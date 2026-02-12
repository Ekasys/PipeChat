"""Market Intelligence endpoints"""
from fastapi import APIRouter, Depends, Query, Body, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import os
import logging
import asyncio
from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.market_intel_service import (
    create_market_intel,
    update_intel_stage,
    search_sam_gov_opportunities,
    find_similar_opportunities,
)
from app.integrations.sam_gov import (
    get_opportunity_details,
    search_entities,
    get_entity_details,
    search_contracts,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Keep references to background tasks to prevent GC
_background_tasks = set()


async def process_intel_background(intel_id: str, tenant_id: str):
    """Background task to fetch documents and extract requirements for new intel"""
    from app.services.capture_service import fetch_sam_gov_attachments, extract_requirements_ai
    from app.models.market_intel import MarketIntel
    from app.integrations.sam_gov import fetch_opportunity_description, extract_department
    from sqlalchemy import select, and_
    
    print(f"[BACKGROUND] Starting processing for intel {intel_id}")
    logger.info(f"Starting background processing for intel {intel_id}")
    
    # Create a new db session for background task
    async with AsyncSessionLocal() as db:
        try:
            # Step 1: Fetch documents and description from SAM.gov
            result = await db.execute(
                select(MarketIntel).where(
                    and_(MarketIntel.id == intel_id, MarketIntel.tenant_id == tenant_id)
                )
            )
            intel = result.scalar_one_or_none()
            if intel:
                intel.processing_status = "fetching_documents"
                await db.commit()
                
                # Fetch full description text if we have a notice ID
                notice_id = intel.sam_gov_id
                if not notice_id and intel.sam_gov_data:
                    notice_id = intel.sam_gov_data.get("noticeId")
                
                if notice_id:
                    print(f"[BACKGROUND] Fetching description for {notice_id}...")
                    description_text = await fetch_opportunity_description(notice_id)
                    if description_text:
                        intel.description = description_text
                        logger.info(f"Fetched description ({len(description_text)} chars) for intel {intel_id}")
                
                # Extract and store department from fullParentPathName
                if intel.sam_gov_data and intel.sam_gov_data.get("fullParentPathName"):
                    department = extract_department(intel.sam_gov_data.get("fullParentPathName", ""))
                    if department:
                        intel.agency = department
                        logger.info(f"Set department to: {department}")
                
                await db.commit()
            
            print(f"[BACKGROUND] Fetching docs for {intel_id}...")
            fetch_result = await fetch_sam_gov_attachments(db, intel_id, tenant_id)
            
            if fetch_result.get("error"):
                print(f"[BACKGROUND] Doc fetch failed: {fetch_result['error']}")
            else:
                print(f"[BACKGROUND] Fetched {fetch_result.get('attachments_downloaded', 0)} documents")
            
            # Step 2: Extract requirements using AI
            result = await db.execute(
                select(MarketIntel).where(
                    and_(MarketIntel.id == intel_id, MarketIntel.tenant_id == tenant_id)
                )
            )
            intel = result.scalar_one_or_none()
            if intel:
                intel.processing_status = "extracting_requirements"
                await db.commit()
            
            print(f"[BACKGROUND] Extracting requirements for {intel_id}...")
            extract_result = await extract_requirements_ai(db, intel_id, tenant_id)
            
            if extract_result.get("error"):
                logger.warning(f"Requirement extraction failed for {intel_id}: {extract_result['error']}")
            else:
                logger.info(f"Extracted {extract_result.get('requirements_extracted', 0)} requirements for intel {intel_id}")
            
            # Mark as completed
            result = await db.execute(
                select(MarketIntel).where(
                    and_(MarketIntel.id == intel_id, MarketIntel.tenant_id == tenant_id)
                )
            )
            intel = result.scalar_one_or_none()
            if intel:
                intel.processing_status = "completed"
                intel.processing_error = None
                await db.commit()
            
            logger.info(f"Background processing complete for intel {intel_id}")
            
        except Exception as e:
            logger.error(f"Background processing error for intel {intel_id}: {e}")
            # Mark as error
            try:
                result = await db.execute(
                    select(MarketIntel).where(
                        and_(MarketIntel.id == intel_id, MarketIntel.tenant_id == tenant_id)
                    )
                )
                intel = result.scalar_one_or_none()
                if intel:
                    intel.processing_status = "error"
                    intel.processing_error = str(e)
                    await db.commit()
            except:
                pass


@router.post("/intel")
async def create_intel(
    data: dict,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a market intelligence record"""
    intel = await create_market_intel(db=db, tenant_id=tenant.id, data=data)
    
    # Queue background doc fetch + requirement extraction (non-blocking)
    if data.get("sam_gov_id") or data.get("sam_gov_data"):
        logger.info(f"Queuing background processing for SAM.gov intel {intel.id}")
        import asyncio
        
        async def run_background():
            try:
                await process_intel_background(intel.id, tenant.id)
            finally:
                _background_tasks.discard(asyncio.current_task())
        
        task = asyncio.create_task(run_background())
        _background_tasks.add(task)
        print(f"[BACKGROUND] Started task for intel {intel.id}")
    
    return intel


@router.get("/intel")
async def list_intel(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List market intelligence records"""
    from app.models.market_intel import MarketIntel
    from sqlalchemy import select
    
    result = await db.execute(
        select(MarketIntel).where(MarketIntel.tenant_id == tenant.id)
    )
    intel_list = result.scalars().all()
    return {"intel": list(intel_list)}


@router.patch("/intel/{intel_id}/stage")
async def update_stage(
    intel_id: str,
    new_stage: str = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update market intel stage (Kanban drag-drop)"""
    intel = await update_intel_stage(db, intel_id, tenant.id, new_stage)
    if not intel:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intel not found")
    return intel


@router.get("/sam-gov/search")
async def search_sam(
    keywords: Optional[str] = Query(None),
    notice_type: Optional[str] = Query(None),
    posted_from: Optional[str] = Query(None),
    posted_to: Optional[str] = Query(None),
    set_aside: Optional[str] = Query(None),
    naics_code: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Search SAM.gov for contract opportunities with advanced filtering"""
    # Normalize empty strings to None
    posted_from = None if (posted_from is None or (isinstance(posted_from, str) and posted_from.strip() == "")) else posted_from
    posted_to = None if (posted_to is None or (isinstance(posted_to, str) and posted_to.strip() == "")) else posted_to
    keywords = None if (keywords is None or (isinstance(keywords, str) and keywords.strip() == "")) else keywords
    notice_type = None if (notice_type is None or (isinstance(notice_type, str) and notice_type.strip() == "")) else notice_type
    set_aside = None if (set_aside is None or (isinstance(set_aside, str) and set_aside.strip() == "")) else set_aside
    naics_code = None if (naics_code is None or (isinstance(naics_code, str) and naics_code.strip() == "")) else naics_code
    
    results = await search_sam_gov_opportunities(
        keywords=keywords,
        notice_type=notice_type,
        posted_from=posted_from,
        posted_to=posted_to,
        set_aside=set_aside,
        naics_code=naics_code,
        limit=limit,
        offset=offset,
    )
    return results


@router.get("/sam-gov/opportunities/{notice_id}")
async def get_sam_opportunity(
    notice_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Get detailed information for a specific SAM.gov opportunity"""
    details = await get_opportunity_details(notice_id)
    if not details:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity {notice_id} not found in SAM.gov"
        )
    return details


@router.get("/sam-gov/entities/search")
async def search_sam_entities(
    name: Optional[str] = Query(None),
    duns: Optional[str] = Query(None),
    cage_code: Optional[str] = Query(None),
    naics_code: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Search SAM.gov for registered entities (contractors)"""
    results = await search_entities(
        name=name,
        duns=duns,
        cage_code=cage_code,
        naics_code=naics_code,
        limit=limit,
        offset=offset,
    )
    return results


@router.get("/sam-gov/entities/{uei}")
async def get_sam_entity(
    uei: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Get detailed information for a specific SAM.gov entity"""
    details = await get_entity_details(uei)
    if not details:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity {uei} not found in SAM.gov"
        )
    return details


@router.get("/sam-gov/contracts/search")
async def search_sam_contracts(
    keywords: Optional[str] = Query(None),
    naics_code: Optional[str] = Query(None),
    award_date_from: Optional[str] = Query(None),
    award_date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Search SAM.gov for contract award data"""
    results = await search_contracts(
        keywords=keywords,
        naics_code=naics_code,
        award_date_from=award_date_from,
        award_date_to=award_date_to,
        limit=limit,
        offset=offset,
    )
    return results


@router.get("/intel/{intel_id}/similar")
async def get_similar(
    intel_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Find similar opportunities"""
    similar = await find_similar_opportunities(db, tenant.id, intel_id)
    return {"similar_opportunities": similar}


# ==================== Capture Qualification Endpoints ====================

from app.services.capture_service import (
    fetch_sam_gov_attachments,
    extract_requirements_ai,
    get_compliance_matrix,
    update_compliance_requirement,
    calculate_bid_score,
    set_bid_decision,
    convert_to_opportunity,
)
import os
from fastapi.responses import FileResponse


@router.post("/intel/{intel_id}/fetch-documents")
async def fetch_documents(
    intel_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Fetch attachments/documents from SAM.gov for this intel"""
    result = await fetch_sam_gov_attachments(db, intel_id, tenant.id)
    if result.get("error"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.post("/intel/{intel_id}/extract-requirements")
async def extract_requirements(
    intel_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Use AI to extract requirements from attached documents"""
    result = await extract_requirements_ai(db, intel_id, tenant.id)
    if result.get("error"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/intel/{intel_id}/compliance-matrix")
async def get_compliance(
    intel_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get compliance matrix for this intel"""
    result = await get_compliance_matrix(db, intel_id, tenant.id)
    if result.get("error"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


@router.patch("/compliance-requirements/{requirement_id}")
async def update_requirement(
    requirement_id: str,
    data: dict = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a compliance requirement"""
    result = await update_compliance_requirement(db, requirement_id, tenant.id, data)
    if not result:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    return result


@router.post("/intel/{intel_id}/calculate-bid-score")
async def calc_bid_score(
    intel_id: str,
    criteria_scores: dict = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Calculate bid/no-bid score based on criteria"""
    result = await calculate_bid_score(db, intel_id, tenant.id, criteria_scores)
    if result.get("error"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.post("/intel/{intel_id}/bid-decision")
async def make_bid_decision(
    intel_id: str,
    decision: str = Body(..., embed=True),
    rationale: Optional[str] = Body(None, embed=True),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Set the bid/no-bid decision"""
    if decision not in ["bid", "no-bid", "pending"]:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid decision. Must be: bid, no-bid, or pending")
    result = await set_bid_decision(db, intel_id, tenant.id, decision, rationale)
    if result.get("error"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.post("/intel/{intel_id}/convert-to-opportunity")
async def convert_intel_to_opp(
    intel_id: str,
    additional_data: dict = Body(default={}),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Convert qualified Market Intel to an Opportunity"""
    result = await convert_to_opportunity(db, intel_id, tenant.id, additional_data)
    if result.get("error"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.delete("/intel/{intel_id}")
async def delete_intel(
    intel_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete a market intelligence record and all related data"""
    from fastapi import HTTPException, status
    from sqlalchemy import select, and_
    from app.models.market_intel import MarketIntel
    import shutil
    
    # Get the intel record
    result = await db.execute(
        select(MarketIntel).where(
            and_(
                MarketIntel.id == intel_id,
                MarketIntel.tenant_id == tenant.id,
            )
        )
    )
    intel = result.scalar_one_or_none()
    
    if not intel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market Intel not found")
    
    # Delete associated files
    from app.config import settings
    upload_dir = os.path.join(settings.UPLOAD_DIR, "market_intel", intel_id)
    if os.path.exists(upload_dir):
        try:
            shutil.rmtree(upload_dir)
        except Exception as e:
            pass  # Log but continue with deletion
    
    # Delete the intel record (cascade will handle compliance requirements)
    await db.delete(intel)
    await db.commit()
    
    return {"message": "Market Intel deleted successfully", "id": intel_id}


@router.get("/intel/{intel_id}/attachments/{attachment_idx}")
async def download_attachment(
    intel_id: str,
    attachment_idx: int,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Download an attachment from market intel"""
    from fastapi import HTTPException, status
    from app.models.market_intel import MarketIntel
    from sqlalchemy import select, and_
    
    # Get the intel record
    result = await db.execute(
        select(MarketIntel).where(
            and_(
                MarketIntel.id == intel_id,
                MarketIntel.tenant_id == tenant.id,
            )
        )
    )
    intel = result.scalar_one_or_none()
    
    if not intel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market Intel not found")
    
    if not intel.attachments or attachment_idx >= len(intel.attachments):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    
    attachment = intel.attachments[attachment_idx]
    local_path = attachment.get("local_path")
    
    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")
    
    # Determine mime type from extension
    ext = os.path.splitext(local_path)[1].lower()
    mime_types = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain',
    }
    mime_type = mime_types.get(ext, 'application/octet-stream')
    
    return FileResponse(
        path=local_path,
        filename=attachment.get("name", f"attachment{ext}"),
        media_type=mime_type,
    )
