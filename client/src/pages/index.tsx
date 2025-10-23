import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClient } from '../lib/api';
import { defaultSettings } from '../settings';
import { VoiceCapture, CaptureState } from '../components/VoiceCapture';
import { CardHUD } from '../components/CardHUD';

const apiClient = new ApiClient({
  baseUrl: defaultSettings.network.backendUrl,
  authToken: defaultSettings.network.authToken
});

interface CardState {
  id: number;
  deck: string;
  front: string;
}

interface AnswerState {
  transcript?: string;
  rationale?: string;
  ease?: number;
  latency_ms?: number;
}

export function App() {
  const [card, setCard] = useState<CardState | null>(null);
  const [answer, setAnswer] = useState<AnswerState>({});
  const [status, setStatus] = useState('Initializing…');
  const statusLockRef = useRef(false);

  const loadCurrentCard = useCallback(async () => {
    try {
      const snapshot = await apiClient.getCurrentCard();
      setCard({ id: snapshot.card_id, deck: snapshot.deck, front: snapshot.front });
      setAnswer({});
      setStatus('Listening');
    } catch (error) {
      console.error(error);
      setStatus('Failed to load card');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      setStatus('Connecting to Anki…');
      try {
        const session = await apiClient.startSession();
        if (mounted) {
          setStatus(`Attached to ${session.deck_name}`);
          await loadCurrentCard();
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setStatus('Failed to start session');
        }
      }
    };
    void start();
    return () => {
      mounted = false;
    };
  }, [loadCurrentCard]);

  const handleCaptureStateChange = useCallback(
    (captureState: CaptureState) => {
      if (statusLockRef.current) {
        return;
      }
      const nextStatus: Record<CaptureState, string> = {
        IDLE: 'Idle',
        PREPARING: 'Preparing microphone…',
        ARMED: 'Listening',
        RECORDING: 'Recording answer…',
        POSTROLL: 'Wrapping up…',
        FINALIZING: 'Uploading audio…',
        ERROR: 'Microphone error – tap to retry'
      };
      setStatus(nextStatus[captureState]);
    },
    []
  );

  const handleFinalize = useCallback(
    async (blob: Blob, _meta: { durationMs: number }) => {
      if (blob.size === 0) {
        setStatus('No audio captured');
        return;
      }
      statusLockRef.current = true;
      setStatus('Processing answer…');
      const startedAt = performance.now();
      try {
        const base64 = await blobToBase64(blob);
        const result = await apiClient.submitAnswer(base64, blob.type || 'audio/wav', Math.round(performance.now() - startedAt));
        setAnswer({
          transcript: result.transcript,
          rationale: result.rationale,
          ease: result.ease,
          latency_ms: result.latency_ms
        });
        await loadCurrentCard();
        setStatus('Listening');
      } catch (error) {
        console.error(error);
        setStatus('Failed to submit answer');
      } finally {
        statusLockRef.current = false;
      }
    },
    [loadCurrentCard]
  );

  const deckName = useMemo(() => card?.deck ?? 'Loading…', [card]);
  const front = card?.front ?? '';

  return (
    <main className="app-shell">
      <h1>Hands-Free Anki Voice Reviewer</h1>
      <p className="status">Status: {status}</p>
      <CardHUD deckName={deckName} front={front} {...answer} />
      <VoiceCapture onFinalize={handleFinalize} onStateChange={handleCaptureStateChange} />
    </main>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
