"""Audio utility helpers."""

from __future__ import annotations

import base64
from typing import Tuple


def decode_base64_audio(payload: str) -> bytes:
    """Decode a base64 audio payload."""

    return base64.b64decode(payload)


def sniff_mimetype(audio: bytes) -> Tuple[str, bytes]:
    """Very small helper to guess MIME type.

    The scaffold implementation inspects the first few bytes and defaults to
    `audio/webm` if no signature is recognized.
    """

    if audio.startswith(b"RIFF"):
        return "audio/wav", audio
    if audio.startswith(b"OggS"):
        return "audio/ogg", audio
    return "audio/webm", audio
