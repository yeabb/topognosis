"""
EventCapture — records every event in the session as a delta_event.
Writes a local JSONL append-log for crash safety and streams to the backend.

Three event sources:
  1. User messages     — record_user_message() called from session.py before send()
  2. Assistant text    — record_driver_event() called from session.py for each DriverEvent
  3. Tool calls        — pre/post hooks registered on the driver (fire mid-response)

Each event gets a uuid + parent_event_id forming a linked list, so the full
conversation can be reconstructed in order and branching points are precise.

All events hit the local JSONL log first, then the backend — local log is
the source of truth on crash.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .backend import BackendClient
    from .drivers.base import BaseDriver, DriverEvent, ToolHookPayload

logger = logging.getLogger(__name__)

# Tools that mutate filesystem state and warrant a world-state snapshot
SIDE_EFFECTING_TOOLS = {
    "Edit", "Write", "MultiEdit", "NotebookEdit",
    "Bash",  # conservative — not all Bash calls are side-effecting,
             # but we snapshot after all of them and let SnapshotManager dedupe
}

SESSIONS_DIR = Path.home() / ".topo" / "sessions"


class EventCapture:
    """
    Observes every tool call the driver makes and records it as a delta_event.

    Usage:
        capture = EventCapture(backend, graph_id, node_id, session_id)
        capture.register(driver)   # before driver.connect()
        # ... run session ...
        capture.close()
    """

    def __init__(
        self,
        backend: "BackendClient",
        graph_id: str,
        node_id: str,
        session_id: str,
    ) -> None:
        self._backend = backend
        self._graph_id = graph_id
        self._node_id = node_id
        self._session_id = session_id
        self._last_event_id: str | None = None

        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        self._log_path = SESSIONS_DIR / f"{session_id}.jsonl"
        self._log_file = self._log_path.open("a", encoding="utf-8")
        logger.debug("EventCapture initialized — log: %s", self._log_path)

    def register(self, driver: "BaseDriver") -> None:
        """Wire pre/post tool hooks onto the driver."""
        driver.register_pre_tool_hook(self._on_pre_tool)
        driver.register_post_tool_hook(self._on_post_tool)

    def close(self) -> None:
        self._log_file.close()

    # ------------------------------------------------------------------
    # Public recording methods — called from session.py
    # ------------------------------------------------------------------

    async def record_user_message(self, text: str) -> None:
        """Record a user prompt before it's sent to the driver."""
        event = self._build_event(
            event_type="message_user",
            tool_name="",
            tool_use_id="",
            data={"text": text},
        )
        await self._record(event)

    async def record_driver_event(self, event: "DriverEvent") -> None:
        """Record a DriverEvent from the response stream (text, result, etc.)."""
        # Tool calls are captured via hooks (pre/post_tool_use) — skip here to avoid duplication
        if event.type in ("tool_use", "tool_result"):
            return

        type_map = {
            "text": "message_ai",
            "thinking": "message_ai_thinking",
            "result": "turn_result",
            "rate_limit": "rate_limit",
            "error": "error",
        }
        event_type = type_map.get(event.type, event.type)

        recorded = self._build_event(
            event_type=event_type,
            tool_name="",
            tool_use_id="",
            data=event.data,
        )
        await self._record(recorded)

    # ------------------------------------------------------------------
    # Hook callbacks — fired by the driver for tool calls
    # ------------------------------------------------------------------

    async def _on_pre_tool(self, payload: "ToolHookPayload") -> None:
        event = self._build_event(
            event_type="pre_tool_use",
            tool_name=payload.tool_name,
            tool_use_id=payload.tool_use_id,
            data={"tool_input": payload.tool_input},
        )
        await self._record(event)

    async def _on_post_tool(self, payload: "ToolHookPayload") -> None:
        is_side_effecting = payload.tool_name in SIDE_EFFECTING_TOOLS
        event = self._build_event(
            event_type="post_tool_use",
            tool_name=payload.tool_name,
            tool_use_id=payload.tool_use_id,
            data={
                "tool_output": _truncate(payload.tool_output),
                "is_error": payload.is_error,
                "is_side_effecting": is_side_effecting,
            },
        )
        await self._record(event)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_event(
        self,
        event_type: str,
        tool_name: str,
        tool_use_id: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        event_id = str(uuid.uuid4())
        event = {
            "id": event_id,
            "parent_event_id": self._last_event_id,
            "type": event_type,
            "tool_name": tool_name,
            "tool_use_id": tool_use_id,
            "graph_id": self._graph_id,
            "node_id": self._node_id,
            "session_id": self._session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        self._last_event_id = event_id
        return event

    async def _record(self, event: dict[str, Any]) -> None:
        # 1. Write locally first — crash safe
        self._log_file.write(json.dumps(event) + "\n")
        self._log_file.flush()

        # 2. Send to backend — best effort, never crash the session on failure
        try:
            self._backend.append_delta_event(self._node_id, event)
        except Exception as exc:
            logger.warning("Failed to send event to backend: %s", exc)


def _truncate(value: Any, max_len: int = 500) -> Any:
    """Keep tool output in the log but don't let huge file reads bloat it."""
    if isinstance(value, str) and len(value) > max_len:
        return value[:max_len] + f"…[{len(value) - max_len} chars truncated]"
    return value
