"""CRM endpoints"""
from fastapi import APIRouter, Depends, Body, Query, Response
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
import csv
import io
from app.services.crm_service import (
    create_account,
    create_contact,
    calculate_relationship_health,
    get_org_chart,
    add_account_activity,
    add_contact_activity,
    get_account_timeline,
    get_contact_timeline,
)

router = APIRouter()


@router.post("/accounts")
async def create_acc(
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create an account"""
    account = await create_account(db=db, tenant_id=tenant.id, data=data)
    return account


@router.get("/accounts")
async def list_accounts(
    search: Optional[str] = Query(None, description="Search by name or agency"),
    organization_type: Optional[str] = Query(None, description="Filter by organization type"),
    account_type: Optional[str] = Query(None, description="Filter by account type (customer, teaming_partner)"),
    relationship_health: Optional[str] = Query(None, description="Filter by relationship health"),
    sort_by: Optional[str] = Query("created_at", description="Sort field (name, created_at, relationship_health_score)"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    page: Optional[int] = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(50, ge=1, le=100, description="Items per page"),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List accounts with search, filter, sort, and pagination"""
    from app.models.account import Account
    
    query = select(Account).where(Account.tenant_id == tenant.id)
    
    # Search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Account.name).like(search_term),
                func.lower(Account.agency).like(search_term),
            )
        )
    
    # Organization type filter
    if organization_type:
        query = query.where(Account.organization_type == organization_type)
    
    # Account type filter
    if account_type:
        query = query.where(Account.account_type == account_type)
    
    # Relationship health filter
    if relationship_health:
        query = query.where(Account.relationship_health_score == relationship_health)
    
    # Sorting
    sort_field = getattr(Account, sort_by, Account.created_at)
    if sort_order == "asc":
        query = query.order_by(asc(sort_field))
    else:
        query = query.order_by(desc(sort_field))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    accounts = result.scalars().all()
    
    # Enrich accounts with opportunity counts and values
    from app.models.opportunity import Opportunity
    from app.models.contact import Contact
    enriched_accounts = []
    for account in accounts:
        # Get opportunity counts and total value
        opps_result = await db.execute(
            select(
                func.count(Opportunity.id),
                func.coalesce(func.sum(Opportunity.value), 0)
            ).where(
                and_(
                    Opportunity.account_id == account.id,
                    Opportunity.tenant_id == tenant.id,
                )
            )
        )
        opps_data = opps_result.first()
        opportunities_count = opps_data[0] or 0
        total_opportunity_value = float(opps_data[1] or 0)
        
        # Get contacts count
        contacts_result = await db.execute(
            select(func.count(Contact.id)).where(
                and_(
                    Contact.account_id == account.id,
                    Contact.tenant_id == tenant.id,
                )
            )
        )
        contacts_count = contacts_result.scalar() or 0
        
        account_dict = {
            **{c.name: getattr(account, c.name) for c in account.__table__.columns},
            "opportunities_count": opportunities_count,
            "total_opportunity_value": total_opportunity_value,
            "contacts_count": contacts_count,
        }
        enriched_accounts.append(account_dict)
    
    return {
        "accounts": enriched_accounts,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.get("/accounts/{account_id}")
async def get_account(
    account_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get account details with related data"""
    from app.models.account import Account
    from app.models.contact import Contact
    from app.models.opportunity import Opportunity
    from sqlalchemy import select, and_, func
    from fastapi import HTTPException, status
    
    # Get account
    result = await db.execute(
        select(Account).where(
            and_(
                Account.id == account_id,
                Account.tenant_id == tenant.id,
            )
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    
    # Get related contacts count
    contacts_result = await db.execute(
        select(func.count(Contact.id)).where(
            and_(
                Contact.account_id == account_id,
                Contact.tenant_id == tenant.id,
            )
        )
    )
    contacts_count = contacts_result.scalar() or 0
    
    # Get related opportunities count and total value
    opps_result = await db.execute(
        select(
            func.count(Opportunity.id),
            func.coalesce(func.sum(Opportunity.value), 0)
        ).where(
            and_(
                Opportunity.account_id == account_id,
                Opportunity.tenant_id == tenant.id,
            )
        )
    )
    opps_data = opps_result.first()
    opportunities_count = opps_data[0] or 0
    total_opportunity_value = float(opps_data[1] or 0)
    
    # Get active opportunities
    active_opps_result = await db.execute(
        select(Opportunity).where(
            and_(
                Opportunity.account_id == account_id,
                Opportunity.tenant_id == tenant.id,
                Opportunity.status == "active",
            )
        ).limit(10)
    )
    active_opportunities = active_opps_result.scalars().all()
    
    # Get recent contacts
    contacts_result = await db.execute(
        select(Contact).where(
            and_(
                Contact.account_id == account_id,
                Contact.tenant_id == tenant.id,
            )
        ).limit(10)
    )
    recent_contacts = contacts_result.scalars().all()
    
    # Convert account to dict with proper serialization
    account_dict = {}
    for c in account.__table__.columns:
        value = getattr(account, c.name)
        if value is not None:
            if isinstance(value, datetime):
                account_dict[c.name] = value.isoformat()
            else:
                account_dict[c.name] = value
        else:
            account_dict[c.name] = None
    
    # Serialize active opportunities
    active_opps_list = []
    for opp in active_opportunities:
        opp_dict = {}
        for c in opp.__table__.columns:
            value = getattr(opp, c.name)
            if value is not None:
                if isinstance(value, datetime):
                    opp_dict[c.name] = value.isoformat()
                else:
                    opp_dict[c.name] = value
            else:
                opp_dict[c.name] = None
        active_opps_list.append(opp_dict)
    
    # Serialize recent contacts
    recent_contacts_list = []
    for contact in recent_contacts:
        contact_dict = {}
        for c in contact.__table__.columns:
            value = getattr(contact, c.name)
            if value is not None:
                if isinstance(value, datetime):
                    contact_dict[c.name] = value.isoformat()
                else:
                    contact_dict[c.name] = value
            else:
                contact_dict[c.name] = None
        recent_contacts_list.append(contact_dict)
    
    account_dict.update({
        "contacts_count": contacts_count,
        "opportunities_count": opportunities_count,
        "total_opportunity_value": total_opportunity_value,
        "active_opportunities": active_opps_list,
        "recent_contacts": recent_contacts_list,
    })
    
    return account_dict


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update an account"""
    from app.models.account import Account
    from sqlalchemy import select, and_
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Account).where(
            and_(
                Account.id == account_id,
                Account.tenant_id == tenant.id,
            )
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    
    # Store old account_type to check if it changed
    old_account_type = account.account_type
    
    # Update fields (exclude read-only fields)
    excluded_fields = {'id', 'tenant_id', 'created_at', 'updated_at'}
    for key, value in data.items():
        if key not in excluded_fields and hasattr(account, key):
            # Convert empty strings to None for optional fields
            if value == '':
                value = None
            setattr(account, key, value)
    
    await db.commit()
    await db.refresh(account)
    
    # Handle account_type changes for teaming partners
    from app.models.partner import Partner
    if account.account_type == 'teaming_partner':
        # Find or create partner for this account
        partner_result = await db.execute(
            select(Partner).where(
                and_(
                    Partner.tenant_id == tenant.id,
                    Partner.name == account.name,
                )
            )
        )
        existing_partner = partner_result.scalar_one_or_none()
        
        if not existing_partner:
            # Create new partner
            partner = Partner(
                tenant_id=tenant.id,
                name=account.name,
                company_name=None,  # Don't duplicate name - leave company_name empty
                description=account.notes,
                website=account.website,
                contact_phone=account.phone,
                naics_codes=account.naics_codes,
                contract_vehicles=account.contract_vehicles,
                status="active",
                onboarding_status="not_started",
            )
            db.add(partner)
            await db.commit()
        else:
            # Update existing partner with account data
            existing_partner.name = account.name
            # Only update company_name if it was previously set (don't overwrite with duplicate)
            if existing_partner.company_name and existing_partner.company_name != account.name:
                existing_partner.company_name = account.name
            existing_partner.description = account.notes
            existing_partner.website = account.website
            existing_partner.contact_phone = account.phone
            existing_partner.naics_codes = account.naics_codes
            existing_partner.contract_vehicles = account.contract_vehicles
            if existing_partner.status == "inactive":
                existing_partner.status = "active"
            await db.commit()
    elif old_account_type == 'teaming_partner' and account.account_type != 'teaming_partner':
        # Account was changed from teaming_partner, mark partner as inactive
        partner_result = await db.execute(
            select(Partner).where(
                and_(
                    Partner.tenant_id == tenant.id,
                    Partner.name == account.name,
                )
            )
        )
        existing_partner = partner_result.scalar_one_or_none()
        if existing_partner:
            existing_partner.status = "inactive"
            await db.commit()
    
    # Serialize account to dict
    account_dict = {}
    for c in account.__table__.columns:
        value = getattr(account, c.name)
        if value is not None:
            if isinstance(value, datetime):
                account_dict[c.name] = value.isoformat()
            else:
                account_dict[c.name] = value
        else:
            account_dict[c.name] = None
    
    return account_dict


@router.post("/contacts")
async def create_cont(
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a contact"""
    contact = await create_contact(db=db, tenant_id=tenant.id, data=data)
    return contact


@router.get("/accounts/{account_id}/health")
async def get_health(
    account_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get relationship health score"""
    health = await calculate_relationship_health(db, account_id, tenant.id)
    return {"health_score": health}


@router.get("/contacts")
async def list_contacts(
    account_id: Optional[str] = Query(None, description="Filter by account ID"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    influence_level: Optional[str] = Query(None, description="Filter by influence level"),
    relationship_strength: Optional[str] = Query(None, description="Filter by relationship strength"),
    sort_by: Optional[str] = Query("created_at", description="Sort field (first_name, last_name, created_at)"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    page: Optional[int] = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(50, ge=1, le=100, description="Items per page"),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List contacts with search, filter, sort, and pagination"""
    from app.models.contact import Contact
    
    query = select(Contact).where(Contact.tenant_id == tenant.id)
    
    # Account filter
    if account_id:
        query = query.where(Contact.account_id == account_id)
    
    # Search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Contact.first_name).like(search_term),
                func.lower(Contact.last_name).like(search_term),
                func.lower(Contact.email).like(search_term),
            )
        )
    
    # Influence level filter
    if influence_level:
        query = query.where(Contact.influence_level == influence_level)
    
    # Relationship strength filter
    if relationship_strength:
        query = query.where(Contact.relationship_strength == relationship_strength)
    
    # Sorting
    sort_field = getattr(Contact, sort_by, Contact.created_at)
    if sort_order == "asc":
        query = query.order_by(asc(sort_field))
    else:
        query = query.order_by(desc(sort_field))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    contacts = result.scalars().all()
    
    return {
        "contacts": list(contacts),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get contact details with related data"""
    from app.models.contact import Contact
    from app.models.opportunity import Opportunity, OpportunityContact
    from app.models.account import Account
    from sqlalchemy import select, and_, func
    from fastapi import HTTPException, status
    
    # Get contact
    result = await db.execute(
        select(Contact).where(
            and_(
                Contact.id == contact_id,
                Contact.tenant_id == tenant.id,
            )
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    
    # Get account if exists
    account = None
    if contact.account_id:
        account_result = await db.execute(
            select(Account).where(
                and_(
                    Account.id == contact.account_id,
                    Account.tenant_id == tenant.id,
                )
            )
        )
        account = account_result.scalar_one_or_none()
    
    # Get related opportunities
    opps_result = await db.execute(
        select(Opportunity)
        .join(OpportunityContact, Opportunity.id == OpportunityContact.opportunity_id)
        .where(
            and_(
                OpportunityContact.contact_id == contact_id,
                Opportunity.tenant_id == tenant.id,
            )
        )
        .limit(10)
    )
    related_opportunities = opps_result.scalars().all()
    
    # Get manager if exists
    manager = None
    if contact.manager_id:
        manager_result = await db.execute(
            select(Contact).where(
                and_(
                    Contact.id == contact.manager_id,
                    Contact.tenant_id == tenant.id,
                )
            )
        )
        manager = manager_result.scalar_one_or_none()
    
    # Convert contact to dict with proper serialization
    contact_dict = {}
    for c in contact.__table__.columns:
        value = getattr(contact, c.name)
        if value is not None:
            if isinstance(value, datetime):
                contact_dict[c.name] = value.isoformat()
            else:
                contact_dict[c.name] = value
        else:
            contact_dict[c.name] = None
    
    # Serialize account if exists
    account_dict = None
    if account:
        account_dict = {}
        for c in account.__table__.columns:
            value = getattr(account, c.name)
            if value is not None:
                if isinstance(value, datetime):
                    account_dict[c.name] = value.isoformat()
                else:
                    account_dict[c.name] = value
            else:
                account_dict[c.name] = None
    
    # Serialize manager if exists
    manager_dict = None
    if manager:
        manager_dict = {}
        for c in manager.__table__.columns:
            value = getattr(manager, c.name)
            if value is not None:
                if isinstance(value, datetime):
                    manager_dict[c.name] = value.isoformat()
                else:
                    manager_dict[c.name] = value
            else:
                manager_dict[c.name] = None
    
    # Serialize related opportunities
    related_opps_list = []
    for opp in related_opportunities:
        opp_dict = {}
        for c in opp.__table__.columns:
            value = getattr(opp, c.name)
            if value is not None:
                if isinstance(value, datetime):
                    opp_dict[c.name] = value.isoformat()
                else:
                    opp_dict[c.name] = value
            else:
                opp_dict[c.name] = None
        related_opps_list.append(opp_dict)
    
    contact_dict.update({
        "account": account_dict,
        "manager": manager_dict,
        "related_opportunities": related_opps_list,
    })
    
    return contact_dict


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a contact"""
    from app.models.contact import Contact
    from sqlalchemy import select, and_
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Contact).where(
            and_(
                Contact.id == contact_id,
                Contact.tenant_id == tenant.id,
            )
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    
    # Update fields (exclude read-only fields)
    excluded_fields = {'id', 'tenant_id', 'created_at', 'updated_at'}
    for key, value in data.items():
        if key not in excluded_fields and hasattr(contact, key):
            # Convert empty strings to None for optional fields
            if value == '':
                value = None
            setattr(contact, key, value)
    
    await db.commit()
    await db.refresh(contact)
    
    # Serialize contact to dict
    contact_dict = {}
    for c in contact.__table__.columns:
        value = getattr(contact, c.name)
        if value is not None:
            if isinstance(value, datetime):
                contact_dict[c.name] = value.isoformat()
            else:
                contact_dict[c.name] = value
        else:
            contact_dict[c.name] = None
    
    return contact_dict


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete a contact"""
    from app.models.contact import Contact
    from sqlalchemy import select, and_, delete
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Contact).where(
            and_(
                Contact.id == contact_id,
                Contact.tenant_id == tenant.id,
            )
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    
    await db.delete(contact)
    await db.commit()
    return {"message": "Contact deleted successfully"}


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete an account (cascade deletes related contacts, opportunities, activities)"""
    from app.models.account import Account
    from sqlalchemy import select, and_
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Account).where(
            and_(
                Account.id == account_id,
                Account.tenant_id == tenant.id,
            )
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    
    # Cascade delete will handle related records (contacts, opportunities, activities)
    await db.delete(account)
    await db.commit()
    return {"message": "Account deleted successfully"}


@router.get("/accounts/{account_id}/org-chart")
async def get_chart(
    account_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get org chart for an account"""
    chart = await get_org_chart(db, account_id, tenant.id)
    return {"org_chart": chart}


@router.get("/accounts/{account_id}/activities")
async def get_account_activities(
    account_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get activity timeline for an account"""
    timeline = await get_account_timeline(db, account_id, tenant.id)
    return {"timeline": timeline}


@router.post("/accounts/{account_id}/activities")
async def create_account_activity(
    account_id: str,
    activity_type: str = Body(...),
    subject: Optional[str] = Body(None),
    description: Optional[str] = Body(None),
    outcome: Optional[str] = Body(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Add an activity to account timeline"""
    activity = await add_account_activity(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        account_id=account_id,
        activity_type=activity_type,
        subject=subject,
        description=description,
        outcome=outcome,
    )
    return activity


@router.get("/contacts/{contact_id}/activities")
async def get_contact_activities(
    contact_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get activity timeline for a contact"""
    timeline = await get_contact_timeline(db, contact_id, tenant.id)
    return {"timeline": timeline}


@router.post("/contacts/{contact_id}/activities")
async def create_contact_activity(
    contact_id: str,
    activity_type: str = Body(...),
    subject: Optional[str] = Body(None),
    description: Optional[str] = Body(None),
    outcome: Optional[str] = Body(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Add an activity to contact timeline"""
    activity = await add_contact_activity(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        contact_id=contact_id,
        activity_type=activity_type,
        subject=subject,
        description=description,
        outcome=outcome,
    )
    return activity


@router.get("/accounts/export")
async def export_accounts(
    search: Optional[str] = Query(None),
    organization_type: Optional[str] = Query(None),
    relationship_health: Optional[str] = Query(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Export accounts to CSV"""
    from app.models.account import Account
    
    query = select(Account).where(Account.tenant_id == tenant.id)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Account.name).like(search_term),
                func.lower(Account.agency).like(search_term),
            )
        )
    
    if organization_type:
        query = query.where(Account.organization_type == organization_type)
    
    if relationship_health:
        query = query.where(Account.relationship_health_score == relationship_health)
    
    result = await db.execute(query)
    accounts = result.scalars().all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Name', 'Agency', 'Organization Type', 'Website', 'Phone', 'Address',
        'NAICS Codes', 'Contract Vehicles', 'Relationship Health', 'Notes', 'Created At'
    ])
    
    # Write data
    for account in accounts:
        writer.writerow([
            account.name,
            account.agency or '',
            account.organization_type or '',
            account.website or '',
            account.phone or '',
            account.address or '',
            ', '.join(account.naics_codes) if account.naics_codes else '',
            ', '.join(account.contract_vehicles) if account.contract_vehicles else '',
            account.relationship_health_score or '',
            account.notes or '',
            account.created_at.isoformat() if account.created_at else '',
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=accounts.csv"}
    )


@router.get("/contacts/export")
async def export_contacts(
    account_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    influence_level: Optional[str] = Query(None),
    relationship_strength: Optional[str] = Query(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Export contacts to CSV"""
    from app.models.contact import Contact
    
    query = select(Contact).where(Contact.tenant_id == tenant.id)
    
    if account_id:
        query = query.where(Contact.account_id == account_id)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Contact.first_name).like(search_term),
                func.lower(Contact.last_name).like(search_term),
                func.lower(Contact.email).like(search_term),
            )
        )
    
    if influence_level:
        query = query.where(Contact.influence_level == influence_level)
    
    if relationship_strength:
        query = query.where(Contact.relationship_strength == relationship_strength)
    
    result = await db.execute(query)
    contacts = result.scalars().all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'First Name', 'Last Name', 'Email', 'Phone', 'Title', 'Department',
        'Influence Level', 'Relationship Strength', 'Account ID', 'Manager ID', 'Notes', 'Created At'
    ])
    
    # Write data
    for contact in contacts:
        writer.writerow([
            contact.first_name,
            contact.last_name,
            contact.email or '',
            contact.phone or '',
            contact.title or '',
            contact.department or '',
            contact.influence_level or '',
            contact.relationship_strength or '',
            contact.account_id or '',
            contact.manager_id or '',
            contact.notes or '',
            contact.created_at.isoformat() if contact.created_at else '',
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"}
    )
