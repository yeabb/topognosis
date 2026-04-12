import logging
from typing import Any

import httpx

from .auth import get_access_token, get_refresh_token, save_tokens

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://localhost:8000"


class BackendError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


class BackendClient:
    def __init__(self, base_url: str = DEFAULT_BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    def login(self, email: str, password: str) -> dict[str, str]:
        """Exchange credentials for JWT tokens. Returns {"access": ..., "refresh": ...}."""
        resp = httpx.post(
            f"{self.base_url}/api/auth/login/",
            json={"email": email, "password": password},
            timeout=15,
        )
        if resp.status_code == 401:
            raise BackendError(401, "Invalid email or password.")
        _raise_for_status(resp)
        return resp.json()

    def refresh_access_token(self) -> str:
        """Use the stored refresh token to get a new access token. Returns new access token."""
        refresh = get_refresh_token()
        if not refresh:
            raise BackendError(401, "No refresh token stored. Please log in again.")
        resp = httpx.post(
            f"{self.base_url}/api/auth/token/refresh/",
            json={"refresh": refresh},
            timeout=15,
        )
        _raise_for_status(resp)
        data = resp.json()
        access = data["access"]
        save_tokens(access, refresh)
        return access

    # ------------------------------------------------------------------
    # Graphs
    # ------------------------------------------------------------------

    def create_graph(self, name: str, project_path: str) -> dict[str, Any]:
        return self._post("/api/graphs/", {"name": name, "project_path": project_path})

    def get_graph(self, graph_id: str) -> dict[str, Any]:
        return self._get(f"/api/graphs/{graph_id}/")

    # ------------------------------------------------------------------
    # Nodes
    # ------------------------------------------------------------------

    def create_node(self, graph_id: str, parent_id: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"graph": graph_id}
        if parent_id:
            payload["parent"] = parent_id
        return self._post("/api/nodes/", payload)

    def patch_node(self, node_id: str, data: dict[str, Any]) -> dict[str, Any]:
        return self._patch(f"/api/nodes/{node_id}/", data)

    def append_delta_event(self, node_id: str, event: dict[str, Any]) -> dict[str, Any]:
        return self._post(f"/api/nodes/{node_id}/events/", event)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get(self, path: str) -> dict[str, Any]:
        return self._request("GET", path)

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", path, json=body)

    def _patch(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("PATCH", path, json=body)

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        token = get_access_token()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            resp = httpx.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                timeout=15,
                **kwargs,
            )
        except httpx.ConnectError as exc:
            raise BackendError(0, f"Cannot reach backend at {self.base_url}") from exc
        except httpx.TimeoutException as exc:
            raise BackendError(0, "Request timed out.") from exc

        if resp.status_code == 401:
            # Try token refresh once
            logger.debug("Access token expired, attempting refresh")
            try:
                new_token = self.refresh_access_token()
                headers["Authorization"] = f"Bearer {new_token}"
                resp = httpx.request(
                    method,
                    f"{self.base_url}{path}",
                    headers=headers,
                    timeout=15,
                    **kwargs,
                )
            except BackendError:
                raise BackendError(401, "Session expired. Please run `topo login` again.")

        _raise_for_status(resp)
        return resp.json()


def _raise_for_status(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    try:
        detail = resp.json().get("detail") or resp.text
    except Exception:
        detail = resp.text
    raise BackendError(resp.status_code, detail)
