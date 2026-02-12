"""Capture Qualification Service - SAM.gov docs, compliance matrix, bid/no-bid"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta
import httpx
import os
import uuid
import logging

from app.models.market_intel import MarketIntel, ComplianceRequirement, BidNoBidCriteria
from app.models.opportunity import Opportunity
from app.config import settings
from app.integrations.sam_gov import get_opportunity_details

logger = logging.getLogger(__name__)

# Default Bid/No-Bid criteria
DEFAULT_BID_CRITERIA = [
    {
        "name": "Strategic Alignment",
        "description": "How well does this opportunity align with company strategy and growth goals?",
        "category": "strategic",
        "weight": 1.5,
        "max_score": 10,
        "scoring_guidance": {"1-3": "Poor fit", "4-6": "Moderate fit", "7-10": "Strong fit"},
        "evaluation_questions": [
            "Does this align with our target markets?",
            "Will winning strengthen our market position?",
            "Does it support long-term growth goals?"
        ]
    },
    {
        "name": "Technical Capability",
        "description": "Do we have the technical skills and experience to perform?",
        "category": "technical",
        "weight": 2.0,
        "max_score": 10,
        "scoring_guidance": {"1-3": "Significant gaps", "4-6": "Some gaps", "7-10": "Fully capable"},
        "evaluation_questions": [
            "Do we have relevant past performance?",
            "Do we have the required certifications?",
            "Do we have the technical staff?"
        ]
    },
    {
        "name": "Compliance Readiness",
        "description": "Can we meet all mandatory requirements?",
        "category": "technical",
        "weight": 2.0,
        "max_score": 10,
        "scoring_guidance": {"1-3": "Major gaps", "4-6": "Gaps addressable", "7-10": "Fully compliant"},
        "evaluation_questions": [
            "Do we meet all mandatory requirements?",
            "Are there showstopper gaps?",
            "Can gaps be addressed before submission?"
        ]
    },
    {
        "name": "Price Competitiveness",
        "description": "Can we be competitive on price while maintaining margins?",
        "category": "financial",
        "weight": 1.5,
        "max_score": 10,
        "scoring_guidance": {"1-3": "Not competitive", "4-6": "Marginally competitive", "7-10": "Highly competitive"},
        "evaluation_questions": [
            "Do we have competitive labor rates?",
            "Can we meet price expectations?",
            "Is the budget realistic for the scope?"
        ]
    },
    {
        "name": "Competitive Position",
        "description": "How do we stack up against likely competitors?",
        "category": "strategic",
        "weight": 1.0,
        "max_score": 10,
        "scoring_guidance": {"1-3": "Weak position", "4-6": "Competitive", "7-10": "Strong position"},
        "evaluation_questions": [
            "Who is the incumbent?",
            "What are competitor strengths/weaknesses?",
            "Do we have any discriminators?"
        ]
    },
    {
        "name": "Resource Availability",
        "description": "Do we have the resources to pursue and perform?",
        "category": "risk",
        "weight": 1.0,
        "max_score": 10,
        "scoring_guidance": {"1-3": "Resource constrained", "4-6": "Manageable", "7-10": "Well resourced"},
        "evaluation_questions": [
            "Do we have BD/capture bandwidth?",
            "Do we have proposal team availability?",
            "Can we staff the contract if we win?"
        ]
    },
    {
        "name": "Risk Assessment",
        "description": "What is the overall risk profile?",
        "category": "risk",
        "weight": 1.0,
        "max_score": 10,
        "scoring_guidance": {"1-3": "High risk", "4-6": "Moderate risk", "7-10": "Low risk"},
        "evaluation_questions": [
            "What are the performance risks?",
            "What are the financial risks?",
            "What are the reputational risks?"
        ]
    },
]


async def fetch_sam_gov_attachments(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """
    Fetch attachments/documents from SAM.gov for a Market Intel record.
    Downloads files and stores locally.
    """
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
        return {"error": "Market Intel not found"}
    
    if not intel.sam_gov_id and not intel.sam_gov_data:
        return {"error": "No SAM.gov ID linked to this intel"}
    
    # Debug logging
    logger.info(f"Intel {intel_id}: sam_gov_id={intel.sam_gov_id}")
    logger.info(f"Intel {intel_id}: sam_gov_data type={type(intel.sam_gov_data)}")
    if intel.sam_gov_data:
        logger.info(f"Intel {intel_id}: sam_gov_data keys={list(intel.sam_gov_data.keys()) if isinstance(intel.sam_gov_data, dict) else 'not a dict'}")
        if isinstance(intel.sam_gov_data, dict):
            logger.info(f"Intel {intel_id}: resourceLinks={intel.sam_gov_data.get('resourceLinks', 'NOT FOUND')}")
    
    # First check if sam_gov_data already has resourceLinks (from original search)
    details = None
    if intel.sam_gov_data and isinstance(intel.sam_gov_data, dict):
        # Check if we already have resourceLinks cached
        if intel.sam_gov_data.get("resourceLinks"):
            logger.info(f"Using cached SAM.gov data with {len(intel.sam_gov_data.get('resourceLinks', []))} resource links")
            details = intel.sam_gov_data
    
    # If no cached resourceLinks, try to fetch fresh data
    if not details or not details.get("resourceLinks"):
        # Try to search by solicitation number (more reliable than noticeId)
        solnum = None
        if intel.sam_gov_data and isinstance(intel.sam_gov_data, dict):
            solnum = intel.sam_gov_data.get("solicitationNumber")
        
        if solnum:
            logger.info(f"Fetching fresh SAM.gov data for solnum: {solnum}")
            # Use the search function with solnum filter
            from app.integrations.sam_gov import search_opportunities
            search_result = await search_opportunities(keywords=None, limit=1)
            
            # Actually we need a direct search by solnum - let's use a custom call
            today = datetime.now()
            start_date = (today - timedelta(days=730)).strftime("%m/%d/%Y")
            end_date = today.strftime("%m/%d/%Y")
            
            try:
                async with httpx.AsyncClient(timeout=60.0) as api_client:
                    params = {
                        "api_key": settings.SAM_GOV_API_KEY,
                        "postedFrom": start_date,
                        "postedTo": end_date,
                        "solnum": solnum,
                        "limit": 1,
                    }
                    response = await api_client.get(
                        "https://api.sam.gov/opportunities/v2/search",
                        params=params,
                        headers={"Accept": "application/json"},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        opportunities = data.get("opportunitiesData", [])
                        if opportunities:
                            details = opportunities[0]
                            logger.info(f"Fetched fresh data with {len(details.get('resourceLinks', []))} resource links")
            except Exception as e:
                logger.error(f"Failed to fetch fresh SAM.gov data: {e}")
        
        # Fallback: try by noticeId
        if not details:
            notice_id = None
            if intel.sam_gov_data and isinstance(intel.sam_gov_data, dict):
                notice_id = intel.sam_gov_data.get("noticeId")
            if not notice_id:
                notice_id = intel.sam_gov_id
            
            if notice_id:
                details = await get_opportunity_details(notice_id)
    
    if not details:
        return {"error": "Could not fetch details from SAM.gov"}
    
    # Extract resource links/attachments
    # SAM.gov API returns attachments in various fields depending on the endpoint
    # resourceLinks can be an array of URL strings OR an array of objects
    attachments_data = []
    raw_resource_links = details.get("resourceLinks", []) or details.get("attachments", []) or []
    
    # Normalize resource_links to always be a list of dicts with 'url' key
    resource_links = []
    for item in raw_resource_links:
        if isinstance(item, str):
            # It's a plain URL string - extract filename from URL if possible
            url = item
            # Try to get filename from content-disposition later, for now use URL hash
            file_id = url.split('/')[-2] if '/download' in url else url.split('/')[-1]
            resource_links.append({
                "url": url,
                "name": f"document_{file_id[:8]}",
                "type": "document"
            })
        elif isinstance(item, dict):
            # It's already an object
            resource_links.append(item)
    
    # Also check for links in the main data
    if details.get("additionalInfoLink"):
        resource_links.append({
            "name": "Additional Information",
            "url": details.get("additionalInfoLink"),
            "type": "link"
        })
    
    # Create upload directory if needed
    upload_dir = os.path.join(settings.UPLOAD_DIR, "market_intel", intel_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    # Download each attachment
    async with httpx.AsyncClient(timeout=60.0) as client:
        for idx, resource in enumerate(resource_links):
            try:
                url = resource.get("url") or resource.get("link") or resource.get("uri")
                name = resource.get("name") or resource.get("filename") or f"attachment_{idx}"
                
                if not url:
                    continue
                
                # Determine file extension
                ext = os.path.splitext(name)[1] or ".pdf"
                safe_name = f"{idx}_{uuid.uuid4().hex[:8]}{ext}"
                local_path = os.path.join(upload_dir, safe_name)
                
                # Download file
                try:
                    response = await client.get(url, follow_redirects=True)
                    if response.status_code == 200:
                        # Try to get real filename from content-disposition header
                        content_disp = response.headers.get("content-disposition", "")
                        real_name = name
                        if "filename=" in content_disp:
                            # Extract filename from header like: attachment; filename="document.pdf"
                            import re
                            match = re.search(r'filename[*]?=["\']?([^"\';\r\n]+)', content_disp)
                            if match:
                                real_name = match.group(1).strip('"\'')
                                # URL decode if needed
                                from urllib.parse import unquote
                                real_name = unquote(real_name).replace("+", " ")
                        
                        # Update extension based on real filename
                        real_ext = os.path.splitext(real_name)[1] or ext
                        safe_name = f"{idx}_{uuid.uuid4().hex[:8]}{real_ext}"
                        local_path = os.path.join(upload_dir, safe_name)
                        
                        with open(local_path, "wb") as f:
                            f.write(response.content)
                        
                        attachments_data.append({
                            "name": real_name,
                            "original_url": url,
                            "local_path": local_path,
                            "size": len(response.content),
                            "type": resource.get("type") or real_ext.replace(".", ""),
                            "fetched_at": datetime.utcnow().isoformat(),
                        })
                        logger.info(f"Downloaded attachment: {real_name}")
                    else:
                        attachments_data.append({
                            "name": name,
                            "original_url": url,
                            "local_path": None,
                            "error": f"HTTP {response.status_code}",
                            "type": resource.get("type", "unknown"),
                        })
                except Exception as e:
                    attachments_data.append({
                        "name": name,
                        "original_url": url,
                        "local_path": None,
                        "error": str(e),
                        "type": resource.get("type", "unknown"),
                    })
            except Exception as e:
                logger.error(f"Error processing attachment: {e}")
    
    # Update the intel record
    intel.attachments = attachments_data
    intel.attachments_fetched = True
    intel.sam_gov_data = details  # Update with full details
    intel.updated_at = datetime.utcnow()
    
    # Extract additional fields from details
    if details.get("placeOfPerformance"):
        pop = details.get("placeOfPerformance", {})
        intel.place_of_performance = f"{pop.get('city', '')}, {pop.get('state', '')} {pop.get('zip', '')}".strip(", ")
    
    if details.get("archiveType"):
        intel.contract_type = details.get("archiveType")
    
    await db.commit()
    await db.refresh(intel)
    
    return {
        "success": True,
        "attachments_found": len(resource_links),
        "attachments_downloaded": len([a for a in attachments_data if a.get("local_path")]),
        "attachments": attachments_data,
    }


async def extract_requirements_ai(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """
    Use AI to extract requirements from attached documents.
    Creates ComplianceRequirement records.
    """
    from app.integrations.openai_client import call_openai
    
    # Get the intel record with attachments
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
        return {"error": "Market Intel not found"}
    
    if not intel.attachments:
        return {"error": "No attachments to analyze. Fetch documents first."}
    
    # For now, we'll analyze the SAM.gov data and any text we can extract
    # Full PDF parsing would require additional libraries (PyPDF2, pdfplumber)
    
    # Build context from SAM.gov data
    sam_data = intel.sam_gov_data or {}
    context = f"""
    Opportunity: {intel.title}
    Agency: {intel.agency or 'Unknown'}
    Description: {sam_data.get('description', intel.description or 'No description')}
    
    Additional Info:
    - NAICS: {intel.naics_codes}
    - Set-Aside: {intel.contract_vehicle}
    - Place of Performance: {intel.place_of_performance or 'Not specified'}
    """
    
    prompt = f"""Analyze this government contract opportunity and extract key requirements that a contractor would need to address in their proposal.

