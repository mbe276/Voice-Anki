class DownsampleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.outputSampleRate = 16000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
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
