"""Teaming & Partners endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.teaming_service import create_partner, list_partners, calculate_partner_fit_score

router = APIRouter()


@router.post("/partners")
async def create_part(
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a partner"""
    from datetime import datetime
    from decimal import Decimal
    
    partner = await create_partner(db=db, tenant_id=tenant.id, data=data)
    
    # Serialize partner to dict
    partner_dict = {}
    for c in partner.__table__.columns:
        value = getattr(partner, c.name)
        if value is not None:
            if isinstance(value, datetime):
                partner_dict[c.name] = value.isoformat()
            elif isinstance(value, Decimal):
                partner_dict[c.name] = float(value)
            else:
                partner_dict[c.name] = value
        else:
            partner_dict[c.name] = None
    
    return partner_dict


@router.get("/partners")
async def list_part(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List partners"""
    from datetime import datetime
    from decimal import Decimal
    
    partners = await list_partners(db, tenant.id)
    
    # Serialize partners to dicts
    partners_list = []
    for partner in partners:
        partner_dict = {}
        for c in partner.__table__.columns:
            value = getattr(partner, c.name)
            if value is not None:
                if isinstance(value, datetime):
                    partner_dict[c.name] = value.isoformat()
                elif isinstance(value, Decimal):
                    partner_dict[c.name] = float(value)
                else:
                    partner_dict[c.name] = value
            else:
                partner_dict[c.name] = None
        partners_list.append(partner_dict)
    
    return {"partners": partners_list}


@router.get("/partners/{partner_id}")
async def get_partner(
    partner_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get partner details"""
    from app.models.partner import Partner
    from sqlalchemy import select, and_
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Partner).where(
            and_(
                Partner.id == partner_id,
                Partner.tenant_id == tenant.id,
            )
        )
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    
    # Serialize partner to dict
    from datetime import datetime
    from decimal import Decimal
    
    partner_dict = {}
    for c in partner.__table__.columns:
        value = getattr(partner, c.name)
        if value is not None:
            if isinstance(value, datetime):
                partner_dict[c.name] = value.isoformat()
            elif isinstance(value, Decimal):
                partner_dict[c.name] = float(value)
            else:
                partner_dict[c.name] = value
        else:
            partner_dict[c.name] = None
    
    return partner_dict


@router.put("/partners/{partner_id}")
async def update_partner(
    partner_id: str,
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a partner"""
    from app.models.partner import Partner
    from sqlalchemy import select, and_
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Partner).where(
            and_(
                Partner.id == partner_id,
                Partner.tenant_id == tenant.id,
            )
        )
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    
    # Update fields
    allowed_fields = {
        "name",
        "company_name",
        "description",
        "website",
        "contact_email",
        "contact_phone",
        "capabilities",
        "contract_vehicles",
        "status",
        "win_rate",
        "fit_score",
        "naics_codes",
    }
    for key, value in data.items():
        if key in allowed_fields:
            setattr(partner, key, value)
    
    await db.commit()
    await db.refresh(partner)
    
    # Serialize partner to dict
    from datetime import datetime
    from decimal import Decimal
    
    partner_dict = {}
    for c in partner.__table__.columns:
        value = getattr(partner, c.name)
        if value is not None:
            if isinstance(value, datetime):
                partner_dict[c.name] = value.isoformat()
            elif isinstance(value, Decimal):
                partner_dict[c.name] = float(value)
            else:
                partner_dict[c.name] = value
        else:
            partner_dict[c.name] = None
    
    return partner_dict


@router.delete("/partners/{partner_id}")
async def delete_partner(
    partner_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete a partner"""
    from app.models.partner import Partner
    from sqlalchemy import select, and_
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Partner).where(
            and_(
                Partner.id == partner_id,
                Partner.tenant_id == tenant.id,
            )
        )
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    
    await db.delete(partner)
    await db.commit()
    return {"message": "Partner deleted successfully"}


@router.post("/partners/{partner_id}/calculate-fit")
async def calculate_fit(
    partner_id: str,
    opportunity_requirements: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Calculate partner fit score"""
    from app.models.partner import Partner
    from sqlalchemy import select, and_
    
    result = await db.execute(
        select(Partner).where(
            and_(
                Partner.id == partner_id,
                Partner.tenant_id == tenant.id,
            )
        )
    )
    partner = result.scalar_one_or_none()
    
    if not partner:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    
    fit_score = await calculate_partner_fit_score(partner, opportunity_requirements)
    return {"fit_score": fit_score}
