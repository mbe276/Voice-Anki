/* eslint-disable no-restricted-globals */
interface WorkerPayload {
  frame: Float32Array;
  timestamp: number;
}

const SILENCE_FLOOR = 0.01;
const SPEECH_CEIL = 0.25;

self.onmessage = (event: MessageEvent<WorkerPayload>) => {
  const { frame, timestamp } = event.data;
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i += 1) {
    const sample = frame[i];
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / frame.length);
  const normalised = Math.min(1, Math.max(0, (rms - SILENCE_FLOOR) / (SPEECH_CEIL - SILENCE_FLOOR)));
  (self as unknown as Worker).postMessage({ probability: normalised, timestamp });
};

/*
 * Placeholder Web Worker for WebRTC VAD integration.
 * The production implementation will load `webrtc_vad.wasm` and expose
 * message handlers for scoring 20 ms audio frames.
 */

self.onmessage = (event: MessageEvent<Float32Array>) => {
  // TODO: implement WASM-backed VAD scoring.
  const buffer = event.data;
  // Naive stub: treat any non-silent frame as speech.
  const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
  const probability = Math.min(1, rms * 10);
  (self as unknown as Worker).postMessage({ probability, timestamp: performance.now() });
};
export {};
