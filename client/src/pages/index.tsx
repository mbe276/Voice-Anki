import { useCallback, useEffect, useState } from 'react';
import { ApiClient } from '../lib/api';
import { defaultSettings } from '../settings';
import { VoiceCapture } from '../components/VoiceCapture';
import { CardHUD } from '../components/CardHUD';

const apiClient = new ApiClient({
  baseUrl: defaultSettings.network.backendUrl,
  authToken: defaultSettings.network.authToken
});

interface CardState {
  deck: string;
  front: string;
}

interface AnswerState {
  transcript?: string;
  rationale?: string;
  ease?: number;
}

export function App() {
  const [card, setCard] = useState<CardState | null>(null);
  const [answer, setAnswer] = useState<AnswerState>({});
  const [status, setStatus] = useState('Initializing…');

  const loadCard = useCallback(async () => {
    try {
      const snapshot = await apiClient.getCurrentCard();
      setCard({ deck: snapshot.deck, front: snapshot.front });
      setStatus('Listening');
    } catch (error) {
      console.error(error);
      setStatus('Failed to load card');
    }
  }, []);

  useEffect(() => {
    apiClient
      .startSession()
      .then(loadCard)
      .catch((error) => {
        console.error(error);
        setStatus('Failed to start session');
      });
  }, [loadCard]);

  const handleFinalize = useCallback(
    async (blob: Blob) => {
      setStatus('Processing answer…');
      const base64 = await blobToBase64(blob);
      try {
        const result = await apiClient.submitAnswer(base64);
        setAnswer({
          transcript: result.transcript,
          rationale: result.rationale,
          ease: result.ease
        });
        setStatus('Listening');
      } catch (error) {
        console.error(error);
        setStatus('Failed to submit answer');
      }
    },
    []
  );

  const deckName = card?.deck ?? 'Loading…';
  const front = card?.front ?? '';

  return (
    <main className="app-shell">
      <h1>Hands-Free Anki Voice Reviewer</h1>
      <p className="status">Status: {status}</p>
      <CardHUD deckName={deckName} front={front} {...answer} />
      <VoiceCapture onFinalize={handleFinalize} />
    </main>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (blob.size === 0) {
    return '';
  }
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
