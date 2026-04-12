"""
EventType constants — single source of truth for all event type strings.

The DB stores these as plain strings (no constraint). Define them here so
all code uses constants instead of raw strings. New drivers (Codex, Aider,
etc.) add their constants here — no migration required.
"""


class EventType:
    # ------------------------------------------------------------------
    # Web surface — chat-driven events
    # ------------------------------------------------------------------
    MESSAGE_USER = "message_user"
    MESSAGE_AI = "message_ai"
    BRANCH = "branch"
    MERGE = "merge"
    COMPRESS = "compress"
    CHECKOUT = "checkout"

    # ------------------------------------------------------------------
    # CLI surface — tool-driven events (Claude driver, and future drivers)
    # ------------------------------------------------------------------
    PRE_TOOL_USE = "pre_tool_use"
    POST_TOOL_USE = "post_tool_use"
    INTERRUPT = "interrupt"          # Ctrl+C written as an explicit event

    # ------------------------------------------------------------------
    # Sets for group checks
    # ------------------------------------------------------------------

    # Events that carry a snapshot_hash (they mutate filesystem state)
    SIDE_EFFECTING = {POST_TOOL_USE}

    # Events that belong to the CLI surface
    CLI_EVENTS = {PRE_TOOL_USE, POST_TOOL_USE, INTERRUPT}

    # Events that belong to the web surface
    WEB_EVENTS = {MESSAGE_USER, MESSAGE_AI, BRANCH, MERGE, COMPRESS, CHECKOUT}
