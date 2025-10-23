export interface VadSettings {
  startProb: number;
  endProb: number;
  startWindowMs: number;
  endWindowMs: number;
  minUtteranceMs: number;
  maxUtteranceMs: number;
  preRollMs: number;
  postPadMs: number;
  denoise: boolean;
  noiseMode: 'auto' | 'off' | 'aggressive';
}

export interface AudioSettings {
  sampleRate: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  container: 'webm' | 'wav';
}

export interface NetworkSettings {
  backendUrl: string;
  authToken?: string;
}

export interface UiSettings {
  listenTimeoutMs: number;
  showTranscript: boolean;
  speakBackAnswer: boolean;
}

export interface AppSettings {
  vad: VadSettings;
  audio: AudioSettings;
  network: NetworkSettings;
  ui: UiSettings;
}

export const defaultSettings: AppSettings = {
  vad: {
    startProb: 0.8,
    endProb: 0.5,
    startWindowMs: 200,
    endWindowMs: 600,
    minUtteranceMs: 400,
    maxUtteranceMs: 8000,
    preRollMs: 200,
    postPadMs: 200,
    denoise: false,
    noiseMode: 'auto'
  },
  audio: {
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    container: 'webm'
  },
  network: {
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
    authToken: import.meta.env.VITE_AUTH_TOKEN
  },
  ui: {
    listenTimeoutMs: 10000,
    showTranscript: true,
    speakBackAnswer: true
  }
};
