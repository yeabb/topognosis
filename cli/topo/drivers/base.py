"""
Abstract driver interface — the contract any agentic tool must implement
to plug into the topo graph layer.

Claude is the first implementation. Future: Codex, Aider, Gemini CLI, etc.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal

logger = logging.getLogger(__name__)

EventType = Literal[
    "text",         # assistant text output
    "thinking",     # assistant thinking block
    "tool_use",     # tool call initiated
    "tool_result",  # tool call completed
    "result",       # turn complete (includes cost/usage)
    "error",        # error from the driver
    "rate_limit",   # rate limit hit
]


@dataclass
class DriverEvent:
    """Normalized event that any driver emits, regardless of underlying tool."""
    type: EventType
    data: dict[str, Any]
    raw: Any = field(default=None, repr=False)  # original event from the underlying tool


@dataclass
class ToolHookPayload:
    """Passed to pre/post tool hook callbacks."""
    tool_name: str
    tool_input: dict[str, Any]
    tool_use_id: str
    session_id: str | None
    # Only present on PostToolUse:
    tool_output: Any | None = None
    is_error: bool = False


class BaseDriver(ABC):
    """
    Abstract base class for agentic tool drivers.

    A driver wraps a specific agentic tool (Claude, Codex, etc.) and:
      - Manages the connection lifecycle (connect / disconnect)
      - Sends user prompts
      - Streams back normalized DriverEvents
      - Fires pre/post tool hook callbacks so EventCapture can observe everything

    To add a new tool: subclass BaseDriver, implement the abstract methods,
    and register it in session.py's driver factory.
    """

    # Subclasses set this to identify themselves (e.g. "claude", "codex")
    name: str = "unknown"

    def __init__(self) -> None:
        self._pre_tool_hooks: list[Any] = []
        self._post_tool_hooks: list[Any] = []

    # ------------------------------------------------------------------
    # Lifecycle — use as async context manager
    # ------------------------------------------------------------------

    @abstractmethod
    async def connect(self, cwd: str) -> None:
        """Establish connection to the underlying tool."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Tear down the connection cleanly."""

    async def __aenter__(self) -> "BaseDriver":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.disconnect()

    # ------------------------------------------------------------------
    # Communication
    # ------------------------------------------------------------------

    @abstractmethod
    async def send(self, prompt: str) -> None:
        """Send a user prompt to the tool."""

    @abstractmethod
    def receive(self) -> AsyncIterator[DriverEvent]:
        """
        Async-iterate over normalized events for the current turn.
        Terminates after the ResultEvent for this turn.
        """

    # ------------------------------------------------------------------
    # Hook registration — called by EventCapture before connect()
    # ------------------------------------------------------------------

    def register_pre_tool_hook(self, callback: Any) -> None:
        """Register a coroutine callback fired before each tool call."""
        self._pre_tool_hooks.append(callback)

    def register_post_tool_hook(self, callback: Any) -> None:
        """Register a coroutine callback fired after each tool call."""
        self._post_tool_hooks.append(callback)
