import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LevelMeter } from './LevelMeter';
import { VadController, VadDecision } from '../vad/vadController';
import { defaultSettings } from '../settings';

export type CaptureState =
  | 'IDLE'
  | 'PREPARING'
  | 'ARMED'
  | 'RECORDING'
  | 'POSTROLL'
  | 'FINALIZING'
  | 'ERROR';

interface VoiceCaptureProps {
  onFinalize: (blob: Blob, meta: { durationMs: number }) => Promise<void> | void;
  onStateChange?: (state: CaptureState) => void;
}

interface AudioRuntimeState {
  context: AudioContext | null;
  worker: Worker | null;
  worklet: AudioWorkletNode | null;
  stream: MediaStream | null;
  controller: VadController | null;
  preRoll: Float32Array[];
  recorded: Float32Array[];
  recording: boolean;
  awaitingFinalize: boolean;
  postFramesRemaining: number;
  frameDurationMs: number;
  maxPreRollFrames: number;
  postPadFrames: number;
  recordingStartedAt: number;
  lastFrameTimestamp: number;
  finalizing: boolean;
}

const initialAudioState: AudioRuntimeState = {
  context: null,
  worker: null,
  worklet: null,
  stream: null,
  controller: null,
  preRoll: [],
  recorded: [],
  recording: false,
  awaitingFinalize: false,
  postFramesRemaining: 0,
  frameDurationMs: 0,
  maxPreRollFrames: 1,
  postPadFrames: 0,
  recordingStartedAt: 0,
  lastFrameTimestamp: 0,
  finalizing: false
};

