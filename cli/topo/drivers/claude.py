"""
Claude driver — wraps the Claude Agent SDK (ClaudeSDKClient) to implement
the BaseDriver interface.
"""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

from claude_agent_sdk import types as sdk_types
from claude_agent_sdk.client import ClaudeSDKClient
from claude_agent_sdk.types import (
    AssistantMessage,
    ClaudeAgentOptions,
    HookContext,
    HookMatcher,
    PostToolUseHookInput,
    PreToolUseHookInput,
    RateLimitEvent,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
)

from .base import BaseDriver, DriverEvent, ToolHookPayload

logger = logging.getLogger(__name__)


class ClaudeDriver(BaseDriver):
    """Driver for Claude via the Claude Agent SDK."""

    name = "claude"

    def __init__(self, permission_mode: str = "default") -> None:
        super().__init__()
        self._permission_mode = permission_mode
        self._client: ClaudeSDKClient | None = None
        self._cwd: str | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def connect(self, cwd: str) -> None:
        self._cwd = cwd
        options = ClaudeAgentOptions(
            permission_mode=self._permission_mode,  # type: ignore[arg-type]
            cwd=cwd,
            hooks=self._build_hooks(),
        )
        self._client = ClaudeSDKClient(options=options)
        await self._client.__aenter__()
        logger.debug("ClaudeDriver connected (cwd=%s)", cwd)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.__aexit__(None, None, None)
            self._client = None
            logger.debug("ClaudeDriver disconnected")

    # ------------------------------------------------------------------
    # Communication
    # ------------------------------------------------------------------

    async def send(self, prompt: str) -> None:
        if not self._client:
            raise RuntimeError("Driver not connected. Call connect() first.")
        await self._client.query(prompt)

    async def receive(self) -> AsyncIterator[DriverEvent]:  # type: ignore[override]
        if not self._client:
            raise RuntimeError("Driver not connected.")
        async for msg in self._client.receive_response():
            for event in _normalize(msg):
                yield event

    # ------------------------------------------------------------------
    # Internal — hook wiring
    # ------------------------------------------------------------------

    def _build_hooks(self) -> dict:
        async def pre_tool_hook(
            hook_input: PreToolUseHookInput,
            session_id: str | None,
            ctx: HookContext,
        ) -> None:
            payload = ToolHookPayload(
                tool_name=hook_input.tool_name,
                tool_input=hook_input.tool_input,
                tool_use_id=hook_input.tool_use_id,
                session_id=session_id,
            )
            for cb in self._pre_tool_hooks:
                await cb(payload)
            return None

        async def post_tool_hook(
            hook_input: PostToolUseHookInput,
            session_id: str | None,
            ctx: HookContext,
        ) -> None:
            payload = ToolHookPayload(
                tool_name=hook_input.tool_name,
                tool_input=hook_input.tool_input,
                tool_use_id=hook_input.tool_use_id,
                session_id=session_id,
                tool_output=hook_input.tool_response,
                is_error=False,  # PostToolUseHookInput has no error field — errors surface in tool_response content
            )
            for cb in self._post_tool_hooks:
                await cb(payload)
            return None

        return {
            "PreToolUse": [HookMatcher(matcher=None, hooks=[pre_tool_hook])],
            "PostToolUse": [HookMatcher(matcher=None, hooks=[post_tool_hook])],
        }


def _normalize(msg: Any) -> list[DriverEvent]:
    """Translate a raw SDK message into one or more normalized DriverEvents."""
    events: list[DriverEvent] = []

    if isinstance(msg, AssistantMessage):
        for block in msg.content:
            if isinstance(block, TextBlock):
                events.append(DriverEvent(
                    type="text",
                    data={"text": block.text, "session_id": msg.session_id},
                    raw=msg,
                ))
            elif isinstance(block, ThinkingBlock):
                events.append(DriverEvent(
                    type="thinking",
                    data={"thinking": block.thinking, "session_id": msg.session_id},
                    raw=msg,
                ))
            elif isinstance(block, ToolUseBlock):
                events.append(DriverEvent(
                    type="tool_use",
                    data={
                        "tool_name": block.name,
                        "tool_input": block.input,
                        "tool_use_id": block.id,
                        "session_id": msg.session_id,
                    },
                    raw=msg,
                ))
            elif isinstance(block, ToolResultBlock):
                events.append(DriverEvent(
                    type="tool_result",
                    data={
                        "tool_use_id": block.tool_use_id,
                        "content": block.content,
                        "session_id": msg.session_id,
                    },
                    raw=msg,
                ))

    elif isinstance(msg, ResultMessage):
        events.append(DriverEvent(
            type="result",
            data={
                "cost_usd": msg.total_cost_usd,
                "num_turns": msg.num_turns,
                "stop_reason": msg.stop_reason,
                "is_error": msg.is_error,
                "session_id": msg.session_id,
            },
            raw=msg,
        ))

    elif isinstance(msg, RateLimitEvent):
        events.append(DriverEvent(
            type="rate_limit",
            data={"info": msg.rate_limit_info.raw},
            raw=msg,
        ))

    # StreamEvents (partial streaming chunks) are intentionally dropped here —
    # we work at the message level, not the token level.

    return events
