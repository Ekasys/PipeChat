# PipelinePro v1.0

PipelinePro is an all-in-one GovCon SaaS platform with two backend services behind one frontend:

- `backend` (`/api/v1/*`) for core PipelinePro modules.
- `ekchat-api` (`/api/ekchat/v1/*`) for chat, file handling, and phased RFP features.

## Features

- Authentication & Security: JWT auth, RBAC, MFA, tenant isolation.
- App-only login: no Cloudflare Access dependency for user authentication.
- Core modules: Dashboard, Opportunities, CRM, Proposals, PTW/PWin, Teaming, Admin.
- AI modules: AI Assistant and Ekchat.
- Multi-tenant AI provider routing (including Azure OpenAI).
- Shared Postgres with tenant-aware schema isolation (`public` + `ekchat`).

## Technology Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Redis
- Frontend: React, TypeScript, Vite
- Storage: Azure Blob Storage (with local fallback for development)
- Deployment: Docker, Azure Container Apps

## Quick Start

### Docker setup (recommended)

```bash
docker-compose up -d
```

Run migrations from the backend container:

```bash
docker-compose exec backend alembic upgrade head
```

Endpoints:

- PipelinePro API docs: `http://localhost:8000/api/docs`
- Ekchat API docs: `http://localhost:8001/api/ekchat/docs`
- Frontend: `http://localhost:5173`

### Local backend setup

Core backend:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Ekchat backend:

```bash
cd services/ekchat-api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Key Configuration

Core backend:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`

Ekchat backend:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `AZURE_STORAGE_CONNECTION_STRING`
- `EKCHAT_BLOB_CONTAINER`
- `EKCHAT_DEFAULT_MODEL`

Tenant feature flags (`tenants.settings` JSON):

- `ekchat_chat_enabled`
- `ekchat_rag_enabled`
- `ekchat_rfp_enabled`

## License

Proprietary - All rights reserved
