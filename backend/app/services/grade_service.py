"""Service responsible for grading transcripts with GPT-4o-mini."""

from __future__ import annotations

from dataclasses import dataclass
from json import loads
from typing import Any, Dict

import httpx

RUBRIC_SYSTEM_PROMPT = (
    "You grade short spoken answers to study prompts. Return JSON only: "
    '{"ease":1|2|3|4,"rationale":"<=120 chars"}. '
    "1=wrong, 2=partial, 3=good, 4=fluent. Be strict but fair."
)


@dataclass
class GradeService:
    """Wrapper around the OpenAI API used for grading."""

    api_key: str | None
    model: str = "gpt-4o-mini"
    endpoint: str = "https://api.openai.com/v1/responses"

    async def grade(self, front: str, back: str, transcript: str) -> Dict[str, Any]:
        """Return an ease score and rationale for the user's transcript.

        When an API key is not configured, the method falls back to a deterministic
        heuristic so that the rest of the pipeline can still be exercised.
        """

        if not self.api_key:
            rationale = "Stub grade (no API key configured)."
            return {"ease": 2, "rationale": rationale}

        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "input": [
                {"role": "system", "content": RUBRIC_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Front: {front}\nCorrect: {back}\nTranscript: {transcript}\nGrade the response."
                    ),
                },
            ],
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(self.endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data: Dict[str, Any] = response.json()

        output = data.get("output", [])
        if not output:
            raise RuntimeError("LLM response missing output field")

        content = output[0].get("content", [])
        if not content:
            raise RuntimeError("LLM response missing content field")

        text = content[0].get("text", "{}").strip()
        parsed = loads(text)
        return {"ease": int(parsed.get("ease", 2)), "rationale": parsed.get("rationale", "")}
