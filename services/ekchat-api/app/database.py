"""Database connection and tenant context helpers."""
import json
import os
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.security import AuthenticatedUser


def _build_engine_config():
    url = make_url(settings.DATABASE_URL)
    connect_args: Dict[str, Any] = {}

    if url.drivername.endswith("+asyncpg"):
        query = dict(url.query)
        ssl_mode = str(query.pop("sslmode", "")).lower()
        ssl_flag = str(query.pop("ssl", "")).lower()
        env_ssl = os.getenv("DATABASE_SSL", "").lower()

        ssl_required = ssl_mode in {"require", "verify-ca", "verify-full"} or ssl_flag in {
            "true",
            "1",
            "require",
        }
        if ssl_required or env_ssl in {"true", "1", "require"}:
            connect_args["ssl"] = True

        url = url.set(query=query)

    return url, connect_args


engine_url, engine_connect_args = _build_engine_config()
engine = create_async_engine(
    engine_url,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
    future=True,
    connect_args=engine_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def set_rls_context(session: AsyncSession, user: AuthenticatedUser) -> None:
    """Bind tenant and user identifiers to the transaction for RLS policies."""
    await session.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": user.tenant_id},
    )
    await session.execute(
        text("SELECT set_config('app.user_id', :user_id, true)"),
        {"user_id": user.user_id},
    )


async def load_tenant_settings(session: AsyncSession, tenant_id: str) -> Dict[str, Any]:
    result = await session.execute(
        text("SELECT settings FROM public.tenants WHERE id = :tenant_id"),
        {"tenant_id": tenant_id},
    )
    raw = result.scalar_one_or_none()

    if raw is None:
        return {}

    if isinstance(raw, dict):
        return raw

    if isinstance(raw, str):
        text_value = raw.strip()
        if not text_value:
            return {}
        try:
            parsed = json.loads(text_value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}

    return {}


async def is_feature_enabled(
    session: AsyncSession,
    tenant_id: str,
    feature_name: str,
    default: bool = False,
) -> bool:
    settings_map = await load_tenant_settings(session, tenant_id)
    if feature_name not in settings_map:
        return default

    raw = settings_map.get(feature_name)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return raw != 0
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on", "enabled"}

    return default
