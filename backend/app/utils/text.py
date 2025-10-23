"""Text manipulation helpers."""

from __future__ import annotations

import re

HTML_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(value: str) -> str:
    """Remove HTML tags from a string."""

    return HTML_TAG_RE.sub(" ", value).strip()
