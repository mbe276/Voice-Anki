# Hands-Free Anki Voice Reviewer Design Document

## 1. Executive Summary

Create a hands-free Anki reviewer. The app reads the card, listens for your spoken answer (auto-detected via VAD), transcribes with Whisper, grades with GPT-4o-mini, marks the card in Anki via AnkiConnect, speaks the correct answer locally (OS TTS), and advances.

**Constraints**

- Low latency: ≤ 2.5 seconds after you stop talking.
- Low cost: ≈ $0.22/day at 400 cards.
- Full Anki integration (desktop authority).
- Phone-as-remote UX.

## 2. Objectives

| Objective        | Detail                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| Hands-free loop  | No press-and-hold; client-side VAD auto-captures your answer.                |
| Low cost         | Whisper for STT + GPT-4o-mini for grading + device TTS.                      |
| Low latency      | Target ≤ 2.5 s from end-of-speech to feedback.                               |
| Anki-native      | Use AnkiConnect to read/flip/answer cards; preserve stats/sync.              |
| Multi-device UX  | Phone PWA as mic/controller; desktop runs the session.                       |

## 3. Architecture

```
┌───────────┐   HTTP/JSON (AnkiConnect)   ┌──────────────┐
│ Anki GUI  │<───────────────────────────>│  Backend API │
│ (Desktop) │                              │  (FastAPI)   │
└────┬──────┘                              └──────┬───────┘
     │                                         │
  OS TTS                                   Whisper STT
     │                                         │
     ▼                                     GPT-4o-mini
               <──── WebSocket/REST ────>
                    React PWA (Phone)
                 VAD (WASM) + Worklet
```

Why: Desktop Anki is the source of truth; iOS can’t run add-ons, so the phone is a remote. WAN access supported via VPN/tunnel; otherwise LAN.

## 4. Functional Requirements

| ID  | Feature         | Description                                                                 |
| --- | --------------- | --------------------------------------------------------------------------- |
| F-1 | Start session    | Attach to active Anki deck/queue.                                            |
| F-2 | Speak front/back | Device/OS TTS (no cloud audio-out cost).                                    |
| F-3 | Auto capture     | Browser PWA does client-side VAD; detects start/stop speech; encodes audio. |
| F-4 | Transcribe       | Whisper API; return transcript text.                                        |
| F-5 | Grade            | GPT-4o-mini returns {ease:1–4, rationale} using rubric.                     |
| F-6 | Mark             | `answerCard` (1=Again,2=Hard,3=Good,4=Easy).                                |
| F-7 | Feedback         | Speak back answer; show transcript & rationale; advance.                    |
| F-8 | Metrics          | Latency per stage; daily spend estimates.                                   |
| F-9 | Reliability      | Retries for API; graceful fallbacks for VAD/TTS.                            |

**Non-Goals (MVP)**: No cloud TTS, no mobile-only Anki review, no auto-evaluation based on audio similarity beyond text grading.

## 5. Voice Activity Detection (VAD)

### 5.1 Strategy

- Client-side VAD (WebAssembly WebRTC-VAD) in a Web Worker for 20 ms frames at 16 kHz mono.
- Optional RNNoise or simple spectral gate for noisy environments.
- Downsample to 16 kHz via AudioWorklet; ring buffer keeps ~200 ms pre-roll.

### 5.2 Thresholds

| Parameter          | Default |
| ------------------ | ------- |
| frame              | 20 ms @ 16 kHz mono |
| startProb          | 0.80 for ≥200 ms |
| endProb            | 0.50 for ≥600 ms (hangover) |
| minUtterance       | 0.4 s (discard blips) |
| maxUtterance       | 8.0 s (split or cutoff) |
| postPad            | 0.2 s (include a bit of silence at end) |

### 5.3 Echo Control

```
getUserMedia({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })
```

Mute/duck TTS while ARMED/RECORDING to avoid feedback. Recommend headphones (AirPods).

### 5.4 Client State Machine

- **IDLE**
  - `PREPARE_LISTEN` (init AudioContext/Worklet/Worker, pause TTS)
    - `ARMED` (Listening…)
      - `VAD_START` ⇒ `RECORDING` (start buffer)
      - `TIMEOUT(10s)` ⇒ prompt & remain `ARMED`
      - `STOP` ⇒ `IDLE`
- **RECORDING**
  - `VAD_END` & len≥min ⇒ `FINALIZE`
  - `MAX_LEN` ⇒ `FINALIZE`
  - `STOP` ⇒ `DISCARD` ⇒ `IDLE`
- **FINALIZE**
  - Encode (WEBM/WAV)
  - `POST /api/answer`
  - Spinner; show rationale/ease
  - Return to `ARMED`

## 6. API Design (Backend)

- Protocol: REST (JSON); optional small WebSocket for status events.
- Auth: Local-only by default. If WAN exposed, require Bearer token.

### 6.1 Endpoints

