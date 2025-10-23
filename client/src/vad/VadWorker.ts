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

export {};
