"""Opportunity service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime
from decimal import Decimal

from app.models.opportunity import Opportunity, OpportunityContact
from app.models.contact import Contact
from app.models.activity import Activity
from app.models.document import Document


async def create_opportunity(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Opportunity:
    """Create a new opportunity"""
    def _normalize_datetime(value: Any) -> Optional[datetime]:
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            if value.tzinfo is not None:
                from datetime import timezone
                return value.astimezone(timezone.utc).replace(tzinfo=None)
            return value
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if parsed.tzinfo is not None:
                    from datetime import timezone
                    parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
                return parsed
            except (ValueError, AttributeError, TypeError):
                return None
        return None

    def _to_decimal(value: Any) -> Optional[Decimal]:
        if value is None or value == "":
            return None
        try:
            return Decimal(str(value))
        except (ValueError, TypeError):
            return None

    due_date = _normalize_datetime(data.get("due_date"))
    rfp_submission_date = _normalize_datetime(data.get("rfp_submission_date"))
    award_date = _normalize_datetime(data.get("award_date"))
    next_task_due = _normalize_datetime(data.get("next_task_due"))

    value = _to_decimal(data.get("value"))
    pwin = _to_decimal(data.get("pwin"))
    ptw = _to_decimal(data.get("ptw"))

    number_of_years = None
    if data.get("number_of_years") not in (None, ""):
        try:
            number_of_years = int(data["number_of_years"])
        except (ValueError, TypeError):
            number_of_years = None

    opportunity = Opportunity(
        tenant_id=tenant_id,
        name=data["name"],
        agency=data.get("agency"),
        sub_agency=data.get("sub_agency"),
        stage=data.get("stage", "qualification"),
        status=data.get("status", "active"),  # Explicitly set status
        value=value,
        pwin=pwin,
        ptw=ptw,
        due_date=due_date,
        rfp_submission_date=rfp_submission_date,
        award_date=award_date,
        naics_code=data.get("naics_code"),
        contract_vehicle=data.get("contract_vehicle"),
        opportunity_type=data.get("opportunity_type"),
        description=data.get("description"),
        summary=data.get("summary"),
        history_notes=data.get("history_notes"),
        next_task_comments=data.get("next_task_comments"),
        next_task_due=next_task_due,
        capture_manager=data.get("capture_manager"),
        agency_pocs=data.get("agency_pocs"),
        business_sectors=data.get("business_sectors"),
        role=data.get("role"),
        number_of_years=number_of_years,
        bd_status=data.get("bd_status"),
        requirements=data.get("requirements"),
        account_id=data.get("account_id"),
        owner_id=data.get("owner_id"),
    )
    
    db.add(opportunity)
    await db.commit()
    await db.refresh(opportunity)
    return opportunity


async def get_opportunity(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
) -> Optional[Opportunity]:
    """Get an opportunity by ID"""
    result = await db.execute(
        select(Opportunity).where(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.tenant_id == tenant_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def list_opportunities(
    db: AsyncSession,
    tenant_id: str,
    filters: Optional[Dict[str, Any]] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Opportunity]:
    """List opportunities with filtering"""
    query = select(Opportunity).where(Opportunity.tenant_id == tenant_id)
    
    if filters:
        if filters.get("stage"):
            query = query.where(Opportunity.stage == filters["stage"])
        if filters.get("status"):
            query = query.where(Opportunity.status == filters["status"])
        if filters.get("agency"):
            query = query.where(Opportunity.agency.ilike(f"%{filters['agency']}%"))
        if filters.get("owner_id"):
            query = query.where(Opportunity.owner_id == filters["owner_id"])
    
    query = query.offset(skip).limit(limit).order_by(Opportunity.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_opportunity(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
    data: Dict[str, Any],
) -> Optional[Opportunity]:
    """Update an opportunity"""
    opportunity = await get_opportunity(db, opportunity_id, tenant_id)
    if not opportunity:
        return None
    
    def _normalize_update_datetime(value: Any) -> Optional[datetime]:
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            if value.tzinfo is not None:
                from datetime import timezone
                return value.astimezone(timezone.utc).replace(tzinfo=None)
            return value
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if parsed.tzinfo is not None:
                    from datetime import timezone
                    parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
                return parsed
            except (ValueError, AttributeError, TypeError):
                return None
        return None

    for key, value in data.items():
        if not hasattr(opportunity, key):
            continue

        if key in {"value", "pwin", "ptw"}:
            converted = _to_decimal(value)
            setattr(opportunity, key, converted)
        elif key in {"due_date", "rfp_submission_date", "award_date", "next_task_due"}:
            setattr(opportunity, key, _normalize_update_datetime(value))
        elif key == "number_of_years":
            if value in (None, ""):
                setattr(opportunity, key, None)
            else:
                try:
                    setattr(opportunity, key, int(value))
                except (ValueError, TypeError):
                    pass
        elif value is not None:
            setattr(opportunity, key, value)
 
    opportunity.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(opportunity)
    return opportunity


async def add_contact_to_opportunity(
    db: AsyncSession,
    opportunity_id: str,
    contact_id: str,
    role: str,
    tenant_id: str,
) -> Optional[OpportunityContact]:
    """Add a contact to an opportunity"""
    # Verify opportunity belongs to tenant
    opportunity = await get_opportunity(db, opportunity_id, tenant_id)
    if not opportunity:
        return None
    
    opp_contact = OpportunityContact(
        opportunity_id=opportunity_id,
        contact_id=contact_id,
        role=role,
    )
    
    db.add(opp_contact)
    await db.commit()
    await db.refresh(opp_contact)
    return opp_contact


async def add_activity(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    opportunity_id: Optional[str],
    activity_type: str,
    subject: Optional[str],
    description: Optional[str],
) -> Activity:
    """Add an activity to timeline"""
    activity = Activity(
        tenant_id=tenant_id,
        user_id=user_id,
        opportunity_id=opportunity_id,
        activity_type=activity_type,
        subject=subject,
        description=description,
        activity_date=datetime.utcnow(),
    )
    
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


async def get_opportunity_timeline(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
) -> List[Activity]:
    """Get activity timeline for an opportunity"""
    result = await db.execute(
        select(Activity).where(
            and_(
                Activity.opportunity_id == opportunity_id,
                Activity.tenant_id == tenant_id,
            )
        ).order_by(Activity.activity_date.desc())
    )
    return list(result.scalars().all())

