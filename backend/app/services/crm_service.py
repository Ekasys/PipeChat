"""CRM service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import datetime

from app.models.account import Account
from app.models.contact import Contact
from app.models.activity import Activity
from app.models.opportunity import Opportunity


async def create_account(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Account:
    """Create an account"""
    account = Account(
        tenant_id=tenant_id,
        name=data["name"],
        agency=data.get("agency"),
        organization_type=data.get("organization_type"),
        account_type=data.get("account_type"),
        naics_codes=data.get("naics_codes"),
        contract_vehicles=data.get("contract_vehicles"),
        website=data.get("website"),
        address=data.get("address"),
        phone=data.get("phone"),
        relationship_health_score=data.get("relationship_health_score"),
        notes=data.get("notes"),
    )
    
    db.add(account)
    await db.commit()
    await db.refresh(account)
    
    # If account type is teaming_partner, also create a Partner record
    if account.account_type == 'teaming_partner':
        from app.models.partner import Partner
        partner = Partner(
            tenant_id=tenant_id,
            name=account.name,
            company_name=None,  # Don't duplicate name - leave company_name empty
            description=account.notes,  # Use account notes as description
            website=account.website,
            contact_phone=account.phone,
            naics_codes=account.naics_codes,
            contract_vehicles=account.contract_vehicles,
            status="active",
            onboarding_status="not_started",
        )
        db.add(partner)
        await db.commit()
    
    return account


async def create_contact(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Contact:
    """Create a contact"""
    contact = Contact(
        tenant_id=tenant_id,
        account_id=data.get("account_id"),
        first_name=data["first_name"],
        last_name=data["last_name"],
        email=data.get("email"),
        phone=data.get("phone"),
        title=data.get("title"),
        department=data.get("department"),
        influence_level=data.get("influence_level"),
        relationship_strength=data.get("relationship_strength"),
        notes=data.get("notes"),
        manager_id=data.get("manager_id"),
    )
    
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


async def calculate_relationship_health(
    db: AsyncSession,
    account_id: str,
    tenant_id: str,
) -> str:
    """Calculate relationship health score for an account using multiple factors"""
    from datetime import datetime, timedelta
    
    score = 0.0
    max_score = 100.0
    
    # Factor 1: Opportunity Win Rate (30 points)
    opps_result = await db.execute(
        select(Opportunity).where(
            and_(
                Opportunity.account_id == account_id,
                Opportunity.tenant_id == tenant_id,
            )
        )
    )
    opportunities = opps_result.scalars().all()
    
    if opportunities:
        won_count = sum(1 for opp in opportunities if opp.status == "won")
        total_count = len(opportunities)
        win_rate = won_count / total_count if total_count > 0 else 0
        score += win_rate * 30
    
    # Factor 2: Active Opportunities (20 points)
    active_opps = [opp for opp in opportunities if opp.status == "active"]
    if active_opps:
        # Score based on number of active opportunities (capped at 20)
        active_score = min(len(active_opps) * 5, 20)
        score += active_score
    
    # Factor 3: Pipeline Value (20 points)
    if opportunities:
        total_value = sum(float(opp.value or 0) for opp in opportunities if opp.status == "active")
        # Score based on pipeline value (normalized, capped at 20)
        # Assuming $10M+ pipeline = 20 points
        value_score = min((total_value / 10_000_000) * 20, 20)
        score += value_score
    
    # Factor 4: Contact Relationship Strength (15 points)
    contacts_result = await db.execute(
        select(Contact).where(
            and_(
                Contact.account_id == account_id,
                Contact.tenant_id == tenant_id,
            )
        )
    )
    contacts = contacts_result.scalars().all()
    
    if contacts:
        strong_contacts = sum(1 for c in contacts if c.relationship_strength == "Strong")
        moderate_contacts = sum(1 for c in contacts if c.relationship_strength == "Moderate")
        relationship_score = (strong_contacts * 5 + moderate_contacts * 2.5) / max(len(contacts), 1) * 15
        score += min(relationship_score, 15)
    
    # Factor 5: Activity Frequency and Recency (15 points)
    activities_result = await db.execute(
        select(Activity).where(
            and_(
                Activity.account_id == account_id,
                Activity.tenant_id == tenant_id,
            )
        ).order_by(Activity.activity_date.desc())
    )
    activities = activities_result.scalars().all()
    
    if activities:
        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_activities = [a for a in activities if a.activity_date >= thirty_days_ago]
        
        # Score based on recent activity frequency
        activity_score = min(len(recent_activities) * 2, 10)  # Up to 10 points for frequency
        
        # Recency bonus (last activity within 7 days = 5 points)
        if activities:
            last_activity_date = activities[0].activity_date
            days_since_last = (datetime.utcnow() - last_activity_date.replace(tzinfo=None)).days
            if days_since_last <= 7:
                activity_score += 5
            elif days_since_last <= 30:
                activity_score += 2
        
        score += min(activity_score, 15)
    
    # Normalize score to 0-100 and determine health level
    normalized_score = min(score, max_score) / max_score
    
    if normalized_score >= 0.8:
        return "Excellent"
    elif normalized_score >= 0.6:
        return "Good"
    elif normalized_score >= 0.4:
        return "Fair"
    elif normalized_score >= 0.2:
        return "Poor"
    else:
        return "Unknown"


async def get_org_chart(
    db: AsyncSession,
    account_id: str,
    tenant_id: str,
) -> List[Dict[str, Any]]:
    """Get org chart for an account"""
    result = await db.execute(
        select(Contact).where(
            and_(
                Contact.account_id == account_id,
                Contact.tenant_id == tenant_id,
            )
        )
    )
    contacts = result.scalars().all()
    
    # Build hierarchical structure
    org_chart = []
    contact_map = {contact.id: contact for contact in contacts}
    
    # Find root contacts (no manager)
    roots = [c for c in contacts if not c.manager_id]
    
    def build_node(contact: Contact) -> Dict[str, Any]:
        node = {
            "id": contact.id,
            "name": f"{contact.first_name} {contact.last_name}",
            "title": contact.title,
            "department": contact.department,
            "influence_level": contact.influence_level,
            "email": contact.email,
            "phone": contact.phone,
            "children": [],
        }
        
        # Find direct reports
        for c in contacts:
            if c.manager_id == contact.id:
                node["children"].append(build_node(c))
        
        return node
    
    for root in roots:
        org_chart.append(build_node(root))
    
    return org_chart


async def add_account_activity(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    account_id: str,
    activity_type: str,
    subject: Optional[str] = None,
    description: Optional[str] = None,
    outcome: Optional[str] = None,
    activity_date: Optional[datetime] = None,
) -> Activity:
    """Add an activity to an account timeline"""
    if activity_date is None:
        activity_date = datetime.utcnow()
    
    activity = Activity(
        tenant_id=tenant_id,
        user_id=user_id,
        account_id=account_id,
        activity_type=activity_type,
        subject=subject,
        description=description,
        outcome=outcome,
        activity_date=activity_date,
    )
    
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


async def add_contact_activity(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    contact_id: str,
    activity_type: str,
    subject: Optional[str] = None,
    description: Optional[str] = None,
    outcome: Optional[str] = None,
    activity_date: Optional[datetime] = None,
) -> Activity:
    """Add an activity to a contact timeline"""
    if activity_date is None:
        activity_date = datetime.utcnow()
    
    activity = Activity(
        tenant_id=tenant_id,
        user_id=user_id,
        contact_id=contact_id,
        activity_type=activity_type,
        subject=subject,
        description=description,
        outcome=outcome,
        activity_date=activity_date,
    )
    
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


async def get_account_timeline(
    db: AsyncSession,
    account_id: str,
    tenant_id: str,
) -> List[Activity]:
    """Get activity timeline for an account"""
    result = await db.execute(
        select(Activity).where(
            and_(
                Activity.account_id == account_id,
                Activity.tenant_id == tenant_id,
            )
        ).order_by(Activity.activity_date.desc())
    )
    activities = result.scalars().all()
    return list(activities)


async def get_contact_timeline(
    db: AsyncSession,
    contact_id: str,
    tenant_id: str,
) -> List[Activity]:
    """Get activity timeline for a contact"""
    result = await db.execute(
        select(Activity).where(
            and_(
                Activity.contact_id == contact_id,
                Activity.tenant_id == tenant_id,
            )
        ).order_by(Activity.activity_date.desc())
    )
    activities = result.scalars().all()
    return list(activities)

