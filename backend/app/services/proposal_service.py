"""Proposal service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy import func as sa_func
from datetime import datetime

from app.models.proposal import Proposal, ProposalPhaseRecord, ProposalTask, ProposalComment, ProposalPhase, ProposalVolume, ProposalSection, VolumeType, VolumeStatus, StructureSource
from app.models.opportunity import Opportunity
from app.utils.file_parser import parse_pdf
from app.utils.rfp_parser import extract_rfp_sections, generate_compliance_matrix
from fastapi import HTTPException, status


async def create_proposal(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Proposal:
    """Create a proposal"""
    proposal = Proposal(
        tenant_id=tenant_id,
        opportunity_id=data["opportunity_id"],
        name=data["name"],
        version=data.get("version", "1.0"),
        current_phase=ProposalPhase.PINK_TEAM,
        executive_summary=data.get("executive_summary"),
        technical_approach=data.get("technical_approach"),
        win_themes=data.get("win_themes"),
    )
    
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    
    # Create initial Pink Team phase
    phase = ProposalPhaseRecord(
        proposal_id=proposal.id,
        phase=ProposalPhase.PINK_TEAM,
        status="in_progress",
        start_date=datetime.utcnow(),
    )
    db.add(phase)
    await db.commit()
    
    return proposal


async def parse_rfp_document(
    db: AsyncSession,
    document_id: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """Parse RFP document and generate compliance matrix"""
    from app.models.document import Document
    
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == tenant_id,
            )
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        return {"error": "Document not found"}
    
    # Parse PDF
    parsed = await parse_pdf(document.file_path)
    if "error" in parsed:
        return parsed
    
    # Extract RFP sections
    sections = await extract_rfp_sections(parsed["text"])
    
    # Generate compliance matrix
    matrix = generate_compliance_matrix(sections)
    
    # Update document with parsed data
    document.rfp_sections = sections
    document.requirements = parsed["text"][:5000]  # Store first 5000 chars
    await db.commit()
    
    return {
        "sections": sections,
        "compliance_matrix": matrix,
        "text_length": parsed["length"],
    }


async def transition_proposal_phase(
    db: AsyncSession,
    proposal_id: str,
    tenant_id: str,
    new_phase: ProposalPhase,
) -> Optional[Proposal]:
    """Transition proposal to new phase"""
    result = await db.execute(
        select(Proposal).where(
            and_(
                Proposal.id == proposal_id,
                Proposal.tenant_id == tenant_id,
            )
        )
    )
    proposal = result.scalar_one_or_none()
    
    if not proposal:
        return None
    
    # Close current phase
    current_phase_result = await db.execute(
        select(ProposalPhaseRecord).where(
            and_(
                ProposalPhaseRecord.proposal_id == proposal_id,
                ProposalPhaseRecord.status == "in_progress",
            )
        )
    )
    current_phase = current_phase_result.scalar_one_or_none()
    if current_phase:
        current_phase.status = "completed"
        current_phase.end_date = datetime.utcnow()
    
    # Create new phase
    new_phase_record = ProposalPhaseRecord(
        proposal_id=proposal_id,
        phase=new_phase,
        status="in_progress",
        start_date=datetime.utcnow(),
    )
    db.add(new_phase_record)
    
    proposal.current_phase = new_phase
    proposal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(proposal)
    
    return proposal


async def create_proposal_task(
    db: AsyncSession,
    proposal_id: str,
    data: Dict[str, Any],
) -> ProposalTask:
    """Create a proposal task"""
    task = ProposalTask(
        proposal_id=proposal_id,
        assigned_to_id=data.get("assigned_to_id"),
        title=data["title"],
        description=data.get("description"),
        priority=data.get("priority", "medium"),
        due_date=data.get("due_date"),
    )
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def add_proposal_comment(
    db: AsyncSession,
    proposal_id: str,
    user_id: str,
    content: str,
    section: Optional[str] = None,
    parent_comment_id: Optional[str] = None,
) -> ProposalComment:
    """Add a comment to a proposal"""
    comment = ProposalComment(
        proposal_id=proposal_id,
        user_id=user_id,
        content=content,
        section=section,
        parent_comment_id=parent_comment_id,
    )
    
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


# Proposal Volume Service Functions

async def create_proposal_volume(
    db: AsyncSession,
    proposal_id: str,
    tenant_id: str,
    data: Dict[str, Any],
) -> ProposalVolume:
    """Create a proposal volume"""
    # Verify proposal exists and belongs to tenant
    proposal_result = await db.execute(
        select(Proposal).where(Proposal.id == proposal_id)
    )
    proposal = proposal_result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )
    
    # Check for unique volume name per proposal
    existing_volume_result = await db.execute(
        select(ProposalVolume).where(
            and_(
                ProposalVolume.proposal_id == proposal_id,
                ProposalVolume.name == data["name"],
            )
        )
    )
    existing_volume = existing_volume_result.scalar_one_or_none()
    if existing_volume:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Volume with name '{data['name']}' already exists for this proposal"
        )
    
    # Validate enum values (volume_type is now optional)
    volume_type = None
    if "volume_type" in data and data["volume_type"]:
        try:
            volume_type = VolumeType(data["volume_type"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid volume_type: {data.get('volume_type')}"
            )
    
    try:
        volume_status = VolumeStatus(data.get("status", "draft"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {data.get('status')}"
        )
    
    # Handle source
    source = StructureSource.USER
    if "source" in data and data["source"]:
        try:
            source = StructureSource(data["source"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid source: {data.get('source')}"
            )
    
    # Get max order_index for this proposal to set new volume's order
    max_order_result = await db.execute(
        select(sa_func.max(ProposalVolume.order_index)).where(
            ProposalVolume.proposal_id == proposal_id
        )
    )
    max_order = max_order_result.scalar() or -1
    order_index = data.get("order_index", max_order + 1)
    
    volume = ProposalVolume(
        proposal_id=proposal_id,
        tenant_id=tenant_id,
        name=data["name"],
        volume_type=volume_type,
        status=volume_status,
        source=source,
        order_index=order_index,
        rfp_reference=data.get("rfp_reference"),
        description=data.get("description"),
        content=data.get("content"),
        compliance_notes=data.get("compliance_notes"),
        page_count=data.get("page_count"),
        word_count=data.get("word_count"),
        owner_id=data.get("owner_id"),
        page_limit=data.get("page_limit"),
        rfp_sections=data.get("rfp_sections"),
        executive_summary=data.get("executive_summary"),
        technical_approach=data.get("technical_approach"),
    )
    
    db.add(volume)
    await db.commit()
    await db.refresh(volume)
    return volume


async def get_proposal_volume(
    db: AsyncSession,
    volume_id: str,
    tenant_id: str,
) -> Optional[ProposalVolume]:
    """Get a proposal volume by ID with sections"""
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(ProposalVolume)
        .options(selectinload(ProposalVolume.sections))
        .where(
            and_(
                ProposalVolume.id == volume_id,
                ProposalVolume.tenant_id == tenant_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def list_proposal_volumes(
    db: AsyncSession,
    proposal_id: str,
    tenant_id: str,
) -> List[ProposalVolume]:
    """List all volumes for a proposal, ordered by order_index"""
    # Verify proposal exists and belongs to tenant
    proposal_result = await db.execute(
        select(Proposal).where(
            and_(
                Proposal.id == proposal_id,
                Proposal.tenant_id == tenant_id,
            )
        )
    )
    proposal = proposal_result.scalar_one_or_none()
    if not proposal:
        # If the proposal isn't found for this tenant, return an empty list instead of 404.
        # This prevents the UI from failing when proposals exist under a different tenant
        # or the record was recently removed.
        return []
    
    result = await db.execute(
        select(ProposalVolume).where(
            and_(
                ProposalVolume.proposal_id == proposal_id,
                ProposalVolume.tenant_id == tenant_id,
            )
        ).order_by(ProposalVolume.order_index, ProposalVolume.created_at)
    )
    return list(result.scalars().all())


async def update_proposal_volume(
    db: AsyncSession,
    volume_id: str,
    tenant_id: str,
    data: Dict[str, Any],
) -> Optional[ProposalVolume]:
    """Update a proposal volume"""
    result = await db.execute(
        select(ProposalVolume).where(
            and_(
                ProposalVolume.id == volume_id,
                ProposalVolume.tenant_id == tenant_id,
            )
        )
    )
    volume = result.scalar_one_or_none()
    if not volume:
        return None
    
    # Check if volume is locked
    if volume.status == VolumeStatus.LOCKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a locked volume"
        )
    
    # Check for unique volume name if name is being changed
    if "name" in data and data["name"] != volume.name:
        existing_volume_result = await db.execute(
            select(ProposalVolume).where(
                and_(
                    ProposalVolume.proposal_id == volume.proposal_id,
                    ProposalVolume.name == data["name"],
                    ProposalVolume.id != volume_id,
                )
            )
        )
        existing_volume = existing_volume_result.scalar_one_or_none()
        if existing_volume:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Volume with name '{data['name']}' already exists for this proposal"
            )
    
    # Update fields
    if "name" in data:
        volume.name = data["name"]
    if "volume_type" in data:
        if data["volume_type"] is None:
            volume.volume_type = None
        else:
            try:
                volume.volume_type = VolumeType(data["volume_type"])
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid volume_type: {data['volume_type']}"
                )
    if "source" in data:
        try:
            volume.source = StructureSource(data["source"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid source: {data['source']}"
            )
    if "order_index" in data:
        volume.order_index = data["order_index"]
    if "rfp_reference" in data:
        volume.rfp_reference = data["rfp_reference"]
    if "status" in data:
        # Validate status transition
        try:
            new_status = VolumeStatus(data["status"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {data['status']}"
            )
        if volume.status == VolumeStatus.LOCKED and new_status != VolumeStatus.LOCKED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change status of a locked volume"
            )
        volume.status = new_status
    if "description" in data:
        volume.description = data["description"]
    if "content" in data:
        volume.content = data["content"]
    if "compliance_notes" in data:
        volume.compliance_notes = data["compliance_notes"]
    if "page_count" in data:
        volume.page_count = data["page_count"]
    if "word_count" in data:
        volume.word_count = data["word_count"]
    if "owner_id" in data:
        volume.owner_id = data["owner_id"]
    if "page_limit" in data:
        volume.page_limit = data["page_limit"]
    if "rfp_sections" in data:
        volume.rfp_sections = data["rfp_sections"]
    if "executive_summary" in data:
        volume.executive_summary = data["executive_summary"]
    if "technical_approach" in data:
        volume.technical_approach = data["technical_approach"]
    
    volume.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(volume)
    return volume


async def delete_proposal_volume(
    db: AsyncSession,
    volume_id: str,
    tenant_id: str,
) -> bool:
    """Delete a proposal volume"""
    result = await db.execute(
        select(ProposalVolume).where(
            and_(
                ProposalVolume.id == volume_id,
                ProposalVolume.tenant_id == tenant_id,
            )
        )
    )
    volume = result.scalar_one_or_none()
    if not volume:
        return False
    
    # Check if volume is locked
    if volume.status == VolumeStatus.LOCKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a locked volume"
        )
    
    await db.delete(volume)
    await db.commit()
    return True


# Proposal Section Service Functions

async def create_proposal_section(
    db: AsyncSession,
    volume_id: str,
    data: Dict[str, Any],
) -> ProposalSection:
    """Create a proposal section"""
    # Verify volume exists
    volume_result = await db.execute(
        select(ProposalVolume).where(ProposalVolume.id == volume_id)
    )
    volume = volume_result.scalar_one_or_none()
    if not volume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volume not found"
        )
    
    # Handle source
    source = StructureSource.USER
    if "source" in data and data["source"]:
        try:
            source = StructureSource(data["source"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid source: {data.get('source')}"
            )
    
    # Get max order_index for this volume to set new section's order
    max_order_result = await db.execute(
        select(sa_func.max(ProposalSection.order_index)).where(
            ProposalSection.volume_id == volume_id
        )
    )
    max_order = max_order_result.scalar() or -1
    order_index = data.get("order_index", max_order + 1)
    
    section = ProposalSection(
        volume_id=volume_id,
        heading=data["heading"],
        order_index=order_index,
        source=source,
        rfp_reference=data.get("rfp_reference"),
        parent_section_id=data.get("parent_section_id"),
        content=data.get("content"),
    )
    
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


async def get_proposal_section(
    db: AsyncSession,
    section_id: str,
) -> Optional[ProposalSection]:
    """Get a proposal section by ID"""
    result = await db.execute(
        select(ProposalSection).where(ProposalSection.id == section_id)
    )
    return result.scalar_one_or_none()


async def list_proposal_sections(
    db: AsyncSession,
    volume_id: str,
) -> List[ProposalSection]:
    """List all sections for a volume, ordered by order_index"""
    result = await db.execute(
        select(ProposalSection).where(
            ProposalSection.volume_id == volume_id
        ).order_by(ProposalSection.order_index, ProposalSection.created_at)
    )
    return list(result.scalars().all())


async def update_proposal_section(
    db: AsyncSession,
    section_id: str,
    data: Dict[str, Any],
) -> Optional[ProposalSection]:
    """Update a proposal section"""
    result = await db.execute(
        select(ProposalSection).where(ProposalSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        return None
    
    # Update fields
    if "heading" in data:
        section.heading = data["heading"]
    if "order_index" in data:
        section.order_index = data["order_index"]
    if "source" in data:
        try:
            section.source = StructureSource(data["source"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid source: {data['source']}"
            )
    if "rfp_reference" in data:
        section.rfp_reference = data["rfp_reference"]
    if "parent_section_id" in data:
        section.parent_section_id = data["parent_section_id"]
    if "content" in data:
        section.content = data["content"]
    
    section.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(section)
    return section


async def delete_proposal_section(
    db: AsyncSession,
    section_id: str,
) -> bool:
    """Delete a proposal section"""
    result = await db.execute(
        select(ProposalSection).where(ProposalSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        return False
    
    await db.delete(section)
    await db.commit()
    return True


async def reorder_proposal_volumes(
    db: AsyncSession,
    proposal_id: str,
    tenant_id: str,
    volume_orders: List[Dict[str, Any]],  # [{"volume_id": "...", "order_index": 0}, ...]
) -> List[ProposalVolume]:
    """Reorder volumes within a proposal"""
    # Verify proposal exists
    proposal_result = await db.execute(
        select(Proposal).where(
            and_(
                Proposal.id == proposal_id,
                Proposal.tenant_id == tenant_id,
            )
        )
    )
    proposal = proposal_result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )
    
    # Update order_index for each volume
    for vol_order in volume_orders:
        volume_id = vol_order.get("volume_id")
        order_index = vol_order.get("order_index")
        if volume_id and order_index is not None:
            volume_result = await db.execute(
                select(ProposalVolume).where(
                    and_(
                        ProposalVolume.id == volume_id,
                        ProposalVolume.proposal_id == proposal_id,
                        ProposalVolume.tenant_id == tenant_id,
                    )
                )
            )
            volume = volume_result.scalar_one_or_none()
            if volume:
                volume.order_index = order_index
                volume.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # Return updated list
    return await list_proposal_volumes(db, proposal_id, tenant_id)


async def reorder_proposal_sections(
    db: AsyncSession,
    volume_id: str,
    section_orders: List[Dict[str, Any]],  # [{"section_id": "...", "order_index": 0}, ...]
) -> List[ProposalSection]:
    """Reorder sections within a volume"""
    # Verify volume exists
    volume_result = await db.execute(
        select(ProposalVolume).where(ProposalVolume.id == volume_id)
    )
    volume = volume_result.scalar_one_or_none()
    if not volume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volume not found"
        )
    
    # Update order_index for each section
    for sec_order in section_orders:
        section_id = sec_order.get("section_id")
        order_index = sec_order.get("order_index")
        if section_id and order_index is not None:
            section_result = await db.execute(
                select(ProposalSection).where(
                    and_(
                        ProposalSection.id == section_id,
                        ProposalSection.volume_id == volume_id,
                    )
                )
            )
            section = section_result.scalar_one_or_none()
            if section:
                section.order_index = order_index
                section.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # Return updated list
    return await list_proposal_sections(db, volume_id)

