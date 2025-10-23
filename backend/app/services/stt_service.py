"""Speech-to-text service using OpenAI Whisper."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

import httpx


@dataclass
class SpeechToTextService:
    """Abstract base for STT operations."""

    async def transcribe(self, audio_data: bytes, mimetype: str | None = None) -> str:
        raise NotImplementedError


@dataclass
class WhisperSpeechToText(SpeechToTextService):
    """Implementation that calls the Whisper API."""

    api_key: str | None
    endpoint: str = "https://api.openai.com/v1/audio/transcriptions"
    model: str = "whisper-1"

    async def transcribe(self, audio_data: bytes, mimetype: str | None = None) -> str:
        if not self.api_key:
            return "(transcription unavailable - no API key)"

        headers = {"Authorization": f"Bearer {self.api_key}"}
        files = {"file": ("audio.webm", audio_data, mimetype or "audio/webm")}
        data = {"model": self.model}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.endpoint, data=data, files=files, headers=headers)
            response.raise_for_status()
            payload: Dict[str, Any] = response.json()
        return payload.get("text", "")
