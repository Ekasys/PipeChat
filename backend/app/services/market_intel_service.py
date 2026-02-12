"""Market Intelligence service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
import httpx
import os
import uuid
import logging

from app.models.market_intel import MarketIntel, CompetitorProfile
from app.integrations.sam_gov import (
    search_opportunities,
    get_opportunity_details,
    search_entities,
    get_entity_details,
    search_contracts,
    search_sam_gov,  # Backward compatibility
)
from app.config import settings

logger = logging.getLogger(__name__)


async def create_market_intel(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> MarketIntel:
    """Create a market intelligence record and auto-fetch documents if from SAM.gov"""
    # Parse expected_rfp_date if it's a string
    expected_rfp_date = data.get("expected_rfp_date")
    if expected_rfp_date and isinstance(expected_rfp_date, str):
        try:
            # Try common date formats
            for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%m/%d/%Y"]:
                try:
                    expected_rfp_date = datetime.strptime(expected_rfp_date[:19], fmt)
                    break
                except ValueError:
                    continue
            else:
                expected_rfp_date = None  # Couldn't parse, set to None
        except Exception:
            expected_rfp_date = None
    
    intel = MarketIntel(
        tenant_id=tenant_id,
        title=data["title"],
        description=data.get("description"),
        stage=data.get("stage", "rumor"),
        source=data.get("source"),
        agency=data.get("agency"),
        estimated_value=data.get("estimated_value"),
        expected_rfp_date=expected_rfp_date,
        naics_codes=data.get("naics_codes"),
        contract_vehicle=data.get("contract_vehicle"),
        competitor_info=data.get("competitor_info"),
        market_notes=data.get("market_notes"),
        sam_gov_id=data.get("sam_gov_id"),
        sam_gov_data=data.get("sam_gov_data"),
    )
    
    db.add(intel)
    await db.commit()
    await db.refresh(intel)
    
    # Background processing is now handled by the API endpoint via BackgroundTasks
    # See market_intel.py create_intel endpoint
    
    return intel


async def _auto_fetch_documents(
    db: AsyncSession,
    intel: MarketIntel,
    resource_links: List[str],
) -> None:
    """Auto-fetch documents from SAM.gov resource links"""
    import re
    from urllib.parse import unquote
    
    attachments_data = []
    
    # Create upload directory
    upload_dir = os.path.join(settings.UPLOAD_DIR, "market_intel", intel.id)
    os.makedirs(upload_dir, exist_ok=True)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        for idx, url in enumerate(resource_links):
            if not isinstance(url, str):
                continue
                
            try:
                response = await client.get(url, follow_redirects=True)
                if response.status_code == 200:
                    # Get filename from content-disposition header
                    content_disp = response.headers.get("content-disposition", "")
                    real_name = f"document_{idx}"
                    if "filename=" in content_disp:
                        match = re.search(r'filename[*]?=["\']?([^"\';\r\n]+)', content_disp)
                        if match:
                            real_name = match.group(1).strip('"\'')
                            real_name = unquote(real_name).replace("+", " ")
                    
                    # Determine extension
                    ext = os.path.splitext(real_name)[1] or ".pdf"
                    safe_name = f"{idx}_{uuid.uuid4().hex[:8]}{ext}"
                    local_path = os.path.join(upload_dir, safe_name)
                    
                    # Save file
                    with open(local_path, "wb") as f:
                        f.write(response.content)
                    
                    attachments_data.append({
                        "name": real_name,
                        "original_url": url,
                        "local_path": local_path,
                        "size": len(response.content),
                        "type": ext.replace(".", ""),
                        "fetched_at": datetime.utcnow().isoformat(),
                    })
                    logger.info(f"Downloaded: {real_name}")
                else:
                    attachments_data.append({
                        "name": f"document_{idx}",
                        "original_url": url,
                        "local_path": None,
                        "error": f"HTTP {response.status_code}",
                    })
            except Exception as e:
                logger.error(f"Failed to download {url}: {e}")
                attachments_data.append({
                    "name": f"document_{idx}",
                    "original_url": url,
                    "local_path": None,
                    "error": str(e),
                })
    
    # Update intel with attachments
    if attachments_data:
        intel.attachments = attachments_data
        intel.attachments_fetched = True
        await db.commit()
        logger.info(f"Saved {len([a for a in attachments_data if a.get('local_path')])} attachments for intel {intel.id}")


async def _auto_extract_requirements(
    db: AsyncSession,
    intel: MarketIntel,
) -> None:
    """Auto-extract requirements from SAM.gov data using AI"""
    from app.integrations.openai_client import call_openai
    from app.models.market_intel import ComplianceRequirement
    import json
    import re
    
    try:
        # Build context from SAM.gov data
        sam_data = intel.sam_gov_data or {}
        context = f"""
