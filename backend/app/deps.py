"""Dependency injection helpers for FastAPI."""

from functools import lru_cache

from .config import settings
from .services.anki_service import AnkiConnectClient, AnkiService
from .services.grade_service import GradeService
from .services.session_service import SessionManager, SessionService
from .services.stt_service import SpeechToTextService, WhisperSpeechToText
from .services.tts_service import OperatingSystemTTS, TextToSpeechService


@lru_cache()
def get_anki_service() -> AnkiService:
    """Return a singleton instance of the Anki service."""
    client = AnkiConnectClient(base_url=str(settings.anki_url))
    return AnkiService(client=client)


@lru_cache()
def get_stt_service() -> SpeechToTextService:
    """Return the configured speech-to-text implementation."""
    return WhisperSpeechToText(api_key=settings.openai_api_key)


@lru_cache()
def get_grade_service() -> GradeService:
    """Return the grading service wrapper."""
    return GradeService(api_key=settings.openai_api_key)


@lru_cache()
def get_tts_service() -> TextToSpeechService:
    """Return an operating system TTS adapter."""
    return OperatingSystemTTS()


@lru_cache()
def get_session_service() -> SessionService:
    """Return the session orchestrator."""
    return SessionService(manager=SessionManager())
