"""Blob/local file storage abstraction."""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient

from app.config import settings


class StorageBackend:
    def __init__(self) -> None:
        self._conn_str = settings.AZURE_STORAGE_CONNECTION_STRING
        self._container_name = settings.EKCHAT_BLOB_CONTAINER
        self._local_root = Path(settings.LOCAL_STORAGE_ROOT)
        self._blob_client: Optional[BlobServiceClient] = None
        self._container_ready = False

        if self._conn_str:
            self._blob_client = BlobServiceClient.from_connection_string(self._conn_str)
        else:
            self._local_root.mkdir(parents=True, exist_ok=True)

    async def _ensure_container(self) -> None:
        if not self._blob_client or self._container_ready:
            return

        container_client = self._blob_client.get_container_client(self._container_name)
        if not await container_client.exists():
            await container_client.create_container()

        self._container_ready = True

    async def upload_bytes(self, blob_path: str, data: bytes, content_type: Optional[str] = None) -> None:
        if self._blob_client:
            await self._ensure_container()
            blob_client = self._blob_client.get_blob_client(container=self._container_name, blob=blob_path)
            content_settings = ContentSettings(content_type=content_type) if content_type else None
            await blob_client.upload_blob(data, overwrite=True, content_settings=content_settings)
            return

        target = self._local_root / blob_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    async def download_bytes(self, blob_path: str) -> bytes:
        if self._blob_client:
            await self._ensure_container()
            blob_client = self._blob_client.get_blob_client(container=self._container_name, blob=blob_path)
            stream = await blob_client.download_blob()
            return await stream.readall()

        target = self._local_root / blob_path
        return target.read_bytes()

    async def list_paths(self, prefix: str) -> List[str]:
        if self._blob_client:
            await self._ensure_container()
            container_client = self._blob_client.get_container_client(self._container_name)
            paths: List[str] = []
            async for blob in container_client.list_blobs(name_starts_with=prefix):
                paths.append(blob.name)
            return paths

        base = self._local_root / prefix
        if not base.exists():
            return []
        if base.is_file():
            return [prefix]

        return [str(path.relative_to(self._local_root)).replace("\\", "/") for path in base.rglob("*") if path.is_file()]

    async def delete_path(self, blob_path: str) -> None:
        if self._blob_client:
            await self._ensure_container()
            blob_client = self._blob_client.get_blob_client(container=self._container_name, blob=blob_path)
            await blob_client.delete_blob(delete_snapshots="include")
            return

        target = self._local_root / blob_path
        if target.exists() and target.is_file():
            target.unlink()


_storage_backend = StorageBackend()


def get_storage() -> StorageBackend:
    return _storage_backend
