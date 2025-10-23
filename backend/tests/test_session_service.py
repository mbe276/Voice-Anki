import asyncio
import base64
import io
import wave

from app.services.session_service import SessionManager, SessionService


class DummyStt:
    async def transcribe(self, audio_data: bytes, mimetype: str | None = None) -> str:
        assert mimetype == 'audio/wav'
        assert len(audio_data) > 44  # WAV header + data
        return 'dummy transcript'


class DummyGrader:
    async def grade(self, front: str, back: str, transcript: str):
        assert transcript == 'dummy transcript'
        assert '<b>' in back
        return {'ease': 3, 'rationale': 'ok'}


class DummyAnki:
    def __init__(self):
        self.answered = None
        self.answer_revealed = False
        self.question_shown = False

    async def current_card_snapshot(self):
        return {
            'card_id': 123,
            'deck': 'Test Deck',
            'front': '<b>Front</b>',
            'back_excerpt': '<b>Back</b>'
        }

    async def show_answer(self):
        self.answer_revealed = True

    async def answer_card(self, ease: int):
        self.answered = ease

    async def show_question(self):
        self.question_shown = True

    async def deck_name(self):  # used when starting a session
        return 'Test Deck'


class DummyTts:
    def __init__(self):
        self.spoken = []

    async def speak(self, text: str):
        self.spoken.append(text)

    async def pause(self):
        return None

    async def resume(self):
        return None


def test_process_answer_pipeline():
    session_service = SessionService(manager=SessionManager())
    stt = DummyStt()
    grader = DummyGrader()
    anki = DummyAnki()
    tts = DummyTts()

    with io.BytesIO() as buffer:
        with wave.open(buffer, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(b'\x00\x00' * 160)
        audio_bytes = buffer.getvalue()

    payload = base64.b64encode(audio_bytes).decode('ascii')

    result = asyncio.run(
        session_service.process_answer(
            audio_payload=payload,
            mime_type='audio/wav',
            stt=stt,
            grader=grader,
            anki=anki,
            tts=tts,
            client_latency_ms=321,
        )
    )

    assert result['transcript'] == 'dummy transcript'
    assert result['ease'] == 3
    assert result['rationale'] == 'ok'
    assert result['client_ms'] == 321
    assert result['latency_ms'] >= 0
    assert anki.answer_revealed is True
    assert anki.answered == 3
    assert anki.question_shown is True
    assert tts.spoken == ['Back']
