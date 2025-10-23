# Hands-Free Anki Voice Reviewer

Hands-Free Anki Voice Reviewer is a dual-backend/frontend project that enables reviewing Anki flashcards using only your voice. The desktop backend integrates with the official Anki application through AnkiConnect, orchestrates speech transcription and grading, and plays back answers using operating system text-to-speech. A companion progressive web app running on a phone serves as the microphone and controller, using client-side voice activity detection (VAD) to automatically detect when you answer.

This repository is organized as a monorepo that contains:

- A **FastAPI backend** that exposes a REST API for orchestrating card review, Whisper transcription, GPT-4o-mini grading, and AnkiConnect automation.
- A **React + Vite client** that implements the phone PWA, including a WebAssembly-based VAD pipeline and heads-up display for current card status and feedback.
- **Operations documentation** for running the system locally, on a LAN, or over secure tunnels.

The full system architecture, requirements, and development roadmap are documented in [`docs/hands-free-anki-voice-reviewer.md`](docs/hands-free-anki-voice-reviewer.md).

## Getting Started

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Client (in another shell)
cd client
npm install
npm run dev
```

For detailed instructions, configuration options, and architectural background, refer to the design document in the `docs/` directory.