| Method | Path                | Body                    | Response                                            |
| ------ | ------------------- | ----------------------- | --------------------------------------------------- |
| POST   | `/api/session/start`| `{ deckId? }`           | `{ sessionId, deckName }`                           |
| GET    | `/api/card/current` | –                       | `{ cardId, deck, front, back_excerpt }`             |
| POST   | `/api/tts/pause`    | –                       | `{ ok: true }`                                      |
| POST   | `/api/tts/resume`   | –                       | `{ ok: true }`                                      |
| POST   | `/api/answer`       | audio/* (WEBM/WAV)      | `{ transcript, ease, rationale, latency_ms }`       |
| POST   | `/api/session/stop` | –                       | `{ ok: true }`                                      |

#### `/api/answer` Flow

1. Whisper transcribe → transcript.
2. Ask AnkiConnect for current card Q/A (ensure not stale).
3. GPT-4o-mini grade → `{ease, rationale}`.
4. `guiShowAnswer` → OS TTS speak back → `answerCard(ease)` → `guiShowQuestion`.
5. Return JSON with timings.

### 6.2 Grading Prompt

**System prompt**

> You grade short spoken answers to study prompts. Return JSON only: {"ease":1|2|3|4,"rationale":"<=120 chars"}. 1=wrong, 2=partial, 3=good, 4=fluent. Be strict but fair.

**User template**

```
Front: {front}
Correct: {gold}
Transcript: {user}
Grade the response.
```

## 7. Repository Layout

```
anki-voice-reviewer/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                 # FastAPI app, routes
│  │  ├─ config.py               # env, auth, CORS, bind address
│  │  ├─ models.py               # Pydantic schemas
│  │  ├─ services/
│  │  │  ├─ anki_service.py      # AnkiConnect client (guiCurrentCard, answerCard, etc.)
│  │  │  ├─ stt_service.py       # Whisper client
│  │  │  ├─ grade_service.py     # GPT-4o-mini prompt wrapper
│  │  │  ├─ tts_service.py       # OS TTS (macOS say / Windows SAPI / Linux espeak)
│  │  │  └─ session_service.py   # Orchestrates the per-card flow
│  │  ├─ utils/
│  │  │  ├─ audio.py             # validate/convert audio, mime sniffing
│  │  │  └─ timing.py            # latency & cost logging
│  │  └─ deps.py                 # DI for services
│  ├─ tests/                     # unit + integration (mock Anki/Whisper/LLM)
│  ├─ requirements.txt
│  └─ Dockerfile
│
├─ client/
│  ├─ src/
│  │  ├─ vad/
│  │  │  ├─ webrtc_vad.wasm
│  │  │  ├─ VadWorker.ts         # WASM wrapper + frame scoring
│  │  │  ├─ AudioWorklet.js      # downsample 48k→16k; ring buffer
│  │  │  └─ vadController.ts     # thresholds, hangover, state transitions
│  │  ├─ components/
│  │  │  ├─ VoiceCapture.tsx     # replaces hold-to-talk; auto VAD loop
│  │  │  ├─ LevelMeter.tsx
│  │  │  └─ CardHUD.tsx          # front/back snippets; transcript; ease/rationale
│  │  ├─ pages/index.tsx
│  │  ├─ lib/api.ts              # fetch helpers
│  │  ├─ styles.css
│  │  └─ settings.ts             # VAD tunables (with defaults)
│  ├─ public/manifest.json       # PWA
│  ├─ package.json
│  └─ vite.config.ts
│
├─ ops/
│  ├─ docker-compose.yml         # backend; client runs via npm or Nginx
│  ├─ tailscale.md               # VPN setup
│  └─ cloudflared.md             # tunnel setup
│
├─ .env.example                  # OPENAI_API_KEY, BACKEND_URL, ANKI_URL, API_TOKEN
├─ Makefile                      # make dev, make test, make bench
├─ README.md
└─ LICENSE
```

## 8. Settings JSON (UI)

```json
{
  "vad": {
    "startProb": 0.8,
    "endProb": 0.5,
    "startWindowMs": 200,
    "endWindowMs": 600,
    "minUtteranceMs": 400,
    "maxUtteranceMs": 8000,
    "preRollMs": 200,
    "postPadMs": 200,
    "denoise": false,
    "noiseMode": "auto"
  },
  "audio": {
    "sampleRate": 16000,
    "echoCancellation": true,
    "noiseSuppression": true,
    "autoGainControl": true,
    "container": "webm"
  },
  "network": {
    "backendUrl": "http://127.0.0.1:8000",
    "authToken": ""
  },
  "ui": {
    "listenTimeoutMs": 10000,
    "showTranscript": true,
    "speakBackAnswer": true
  }
}
```

## 9. Latency & Cost Targets

| Stage            | Median Latency | Cost/400 cards |
| ---------------- | -------------- | -------------- |
| STT (Whisper)    | 0.7–1.5 s      | ≈ $0.20        |
| LLM (4o-mini)    | 0.2–0.6 s      | ≈ $0.02        |
| TTS (local)      | < 0.3 s start  | $0             |
| **Total**        | **1.2–2.4 s**  | **≈ $0.22/day**|

## 10. Security & Deployment

- Default bind 127.0.0.1; expose to LAN with env flag.
- For WAN/mobile everywhere: Tailscale (preferred) or Cloudflare Tunnel.
- Add Bearer token check on `/api/*` when non-localhost.
- CORS allowlist for PWA origin(s).
- Limit audio payload (e.g., 2 MB), validate MIME, strip metadata.

## 11. Acceptance Criteria

- Complete 10 cards without touching keyboard/mouse: VAD triggers capture, grading happens, card is marked, next card starts.
- False positives (breath/clearing throat) under 400 ms are ignored.
- Median end-of-speech → feedback start ≤ 2.5 s over a 50-card run.
- Anki stats show correct ease updates.
- Logs include per-stage timings and Whisper/LLM usage.
- With headphones, no audible TTS bleed into transcript in quiet room.

## 12. Test Plan

- Quiet vs noisy (pink noise 55–65 dBA) with denoise on/off.
- Soft speech still triggers within ≤300 ms.
- Long answer (>8 s) capped and graded (warn user).
- Network loss mid-upload gracefully retries once.
- Whisper/LLM timeout -> show error toast & allow immediate retry.

## 13. Development Tasks

1. **Phase 1 — Scaffold**
   - Repo, Docker, FastAPI skeleton, AnkiConnect smoke tests.
2. **Phase 2 — VAD Client**
   - AudioWorklet downsampler; `VadWorker` (WASM); `vadController` with thresholds; `LevelMeter`; `VoiceCapture`.
3. **Phase 3 — STT/LLM**
   - `stt_service.py` (Whisper); `grade_service.py` (GPT-4o-mini); rubric; JSON parsing/validation.
4. **Phase 4 — Orchestration & TTS**
   - `session_service.py` to sequence flip → speak → listen → grade → speak back → `answerCard` → next; `tts_service.py` for macOS/Windows/Linux.
5. **Phase 5 — End-to-End**
   - `/api/answer` path; `/api/tts/pause|resume`; PWA wiring; settings panel.
6. **Phase 6 — Security/Deploy**
   - Token auth; CORS; Tailscale/Cloudflared docs; cost/latency benchmark (`make bench`).
7. **Phase 7 — QA**
   - 50-card trial; CSV logs; acceptance test sign-off.

## 14. Illustrative Snippets

### Client: VAD Controller (pseudo)

```ts
// vadController.ts
onScore(prob, tMs) {
  if (state === 'ARMED') {
    startBuf.push(prob, tMs);
    if (startBuf.windowMs >= startWin && startBuf.min() > startProb) {
      beginRecording(tMs);
    }
  } else if (state === 'RECORDING') {
    endBuf.push(prob, tMs);
    if ((endBuf.windowMs >= endWin && endBuf.max() < endProb) || elapsed >= maxUttMs) {
      finalizeUtterance(tMs);
    }
  }
}
```

### Backend: `/api/answer` (sketch)

```python
@router.post("/api/answer")
async def answer(
    audio: UploadFile = File(...),
    x_client_latency_ms: int | None = Header(None),
):
    raw = await audio.read()
    wav = audio_utils.ensure_wav_or_webm(raw)  # validate/convert if needed
    t0 = now()
    transcript = await stt.transcribe(wav)
    card = await anki.current_card()
    info = await anki.cards_info([card["cardId"]])
    front, back = info[0]["question"], info[0]["answer"]
    grade = grader.grade(front, back, transcript)  # {"ease":1..4,"rationale":...}
    await anki.show_answer()
    tts.say(strip_html(back))
    await anki.answer_card(int(grade["ease"]))
    await anki.show_question()
    server_ms = now() - t0
    return {
        "transcript": transcript,
        **grade,
        "latency_ms": server_ms,
        "client_ms": x_client_latency_ms,
    }
```

## 15. Deliverables

- Complete repo as above (backend + client).
- Dockerfile & docker-compose.
- `.env.example` with `OPENAI_API_KEY`, `ANKI_URL`, `BACKEND_URL`, `API_TOKEN`.
- README with LAN/WAN run instructions.
- Bench CSV + short report of latency/cost over 50-card test.
- Short demo video/GIF of a full hands-free loop.

## 16. Timeline (MVP)

| Week | Milestone                                                     |
| ---- | ------------------------------------------------------------- |
| 1    | Backend scaffold + AnkiConnect + client bootstrapped          |
| 2    | VAD pipeline + AudioWorklet + Worker + HUD                    |
| 3    | Whisper + 4o-mini + orchestration + OS TTS                    |
| 4    | Integration, settings UI, logs/benchmarks                     |
| 5    | QA, polish, deployment guide                                  |