{context}

For each requirement, provide:
1. Requirement number (if apparent, or generate like R-1, R-2)
2. Section (e.g., "Technical", "Management", "Past Performance", "Compliance")
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

Extract 10-20 key requirements. Focus on what would be evaluated in a proposal."""

    try:
        response = await call_openai(prompt, max_tokens=4000)
        
        # Parse AI response
        import json
        import re
        
        # Extract JSON from response
        json_match = re.search(r'\[[\s\S]*\]', response)
        if not json_match:
            return {"error": "Could not parse AI response", "raw_response": response}
        
        requirements_data = json.loads(json_match.group())
        
        # Create ComplianceRequirement records
        created_count = 0
        for idx, req in enumerate(requirements_data):
            compliance_req = ComplianceRequirement(
                market_intel_id=intel_id,
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
        
        return {
            "success": True,
            "requirements_extracted": created_count,
        }
        
    except Exception as e:
        logger.error(f"AI extraction error: {e}")
        return {"error": str(e)}


async def get_compliance_matrix(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """Get compliance matrix for a Market Intel record"""
    # Verify intel belongs to tenant
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
        return {"error": "Market Intel not found"}
    
    # Get requirements
    result = await db.execute(
        select(ComplianceRequirement)
        .where(ComplianceRequirement.market_intel_id == intel_id)
        .order_by(ComplianceRequirement.sort_order)
    )
    requirements = result.scalars().all()
    
    # Calculate summary
    total = len(requirements)
    compliant = len([r for r in requirements if r.compliance_status == "compliant"])
    partial = len([r for r in requirements if r.compliance_status == "partial"])
    non_compliant = len([r for r in requirements if r.compliance_status == "non_compliant"])
    pending = len([r for r in requirements if r.compliance_status == "pending"])
    
    score = 0
    if total > 0:
        score = ((compliant * 100) + (partial * 50)) / total
    
    return {
        "intel_id": intel_id,
        "requirements": [
            {
                "id": r.id,
                "requirement_number": r.requirement_number,
                "section": r.section,
                "requirement_text": r.requirement_text,
                "requirement_type": r.requirement_type,
                "compliance_status": r.compliance_status,
                "compliance_notes": r.compliance_notes,
                "gap_description": r.gap_description,
                "mitigation_plan": r.mitigation_plan,
                "response_approach": r.response_approach,
                "weight": float(r.weight) if r.weight else None,
                "confidence_score": float(r.confidence_score) if r.confidence_score else None,
                "source_document": r.source_document,
                "extracted_by_ai": r.extracted_by_ai,
            }
            for r in requirements
        ],
        "summary": {
            "total": total,
            "compliant": compliant,
            "partial": partial,
            "non_compliant": non_compliant,
            "pending": pending,
            "score": round(score, 1),
        }
    }


async def update_compliance_requirement(
    db: AsyncSession,
    requirement_id: str,
    tenant_id: str,
    data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Update a compliance requirement"""
    # Get requirement and verify tenant
    result = await db.execute(
        select(ComplianceRequirement)
        .join(MarketIntel)
        .where(
            and_(
                ComplianceRequirement.id == requirement_id,
                MarketIntel.tenant_id == tenant_id,
            )
        )
    )
    requirement = result.scalar_one_or_none()
    
    if not requirement:
        return None
    
    # Update fields
    for field in ["compliance_status", "compliance_notes", "gap_description", 
                  "mitigation_plan", "response_approach", "weight", "confidence_score"]:
        if field in data:
            setattr(requirement, field, data[field])
    
    requirement.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(requirement)
    
    # Update intel compliance summary
    await _update_compliance_summary(db, requirement.market_intel_id)
    
    return {
        "id": requirement.id,
        "compliance_status": requirement.compliance_status,
        "updated": True,
    }


