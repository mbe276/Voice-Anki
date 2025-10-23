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
