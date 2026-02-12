"""Opportunities endpoints"""
from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from datetime import datetime
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.opportunity_service import (
    create_opportunity,
    get_opportunity,
    list_opportunities,
    update_opportunity,
    add_contact_to_opportunity,
    add_activity,
    get_opportunity_timeline,
)
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate

router = APIRouter()


@router.post("/opportunities")
async def create_opp(
    data: OpportunityCreate,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a new opportunity"""
    try:
        # Convert Pydantic model to dict and handle timezone-aware datetimes
        # Use model_dump() for Pydantic v2, fallback to dict() for v1
        try:
            data_dict = data.model_dump() if hasattr(data, 'model_dump') else data.dict()
        except:
            data_dict = data.dict()
        
        # Convert timezone-aware datetime to naive (for database compatibility)
        if data_dict.get("due_date"):
            due_date_val = data_dict["due_date"]
            if isinstance(due_date_val, datetime):
                if due_date_val.tzinfo is not None:
                    # Convert to UTC and remove timezone
                    from datetime import timezone
                    data_dict["due_date"] = due_date_val.astimezone(timezone.utc).replace(tzinfo=None)
            elif isinstance(due_date_val, str):
                # If it's still a string, parse it and make it naive
                try:
                    from datetime import timezone
                    parsed = datetime.fromisoformat(due_date_val.replace("Z", "+00:00"))
                    if parsed.tzinfo is not None:
                        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
                    data_dict["due_date"] = parsed
                except:
                    pass
        
        opp = await create_opportunity(
            db=db,
            tenant_id=tenant.id,
            data=data_dict,
        )
        return opp
    except Exception as e:
        from fastapi import HTTPException, status
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating opportunity: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create opportunity: {str(e)}"
        )


@router.get("/opportunities")
async def list_opps(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    stage: Optional[str] = None,
    status: Optional[str] = None,
    agency: Optional[str] = None,
    owner_id: Optional[str] = None,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List opportunities with filtering"""
    filters = {}
    if stage:
        filters["stage"] = stage
    if status:
        filters["status"] = status
    if agency:
        filters["agency"] = agency
    if owner_id:
        filters["owner_id"] = owner_id
    
    opps = await list_opportunities(
        db=db,
        tenant_id=tenant.id,
        filters=filters,
        skip=skip,
        limit=limit,
    )
    return {"opportunities": opps, "total": len(opps)}


@router.get("/opportunities/{opportunity_id}")
async def get_opp(
    opportunity_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get an opportunity by ID"""
    opp = await get_opportunity(db, opportunity_id, tenant.id)
    if not opp:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return opp


@router.put("/opportunities/{opportunity_id}")
async def update_opp(
    opportunity_id: str,
    data: OpportunityUpdate,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update an opportunity"""
    opp = await update_opportunity(
        db=db,
        opportunity_id=opportunity_id,
        tenant_id=tenant.id,
        data=data.dict(exclude_unset=True),
    )
    if not opp:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return opp


@router.post("/opportunities/{opportunity_id}/contacts")
async def add_contact(
    opportunity_id: str,
    contact_id: str = Body(...),
    role: str = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Add a contact to an opportunity"""
    opp_contact = await add_contact_to_opportunity(
        db=db,
        opportunity_id=opportunity_id,
        contact_id=contact_id,
        role=role,
        tenant_id=tenant.id,
    )
    if not opp_contact:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return opp_contact


@router.get("/opportunities/{opportunity_id}/timeline")
async def get_timeline(
    opportunity_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get activity timeline for an opportunity"""
    timeline = await get_opportunity_timeline(db, opportunity_id, tenant.id)
    return {"timeline": timeline}


@router.post("/opportunities/{opportunity_id}/activities")
async def create_activity(
    opportunity_id: str,
    activity_type: str = Body(...),
    subject: Optional[str] = Body(None),
    description: Optional[str] = Body(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Add an activity to opportunity timeline"""
    activity = await add_activity(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        opportunity_id=opportunity_id,
        activity_type=activity_type,
        subject=subject,
        description=description,
    )
    return activity


@router.delete("/opportunities/{opportunity_id}")
async def delete_opp(
    opportunity_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete an opportunity and all related data"""
    from fastapi import HTTPException, status
    from sqlalchemy import select, and_
    from app.models.opportunity import Opportunity
    from app.models.document import Document
    from app.config import settings
    import os
    import shutil
    
    # Get the opportunity
    result = await db.execute(
        select(Opportunity).where(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.tenant_id == tenant.id,
            )
        )
    )
    opp = result.scalar_one_or_none()
    
    if not opp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    
    # Delete associated files
    opp_upload_dir = os.path.join(settings.UPLOAD_DIR, tenant.id, opportunity_id)
    if os.path.exists(opp_upload_dir):
        try:
            shutil.rmtree(opp_upload_dir)
        except Exception as e:
            pass  # Log but continue with deletion
    
    # Delete the opportunity (cascade will handle related records)
    await db.delete(opp)
    await db.commit()
    
    return {"message": "Opportunity deleted successfully", "id": opportunity_id}
