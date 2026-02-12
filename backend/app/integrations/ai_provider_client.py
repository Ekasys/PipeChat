"""Unified AI Provider Client - supports multiple AI providers."""
from typing import Optional, Dict, Any

import asyncio
import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_provider import AIProvider


async def get_active_provider(
    db: AsyncSession,
    tenant_id: str,
    provider_name: Optional[str] = None,
) -> Optional[AIProvider]:
    """Get the active AI provider for a tenant."""
    if provider_name:
        result = await db.execute(
            select(AIProvider).where(
                and_(
                    AIProvider.tenant_id == tenant_id,
                    AIProvider.provider_name == provider_name,
                    AIProvider.is_active == True,
                )
            )
        )
    else:
        result = await db.execute(
            select(AIProvider).where(
                and_(
                    AIProvider.tenant_id == tenant_id,
                    AIProvider.is_default == True,
                    AIProvider.is_active == True,
                )
            )
        )
        provider = result.scalar_one_or_none()
        if not provider:
            result = await db.execute(
                select(AIProvider).where(
                    and_(
                        AIProvider.tenant_id == tenant_id,
                        AIProvider.is_active == True,
                    )
                )
            )

    return result.scalar_one_or_none()


async def call_ai_provider(
    db: AsyncSession,
    tenant_id: str,
    prompt: str,
    model: Optional[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.3,
    provider_name: Optional[str] = None,
) -> Optional[str]:
    """Call AI provider API - unified interface for all providers."""
    provider = await get_active_provider(db, tenant_id, provider_name)

    if not provider:
        return "[Error: No active AI provider configured. Please configure an AI provider in Admin > Settings.]"

    if not provider.is_active:
        return f"[Error: AI provider '{provider.display_name}' is not active.]"

    config = provider.connection_config or {}
    provider_type = provider.provider_name

    model_name = model or config.get("default_model") or get_default_model(provider_type)
    max_tokens = max_tokens or config.get("max_tokens", 1000)
    temperature = temperature if temperature is not None else config.get("temperature", 0.3)

    try:
        if provider_type == "azure-openai":
            return await call_azure_openai(config, prompt, model_name, max_tokens, temperature)
        if provider_type == "chatgpt":
            return await call_chatgpt(config, prompt, model_name, max_tokens, temperature)
        if provider_type == "gemini":
            return await call_gemini(config, prompt, model_name, max_tokens, temperature)
        if provider_type == "grok":
            return await call_grok(config, prompt, model_name, max_tokens, temperature)
        if provider_type in ["ollama", "ollama-cloud"]:
            return await call_ollama(config, prompt, model_name, max_tokens, temperature, provider_type)
        return f"[Error: Unsupported provider type: {provider_type}]"
    except Exception as exc:
        import traceback

        print(f"AI Provider error ({provider_type}): {exc}")
        print(traceback.format_exc())
        return f"[Error: {provider.display_name} API call failed: {str(exc)}]"


def get_default_model(provider_type: str) -> str:
    """Get default model for provider type."""
    defaults = {
        "azure-openai": "balanced-mid",
        "chatgpt": "gpt-5-mini",
        "gemini": "gemini-1.5-pro",
        "grok": "grok-2",
        "ollama": "llama3.1",
        "ollama-cloud": "llama3.1",
    }
    return defaults.get(provider_type, "gpt-5-mini")


async def call_azure_openai(
    config: Dict[str, Any],
    prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    """Call Azure OpenAI Chat Completions API using deployment names."""
    endpoint = str(config.get("azure_endpoint") or "").rstrip("/")
    api_key = config.get("api_key")
    api_version = str(config.get("api_version") or "2024-06-01")

    deployment = model or config.get("chat_deployment") or config.get("default_model")

    if not endpoint:
        return "[Error: Azure OpenAI endpoint not configured]"
    if not api_key and str(config.get("auth_mode") or "api-key") == "api-key":
        return "[Error: Azure OpenAI API key not configured]"
    if not deployment:
        return "[Error: Azure OpenAI chat deployment not configured]"

    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["api-key"] = str(api_key)

    payload = {
        "messages": [
            {
                "role": "system",
                "content": "You are an expert proposal writer specializing in government contracting proposals. You write formal, direct proposal sections for federal government submissions.",
            },
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            params={"api-version": api_version},
            json=payload,
            headers=headers,
        )
        if response.status_code >= 400:
            return f"[Error: Azure OpenAI API call failed ({response.status_code}): {response.text}]"

        data = response.json()
        choices = data.get("choices") or []
        if choices:
            message = choices[0].get("message", {})
            return message.get("content", "[Error: No content in Azure OpenAI response]")

        return "[Error: No choices in Azure OpenAI response]"


async def call_chatgpt(
    config: Dict[str, Any],
    prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    """Call OpenAI ChatGPT API."""
    import openai

    api_key = config.get("api_key")
    if not api_key:
        return "[Error: OpenAI API key not configured]"

    client = openai.OpenAI(api_key=api_key)

    is_gpt5 = model.startswith("gpt-5")

    if is_gpt5:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "input": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "You are an expert proposal writer specializing in government contracting proposals. You write formal, direct proposal sections for federal government submissions.",
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": prompt}],
                },
            ],
            "text": {"verbosity": "high"},
        }

        async with httpx.AsyncClient(timeout=120.0) as http_client:
            resp = await http_client.post("https://api.openai.com/v1/responses", json=payload, headers=headers)
            if resp.status_code >= 400:
                return f"[Error: OpenAI API call failed ({resp.status_code}): {resp.text}]"

            data = resp.json()
            output = data.get("output", [])
            texts = []
            for item in output:
                if isinstance(item, dict):
                    content = item.get("content", [])
                    for sub in content:
                        if isinstance(sub, dict) and "text" in sub:
                            texts.append(sub["text"])
                        elif isinstance(sub, str):
                            texts.append(sub)
            return "\n".join(texts) if texts else "[Error: No text output from API]"

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        ),
    )
    return response.choices[0].message.content


