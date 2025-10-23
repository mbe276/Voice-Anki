class DownsampleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.outputSampleRate = 16000;
    this.frameSize = Math.round(this.outputSampleRate / 50); // 20 ms frames
    this.downsampled = new Float32Array(this.frameSize);
    this.offset = 0;
    this.stride = sampleRate / this.outputSampleRate;
    this.phase = 0;
    this.buffer = [];
    this.outputSampleRate = 16000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
    for (let i = 0; i < channel.length; i += 1) {
      this.phase += 1;
      if (this.phase >= this.stride) {
        this.phase -= this.stride;
        this.downsampled[this.offset] = channel[i];
        this.offset += 1;
        if (this.offset >= this.frameSize) {
          const frame = this.downsampled.slice(0);
          const timestamp = (currentFrame / sampleRate) * 1000;
          this.port.postMessage({ frame, timestamp });
          this.offset = 0;
        }
      }
    const step = Math.max(1, Math.floor(sampleRate / this.outputSampleRate));
    for (let i = 0; i < channel.length; i += step) {
      this.buffer.push(channel[i]);
    }
    if (this.buffer.length >= this.outputSampleRate / 50) {
      this.port.postMessage(this.buffer.splice(0));
    }
    return true;
  }
}

registerProcessor('downsample-processor', DownsampleProcessor);
