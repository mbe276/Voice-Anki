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
