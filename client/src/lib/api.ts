export interface ApiConfig {
  baseUrl: string;
  authToken?: string;
}

export class ApiClient {
  constructor(private readonly config: ApiConfig) {}

  private headers(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    return headers;
  }

  async getCurrentCard() {
    const response = await fetch(`${this.config.baseUrl}/api/card/current`, {
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`Failed to load current card: ${response.status}`);
    }
    return response.json();
  }

  async startSession(deckId?: number) {
    const response = await fetch(`${this.config.baseUrl}/api/session/start`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ deckId })
    });
    if (!response.ok) {
      throw new Error(`Failed to start session: ${response.status}`);
    }
    return response.json();
  }

  async submitAnswer(audioBase64: string, mimeType: string, clientLatencyMs?: number) {
    const response = await fetch(`${this.config.baseUrl}/api/answer`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        audio_base64: audioBase64,
        mime_type: mimeType,
        client_latency_ms: clientLatencyMs
      })
    });
    if (!response.ok) {
      throw new Error(`Failed to submit answer: ${response.status}`);
    }
    return response.json();
  }
}
