"""AI Assistant endpoints"""
from fastapi import APIRouter, Depends, Body, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel, Field, validator
import asyncio
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.ai_service import (
    parse_rfp_summary,
    tailor_resume_to_sow,
    draft_proposal_content,
    get_win_theme_suggestions,
    analyze_proposal_risks,
)

# Import with error handling
try:
    from app.services.ai_service import generate_company_profile_field
    print("OK: generate_company_profile_field imported successfully")
except ImportError as e:
    print(f"ERROR: Failed to import generate_company_profile_field: {e}")
    import traceback
    traceback.print_exc()
    # Define a stub function to prevent route registration failure
    async def generate_company_profile_field(*args, **kwargs):
        return "[Error: Function not available]"

router = APIRouter()

# Debug: Print when module loads
print("AI Assistant router module loaded - routes will be registered")


class ParseRFPRequest(BaseModel):
    document_id: str = Field(..., min_length=1, description="Document ID to parse")
    model: Optional[str] = Field(None, max_length=100, description="AI model to use")
    
    @validator('document_id')
    def validate_document_id(cls, v):
        if not v or not v.strip():
            raise ValueError('document_id cannot be empty')
        return v.strip()


@router.post("/parse-rfp")
async def parse_rfp(
    request: ParseRFPRequest,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Parse RFP and generate summary"""
    try:
        # Add timeout for long-running operations
        result = await asyncio.wait_for(
            parse_rfp_summary(db, request.document_id, tenant.id, request.model),
            timeout=300.0  # 5 minute timeout for large PDFs
        )
        
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        return result
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="RFP parsing timed out. The document may be too large or complex."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse RFP: {str(e)}"
        )


class TailorResumeRequest(BaseModel):
    resume_text: str = Field(..., min_length=10, max_length=50000, description="Resume text to tailor")
    sow_text: str = Field(..., min_length=10, max_length=50000, description="Statement of Work text")
    model: Optional[str] = Field(None, max_length=100, description="AI model to use")


@router.post("/tailor-resume")
async def tailor_resume(
    request: TailorResumeRequest = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Tailor resume to SOW"""
    try:
        tailored = await asyncio.wait_for(
            tailor_resume_to_sow(request.resume_text, request.sow_text, request.model, db, tenant.id),
            timeout=120.0  # 2 minute timeout
        )
        return {"tailored_resume": tailored}
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Resume tailoring timed out. Please try again or use shorter text."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to tailor resume: {str(e)}"
        )


class DraftProposalRequest(BaseModel):
    opportunity_id: str = Field(..., min_length=1, description="Opportunity ID")
    section_type: str = Field(..., description="Section type to draft")
    model: Optional[str] = Field(None, max_length=100, description="AI model to use")
    
    @validator('section_type')
    def validate_section_type(cls, v):
        valid_sections = ['executive_summary', 'technical_approach', 'management_approach', 'past_performance']
        if v not in valid_sections:
            raise ValueError(f'section_type must be one of: {", ".join(valid_sections)}')
        return v


@router.post("/draft-proposal")
async def draft_proposal(
    request: DraftProposalRequest = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Draft proposal section using AI"""
    try:
        content = await asyncio.wait_for(
            draft_proposal_content(db, request.opportunity_id, tenant.id, request.section_type, request.model),
            timeout=180.0  # 3 minute timeout
        )
        return {"content": content}
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Proposal drafting timed out. Please try again."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to draft proposal: {str(e)}"
        )


@router.get("/opportunities/{opportunity_id}/win-themes")
async def get_themes(
    opportunity_id: str,
    model: Optional[str] = None,
    regenerate: bool = False,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get win themes for an opportunity. Returns existing themes if available, unless regenerate=True."""
    try:
        themes = await asyncio.wait_for(
            get_win_theme_suggestions(db, opportunity_id, tenant.id, model, regenerate=regenerate),
            timeout=60.0  # 1 minute timeout
        )
        return {"win_themes": themes}
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Win theme generation timed out. Please try again."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate win themes: {str(e)}"
        )


class AnalyzeRisksRequest(BaseModel):
    proposal_text: str = Field(..., min_length=10, max_length=50000, description="Proposal text to analyze")
    model: Optional[str] = Field(None, max_length=100, description="AI model to use")


@router.post("/analyze-risks")
async def analyze_risks(
    request: AnalyzeRisksRequest = Body(...),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Identify risks in proposal"""
    try:
        risks = await asyncio.wait_for(
            analyze_proposal_risks(request.proposal_text, request.model, db, tenant.id),
            timeout=120.0  # 2 minute timeout
        )
        return {"risks": risks}
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Risk analysis timed out. Please try again or use shorter text."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze risks: {str(e)}"
        )


# Company Profile Field Generation
class GenerateCompanyFieldRequest(BaseModel):
    website_url: str = Field(..., description="Website URL to scrape")
    field_name: str = Field(..., description="Field name to generate")
    model: Optional[str] = Field(None, max_length=100, description="AI model to use")
    
    @validator('website_url')
    def validate_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('website_url must start with http:// or https://')
        return v
    
    @validator('field_name')
    def validate_field_name(cls, v):
        valid_fields = [
            'company_overview', 'mission_statement', 'vision_statement',
            'core_values', 'differentiators', 'core_capabilities',
            'technical_expertise', 'service_offerings'
        ]
        if v not in valid_fields:
            raise ValueError(f'field_name must be one of: {", ".join(valid_fields)}')
        return v


@router.post("/generate-company-field")
async def generate_company_field(
    request: GenerateCompanyFieldRequest,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Generate company profile field content from website URL"""
    try:
        content = await asyncio.wait_for(
            generate_company_profile_field(
                request.website_url,
                request.field_name,
                request.model,
                db,
                tenant.id,
            ),
            timeout=120.0  # 2 minute timeout
        )
        
        if content.startswith("[Error"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=content
            )
        
        return {"content": content}
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Company field generation timed out. Please try again."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate company field: {str(e)}"
        )

# Debug: Verify route is registered
print(f"AI Assistant router initialized with {len(router.routes)} routes")
for route in router.routes:
    if hasattr(route, 'path') and 'generate-company' in route.path:
        print(f"  OK: Found generate-company-field route: {route.path}")