async def _update_compliance_summary(db: AsyncSession, intel_id: str):
    """Update the compliance summary on the Market Intel record"""
    result = await db.execute(
        select(ComplianceRequirement)
        .where(ComplianceRequirement.market_intel_id == intel_id)
    )
    requirements = result.scalars().all()
    
    total = len(requirements)
    compliant = len([r for r in requirements if r.compliance_status == "compliant"])
    partial = len([r for r in requirements if r.compliance_status == "partial"])
    non_compliant = len([r for r in requirements if r.compliance_status == "non_compliant"])
    
    score = 0
    if total > 0:
        score = ((compliant * 100) + (partial * 50)) / total
    
    result = await db.execute(
        select(MarketIntel).where(MarketIntel.id == intel_id)
    )
    intel = result.scalar_one_or_none()
    
    if intel:
        intel.compliance_summary = {
            "total": total,
            "compliant": compliant,
            "partial": partial,
            "non_compliant": non_compliant,
            "score": round(score, 1),
        }
        await db.commit()


async def calculate_bid_score(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
    criteria_scores: Dict[str, int],
) -> Dict[str, Any]:
    """
    Calculate bid/no-bid score based on criteria.
    criteria_scores: {criteria_name: score}
    """
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
        return {"error": "Market Intel not found"}
    
    # Get tenant's bid criteria or use defaults
    result = await db.execute(
        select(BidNoBidCriteria).where(
            and_(
                BidNoBidCriteria.tenant_id == tenant_id,
                BidNoBidCriteria.is_active == True,
            )
        )
    )
    criteria = result.scalars().all()
    
    if not criteria:
        # Use defaults (would normally seed these)
        criteria_list = DEFAULT_BID_CRITERIA
    else:
        criteria_list = [
            {
                "name": c.name,
                "weight": float(c.weight),
                "max_score": c.max_score,
            }
            for c in criteria
        ]
    
    # Calculate weighted score
    total_weight = sum(c.get("weight", 1) for c in criteria_list)
    weighted_sum = 0
    scores_detail = []
    
    for c in criteria_list:
        name = c["name"]
        weight = c.get("weight", 1)
        max_score = c.get("max_score", 10)
        score = criteria_scores.get(name, 0)
        
        # Normalize to 0-100
        normalized = (score / max_score) * 100 if max_score > 0 else 0
        weighted_sum += normalized * weight
        
        scores_detail.append({
            "name": name,
            "score": score,
            "max_score": max_score,
            "weight": weight,
            "normalized": round(normalized, 1),
        })
    
    final_score = weighted_sum / total_weight if total_weight > 0 else 0
    
    # Determine recommendation
    if final_score >= 70:
        recommendation = "bid"
    elif final_score >= 50:
        recommendation = "review"  # Needs more analysis
    else:
        recommendation = "no-bid"
    
    # Update intel
    intel.bid_score = round(final_score, 1)
    intel.bid_criteria_scores = scores_detail
    intel.updated_at = datetime.utcnow()
    await db.commit()
    
    return {
        "intel_id": intel_id,
        "bid_score": round(final_score, 1),
        "recommendation": recommendation,
        "criteria_scores": scores_detail,
        "thresholds": {
            "bid": ">= 70",
            "review": "50-69",
            "no-bid": "< 50",
        }
    }


