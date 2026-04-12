import json
import os
from pathlib import Path

CONFIG_PATH = Path.home() / ".topo" / "config.json"


def is_authenticated() -> bool:
    if not CONFIG_PATH.exists():
        return False
    config = _load_config()
    return bool(config.get("access_token"))


def get_access_token() -> str | None:
    return _load_config().get("access_token")


def get_refresh_token() -> str | None:
    return _load_config().get("refresh_token")


def save_tokens(access_token: str, refresh_token: str) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = _load_config()
    config["access_token"] = access_token
    config["refresh_token"] = refresh_token
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def clear_tokens() -> None:
    if CONFIG_PATH.exists():
        config = _load_config()
        config.pop("access_token", None)
        config.pop("refresh_token", None)
        CONFIG_PATH.write_text(json.dumps(config, indent=2))


def _load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def login_command() -> None:
    import click
    from .backend import BackendClient, BackendError

    click.echo("Log in to Topognosis")
    email = click.prompt("Email")
    password = click.prompt("Password", hide_input=True)

    client = BackendClient()
    try:
        tokens = client.login(email, password)
    except BackendError as exc:
        click.echo(f"Login failed: {exc.detail}", err=True)
        raise SystemExit(1)

    save_tokens(tokens["access"], tokens["refresh"])
    click.echo("Logged in successfully.")
