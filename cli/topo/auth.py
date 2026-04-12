import json
import os
from pathlib import Path

import httpx

CONFIG_PATH = Path.home() / ".topo" / "config.json"
DEFAULT_BASE_URL = "http://localhost:8000"


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


def login(email: str, password: str, base_url: str = DEFAULT_BASE_URL) -> dict[str, str]:
    """Exchange credentials for JWT tokens. Returns {"access": ..., "refresh": ...}.
    Sync — intended for CLI use only, outside any async session context.
    """
    from .backend import BackendError  # avoid circular at module level

    resp = httpx.post(
        f"{base_url.rstrip('/')}/api/auth/login/",
        json={"email": email, "password": password},
        timeout=15,
    )
    if resp.status_code == 401:
        raise BackendError(401, "Invalid email or password.")
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail") or resp.text
        except Exception:
            detail = resp.text
        raise BackendError(resp.status_code, detail)
    return resp.json()


def login_command() -> None:
    import click

    click.echo("Log in to Topognosis")
    email = click.prompt("Email")
    password = click.prompt("Password", hide_input=True)

    from .backend import BackendError

    try:
        tokens = login(email, password)
    except BackendError as exc:
        click.echo(f"Login failed: {exc.detail}", err=True)
        raise SystemExit(1)

    save_tokens(tokens["access"], tokens["refresh"])
    click.echo("Logged in successfully.")


def _load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}
