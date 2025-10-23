"""Operating system text-to-speech helpers."""

from __future__ import annotations

import asyncio
import platform
import shutil
from dataclasses import dataclass


@dataclass
class TextToSpeechService:
    """Abstract interface for text-to-speech operations."""

    async def speak(self, text: str) -> None:
        raise NotImplementedError

    async def pause(self) -> None:
        raise NotImplementedError

    async def resume(self) -> None:
        raise NotImplementedError


@dataclass
class OperatingSystemTTS(TextToSpeechService):
    """Simple cross-platform TTS adapter using built-in utilities."""

    async def speak(self, text: str) -> None:
        system = platform.system().lower()
        if system == "darwin" and shutil.which("say"):
            process = await asyncio.create_subprocess_exec("say", text)
            await process.communicate()
        elif system == "windows" and shutil.which("powershell"):
            script = (
                "Add-Type -AssemblyName System.Speech; "
                f"(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{text}')"
            )
            process = await asyncio.create_subprocess_exec("powershell", "-Command", script)
            await process.communicate()
        elif shutil.which("espeak"):
            process = await asyncio.create_subprocess_exec("espeak", text)
            await process.communicate()
        else:
            # Fallback: log to stdout so the user can see the message.
            print(f"[TTS] {text}")

    async def pause(self) -> None:
        # Placeholder: actual OS integration would control the audio channel.
        return None

    async def resume(self) -> None:
        # Placeholder: nothing to resume in the scaffold implementation.
        return None
