# Developer Setup Guide

This document describes how to run the Hands-Free Anki Voice Reviewer in a local development environment. Follow these steps after cloning the repository.

## 1. Prerequisites

- **Python 3.11+** (the backend uses FastAPI and httpx)
- **Node.js 18+** (for the Vite/React client)
- **Anki Desktop** running on the same machine with the [AnkiConnect](https://foosoft.net/projects/anki-connect/) add-on installed and listening on `http://127.0.0.1:8765` (Anki must remain open during testing)
- **OpenAI API key** with access to Whisper (`whisper-1`) and GPT-4o-mini (optional for offline testing, but required for production-quality grading/transcription)
- Optional: `espeak`, `say`, or PowerShell on the host OS for text-to-speech playback

## 2. Environment Configuration

1. Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:

   | Variable | Description |
   | --- | --- |
   | `OPENAI_API_KEY` | Required for live Whisper + GPT-4o-mini calls. Leave blank to use deterministic mock grading/transcription. |
   | `ANKI_URL` | URL of the AnkiConnect endpoint (default `http://127.0.0.1:8765`). |
   | `BACKEND_HOST` / `BACKEND_PORT` | Address and port that FastAPI binds to. |
   | `API_TOKEN` | Optional bearer token required on all API calls when set. |
   | `ALLOW_ORIGINS` | Comma separated list of client origins allowed by CORS (e.g. `http://localhost:5173`). |
   | `VITE_BACKEND_URL` | URL that the client uses to reach the backend (default `http://127.0.0.1:8000`). |
   | `VITE_AUTH_TOKEN` | Optional bearer token that matches `API_TOKEN` when auth is enabled. |

## 3. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
pip install --upgrade pip
pip install -r requirements.txt

# Run the FastAPI server with autoreload
uvicorn app.main:app --reload --host $BACKEND_HOST --port $BACKEND_PORT
```

The backend exposes the REST API documented in `docs/hands-free-anki-voice-reviewer.md`. When `API_TOKEN` is defined, every request must include `Authorization: Bearer <token>`.

## 4. Client Setup

```bash
cd client
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Vite prints a local development URL (typically `http://127.0.0.1:5173`). Open it on your phone or desktop browser. Grant microphone permission when prompted. The voice capture pipeline automatically detects speech, records a WAV snippet, and sends it to the backend.

## 5. Text-to-Speech Integration

The backend uses OS-provided TTS utilities:

- macOS: `say`
- Windows: PowerShell + SAPI
- Linux: `espeak`

Ensure one of these commands is available on the host system. If none are found, the backend logs the answer text to stdout instead of speaking it aloud.

## 6. Testing & Tooling

- **Unit tests**: `cd backend && pytest`
- **Client type check**: `cd client && npm run build`
- **Backend lint placeholder**: `make lint` (prints a TODO until linting is configured)

## 7. Development Tips

- Keep Anki focused on the deck you want to review; the backend calls `guiCurrentCard`, `guiShowAnswer`, and `guiShowQuestion` during the loop.
- When testing without an OpenAI key, the backend returns deterministic transcripts and heuristic grades so that the full flow can be exercised.
- Configure WAN access via the guides in `ops/tailscale.md` or `ops/cloudflared.md`. Always set `API_TOKEN` when exposing the API beyond `localhost`.

Happy building!
