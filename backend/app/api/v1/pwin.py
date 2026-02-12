"""PWin Calculator endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.pwin_service import create_pwin_score, get_pwin_history

router = APIRouter()


@router.post("/scores")
async def create_score(
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a PWin score"""
    score = await create_pwin_score(db=db, tenant_id=tenant.id, data=data)
    return score


@router.get("/opportunities/{opportunity_id}/scores")
async def get_scores(
    opportunity_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get PWin score history"""
    history = await get_pwin_history(db, opportunity_id, tenant.id)
    return {"history": history}
