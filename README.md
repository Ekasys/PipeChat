# PipeChat

PipeChat is the unified app that combines PipelinePro and EkChat into one frontend with two backend services.

## Architecture

- `frontend` (React + Vite): single UI for PipelinePro + EkChat.
- `backend` (`/api/v1/*`): core PipelinePro APIs.
- `services/ekchat-api` (`/api/ekchat/v1/*`): EkChat chat, RAG, files, and generation workflows.
- `postgres` + `redis`: shared data and cache/session services.

## Quick Start (Docker)

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python setup_admin_simple.py
```

Open:

- App: `http://localhost:5173`
- PipelinePro API docs: `http://localhost:8000/api/docs`
- EkChat API docs: `http://localhost:8001/api/ekchat/docs`

Default login after setup:

- Email: `admin@pipelinepro.com`
- Password: `admin123`

## Feature Flags (Tenant Settings)

`tenants.settings` supports:

- `ekchat_chat_enabled`
- `ekchat_rag_enabled`
- `ekchat_rfp_enabled`

## Notes

- Ollama local endpoint (dev default): `http://host.docker.internal:11434`
- Azure-ready path is included: Azure OpenAI, Azure Blob, Azure Container Apps, and PostgreSQL schema isolation (`public` + `ekchat`).