async def set_bid_decision(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
    decision: str,
    rationale: str = None,
) -> Dict[str, Any]:
    """Set the bid/no-bid decision"""
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
        return {"error": "Market Intel not found"}
    
    intel.bid_decision = decision
    intel.bid_decision_date = datetime.utcnow()
    intel.bid_decision_rationale = rationale
    intel.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "intel_id": intel_id,
        "decision": decision,
        "decision_date": intel.bid_decision_date.isoformat(),
    }


async def convert_to_opportunity(
    db: AsyncSession,
    intel_id: str,
    tenant_id: str,
    additional_data: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Convert qualified Market Intel to an Opportunity, moving documents and removing intel"""
    from app.models.document import Document
    import shutil
    
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
        return {"error": "Market Intel not found"}
    
    if intel.converted_to_opportunity_id:
        return {"error": "Already converted", "opportunity_id": intel.converted_to_opportunity_id}
    
    # Create Opportunity from Intel
    additional_data = additional_data or {}
    
    opportunity = Opportunity(
        tenant_id=tenant_id,
        name=intel.title,
        description=intel.description,
        agency=intel.agency,
        stage="qualification",  # Starting stage
        value=intel.estimated_value,
        due_date=intel.expected_rfp_date,
        naics_code=intel.naics_codes[0] if intel.naics_codes else None,
        contract_vehicle=intel.contract_vehicle,
        # Store SAM.gov source info in summary field
        summary=f"Source: {'SAM.gov' if intel.sam_gov_id else intel.source or 'Manual Entry'}. SAM ID: {intel.sam_gov_id or 'N/A'}",
        # Copy additional fields (filter out invalid keys)
        **{k: v for k, v in additional_data.items() if k in ['account_id', 'owner_id', 'sub_agency', 'opportunity_type', 'capture_manager']},
    )
    
    db.add(opportunity)
    await db.flush()  # Get the ID
    
    # Move attachments to opportunity and create Document records
    documents_created = 0
    if intel.attachments:
        # Create opportunity upload directory
        opp_upload_dir = os.path.join(settings.UPLOAD_DIR, tenant_id, opportunity.id)
        os.makedirs(opp_upload_dir, exist_ok=True)
        
        for att in intel.attachments:
            old_path = att.get("local_path")
            if old_path and os.path.exists(old_path):
                try:
                    # Move file to opportunity folder
                    filename = os.path.basename(old_path)
                    new_path = os.path.join(opp_upload_dir, filename)
                    shutil.move(old_path, new_path)
                    
                    # Determine mime type from extension
                    ext = os.path.splitext(filename)[1].lower()
                    mime_types = {
                        '.pdf': 'application/pdf',
                        '.doc': 'application/msword',
                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        '.xls': 'application/vnd.ms-excel',
                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        '.txt': 'text/plain',
                    }
                    mime_type = mime_types.get(ext, 'application/octet-stream')
                    
                    # Create Document record
                    doc = Document(
                        tenant_id=tenant_id,
                        opportunity_id=opportunity.id,
                        filename=filename,
                        original_filename=att.get("name", filename),
                        file_path=new_path,
                        file_size=att.get("size"),
                        mime_type=mime_type,
                        document_type="rfp",  # Default to RFP document type
                        title=att.get("name", filename),
                        description=f"Imported from SAM.gov via Market Intelligence",
                    )
                    db.add(doc)
                    documents_created += 1
                    logger.info(f"Moved attachment {att.get('name')} to opportunity {opportunity.id}")
                except Exception as e:
                    logger.error(f"Failed to move attachment {old_path}: {e}")
    
    # Clean up old market intel upload directory
    old_upload_dir = os.path.join(settings.UPLOAD_DIR, "market_intel", intel_id)
    if os.path.exists(old_upload_dir):
        try:
            shutil.rmtree(old_upload_dir)
            logger.info(f"Removed market intel upload directory: {old_upload_dir}")
        except Exception as e:
            logger.error(f"Failed to remove market intel directory: {e}")
    
    # Delete the market intel record (cascade will delete compliance requirements)
    await db.delete(intel)
    
    await db.commit()
    await db.refresh(opportunity)
    
    return {
        "success": True,
        "opportunity_id": opportunity.id,
        "opportunity_name": opportunity.name,
        "intel_id": intel_id,
        "documents_transferred": documents_created,
        "message": "Market Intel converted and removed. Documents transferred to Opportunity.",
    }
