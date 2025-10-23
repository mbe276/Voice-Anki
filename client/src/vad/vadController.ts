import { defaultSettings } from '../settings';

export type VadState = 'IDLE' | 'PREPARE_LISTEN' | 'ARMED' | 'RECORDING' | 'FINALIZE';

export interface VadEvent {
  probability: number;
  timestamp: number;
}

export class VadController {
  private state: VadState = 'IDLE';

  constructor(private onStart: () => void, private onStop: () => void) {}

  getState() {
    return this.state;
  }

  arm() {
    if (this.state !== 'IDLE') return;
    this.state = 'ARMED';
  }

  handleScore(event: VadEvent) {
    if (this.state === 'ARMED' && event.probability >= defaultSettings.vad.startProb) {
      this.state = 'RECORDING';
      this.onStart();
    } else if (this.state === 'RECORDING' && event.probability < defaultSettings.vad.endProb) {
      this.state = 'FINALIZE';
      this.onStop();
      this.state = 'ARMED';
    }
  }
}
