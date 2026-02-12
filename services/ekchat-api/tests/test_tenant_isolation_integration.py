"""Endpoint-level tenant isolation tests for ekchat-api."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Dict, Iterable, List, Optional

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.config import settings
from app.main import app
import app.deps as deps
import app.routers.chats as chats_router


class _FakeResult:
    def __init__(self, rows: Optional[Iterable[Dict[str, Any]]] = None):
        self._rows = list(rows or [])
        self.rowcount = len(self._rows)

    def mappings(self) -> "_FakeResult":
        return self

    def first(self) -> Optional[Dict[str, Any]]:
        return self._rows[0] if self._rows else None

    def all(self) -> List[Dict[str, Any]]:
        return list(self._rows)

    def scalar_one_or_none(self) -> Any:
        if not self._rows:
            return None
        first = self._rows[0]
        if isinstance(first, dict) and first:
            return next(iter(first.values()))
        return first


class _Tx:
    def __init__(self, db: "FakeDB"):
        self._db = db

    async def __aenter__(self) -> "FakeDB":
        return self._db

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


@dataclass
class _FakeStorage:
    objects: Dict[str, bytes]

    async def download_bytes(self, blob_path: str) -> bytes:
        if blob_path not in self.objects:
            raise FileNotFoundError(blob_path)
        return self.objects[blob_path]


class FakeDB:
    def __init__(self):
        self.chats = [
            {
                "id": "chat-tenant-a",
                "tenant_id": "tenant-a",
                "user_id": "user-a",
                "title": "Tenant A chat",
                "model": "balanced-mid",
                "created_at": None,
                "updated_at": None,
            },
            {
                "id": "chat-tenant-b",
                "tenant_id": "tenant-b",
                "user_id": "user-b",
                "title": "Tenant B chat",
                "model": "balanced-mid",
                "created_at": None,
                "updated_at": None,
            },
        ]
        self.chat_files = [
            {
                "id": "file-tenant-a",
                "chat_id": "chat-tenant-a",
                "tenant_id": "tenant-a",
                "user_id": "user-a",
                "original_name": "a.txt",
                "mime_type": "text/plain",
                "blob_path": "tenant/tenant-a/user/user-a/chat/chat-tenant-a/files/file-tenant-a-a.txt",
            },
        ]
        self.capability_matrices = [
            {
                "id": "matrix-tenant-a",
                "tenant_id": "tenant-a",
                "user_id": "user-a",
                "rfp_name": "rfp-a.pdf",
                "payload": {
                    "rows": [
                        {
                            "rfp_requirement_id": "REQ-001",
                            "capability_area": "Security",
                            "requirement_text": "Contractor shall provide MFA.",
                        }
                    ]
                },
            }
        ]

    def begin(self) -> _Tx:
        return _Tx(self)

    async def close(self) -> None:
        return None

    async def execute(self, statement: Any, params: Optional[Dict[str, Any]] = None) -> _FakeResult:
        sql = str(statement).lower()
        query_params = params or {}

        if "from ekchat.chats" in sql:
            row = next(
                (
                    chat
                    for chat in self.chats
                    if chat["id"] == query_params.get("chat_id")
                    and chat["tenant_id"] == query_params.get("tenant_id")
                    and chat["user_id"] == query_params.get("user_id")
                ),
                None,
            )
            return _FakeResult([row] if row else [])

        if "from ekchat.chat_files" in sql and "select original_name, mime_type, blob_path" in sql:
            if query_params.get("file_id"):
                row = next(
                    (
                        item
                        for item in self.chat_files
                        if item["id"] == query_params.get("file_id")
                        and item["chat_id"] == query_params.get("chat_id")
                        and item["tenant_id"] == query_params.get("tenant_id")
                        and item["user_id"] == query_params.get("user_id")
                    ),
                    None,
                )
            else:
                row = next(
                    (
                        item
                        for item in self.chat_files
                        if item["original_name"] == query_params.get("name")
                        and item["chat_id"] == query_params.get("chat_id")
                        and item["tenant_id"] == query_params.get("tenant_id")
                        and item["user_id"] == query_params.get("user_id")
                    ),
                    None,
                )
            return _FakeResult([row] if row else [])

        if "from ekchat.rfp_outputs_capability_matrix" in sql and "where id = :id" in sql:
            row = next(
                (
                    matrix
                    for matrix in self.capability_matrices
                    if matrix["id"] == query_params.get("id")
                    and matrix["tenant_id"] == query_params.get("tenant_id")
                    and matrix["user_id"] == query_params.get("user_id")
                ),
                None,
            )
            if not row:
                return _FakeResult([])
            return _FakeResult(
                [
                    {
                        "id": row["id"],
                        "rfp_name": row["rfp_name"],
                        "payload": row["payload"],
                    }
                ]
            )

        return _FakeResult([])


def _token(*, tenant_id: str, user_id: str) -> str:
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": "member",
        "email": f"{user_id}@example.com",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _auth_headers(*, tenant_id: str, user_id: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {_token(tenant_id=tenant_id, user_id=user_id)}"}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    fake_db = FakeDB()
    fake_storage = _FakeStorage(
        {
            "tenant/tenant-a/user/user-a/chat/chat-tenant-a/files/file-tenant-a-a.txt": b"tenant-a-secret-file"
        }
    )

    async def _override_get_db():
        yield fake_db

    async def _feature_enabled(*args, **kwargs):
        _ = args
        _ = kwargs
        return True

    async def _noop_set_rls(*args, **kwargs):
        _ = args
        _ = kwargs
        return None

    app.dependency_overrides[deps.get_db] = _override_get_db
    monkeypatch.setattr(deps, "is_feature_enabled", _feature_enabled)
    monkeypatch.setattr(deps, "set_rls_context", _noop_set_rls)
    monkeypatch.setattr(chats_router, "get_storage", lambda: fake_storage)

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_chat_metadata_isolation_blocks_cross_tenant_id_guess(client: TestClient):
    ok = client.get(
        "/api/ekchat/v1/chats/chat-tenant-a",
        headers=_auth_headers(tenant_id="tenant-a", user_id="user-a"),
    )
    assert ok.status_code == 200
    assert ok.json()["chat"]["id"] == "chat-tenant-a"

    denied = client.get(
        "/api/ekchat/v1/chats/chat-tenant-a",
        headers=_auth_headers(tenant_id="tenant-b", user_id="user-b"),
    )
    assert denied.status_code == 404


def test_file_download_isolation_blocks_cross_tenant_file_id_guess(client: TestClient):
    ok = client.get(
        "/api/ekchat/v1/files/download",
        params={"chat_id": "chat-tenant-a", "file_id": "file-tenant-a"},
        headers=_auth_headers(tenant_id="tenant-a", user_id="user-a"),
    )
    assert ok.status_code == 200
    assert ok.content == b"tenant-a-secret-file"

    denied = client.get(
        "/api/ekchat/v1/files/download",
        params={"chat_id": "chat-tenant-b", "file_id": "file-tenant-a"},
        headers=_auth_headers(tenant_id="tenant-b", user_id="user-b"),
    )
    assert denied.status_code == 404


def test_capability_matrix_export_isolation_blocks_cross_tenant_id_guess(client: TestClient):
    ok = client.get(
        "/api/ekchat/v1/rfp/capability-matrix/export",
        params={"matrix_id": "matrix-tenant-a"},
        headers=_auth_headers(tenant_id="tenant-a", user_id="user-a"),
    )
    assert ok.status_code == 200
    assert "REQ-001" in ok.text

    denied = client.get(
        "/api/ekchat/v1/rfp/capability-matrix/export",
        params={"matrix_id": "matrix-tenant-a"},
        headers=_auth_headers(tenant_id="tenant-b", user_id="user-b"),
    )
    assert denied.status_code == 404
