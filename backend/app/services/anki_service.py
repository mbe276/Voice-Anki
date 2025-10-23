"""Service abstraction for interacting with AnkiConnect."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import httpx


@dataclass
class AnkiConnectClient:
    """Minimal HTTP client for AnkiConnect."""

    base_url: str
    timeout: float = 10.0

    async def invoke(self, action: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Invoke an AnkiConnect action.

        The scaffold implementation uses a simple HTTP POST. Errors are
        propagated to the caller to make debugging easier.
        """

        payload = {"action": action, "params": params or {}, "version": 6}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(self.base_url, json=payload)
            response.raise_for_status()
            data: Dict[str, Any] = response.json()
            if data.get("error"):
                raise RuntimeError(f"AnkiConnect error: {data['error']}")
            return data["result"]


@dataclass
class AnkiService:
    """Higher-level utilities for working with the current card."""

    client: AnkiConnectClient
    _cached_deck: str = field(default="", init=False)

    async def current_card_snapshot(self) -> Dict[str, Any]:
        """Return front/back metadata for the active card.

        This function issues two AnkiConnect requests: `guiCurrentCard` to get
        the card identifier and deck, followed by `cardsInfo` to retrieve the
        question/answer HTML.
        """

        card = await self.client.invoke("guiCurrentCard")
        card_id = card["cardId"]
        self._cached_deck = card.get("deckName", "")
        info = await self.client.invoke("cardsInfo", {"cards": [card_id]})
        first = info[0]
        return {
            "card_id": card_id,
            "deck": self._cached_deck,
            "front": first.get("question", ""),
            "back_excerpt": first.get("answer", ""),
        }

    async def answer_card(self, ease: int) -> None:
        """Submit an ease value for the current card."""

        await self.client.invoke("guiAnswerCard", {"ease": ease})

    async def show_answer(self) -> None:
        """Reveal the answer in the Anki UI."""

        await self.client.invoke("guiShowAnswer")

    async def show_question(self) -> None:
        """Return the Anki UI to the question side of the card."""

        await self.client.invoke("guiShowQuestion")

    async def deck_name(self) -> str:
        """Return the cached deck name if available."""

        if not self._cached_deck:
            card = await self.client.invoke("guiCurrentCard")
            self._cached_deck = card.get("deckName", "")
        return self._cached_deck