function encodeWav(frames: Float32Array[], sampleRate: number): Blob {
  const totalSamples = frames.reduce((acc, frame) => acc + frame.length, 0);
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  frames.forEach((frame) => {
    for (let i = 0; i < frame.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, frame[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  });

  return new Blob([buffer], { type: 'audio/wav' });
}

export function VoiceCapture({ onFinalize, onStateChange }: VoiceCaptureProps) {
  const [state, setState] = useState<CaptureState>('IDLE');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<AudioRuntimeState>({ ...initialAudioState });
  const stateRef = useRef<CaptureState>('IDLE');

  const setCaptureState = useCallback(
    (next: CaptureState) => {
      const previous = stateRef.current;
      stateRef.current = next;
      setState(next);
      if (next === 'ARMED' && previous !== 'ERROR') {
        setError(null);
      }
      onStateChange?.(next);
    },
    [onStateChange]
  );

  const finalizeRecording = useCallback(async () => {
    const runtime = audioRef.current;
    if (runtime.finalizing) {
      return;
    }
    runtime.finalizing = true;
    runtime.awaitingFinalize = false;
    runtime.recording = false;

    const frames = runtime.recorded.splice(0, runtime.recorded.length);
    const durationMs = Math.max(0, Math.round(runtime.lastFrameTimestamp - runtime.recordingStartedAt));

    if (frames.length === 0) {
      runtime.finalizing = false;
      runtime.preRoll.length = 0;
      runtime.postFramesRemaining = 0;
      if (runtime.controller) {
        runtime.controller.arm();
      }
      setCaptureState('ARMED');
      return;
    }

    const blob = encodeWav(frames, defaultSettings.audio.sampleRate);
    setCaptureState('FINALIZING');

    try {
      await onFinalize(blob, { durationMs });
      runtime.preRoll.length = 0;
      runtime.postFramesRemaining = 0;
      if (runtime.controller) {
        runtime.controller.arm();
      }
      setCaptureState('ARMED');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      setError(message);
      if (runtime.controller) {
        runtime.controller.arm();
      }
      setCaptureState('ERROR');
      setCaptureState('ARMED');
    } finally {
      runtime.finalizing = false;
    }
  }, [onFinalize, setCaptureState]);

  const handleVadDecision = useCallback(
    (decision: VadDecision) => {
      const runtime = audioRef.current;
      if (!runtime.controller) {
        return;
      }

      if (decision.type === 'start') {
        runtime.recording = true;
        runtime.awaitingFinalize = false;
        runtime.recordingStartedAt = decision.timestamp;
        runtime.recorded.length = 0;
        runtime.recorded.push(...runtime.preRoll);
        runtime.preRoll.length = 0;
        setCaptureState('RECORDING');
        return;
      }

      if (decision.type === 'stop') {
        runtime.awaitingFinalize = true;
        runtime.postFramesRemaining = runtime.postPadFrames;
        runtime.controller.disarm();
        setCaptureState('POSTROLL');
        if (runtime.postPadFrames === 0) {
          void finalizeRecording();
        }
      }
    },
    [finalizeRecording, setCaptureState]
  );

  const handleFrame = useCallback(
    (frame: Float32Array, timestamp: number) => {
      const runtime = audioRef.current;
      if (!runtime.worker) {
        return;
      }

      const copy = new Float32Array(frame);
      runtime.lastFrameTimestamp = timestamp;

      if (runtime.frameDurationMs === 0) {
        runtime.frameDurationMs = (copy.length / defaultSettings.audio.sampleRate) * 1000;
        runtime.maxPreRollFrames = Math.max(
          1,
          Math.round(defaultSettings.vad.preRollMs / runtime.frameDurationMs)
        );
        runtime.postPadFrames = Math.max(
          0,
          Math.round(defaultSettings.vad.postPadMs / runtime.frameDurationMs)
        );
      }

      const rms = Math.sqrt(copy.reduce((acc, value) => acc + value * value, 0) / copy.length);
      const smoothed = Math.max(0, Math.min(1, rms * 4));
      setLevel((prev) => prev * 0.7 + smoothed * 0.3);

      if (runtime.recording || runtime.awaitingFinalize) {
        runtime.recorded.push(copy);
      } else {
        runtime.preRoll.push(copy);
        if (runtime.preRoll.length > runtime.maxPreRollFrames) {
          runtime.preRoll.shift();
        }
      }

      if (runtime.awaitingFinalize) {
        if (runtime.postFramesRemaining > 0) {
          runtime.postFramesRemaining -= 1;
        }
        if (runtime.postFramesRemaining <= 0 && !runtime.finalizing) {
          void finalizeRecording();
        }
      }

      runtime.worker.postMessage({ frame: copy, timestamp });
    },
    [finalizeRecording]
  );

  useEffect(() => {
    let cancelled = false;
    const runtime = audioRef.current;

    const setup = async () => {
      setCaptureState('PREPARING');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: defaultSettings.audio.echoCancellation,
            noiseSuppression: defaultSettings.audio.noiseSuppression,
            autoGainControl: defaultSettings.audio.autoGainControl
          }
        });

        const context = new AudioContext({ latencyHint: 'interactive' });
        await context.audioWorklet.addModule(new URL('../vad/AudioWorklet.js', import.meta.url));
        await context.resume();

        const source = context.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(context, 'downsample-processor', {
          numberOfOutputs: 0
        });
        source.connect(worklet);

        const worker = new Worker(new URL('../vad/VadWorker.ts', import.meta.url), {
          type: 'module'
        });

        runtime.context = context;
        runtime.stream = stream;
        runtime.worklet = worklet;
        runtime.worker = worker;
        runtime.controller = new VadController();
        runtime.controller.arm();

        worklet.port.onmessage = (event: MessageEvent<{ frame: Float32Array; timestamp: number }>) => {
          handleFrame(event.data.frame, event.data.timestamp);
        };

        worker.onmessage = (event: MessageEvent<{ probability: number; timestamp: number }>) => {
          const decision = runtime.controller?.handleScore(event.data) ?? { type: 'none' };
          if (decision.type !== 'none') {
            handleVadDecision(decision);
          }
        };

        if (!cancelled) {
          setCaptureState('ARMED');
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Microphone initialization failed';
          setError(message);
          setCaptureState('ERROR');
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      runtime.controller?.disarm();
      runtime.controller = null;
      if (runtime.worker) {
        runtime.worker.terminate();
      }
      runtime.worker = null;
      if (runtime.worklet) {
        runtime.worklet.port.onmessage = null;
        runtime.worklet.disconnect();
      }
      runtime.worklet = null;
      if (runtime.stream) {
        runtime.stream.getTracks().forEach((track) => track.stop());
      }
      runtime.stream = null;
      if (runtime.context) {
        void runtime.context.close();
      }
      runtime.context = null;
    };
  }, [handleFrame, handleVadDecision, setCaptureState]);

  const statusText = useMemo(() => {
    switch (state) {
      case 'PREPARING':
        return 'Preparing microphone…';
      case 'RECORDING':
        return 'Recording answer…';
      case 'POSTROLL':
        return 'Wrapping up…';
      case 'FINALIZING':
        return 'Uploading response…';
      case 'ERROR':
        return error ?? 'An error occurred';
      default:
        return 'Listening';
    }
  }, [error, state]);

  return (
    <div className="voice-capture">
      <div className="status">State: {statusText}</div>
      <LevelMeter level={level} />
      <p className="hint">Speak your answer; voice detection will trigger automatically.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
import { useEffect, useRef, useState } from 'react';
import { LevelMeter } from './LevelMeter';
import { VadController } from '../vad/vadController';

interface VoiceCaptureProps {
  onFinalize: (blob: Blob) => void;
}

export function VoiceCapture({ onFinalize }: VoiceCaptureProps) {
  const [state, setState] = useState('IDLE');
  const [level] = useState(0);
  const controllerRef = useRef<VadController | null>(null);

  useEffect(() => {
    controllerRef.current = new VadController(
      () => setState('RECORDING'),
      () => setState('FINALIZE')
    );
    controllerRef.current.arm();
    setState(controllerRef.current.getState());
  }, []);

  useEffect(() => {
    if (state !== 'FINALIZE') return;
    // TODO: export captured audio. For now emit an empty Blob placeholder.
    onFinalize(new Blob());
    setState('ARMED');
  }, [state, onFinalize]);

  return (
    <div className="voice-capture">
      <div className="status">State: {state}</div>
      <LevelMeter level={level} />
      <p className="hint">Speak your answer; VAD will auto-detect.</p>
    </div>
  );
}