async def call_gemini(
    config: Dict[str, Any],
    prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    """Call Google Gemini API."""
    api_key = config.get("api_key")
    if not api_key:
        return "[Error: Gemini API key not configured]"

    endpoint = config.get("api_endpoint", "https://generativelanguage.googleapis.com/v1")
    url = f"{endpoint}/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload)
        if response.status_code >= 400:
            return f"[Error: Gemini API call failed ({response.status_code}): {response.text}]"

        data = response.json()
        candidates = data.get("candidates", [])
        if candidates:
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if parts:
                return parts[0].get("text", "[Error: No text in response]")

        return "[Error: No content in Gemini response]"


async def call_grok(
    config: Dict[str, Any],
    prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> Optional[str]:
    """Call xAI Grok API."""
    api_key = config.get("api_key")
    if not api_key:
        return "[Error: Grok API key not configured]"

    endpoint = config.get("api_endpoint", "https://api.x.ai/v1")
    url = f"{endpoint}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code >= 400:
            return f"[Error: Grok API call failed ({response.status_code}): {response.text}]"

        data = response.json()
        choices = data.get("choices", [])
        if choices:
            message = choices[0].get("message", {})
            return message.get("content", "[Error: No content in response]")

        return "[Error: No choices in Grok response]"


async def call_ollama(
    config: Dict[str, Any],
    prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
    provider_type: str,
) -> Optional[str]:
    """Call Ollama API (local or cloud)."""
    base_url = config.get("base_url")
    if not base_url:
        return "[Error: Ollama base URL not configured]"

    api_key = config.get("api_key") if provider_type == "ollama-cloud" else None
    url = f"{base_url}/api/generate"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code >= 400:
            return f"[Error: Ollama API call failed ({response.status_code}): {response.text}]"

        data = response.json()
        return data.get("response", "[Error: No response from Ollama]")
