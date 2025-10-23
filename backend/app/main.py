"""FastAPI application entry point for the Hands-Free Anki Voice Reviewer backend."""

from fastapi import Depends, FastAPI
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


@app.post("/api/session/start", response_model=models.SessionStartResponse)
async def start_session(
    request: models.SessionStartRequest,
    session_service: SessionService = Depends(get_session_service),
    anki_service: AnkiService = Depends(get_anki_service),
) -> models.SessionStartResponse:
    """Start a new review session."""
    session = await session_service.start_session(deck_id=request.deck_id, anki_service=anki_service)
    return models.SessionStartResponse(**session)


@app.get("/api/card/current", response_model=models.CardSnapshot)
async def get_current_card(
    anki_service: AnkiService = Depends(get_anki_service),
) -> models.CardSnapshot:
    """Return details for the current card shown in Anki."""
    return await anki_service.current_card_snapshot()


@app.post("/api/tts/pause", response_model=models.GenericResponse)
async def pause_tts(tts_service: TextToSpeechService = Depends(get_tts_service)) -> models.GenericResponse:
    """Pause any active text-to-speech playback."""
    await tts_service.pause()
    return models.GenericResponse(ok=True)


@app.post("/api/tts/resume", response_model=models.GenericResponse)
async def resume_tts(tts_service: TextToSpeechService = Depends(get_tts_service)) -> models.GenericResponse:
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
) -> models.AnswerResponse:
    """Process an uploaded answer by running STT, grading, and updating Anki."""
    result = await session_service.process_answer(
        audio_payload=answer.audio_base64,
        stt=stt_service,
        grader=grade_service,
        anki=anki_service,
        tts=tts_service,
        client_latency_ms=answer.client_latency_ms,
    )
    return models.AnswerResponse(**result)


@app.post("/api/session/stop", response_model=models.GenericResponse)
async def stop_session(
    session_service: SessionService = Depends(get_session_service),
) -> models.GenericResponse:
    """Stop the current review session."""
    await session_service.stop_session()
    return models.GenericResponse(ok=True)
