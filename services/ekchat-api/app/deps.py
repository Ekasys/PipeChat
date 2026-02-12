"""FastAPI dependencies for request-scoped tenant context."""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, is_feature_enabled, set_rls_context
from app.security import AuthenticatedUser, get_current_user


@dataclass
class RequestContext:
    user: AuthenticatedUser
    db: AsyncSession


async def get_request_context(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        await set_rls_context(db, user)
        yield RequestContext(user=user, db=db)


def require_feature(flag_name: str, *, default: bool = False):
    async def _feature_guard(ctx: RequestContext = Depends(get_request_context)) -> RequestContext:
        enabled = await is_feature_enabled(ctx.db, ctx.user.tenant_id, flag_name, default=default)
        if not enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{flag_name}' is disabled for this tenant.",
            )
        return ctx

    return _feature_guard
