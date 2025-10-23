"""Session orchestration logic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional
from uuid import uuid4

from ..utils.audio import decode_base64_audio, sniff_mimetype
from ..utils.text import strip_html
from ..utils.timing import stopwatch


@dataclass
class SessionManager:
    """In-memory tracking of the active review session."""

    session_id: Optional[str] = None
    deck_id: Optional[int] = None
    deck_name: str = ""

    def start(self, deck_id: Optional[int], deck_name: str) -> Dict[str, Any]:
        self.session_id = str(uuid4())
        self.deck_id = deck_id
        self.deck_name = deck_name
        return {"session_id": self.session_id, "deck_name": deck_name}

    def stop(self) -> None:
        self.session_id = None
        self.deck_id = None
        self.deck_name = ""


@dataclass
class SessionService:
    """High-level orchestration of the /api/answer flow."""

    manager: SessionManager

    async def start_session(self, deck_id: Optional[int], anki_service: Any | None = None) -> Dict[str, Any]:
        """Start a new session, using the Anki service to derive the deck name."""

        deck_name = ""
        if anki_service is not None:
            try:
                deck_name = await anki_service.deck_name()
            except Exception:
                deck_name = "Unknown Deck"
        return self.manager.start(deck_id, deck_name)

    async def stop_session(self) -> None:
        """Stop the active session."""

        self.manager.stop()

    async def process_answer(
        self,
        audio_payload: str,
        *,
        mime_type: Optional[str] = None,
        stt: Any,
        grader: Any,
        anki: Any,
        tts: Any,
        client_latency_ms: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Execute the full transcription → grading → marking pipeline."""

        audio_bytes = decode_base64_audio(audio_payload)
        if not audio_bytes:
            raise ValueError("Audio payload was empty")
        if mime_type:
            mimetype = mime_type
            normalized_audio = audio_bytes
        else:
            mimetype, normalized_audio = sniff_mimetype(audio_bytes)
        with stopwatch() as elapsed:
            transcript = await stt.transcribe(normalized_audio, mimetype)
        mimetype, audio_bytes = sniff_mimetype(audio_bytes)
        with stopwatch() as elapsed:
            transcript = await stt.transcribe(audio_bytes, mimetype)
            card = await anki.current_card_snapshot()
            grade = await grader.grade(card["front"], card["back_excerpt"], transcript)
            ease = int(grade.get("ease", 2))
            await anki.show_answer()
            await tts.speak(strip_html(card["back_excerpt"]))
            await anki.answer_card(ease)
            await anki.show_question()
            latency_ms = elapsed()
        return {
            "transcript": transcript,
            "ease": ease,
            "rationale": grade.get("rationale", ""),
            "latency_ms": latency_ms,
            "client_ms": client_latency_ms,
        }
