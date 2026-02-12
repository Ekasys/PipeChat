"""Proposal endpoints"""
from fastapi import APIRouter, Depends, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Any
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.proposal_service import (
    create_proposal,
    parse_rfp_document,
    transition_proposal_phase,
    create_proposal_task,
    add_proposal_comment,
    create_proposal_volume,
    get_proposal_volume,
    list_proposal_volumes,
    update_proposal_volume,
    delete_proposal_volume,
    create_proposal_section,
    get_proposal_section,
    list_proposal_sections,
    update_proposal_section,
    delete_proposal_section,
    reorder_proposal_volumes,
    reorder_proposal_sections,
)
from app.models.proposal import ProposalPhase
from app.core.audit import log_audit_event
from fastapi import Request

router = APIRouter()


@router.post("/proposals")
async def create_prop(
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a proposal"""
    proposal = await create_proposal(db=db, tenant_id=tenant.id, data=data)
    return proposal


@router.get("/proposals")
async def list_proposals(
    opportunity_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List proposals"""
    from app.models.proposal import Proposal
    from sqlalchemy import select, and_
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info(f"Listing proposals for tenant {tenant.id}, opportunity_id filter: {opportunity_id}")
    
    if opportunity_id:
        logger.info(f"Filtering proposals by opportunity_id: {opportunity_id}")
        # Explicitly filter by opportunity_id and exclude NULL values
        query = select(Proposal).where(
            and_(
                Proposal.tenant_id == tenant.id,
                Proposal.opportunity_id == opportunity_id,
                Proposal.opportunity_id.isnot(None)
            )
        )
    else:
        logger.info("No opportunity_id filter provided, returning all proposals for tenant")
        query = select(Proposal).where(Proposal.tenant_id == tenant.id)
    
    result = await db.execute(query)
    proposals = result.scalars().all()
    logger.info(f"Found {len(proposals)} proposals")
    return {"proposals": list(proposals)}


@router.get("/proposals/{proposal_id}")
async def get_proposal(
    proposal_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a proposal by ID"""
    from app.models.proposal import Proposal
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from fastapi import HTTPException, status
    
    from sqlalchemy.orm import selectinload
    from app.models.proposal import ProposalVolume, ProposalSection
    
    result = await db.execute(
        select(Proposal)
        .options(
            selectinload(Proposal.volumes).selectinload(ProposalVolume.sections)
        )
        .where(
            Proposal.id == proposal_id,
            Proposal.tenant_id == tenant.id
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    return proposal


@router.put("/proposals/{proposal_id}")
async def update_proposal(
    proposal_id: str,
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a proposal"""
    from app.models.proposal import Proposal
    from sqlalchemy import select
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Proposal).where(
            Proposal.id == proposal_id,
            Proposal.tenant_id == tenant.id
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    
    # Update fields
    if "name" in data:
        proposal.name = data["name"]
    if "version" in data:
        proposal.version = data["version"]
    if "executive_summary" in data:
        proposal.executive_summary = data["executive_summary"]
    if "technical_approach" in data:
        proposal.technical_approach = data["technical_approach"]
    if "management_approach" in data:
        proposal.management_approach = data["management_approach"]
    if "past_performance" in data:
        proposal.past_performance = data["past_performance"]
    if "win_themes" in data:
        proposal.win_themes = data["win_themes"]
    if "status" in data:
        proposal.status = data["status"]
    
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.post("/proposals/{proposal_id}/parse-rfp")
async def parse_rfp(
    proposal_id: str,
    document_id: str = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Parse RFP document and generate compliance matrix"""
    result = await parse_rfp_document(db, document_id, tenant.id)
    return result


@router.post("/proposals/{proposal_id}/transition")
async def transition_phase(
    proposal_id: str,
    payload: Any = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Transition proposal to new phase.

    We accept both of the following payload shapes to be resilient to client variations:
    - Raw string body: "red_team"
    - JSON object: { "new_phase": "red_team" }
    """
    from fastapi import HTTPException, status
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Normalize the incoming payload into a string
    if isinstance(payload, str):
        new_phase = payload
    elif isinstance(payload, dict):
        new_phase = payload.get("new_phase")
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transition_phase: invalid payload. Send a string or {\"new_phase\": \"...\"}."
        )
    
    if not new_phase:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transition_phase: missing required field new_phase"
        )
    
    if not isinstance(new_phase, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"transition_phase: new_phase must be a string, got {type(new_phase).__name__}"
        )
    
    logger.info(f"Transitioning proposal {proposal_id} to phase: {new_phase}")
    
    try:
        # Convert snake_case to UPPER_CASE for enum lookup (e.g., "red_team" -> "RED_TEAM")
        phase_key = new_phase.upper().replace(' ', '_')
        logger.info(f"Looking up enum for phase_key: {phase_key}")
        phase_enum = ProposalPhase[phase_key]
        logger.info(f"Found enum: {phase_enum}")
    except KeyError as e:
        valid_phases = [p.value for p in ProposalPhase]
        logger.error(f"Invalid phase key '{phase_key}': {e}. Valid phases: {valid_phases}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid phase: {new_phase}. Valid phases: {valid_phases}"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        valid_phases = [p.value for p in ProposalPhase]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing phase transition: {str(e)}. Valid phases: {valid_phases}"
        )
    
    proposal = await transition_proposal_phase(db, proposal_id, tenant.id, phase_enum)
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    return proposal


@router.post("/proposals/{proposal_id}/tasks")
async def create_task(
    proposal_id: str,
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a proposal task"""
    task = await create_proposal_task(db, proposal_id, data)
    return task


@router.post("/proposals/{proposal_id}/comments")
async def add_comment(
    proposal_id: str,
    content: str = Body(...),
    section: Optional[str] = Body(None),
    parent_comment_id: Optional[str] = Body(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Add a comment to a proposal"""
    comment = await add_proposal_comment(
        db, proposal_id, user.id, content, section, parent_comment_id
    )
    return comment


@router.get("/proposals/{proposal_id}/export")
async def export_proposal(
    proposal_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Export proposal as Word document (.docx)"""
    from app.services.proposal_export import export_proposal_to_docx
    from fastapi.responses import StreamingResponse
    from app.models.proposal import Proposal
    from sqlalchemy import select
    from fastapi import HTTPException, status
    
    # Verify proposal exists and belongs to tenant
    result = await db.execute(
        select(Proposal).where(
            Proposal.id == proposal_id,
            Proposal.tenant_id == tenant.id
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    
    # Generate document
    buffer = await export_proposal_to_docx(db, proposal_id, tenant.id)
    
    # Return as download
    filename = f"{proposal.name.replace(' ', '_')}_v{proposal.version}.docx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# Proposal Volume Endpoints

@router.post(
    "/{proposal_id}/volumes",
    include_in_schema=True,
    tags=["Proposal Volumes"],
)
async def create_volume(
    proposal_id: str,
    data: dict,
    request: Request,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a proposal volume"""
    from fastapi import HTTPException, status
    
    if not proposal_id or not proposal_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal ID is required"
        )
    
    if not data or not data.get("name"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Volume name is required"
        )
    
    volume = await create_proposal_volume(
        db=db,
        proposal_id=proposal_id,
        tenant_id=tenant.id,
        data=data,
    )
    
    # Audit log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="create",
        resource_type="proposal_volume",
        resource_id=volume.id,
        details={"proposal_id": proposal_id, "volume_name": volume.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return volume


@router.get(
    "/{proposal_id}/volumes",
    include_in_schema=True,
    tags=["Proposal Volumes"],
)
async def list_volumes(
    proposal_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List all volumes for a proposal"""
    volumes = await list_proposal_volumes(
        db=db,
        proposal_id=proposal_id,
        tenant_id=tenant.id,
    )
    return {"volumes": volumes}


@router.get(
    "/{proposal_id}/volumes/{volume_id}",
    include_in_schema=True,
    tags=["Proposal Volumes"],
)
async def get_volume(
    proposal_id: str,
    volume_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a proposal volume by ID"""
    from fastapi import HTTPException, status
    
    volume = await get_proposal_volume(
        db=db,
        volume_id=volume_id,
        tenant_id=tenant.id,
    )
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    
    # Verify volume belongs to the proposal
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    return volume


@router.put(
    "/{proposal_id}/volumes/{volume_id}",
    include_in_schema=True,
    tags=["Proposal Volumes"],
)
async def update_volume(
    proposal_id: str,
    volume_id: str,
    data: dict,
    request: Request,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a proposal volume"""
    from fastapi import HTTPException, status
    
    volume = await update_proposal_volume(
        db=db,
        volume_id=volume_id,
        tenant_id=tenant.id,
        data=data,
    )
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    
    # Verify volume belongs to the proposal
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    # Audit log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="update",
        resource_type="proposal_volume",
        resource_id=volume.id,
        details={"proposal_id": proposal_id, "volume_name": volume.name, "changes": data},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return volume


@router.delete(
    "/{proposal_id}/volumes/{volume_id}",
    include_in_schema=True,
    tags=["Proposal Volumes"],
)
async def delete_volume(
    proposal_id: str,
    volume_id: str,
    request: Request,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete a proposal volume"""
    from fastapi import HTTPException, status
    
    # Get volume first for audit log
    volume = await get_proposal_volume(
        db=db,
        volume_id=volume_id,
        tenant_id=tenant.id,
    )
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    
    # Verify volume belongs to the proposal
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    deleted = await delete_proposal_volume(
        db=db,
        volume_id=volume_id,
        tenant_id=tenant.id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    
    # Audit log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="delete",
        resource_type="proposal_volume",
        resource_id=volume_id,
        details={"proposal_id": proposal_id, "volume_name": volume.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return {"message": "Volume deleted successfully"}

# Legacy double-path support: /proposals/proposals/{proposal_id}/volumes...
@router.post("/proposals/{proposal_id}/volumes", include_in_schema=False)
async def create_volume_legacy(*args, **kwargs):
    return await create_volume(*args, **kwargs)

@router.get("/proposals/{proposal_id}/volumes", include_in_schema=False)
async def list_volumes_legacy(*args, **kwargs):
    return await list_volumes(*args, **kwargs)

@router.get("/proposals/{proposal_id}/volumes/{volume_id}", include_in_schema=False)
async def get_volume_legacy(*args, **kwargs):
    return await get_volume(*args, **kwargs)

@router.put("/proposals/{proposal_id}/volumes/{volume_id}", include_in_schema=False)
async def update_volume_legacy(*args, **kwargs):
    return await update_volume(*args, **kwargs)

@router.delete("/proposals/{proposal_id}/volumes/{volume_id}", include_in_schema=False)
async def delete_volume_legacy(*args, **kwargs):
    return await delete_volume(*args, **kwargs)


# Proposal Section Endpoints

@router.post(
    "/{proposal_id}/volumes/{volume_id}/sections",
    include_in_schema=True,
    tags=["Proposal Sections"],
)
async def create_section(
    proposal_id: str,
    volume_id: str,
    data: dict,
    request: Request,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a proposal section"""
    from fastapi import HTTPException, status
    
    # Verify volume belongs to proposal and tenant
    volume = await get_proposal_volume(db=db, volume_id=volume_id, tenant_id=tenant.id)
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    if not data or not data.get("heading"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section heading is required"
        )
    
    section = await create_proposal_section(
        db=db,
        volume_id=volume_id,
        data=data,
    )
    
    # Audit log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="create",
        resource_type="proposal_section",
        resource_id=section.id,
        details={"proposal_id": proposal_id, "volume_id": volume_id, "heading": section.heading},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return section


@router.get(
    "/{proposal_id}/volumes/{volume_id}/sections",
    include_in_schema=True,
    tags=["Proposal Sections"],
)
async def list_sections(
    proposal_id: str,
    volume_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List all sections for a volume"""
    from fastapi import HTTPException, status
    
    # Verify volume belongs to proposal and tenant
    volume = await get_proposal_volume(db=db, volume_id=volume_id, tenant_id=tenant.id)
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    sections = await list_proposal_sections(db=db, volume_id=volume_id)
    return {"sections": sections}


@router.get(
    "/{proposal_id}/volumes/{volume_id}/sections/{section_id}",
    include_in_schema=True,
    tags=["Proposal Sections"],
)
async def get_section(
    proposal_id: str,
    volume_id: str,
    section_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a proposal section by ID"""
    from fastapi import HTTPException, status
    
    # Verify volume belongs to proposal and tenant
    volume = await get_proposal_volume(db=db, volume_id=volume_id, tenant_id=tenant.id)
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    section = await get_proposal_section(db=db, section_id=section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    
    if section.volume_id != volume_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Section does not belong to this volume")
    
    return section


@router.put(
    "/{proposal_id}/volumes/{volume_id}/sections/{section_id}",
    include_in_schema=True,
    tags=["Proposal Sections"],
)
async def update_section(
    proposal_id: str,
    volume_id: str,
    section_id: str,
    data: dict,
    request: Request,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a proposal section"""
    from fastapi import HTTPException, status
    
    # Verify volume belongs to proposal and tenant
    volume = await get_proposal_volume(db=db, volume_id=volume_id, tenant_id=tenant.id)
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    section = await update_proposal_section(
        db=db,
        section_id=section_id,
        data=data,
    )
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    
    if section.volume_id != volume_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Section does not belong to this volume")
    
    # Audit log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="update",
        resource_type="proposal_section",
        resource_id=section.id,
        details={"proposal_id": proposal_id, "volume_id": volume_id, "changes": data},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return section


@router.delete(
    "/{proposal_id}/volumes/{volume_id}/sections/{section_id}",
    include_in_schema=True,
    tags=["Proposal Sections"],
)
async def delete_section(
    proposal_id: str,
    volume_id: str,
    section_id: str,
    request: Request,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete a proposal section"""
    from fastapi import HTTPException, status
    
    # Verify volume belongs to proposal and tenant
    volume = await get_proposal_volume(db=db, volume_id=volume_id, tenant_id=tenant.id)
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    # Get section first for audit log
    section = await get_proposal_section(db=db, section_id=section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    
    if section.volume_id != volume_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Section does not belong to this volume")
    
    deleted = await delete_proposal_section(db=db, section_id=section_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    
    # Audit log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="delete",
        resource_type="proposal_section",
        resource_id=section_id,
        details={"proposal_id": proposal_id, "volume_id": volume_id, "heading": section.heading},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return {"message": "Section deleted successfully"}


@router.post(
    "/{proposal_id}/volumes/reorder",
    include_in_schema=True,
    tags=["Proposal Volumes"],
)
async def reorder_volumes(
    proposal_id: str,
    volume_orders: list = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Reorder volumes within a proposal"""
    volumes = await reorder_proposal_volumes(
        db=db,
        proposal_id=proposal_id,
        tenant_id=tenant.id,
        volume_orders=volume_orders,
    )
    return {"volumes": volumes}


@router.post(
    "/{proposal_id}/volumes/{volume_id}/sections/reorder",
    include_in_schema=True,
    tags=["Proposal Sections"],
)
async def reorder_sections(
    proposal_id: str,
    volume_id: str,
    section_orders: list = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Reorder sections within a volume"""
    from fastapi import HTTPException, status
    
    # Verify volume belongs to proposal and tenant
    volume = await get_proposal_volume(db=db, volume_id=volume_id, tenant_id=tenant.id)
    if not volume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volume not found")
    if volume.proposal_id != proposal_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volume does not belong to this proposal")
    
    sections = await reorder_proposal_sections(
        db=db,
        volume_id=volume_id,
        section_orders=section_orders,
    )
    return {"sections": sections}
