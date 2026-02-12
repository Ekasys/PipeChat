"""Document endpoints"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from sqlalchemy import select
import os
import hashlib
import uuid
from pathlib import Path
from datetime import datetime

from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.models.document import Document
from app.config import settings

router = APIRouter()


# Allowed file types
ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.rtf', '.csv', '.json', '.xml', '.html'
}

ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/rtf',
    'text/csv',
    'application/json',
    'application/xml',
    'text/html',
}


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    opportunity_id: Optional[str] = Form(None),
    proposal_id: Optional[str] = Form(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document"""
    try:
        # Validate file size
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty"
            )
        
        if file_size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / (1024 * 1024)}MB"
            )
        
        # Validate file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext and file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Validate MIME type if provided
        if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
            # Allow if extension is valid even if MIME type doesn't match
            if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File MIME type not allowed: {file.content_type}"
                )
        
        # Create upload directory if it doesn't exist
        upload_dir = Path(settings.UPLOAD_DIR)
        tenant_dir = upload_dir / tenant.id
        tenant_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_ext = Path(file.filename).suffix
        stored_filename = f"{file_id}{file_ext}"
        file_path = tenant_dir / stored_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Calculate file hash
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Determine MIME type
        mime_type = file.content_type or "application/octet-stream"
        
        # Create document record
        document = Document(
            id=file_id,
            tenant_id=tenant.id,
            opportunity_id=opportunity_id,
            proposal_id=proposal_id,
            filename=stored_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
            document_type=document_type,
            title=title or file.filename,
            description=description,
            uploaded_at=datetime.utcnow(),
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        return {
            "id": document.id,
            "filename": document.original_filename,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "document_type": document.document_type,
            "title": document.title,
            "description": document.description,
            "opportunity_id": document.opportunity_id,
            "proposal_id": document.proposal_id,
            "uploaded_at": document.uploaded_at.isoformat() if document.uploaded_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error uploading document: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.get("/documents")
async def list_documents(
    opportunity_id: Optional[str] = None,
    proposal_id: Optional[str] = None,
    document_type: Optional[str] = None,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List documents"""
    query = select(Document).where(Document.tenant_id == tenant.id)
    
    if opportunity_id:
        query = query.where(Document.opportunity_id == opportunity_id)
    if proposal_id:
        query = query.where(Document.proposal_id == proposal_id)
    if document_type:
        query = query.where(Document.document_type == document_type)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return {
        "documents": [
            {
                "id": doc.id,
                "filename": doc.original_filename,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
                "document_type": doc.document_type,
                "title": doc.title,
                "description": doc.description,
                "opportunity_id": doc.opportunity_id,
                "proposal_id": doc.proposal_id,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            }
            for doc in documents
        ]
    }


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get document details"""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == tenant.id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return {
        "id": document.id,
        "filename": document.original_filename,
        "file_size": document.file_size,
        "mime_type": document.mime_type,
        "document_type": document.document_type,
        "title": document.title,
        "description": document.description,
        "opportunity_id": document.opportunity_id,
        "proposal_id": document.proposal_id,
        "uploaded_at": document.uploaded_at.isoformat() if document.uploaded_at else None,
    }


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document"""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == tenant.id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete file from filesystem
    try:
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
    except Exception as e:
        # Log error but continue with database deletion
        print(f"Error deleting file: {e}")
    
    # Delete from database
    from sqlalchemy import delete
    await db.execute(delete(Document).where(Document.id == document_id))
    await db.commit()
    
    return {"message": "Document deleted successfully"}


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Download a document"""
    from fastapi.responses import FileResponse
    
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == tenant.id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )
    
    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type=document.mime_type or "application/octet-stream",
    )

