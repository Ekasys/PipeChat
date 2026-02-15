# PipelinePro + Ekchat Deployment Guide

## Architecture

Production runs in Azure Container Apps with three services:

- `pipelinepro-web` (frontend, public ingress)
- `pipelinepro-api` (core backend, internal ingress)
- `ekchat-api` (Ekchat backend, internal ingress)

Shared managed services:

- Azure Database for PostgreSQL Flexible Server
- Azure Redis
- Azure Blob Storage
- Azure OpenAI
- Azure Key Vault (recommended for secret refs)

This deployment model uses in-app JWT login as the only user auth mechanism.
Cloudflare Access / Zero Trust is not required.

## Ingress Topology (Required)

- `pipelinepro-web`: external ingress, target port `80`
- `pipelinepro-api`: internal ingress, target port `8000`
- `ekchat-api`: internal ingress, target port `8001`

All three apps should be in the same ACA environment.

## Runtime Configuration

### Frontend (`pipelinepro-web`)

The Nginx runtime template reads:

- `BACKEND_URL`
- `EKCHAT_API_URL`

Both must point to the ACA-internal base URLs for backend services.

### Core backend (`pipelinepro-api`)

Required:

- `DATABASE_URL`
- `DATABASE_SSL=require` (or `sslmode=require` in URL)
- `REDIS_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `CORS_ORIGINS` (frontend origin only in production)

### Ekchat backend (`ekchat-api`)

Required:

- `DATABASE_URL`
- `DATABASE_SSL=require` (or `sslmode=require` in URL)
- `REDIS_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `AZURE_STORAGE_CONNECTION_STRING`
- `EKCHAT_BLOB_CONTAINER`
- `CORS_ORIGINS` (frontend origin only in production)

Recommended cost defaults:

- `EKCHAT_DEFAULT_MODEL=balanced-mid`
- `EKCHAT_LIGHT_TASK_MODEL=cost-mini`
- `EKCHAT_CHAT_MAX_TOKENS=1200`

## Required GitHub Secrets

### Existing CI/CD

- `AZURE_CREDENTIALS`
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `ACA_RESOURCE_GROUP`
- `ACA_PIPELINEPRO_API_APP_NAME`
- `ACA_EKCHAT_API_APP_NAME`
- `ACA_PIPELINEPRO_WEB_APP_NAME`
- `ACA_MIGRATIONS_JOB_NAME`

### Added for internal API routing + CORS hardening

- `ACA_BACKEND_URL`
- `ACA_EKCHAT_API_URL`
- `ACA_CORS_ORIGINS`

`ACA_CORS_ORIGINS` can be a single origin (`https://app.example.com`) or a JSON list.

## GitHub Workflows

### Build images

Workflow: `.github/workflows/acr-build.yml`

Builds and pushes:

- `pipelinepro-backend`
- `pipelinepro-ekchat-api`
- `pipelinepro-frontend`

### Deploy

Workflow: `.github/workflows/aca-deploy.yml`

Per deploy:

- starts migrations job
- updates all 3 images
- enforces ingress topology (web external, APIs internal)
- sets frontend API upstream env vars
- sets strict CORS origins on backend services

## Routing

Frontend proxies:

- `/api/v1/*` -> `pipelinepro-api`
- `/api/ekchat/v1/*` -> `ekchat-api`

Configured in: `frontend/nginx.conf`.

## Tenant Feature Flags

Set in `public.tenants.settings` JSON:

- `ekchat_chat_enabled`
- `ekchat_rag_enabled`
- `ekchat_rfp_enabled`

## Security Requirements

- JWT auth only for protected APIs.
- Ekchat API strictly requires claims: `sub`, `tenant_id`, `role`, `email`.
- No header/subdomain tenant fallback should be used for auth decisions.
- `ekchat.*` tables enforce Postgres RLS with per-request session context:
  - `SET LOCAL app.tenant_id`
  - `SET LOCAL app.user_id`
