"""
EventType constants — single source of truth for all event type strings.

The DB stores these as plain strings (no constraint). Define them here so
all code uses constants instead of raw strings. New drivers (Codex, Aider,
etc.) add their constants here — no migration required.
"""


class EventType:
    # ------------------------------------------------------------------
    # Shared — both web and CLI surfaces
    # ------------------------------------------------------------------
    MESSAGE_USER = "message_user"                    # user prompt
    MESSAGE_AI = "message_ai"                        # assistant text response
    MESSAGE_AI_THINKING = "message_ai_thinking"      # assistant thinking block
    TURN_RESULT = "turn_result"                      # end of turn — cost, stop reason, usage
    RATE_LIMIT = "rate_limit"                        # rate limit hit mid-session
    ERROR = "error"                                  # error event from the driver

    # ------------------------------------------------------------------
    # Web surface only — graph/context management events
    # ------------------------------------------------------------------
    BRANCH = "branch"
    MERGE = "merge"
    COMPRESS = "compress"
    CHECKOUT = "checkout"

    # ------------------------------------------------------------------
    # CLI surface — tool-driven events (all drivers)
    # ------------------------------------------------------------------
    PRE_TOOL_USE = "pre_tool_use"
    POST_TOOL_USE = "post_tool_use"
    INTERRUPT = "interrupt"     # Ctrl+C written as an explicit event, no gaps in audit trail

    # ------------------------------------------------------------------
    # Sets for group checks
    # ------------------------------------------------------------------

    # Events that carry a snapshot_hash (they mutate filesystem state)
    SIDE_EFFECTING = {POST_TOOL_USE}

    # Events exclusive to CLI
    CLI_ONLY_EVENTS = {PRE_TOOL_USE, POST_TOOL_USE, INTERRUPT}

    # Events exclusive to web
    WEB_ONLY_EVENTS = {BRANCH, MERGE, COMPRESS, CHECKOUT}

    # Events shared across both surfaces
    SHARED_EVENTS = {
        MESSAGE_USER, MESSAGE_AI, MESSAGE_AI_THINKING,
        TURN_RESULT, RATE_LIMIT, ERROR,
    }
