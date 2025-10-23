"""Timing helpers for measuring latency."""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator


@contextmanager
def stopwatch() -> Iterator[callable]:
    """Context manager returning a callable that yields elapsed milliseconds."""

    start = time.perf_counter()

    def elapsed_ms() -> int:
        return int((time.perf_counter() - start) * 1000)

    try:
        yield elapsed_ms
    finally:
        pass
