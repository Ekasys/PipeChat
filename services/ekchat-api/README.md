# Ekchat API Service

Tenant-isolated chat and RFP support service for PipelinePro.

## API Prefix

- `/api/ekchat/v1`

## Required JWT Claims

- `sub`
- `tenant_id`
- `role`
- `email`

Requests without any required claim are rejected.

## Implemented Endpoint Groups

- Chat core: chat CRUD, model set/ensure, message streaming
- Web search: `/chats/{chat_id}/websearch` (SSE response)
- Files: upload/list/download (Blob or local fallback)
- Data helpers: table list/preview and plot generate/download
- RFP history library: chat bootstrap, upload/list/download/doc/delete
- RFP style profile: manual edit, read, model-generated profile
- RFP analyze library: upload/list/download/text/delete
- RFP outputs: capability matrix generate/latest/export
- RFP outputs: shred document generate/latest/export
- RFP generation: sections prepare/generate and response generate/export

## Environment Variables

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `AZURE_STORAGE_CONNECTION_STRING`
- `EKCHAT_BLOB_CONTAINER`
- `LOCAL_STORAGE_ROOT`
- `EKCHAT_DEFAULT_MODEL`
- `EKCHAT_LIGHT_TASK_MODEL`
- `EKCHAT_CHAT_MAX_TOKENS`
- `EKCHAT_WEBSEARCH_MAX_RESULTS`
- `EKCHAT_WEBSEARCH_TIMEOUT_SECONDS`

## Feature Flags (tenant settings JSON)

- `ekchat_chat_enabled`
- `ekchat_rag_enabled`
- `ekchat_rfp_enabled`

## Local Validation

Use Python 3.11 for local tests because pinned dependencies (`asyncpg`, `pydantic-core`) currently fail to build on Python 3.13 in this setup.

```bash
python3.11 -m venv /tmp/ekchat-api-venv311
/tmp/ekchat-api-venv311/bin/pip install -r requirements.txt
PYTHONPATH=. /tmp/ekchat-api-venv311/bin/pytest -q -p no:cacheprovider
```
