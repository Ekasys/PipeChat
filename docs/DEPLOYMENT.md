# PipelinePro + Ekchat Deployment Guide

## Architecture

Production deployment targets Azure Container Apps with three services:

- `pipelinepro-api` (existing backend)
- `ekchat-api` (new service)
- `pipelinepro-web` (frontend)

Shared managed services:

- Azure Database for PostgreSQL Flexible Server
- Azure Redis
- Azure Blob Storage
- Azure OpenAI
- Azure Key Vault

## Database

- Keep existing Postgres server.
- Apply Alembic migrations from `backend` (includes `ekchat` schema migration).
- Ensure `vector` extension is available (migration creates it if supported).

## Required Secrets

### Core

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`

### Ekchat API

- `AZURE_STORAGE_CONNECTION_STRING`
- `EKCHAT_BLOB_CONTAINER`
- `EKCHAT_DEFAULT_MODEL`
- `EKCHAT_LIGHT_TASK_MODEL`
- `EKCHAT_CHAT_MAX_TOKENS`

### CI/CD

- `AZURE_CREDENTIALS`
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `ACA_RESOURCE_GROUP`
- `ACA_PIPELINEPRO_API_APP_NAME`
- `ACA_EKCHAT_API_APP_NAME`
- `ACA_PIPELINEPRO_WEB_APP_NAME`
- `ACA_MIGRATIONS_JOB_NAME`

## GitHub Workflows

### Build images

Workflow: `.github/workflows/acr-build.yml`

Builds and pushes:

- `pipelinepro-backend`
- `pipelinepro-ekchat-api`
- `pipelinepro-frontend`

### Deploy

Workflow: `.github/workflows/aca-deploy.yml`

- Starts migrations job in ACA
- Updates backend app image
- Updates ekchat-api app image
- Updates frontend app image

## Routing

Frontend ingress should route:

- `/api/v1/*` -> `pipelinepro-api`
- `/api/ekchat/v1/*` -> `ekchat-api`

## Tenant Feature Flags

Set in `public.tenants.settings` JSON:

- `ekchat_chat_enabled`
- `ekchat_rag_enabled`
- `ekchat_rfp_enabled`

## Security Requirements

- Ekchat API strictly requires JWT with claims: `sub`, `tenant_id`, `role`, `email`.
- No `X-User-ID` fallback.
- `ekchat.*` tables enforce Postgres RLS with per-request session context:
  - `SET LOCAL app.tenant_id`
  - `SET LOCAL app.user_id`
