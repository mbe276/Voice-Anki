"""FastAPI application entry point for the Hands-Free Anki Voice Reviewer backend."""

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .config import settings
from .deps import (
    get_anki_service,
    get_grade_service,
    get_session_service,
    get_stt_service,
    get_tts_service,
)
from .services.anki_service import AnkiService
from .services.grade_service import GradeService
from .services.session_service import SessionService
from .services.stt_service import SpeechToTextService
from .services.tts_service import TextToSpeechService

app = FastAPI(title="Hands-Free Anki Voice Reviewer", version="0.1.0")

if settings.allow_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def require_auth(authorization: str | None = Header(default=None)) -> None:
    """Validate the bearer token if one is configured."""

    if not settings.api_token:
        return None
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    if token != settings.api_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@app.post("/api/session/start", response_model=models.SessionStartResponse)
async def start_session(
    request: models.SessionStartRequest,
    session_service: SessionService = Depends(get_session_service),
    anki_service: AnkiService = Depends(get_anki_service),
    _: None = Depends(require_auth),
) -> models.SessionStartResponse:
    """Start a new review session."""
    session = await session_service.start_session(deck_id=request.deck_id, anki_service=anki_service)
    return models.SessionStartResponse(**session)


@app.get("/api/card/current", response_model=models.CardSnapshot)
async def get_current_card(
    anki_service: AnkiService = Depends(get_anki_service),
    _: None = Depends(require_auth),
) -> models.CardSnapshot:
    """Return details for the current card shown in Anki."""
    return await anki_service.current_card_snapshot()


@app.post("/api/tts/pause", response_model=models.GenericResponse)
async def pause_tts(
    tts_service: TextToSpeechService = Depends(get_tts_service),
    _: None = Depends(require_auth),
) -> models.GenericResponse:
    """Pause any active text-to-speech playback."""
    await tts_service.pause()
    return models.GenericResponse(ok=True)


@app.post("/api/tts/resume", response_model=models.GenericResponse)
async def resume_tts(
    tts_service: TextToSpeechService = Depends(get_tts_service),
    _: None = Depends(require_auth),
) -> models.GenericResponse:
    """Resume text-to-speech playback if supported."""
    await tts_service.resume()
    return models.GenericResponse(ok=True)


@app.post("/api/answer", response_model=models.AnswerResponse)
async def submit_answer(
    answer: models.AudioAnswerRequest,
    session_service: SessionService = Depends(get_session_service),
    stt_service: SpeechToTextService = Depends(get_stt_service),
    grade_service: GradeService = Depends(get_grade_service),
    anki_service: AnkiService = Depends(get_anki_service),
    tts_service: TextToSpeechService = Depends(get_tts_service),
    _: None = Depends(require_auth),
) -> models.AnswerResponse:
    """Process an uploaded answer by running STT, grading, and updating Anki."""
    try:
        result = await session_service.process_answer(
            audio_payload=answer.audio_base64,
            mime_type=answer.mime_type,
            stt=stt_service,
            grader=grade_service,
            anki=anki_service,
            tts=tts_service,
            client_latency_ms=answer.client_latency_ms,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return models.AnswerResponse(**result)


@app.post("/api/session/stop", response_model=models.GenericResponse)
async def stop_session(
    session_service: SessionService = Depends(get_session_service),
    _: None = Depends(require_auth),
) -> models.GenericResponse:
    """Stop the current review session."""
    await session_service.stop_session()
    return models.GenericResponse(ok=True)
