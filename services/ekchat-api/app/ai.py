"""Tenant-aware AI provider routing for chat and embeddings."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings


@dataclass
class TenantProvider:
    provider_name: str
    connection_config: Dict[str, Any]


def _as_config(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _fallback_ollama_provider() -> TenantProvider:
    return TenantProvider(
        provider_name="ollama",
        connection_config={
            "base_url": settings.OLLAMA_URL,
            "default_model": settings.OLLAMA_DEFAULT_MODEL,
            "embedding_model": settings.OLLAMA_EMBED_MODEL,
        },
    )


def _ollama_base_url(cfg: Dict[str, Any]) -> str:
    return str(cfg.get("base_url") or settings.OLLAMA_URL).rstrip("/")


def _ollama_headers(cfg: Dict[str, Any], provider_name: str) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    api_key = cfg.get("api_key")
    if provider_name == "ollama-cloud" and api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


async def load_active_provider(db: AsyncSession, tenant_id: str) -> Optional[TenantProvider]:
    result = await db.execute(
        text(
            """
            SELECT provider_name, connection_config
            FROM public.ai_providers
            WHERE tenant_id = :tenant_id
              AND is_active = true
            ORDER BY is_default DESC, created_at DESC
            LIMIT 1
            """
        ),
        {"tenant_id": tenant_id},
    )
    row = result.mappings().first()
    if not row:
        # Local/dev fallback so Ekchat can run with Ollama without admin provider setup.
        if settings.OLLAMA_URL:
            return _fallback_ollama_provider()
        return None

    return TenantProvider(
        provider_name=str(row["provider_name"]),
        connection_config=_as_config(row["connection_config"]),
    )


def _extract_models(provider: TenantProvider | None) -> List[str]:
    if not provider:
        return [settings.EKCHAT_DEFAULT_MODEL]

    cfg = provider.connection_config
    models: List[str] = []

    if provider.provider_name == "azure-openai":
        for key in ("chat_deployment", "default_model"):
            value = cfg.get(key)
            if value:
                models.append(str(value))
    elif provider.provider_name == "chatgpt":
        value = cfg.get("default_model") or "gpt-5-mini"
        models.append(str(value))
    elif provider.provider_name in {"ollama", "ollama-cloud"}:
        value = cfg.get("default_model") or settings.OLLAMA_DEFAULT_MODEL
        models.append(str(value))
    else:
        value = cfg.get("default_model") or settings.EKCHAT_DEFAULT_MODEL
        models.append(str(value))

    deduped = []
    for model in models:
        if model not in deduped:
            deduped.append(model)

    return deduped or [settings.EKCHAT_DEFAULT_MODEL]


async def list_models_for_tenant(db: AsyncSession, tenant_id: str) -> List[str]:
    provider = await load_active_provider(db, tenant_id)
    if provider and provider.provider_name in {"ollama", "ollama-cloud"}:
        cfg = provider.connection_config
        base_url = _ollama_base_url(cfg)
        headers = _ollama_headers(cfg, provider.provider_name)
        try:
            async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                response = await client.get(f"{base_url}/api/tags", headers=headers)
                response.raise_for_status()
                payload = response.json()
            models = [
                str(item.get("name")).strip()
                for item in payload.get("models", [])
                if isinstance(item, dict) and str(item.get("name") or "").strip()
            ]
            if models:
                return models
        except Exception:
            # Keep service usable even when tags endpoint is unavailable.
            pass
    return _extract_models(provider)


async def _stream_from_openai_compatible(
    *,
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    params: Optional[Dict[str, str]] = None,
) -> AsyncIterator[str]:
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, headers=headers, params=params, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue

                body = line[5:].strip()
                if not body or body == "[DONE]":
                    break

                try:
                    chunk = json.loads(body)
                except json.JSONDecodeError:
                    continue

                delta = ""
                choices = chunk.get("choices") or []
                if choices:
                    delta = (
                        choices[0].get("delta", {}).get("content")
                        or choices[0].get("message", {}).get("content")
                        or ""
                    )

                if delta:
                    yield delta


async def _complete_from_openai_compatible(
    *,
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    params: Optional[Dict[str, str]] = None,
) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, params=params, json=payload)
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices") or []
    if not choices:
        return ""

    return choices[0].get("message", {}).get("content") or ""


async def _azure_stream(
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    model_name: str,
    max_tokens: int,
    temperature: float,
) -> AsyncIterator[str]:
    endpoint = str(cfg.get("azure_endpoint") or "").rstrip("/")
    api_key = cfg.get("api_key")
    api_version = str(cfg.get("api_version") or "2024-06-01")
    deployment = model_name or cfg.get("chat_deployment") or cfg.get("default_model")

    if not endpoint or not api_key or not deployment:
        raise RuntimeError("Azure OpenAI provider is missing endpoint, api_key, or chat deployment.")

    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions"
    headers = {
        "api-key": str(api_key),
        "Content-Type": "application/json",
    }
    payload = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    async for chunk in _stream_from_openai_compatible(
        url=url,
        headers=headers,
        payload=payload,
        params={"api-version": api_version},
    ):
        yield chunk


async def _azure_complete(
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    model_name: str,
    max_tokens: int,
    temperature: float,
) -> str:
    endpoint = str(cfg.get("azure_endpoint") or "").rstrip("/")
    api_key = cfg.get("api_key")
    api_version = str(cfg.get("api_version") or "2024-06-01")
    deployment = model_name or cfg.get("chat_deployment") or cfg.get("default_model")

    if not endpoint or not api_key or not deployment:
        raise RuntimeError("Azure OpenAI provider is missing endpoint, api_key, or chat deployment.")

    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions"
    headers = {
        "api-key": str(api_key),
        "Content-Type": "application/json",
    }
    payload = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    return await _complete_from_openai_compatible(
        url=url,
        headers=headers,
        payload=payload,
        params={"api-version": api_version},
    )


async def _chatgpt_stream(
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    model_name: str,
    max_tokens: int,
    temperature: float,
) -> AsyncIterator[str]:
    api_key = cfg.get("api_key")
    if not api_key:
        raise RuntimeError("OpenAI provider is missing api_key.")

    model = model_name or cfg.get("default_model") or "gpt-5-mini"
    endpoint = str(cfg.get("api_endpoint") or "https://api.openai.com/v1").rstrip("/")

    url = f"{endpoint}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    async for chunk in _stream_from_openai_compatible(url=url, headers=headers, payload=payload):
        yield chunk


async def _chatgpt_complete(
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    model_name: str,
    max_tokens: int,
    temperature: float,
) -> str:
    api_key = cfg.get("api_key")
    if not api_key:
        raise RuntimeError("OpenAI provider is missing api_key.")

    model = model_name or cfg.get("default_model") or "gpt-5-mini"
    endpoint = str(cfg.get("api_endpoint") or "https://api.openai.com/v1").rstrip("/")

    url = f"{endpoint}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    return await _complete_from_openai_compatible(url=url, headers=headers, payload=payload)


async def _ollama_stream(
    provider_name: str,
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    model_name: str,
    max_tokens: int,
    temperature: float,
) -> AsyncIterator[str]:
    model = model_name or cfg.get("default_model") or settings.OLLAMA_DEFAULT_MODEL
    if not model:
        raise RuntimeError("Ollama model is not configured.")

    base_url = _ollama_base_url(cfg)
    headers = _ollama_headers(cfg, provider_name)
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
        async with client.stream("POST", f"{base_url}/api/chat", headers=headers, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                delta = (chunk.get("message") or {}).get("content") or ""
                if delta:
                    yield delta
                if chunk.get("done"):
                    break


async def _ollama_complete(
    provider_name: str,
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    model_name: str,
    max_tokens: int,
    temperature: float,
) -> str:
    model = model_name or cfg.get("default_model") or settings.OLLAMA_DEFAULT_MODEL
    if not model:
        raise RuntimeError("Ollama model is not configured.")

    base_url = _ollama_base_url(cfg)
    headers = _ollama_headers(cfg, provider_name)
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
        response = await client.post(f"{base_url}/api/chat", headers=headers, json=payload)
        response.raise_for_status()
        body = response.json()

    return ((body.get("message") or {}).get("content") or "").strip()


async def stream_chat_completion(
    db: AsyncSession,
    tenant_id: str,
    messages: List[Dict[str, str]],
    model_name: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.3,
) -> AsyncIterator[str]:
    provider = await load_active_provider(db, tenant_id)
    max_output_tokens = max_tokens or settings.EKCHAT_CHAT_MAX_TOKENS

    if not provider:
        raise RuntimeError("No active AI provider configured for tenant.")

    if provider.provider_name == "azure-openai":
        async for token in _azure_stream(
            provider.connection_config,
            messages,
            model_name or "",
            max_output_tokens,
            temperature,
        ):
            yield token
        return

    if provider.provider_name == "chatgpt":
        async for token in _chatgpt_stream(
            provider.connection_config,
            messages,
            model_name or "",
            max_output_tokens,
            temperature,
        ):
            yield token
        return

    if provider.provider_name in {"ollama", "ollama-cloud"}:
        async for token in _ollama_stream(
            provider.provider_name,
            provider.connection_config,
            messages,
            model_name or "",
            max_output_tokens,
            temperature,
        ):
            yield token
        return

    raise RuntimeError(
        "Unsupported provider for ekchat-api. Configure tenant default provider as 'azure-openai', 'chatgpt', or 'ollama'."
    )


async def complete_chat(
    db: AsyncSession,
    tenant_id: str,
    messages: List[Dict[str, str]],
    model_name: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.3,
) -> str:
    provider = await load_active_provider(db, tenant_id)
    max_output_tokens = max_tokens or settings.EKCHAT_CHAT_MAX_TOKENS

    if not provider:
        raise RuntimeError("No active AI provider configured for tenant.")

    if provider.provider_name == "azure-openai":
        return await _azure_complete(
            provider.connection_config,
            messages,
            model_name or "",
            max_output_tokens,
            temperature,
        )

    if provider.provider_name == "chatgpt":
        return await _chatgpt_complete(
            provider.connection_config,
            messages,
            model_name or "",
            max_output_tokens,
            temperature,
        )

    if provider.provider_name in {"ollama", "ollama-cloud"}:
        return await _ollama_complete(
            provider.provider_name,
            provider.connection_config,
            messages,
            model_name or "",
            max_output_tokens,
            temperature,
        )

    raise RuntimeError(
        "Unsupported provider for ekchat-api. Configure tenant default provider as 'azure-openai', 'chatgpt', or 'ollama'."
    )


async def embed_texts(
    db: AsyncSession,
    tenant_id: str,
    texts: List[str],
    model_name: Optional[str] = None,
) -> List[List[float]]:
    provider = await load_active_provider(db, tenant_id)
    if not provider:
        raise RuntimeError("No active AI provider configured for tenant.")

    if provider.provider_name == "azure-openai":
        cfg = provider.connection_config
        endpoint = str(cfg.get("azure_endpoint") or "").rstrip("/")
        api_key = cfg.get("api_key")
        api_version = str(cfg.get("api_version") or "2024-06-01")
        deployment = model_name or cfg.get("embedding_deployment")
        if not endpoint or not api_key or not deployment:
            raise RuntimeError("Azure OpenAI embedding config is incomplete.")

        url = f"{endpoint}/openai/deployments/{deployment}/embeddings"
        headers = {"api-key": str(api_key), "Content-Type": "application/json"}
        payload = {"input": texts}

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, params={"api-version": api_version}, json=payload)
            response.raise_for_status()
            body = response.json()

        return [item.get("embedding", []) for item in body.get("data", [])]

    if provider.provider_name == "chatgpt":
        cfg = provider.connection_config
        api_key = cfg.get("api_key")
        endpoint = str(cfg.get("api_endpoint") or "https://api.openai.com/v1").rstrip("/")
        model = model_name or cfg.get("embedding_model") or "text-embedding-3-small"
        if not api_key:
            raise RuntimeError("OpenAI embedding config is incomplete.")

        url = f"{endpoint}/embeddings"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "input": texts}

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            body = response.json()

        return [item.get("embedding", []) for item in body.get("data", [])]

    if provider.provider_name in {"ollama", "ollama-cloud"}:
        cfg = provider.connection_config
        base_url = _ollama_base_url(cfg)
        headers = _ollama_headers(cfg, provider.provider_name)
        model = model_name or cfg.get("embedding_model") or settings.OLLAMA_EMBED_MODEL
        if not model:
            raise RuntimeError("Ollama embedding model is not configured.")

        vectors: List[List[float]] = []
        async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
            for item in texts:
                response = await client.post(
                    f"{base_url}/api/embeddings",
                    headers=headers,
                    json={"model": model, "prompt": item},
                )
                response.raise_for_status()
                body = response.json()
                vector = body.get("embedding") or []
                vectors.append(vector if isinstance(vector, list) else [])
        return vectors

    raise RuntimeError("Unsupported provider for embeddings.")
