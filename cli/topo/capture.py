"""
EventCapture — wires into driver hooks to record every tool call as a
delta_event. Writes a local JSONL append-log for crash safety and
streams events to the backend.

Architecture:
  - Registered as pre/post tool hooks on the driver before connect()
  - Each event gets a uuid + parent_event_id (linked list structure)
  - Side-effecting tools (Edit, Write, Bash, etc.) trigger a snapshot_hash
    after the event (handled by SnapshotManager, Task #9)
  - All events are written to ~/.topo/sessions/<session_id>.jsonl first,
    then sent to the backend — local log is the source of truth on crash
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
    from .drivers.base import BaseDriver, ToolHookPayload

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
    # Hook callbacks
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
