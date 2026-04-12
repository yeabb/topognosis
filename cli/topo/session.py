"""
Session — the interactive REPL loop.

Wires together:
  - BackendClient  (register graph + node, stream events)
  - EventCapture   (hook into driver, write JSONL, send to backend)
  - ClaudeDriver   (Claude Agent SDK — first concrete driver)
  - Rich console   (basic output — full renderer comes in Task #10)

To add a new tool driver: implement BaseDriver, add it to DRIVERS below.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from rich.console import Console
from rich.markup import escape
from rich.rule import Rule

from .auth import get_access_token
from .backend import BackendClient, BackendError
from .capture import EventCapture
from .drivers.base import DriverEvent
from .drivers.claude import ClaudeDriver

logger = logging.getLogger(__name__)
console = Console()

# Driver registry — add new tool integrations here
DRIVERS = {
    "claude": ClaudeDriver,
}


def start_session(driver_name: str = "claude", cwd: str | None = None) -> None:
    """Entry point called by `topo` (no subcommand). Runs the async REPL."""
    asyncio.run(_run(driver_name=driver_name, cwd=cwd or str(Path.cwd())))


async def _run(driver_name: str, cwd: str) -> None:
    if driver_name not in DRIVERS:
        console.print(f"[red]Unknown driver '{driver_name}'. Available: {', '.join(DRIVERS)}[/red]")
        return

    backend = BackendClient()
    session_id = str(uuid.uuid4())
    project_name = Path(cwd).name

    # ----------------------------------------------------------------
    # Register graph + first node with backend
    # ----------------------------------------------------------------
    try:
        graph = await backend.create_graph(name=project_name, project_path=cwd)
        graph_id = graph["id"]
        node = await backend.create_node(graph_id=graph_id)
        node_id = node["id"]
    except BackendError as exc:
        console.print(f"[red]Could not connect to Topognosis backend: {exc.detail}[/red]")
        console.print("[dim]Start the backend or check your connection, then try again.[/dim]")
        await backend.aclose()
        return

    # ----------------------------------------------------------------
    # Wire up event capture
    # ----------------------------------------------------------------
    capture = EventCapture(
        backend=backend,
        graph_id=graph_id,
        node_id=node_id,
        session_id=session_id,
    )

    # ----------------------------------------------------------------
    # Start driver
    # ----------------------------------------------------------------
    DriverClass = DRIVERS[driver_name]
    driver = DriverClass()
    capture.register(driver)  # hooks registered before connect

    console.print(Rule(f"[bold]topo[/bold] · {project_name} · {driver_name}"))
    console.print(f"[dim]Graph {graph_id[:8]}  Node {node_id[:8]}  Session {session_id[:8]}[/dim]")
    console.print("[dim]Type your prompt. Ctrl+C to end the session.[/dim]\n")

    try:
        await driver.connect(cwd=cwd)

        while True:
            # ---- Read user input ----
            try:
                prompt = await asyncio.get_event_loop().run_in_executor(
                    None, _read_prompt
                )
            except (EOFError, KeyboardInterrupt):
                break

            if prompt is None:
                break
            if not prompt.strip():
                continue

            # ---- Record + send to driver ----
            try:
                await capture.record_user_message(prompt.strip())
                await driver.send(prompt.strip())
            except Exception as exc:
                console.print(f"[red]Error sending prompt: {exc}[/red]")
                continue

            # ---- Stream + record response ----
            try:
                async for event in driver.receive():
                    await capture.record_driver_event(event)
                    _render_event(event)
            except KeyboardInterrupt:
                console.print("\n[yellow]Interrupted.[/yellow]")
            except Exception as exc:
                logger.exception("Error receiving response")
                console.print(f"[red]Error: {exc}[/red]")

    finally:
        await driver.disconnect()
        capture.close()
        await backend.aclose()
        console.print(Rule("[dim]Session ended[/dim]"))


def _read_prompt() -> str | None:
    """Read a line from stdin. Returns None on EOF."""
    try:
        return input("\n[topo] > ")
    except EOFError:
        return None


def _render_event(event: DriverEvent) -> None:
    """Basic Rich rendering — Task #10 will replace this with the full display renderer."""
    if event.type == "text":
        text = event.data.get("text", "")
        if text:
            console.print(escape(text), end="")

    elif event.type == "thinking":
        thinking = event.data.get("thinking", "")
        if thinking:
            console.print(f"[dim italic]💭 {escape(thinking[:200])}…[/dim italic]")

    elif event.type == "tool_use":
        name = event.data.get("tool_name", "")
        inp = event.data.get("tool_input", {})
        # Show the most relevant part of the input without dumping the whole dict
        summary = _tool_input_summary(name, inp)
        console.print(f"\n[cyan]⚙ {name}[/cyan] [dim]{summary}[/dim]")

    elif event.type == "tool_result":
        pass  # tool results are implicit — output appears in next text block

    elif event.type == "result":
        cost = event.data.get("cost_usd")
        turns = event.data.get("num_turns")
        parts = []
        if turns is not None:
            parts.append(f"{turns} turn{'s' if turns != 1 else ''}")
        if cost is not None:
            parts.append(f"${cost:.4f}")
        console.print(f"\n[dim]{'  ·  '.join(parts)}[/dim]" if parts else "")

    elif event.type == "rate_limit":
        console.print("[yellow]Rate limit reached — waiting…[/yellow]")

    elif event.type == "error":
        console.print(f"[red]{event.data.get('message', 'Unknown error')}[/red]")


def _tool_input_summary(tool_name: str, inp: dict) -> str:
    """One-line summary of a tool call for display."""
    if tool_name in ("Read", "Edit", "Write", "MultiEdit"):
        return inp.get("file_path", inp.get("path", ""))
    if tool_name == "Bash":
        cmd = inp.get("command", "")
        return cmd[:80] + ("…" if len(cmd) > 80 else "")
    if tool_name in ("Glob", "Grep"):
        return inp.get("pattern", "")
    if tool_name == "WebSearch":
        return inp.get("query", "")
    if tool_name == "WebFetch":
        return inp.get("url", "")
    # Fallback — show first string value
    for v in inp.values():
        if isinstance(v, str):
            return v[:80]
    return ""
