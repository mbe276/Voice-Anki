"""Pydantic models used throughout the backend API."""

from typing import Optional

from pydantic import BaseModel, Field


class SessionStartRequest(BaseModel):
    """Request payload for starting a session."""

    deck_id: Optional[int] = Field(default=None, description="Optional Anki deck identifier")


class SessionStartResponse(BaseModel):
    """Response returned when a session is started."""

    session_id: str
    deck_name: str


class CardSnapshot(BaseModel):
    """Represents the active card shown in Anki."""

    card_id: int
    deck: str
    front: str
    back_excerpt: str


class GenericResponse(BaseModel):
    """Generic success response."""

    ok: bool = True


class AudioAnswerRequest(BaseModel):
    """Simplified answer payload containing base64 encoded audio."""

    audio_base64: str = Field(description="Base64-encoded audio data (temporary scaffold format)")
    client_latency_ms: Optional[int] = Field(default=None, description="Client-measured latency in milliseconds")


class AnswerResponse(BaseModel):
    """Response payload for processed answers."""

    transcript: str
    ease: int
    rationale: str
    latency_ms: int
    client_ms: Optional[int] = Field(default=None)
