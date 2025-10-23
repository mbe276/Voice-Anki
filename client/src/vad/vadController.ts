import { defaultSettings, VadSettings } from '../settings';

export type VadState = 'IDLE' | 'ARMED' | 'RECORDING';

export interface VadEvent {
  probability: number;
  timestamp: number;
}

export type VadDecision =
  | { type: 'none' }
  | { type: 'start'; timestamp: number }
  | { type: 'stop'; timestamp: number; reason: 'silence' | 'timeout' };

export class VadController {
  private state: VadState = 'IDLE';
  private readonly startWindow: VadEvent[] = [];
  private readonly endWindow: VadEvent[] = [];
  private recordingStartedAt = 0;

  constructor(private readonly settings: VadSettings = defaultSettings.vad) {}

  getState(): VadState {
    return this.state;
  }

  arm(): void {
    this.state = 'ARMED';
    this.startWindow.length = 0;
    this.endWindow.length = 0;
  }

  disarm(): void {
    this.state = 'IDLE';
    this.startWindow.length = 0;
    this.endWindow.length = 0;
  }

  handleScore(event: VadEvent): VadDecision {
    if (this.state === 'ARMED') {
      this.pushWindow(this.startWindow, event, this.settings.startWindowMs);
      if (
        this.windowDuration(this.startWindow) >= this.settings.startWindowMs &&
        this.startWindow.every((sample) => sample.probability >= this.settings.startProb)
      ) {
        this.state = 'RECORDING';
        this.recordingStartedAt = event.timestamp;
        this.endWindow.length = 0;
        return { type: 'start', timestamp: event.timestamp };
      }
      return { type: 'none' };
    }

    if (this.state === 'RECORDING') {
      this.pushWindow(this.endWindow, event, this.settings.endWindowMs);
      const elapsed = event.timestamp - this.recordingStartedAt;
      const windowCovered = this.windowDuration(this.endWindow) >= this.settings.endWindowMs;
      const belowThreshold = this.endWindow.every(
        (sample) => sample.probability < this.settings.endProb
      );
      if (
        elapsed >= this.settings.minUtteranceMs &&
        windowCovered &&
        belowThreshold
      ) {
        this.state = 'ARMED';
        return { type: 'stop', timestamp: event.timestamp, reason: 'silence' };
      }

      if (elapsed >= this.settings.maxUtteranceMs) {
        this.state = 'ARMED';
        return { type: 'stop', timestamp: event.timestamp, reason: 'timeout' };
      }

      return { type: 'none' };
    }

    return { type: 'none' };
  }

  private pushWindow(window: VadEvent[], event: VadEvent, windowMs: number): void {
    window.push(event);
    const cutoff = event.timestamp - windowMs;
    while (window.length && window[0].timestamp < cutoff) {
      window.shift();
    }
  }

  private windowDuration(window: VadEvent[]): number {
    if (window.length < 2) {
      return 0;
    }
    return window[window.length - 1].timestamp - window[0].timestamp;
  }
}