Opportunity: {intel.title}
Agency: {intel.agency or 'Unknown'}
NAICS: {intel.naics_codes}
Set-Aside: {intel.contract_vehicle or 'None'}
"""
        
        prompt = f"""Analyze this government contract opportunity and extract key requirements that a contractor would need to address in their proposal.

{context}

For each requirement, provide:
1. Requirement number (generate like R-1, R-2, etc.)
2. Section (e.g., "Technical", "Management", "Past Performance", "Compliance", "Staffing")
3. The requirement text
4. Type: mandatory, evaluation_criteria, or desirable
5. Suggested compliance approach

Format as JSON array:
[
  {{
    "requirement_number": "R-1",
    "section": "Technical",
    "requirement_text": "...",
    "requirement_type": "mandatory",
    "response_approach": "..."
  }}
]

Extract 10-15 key requirements. Focus on what would be evaluated in a proposal."""

        response = await call_openai(prompt, max_tokens=4000)
        
        if not response:
            logger.warning(f"No AI response for requirements extraction on intel {intel.id}")
            return
        
        # Parse AI response
        json_match = re.search(r'\[[\s\S]*\]', response)
        if not json_match:
            logger.warning(f"Could not parse AI response for intel {intel.id}")
            return
        
        requirements_data = json.loads(json_match.group())
        
        # Create ComplianceRequirement records
        created_count = 0
        for idx, req in enumerate(requirements_data):
            compliance_req = ComplianceRequirement(
                market_intel_id=intel.id,
                requirement_number=req.get("requirement_number", f"R-{idx+1}"),
                section=req.get("section", "General"),
                requirement_text=req.get("requirement_text", ""),
                requirement_type=req.get("requirement_type", "mandatory"),
                response_approach=req.get("response_approach"),
                compliance_status="pending",
                extracted_by_ai=True,
                sort_order=idx,
            )
            db.add(compliance_req)
            created_count += 1
        
        await db.commit()
        logger.info(f"Auto-extracted {created_count} requirements for intel {intel.id}")
        
    except Exception as e:
        logger.error(f"Failed to auto-extract requirements for intel {intel.id}: {e}")


async def update_intel_stage(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
    new_stage: str,
) -> Optional[MarketIntel]:
    """Update market intel stage (for Kanban)"""
    result = await db.execute(
        select(MarketIntel).where(
            and_(
                MarketIntel.id == intel_id,
                MarketIntel.tenant_id == tenant_id,
            )
        )
    )
    intel = result.scalar_one_or_none()
    
    if not intel:
        return None
    
    intel.stage = new_stage
    intel.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(intel)
    return intel


async def search_sam_gov_opportunities(
    keywords: Optional[str] = None,
    notice_type: Optional[str] = None,
    posted_from: Optional[str] = None,
    posted_to: Optional[str] = None,
    set_aside: Optional[str] = None,
    naics_code: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
) -> Dict[str, Any]:
    """Search SAM.gov for opportunities with enhanced filtering"""
    return await search_opportunities(
        keywords=keywords,
        notice_type=notice_type,
        posted_from=posted_from,
        posted_to=posted_to,
        set_aside=set_aside,
        naics_code=naics_code,
        limit=limit,
        offset=offset,
    )


async def find_similar_opportunities(
    db: AsyncSession,
    tenant_id: str,
    intel_id: str,
) -> List[Dict[str, Any]]:
    """Find similar opportunities using AI similarity"""
    # Get the intel record
    result = await db.execute(
        select(MarketIntel).where(
            and_(
                MarketIntel.id == intel_id,
                MarketIntel.tenant_id == tenant_id,
            )
        )
    )
    intel = result.scalar_one_or_none()
    
    if not intel:
        return []
    
    # Simple similarity based on agency and NAICS
    # TODO: Implement more sophisticated AI-based similarity
    from app.models.opportunity import Opportunity
    
    query = select(Opportunity).where(Opportunity.tenant_id == tenant_id)
    
    if intel.agency:
        query = query.where(Opportunity.agency.ilike(f"%{intel.agency}%"))
    
    result = await db.execute(query.limit(5))
    similar = result.scalars().all()
    
    return [
        {
            "id": opp.id,
            "name": opp.name,
            "agency": opp.agency,
            "stage": opp.stage,
            "similarity_score": 0.75,  # Placeholder
        }
        for opp in similar
    ]

