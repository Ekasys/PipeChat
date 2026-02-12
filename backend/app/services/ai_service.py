"""AI Assistant service"""
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import httpx
from bs4 import BeautifulSoup

from app.integrations.openai_client import (
    draft_proposal_section,
    suggest_win_themes,
    identify_risks,
    call_openai,
)
from app.models.opportunity import Opportunity
from app.models.document import Document
from app.utils.file_parser import parse_pdf
from app.utils.rfp_parser import extract_rfp_sections


async def parse_rfp_summary(
    db: AsyncSession,
    document_id: str,
    tenant_id: str,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse RFP and generate summary"""
    try:
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
            return {"error": f"Document not found with ID: {document_id} for tenant: {tenant_id}"}
        
        # Check if file exists
        import os
        file_path = document.file_path
        print(f"Looking for document file at: {file_path}")
        if not os.path.exists(file_path):
            # Try with absolute path if relative
            if not os.path.isabs(file_path):
                abs_path = os.path.abspath(file_path)
                print(f"Trying absolute path: {abs_path}")
                if os.path.exists(abs_path):
                    file_path = abs_path
                else:
                    return {"error": f"File not found at path: {document.file_path} (also tried: {abs_path})"}
            else:
                return {"error": f"File not found at path: {file_path}"}
        
        print(f"Using file path: {file_path}")
        # Parse PDF - limit to first 20 pages for speed (most RFPs have key info upfront)
        parsed = await parse_pdf(file_path, max_pages=20)
        if "error" in parsed:
            return parsed
        
        # Extract sections (limit text size for faster processing)
        text_for_sections = parsed["text"][:50000]  # Limit to 50k chars for faster regex
        sections = await extract_rfp_sections(text_for_sections)
        
        # Generate AI summary - use a larger excerpt for context but cap to keep prompt manageable
        text_for_summary = parsed["text"][:4000]
        summary_prompt = f"""
You are an expert federal contracting analyst. Summarize the RFP excerpt below.

TEXT:
\"\"\"{text_for_summary}\"\"\"

Respond using the exact headings shown (always include all of them even if the excerpt lacks information; write "Not specified in excerpt" when a heading cannot be filled):

### Key Requirements
- ...

### Evaluation Criteria
- ...

### Important Dates
- ...

### Submission Requirements
- ...

### Overall Summary
- 1-2 sentence wrap-up
"""

        # Use AI Provider system if available
        from app.integrations.ai_provider_client import call_ai_provider
        try:
            summary = await call_ai_provider(db, tenant_id, summary_prompt, model, max_tokens=2000)
        except Exception as e:
            print(f"AI Provider call failed, falling back to OpenAI: {e}")
            summary = await call_openai(summary_prompt, max_tokens=2000, model=model)

        # Guarantee all headings exist even if the model omits them
        required_sections = [
            "### Key Requirements",
            "### Evaluation Criteria",
            "### Important Dates",
            "### Submission Requirements",
            "### Overall Summary",
        ]
        normalized_summary = summary or ""
        for heading in required_sections:
            if heading not in normalized_summary:
                normalized_summary += f"\n\n{heading}\n- Not specified in excerpt"
        summary = normalized_summary.strip()
        
        return {
            "summary": summary or "Summary not available",
            "sections": sections,
            "text_length": parsed.get("length", len(parsed.get("text", ""))),
        }
    except Exception as e:
        import traceback
        print(f"Error in parse_rfp_summary: {e}")
        print(traceback.format_exc())
        return {"error": f"Failed to parse RFP: {str(e)}"}


async def tailor_resume_to_sow(
    resume_text: str,
    sow_text: str,
    model: Optional[str] = None,
    db: Optional[AsyncSession] = None,
    tenant_id: Optional[str] = None,
) -> str:
    """Tailor resume to match SOW requirements"""
    prompt = f"""
    Tailor this resume to match the Statement of Work requirements:
    
    RESUME:
    {resume_text[:2000]}
    
    STATEMENT OF WORK:
    {sow_text[:2000]}
    
    Provide a tailored resume that highlights relevant experience and skills.
    """
    
    # Use AI Provider system if available
    if db and tenant_id:
        from app.integrations.ai_provider_client import call_ai_provider
        try:
            return await call_ai_provider(db, tenant_id, prompt, model, max_tokens=2000) or "Resume tailoring not available"
        except Exception as e:
            print(f"AI Provider call failed, falling back to OpenAI: {e}")
    
    # Fallback to original OpenAI implementation
    return await call_openai(prompt, max_tokens=2000, model=model) or "Resume tailoring not available"


async def draft_proposal_content(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
    section_type: str,
    model: Optional[str] = None,
) -> str:
    """Draft proposal section using AI, aligned with opportunity RFP documents"""
    from app.models.document import Document
    
    # Fetch opportunity
    result = await db.execute(
        select(Opportunity).where(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.tenant_id == tenant_id,
            )
        )
    )
    opportunity = result.scalar_one_or_none()
    
    if not opportunity:
        return "Opportunity not found"
    
    # Fetch all RFP documents for this opportunity
    docs_result = await db.execute(
        select(Document).where(
            and_(
                Document.opportunity_id == opportunity_id,
                Document.tenant_id == tenant_id,
                Document.document_type.in_(["rfp", "amendment", "solicitation", None]),  # Include all docs, not just typed ones
            )
        )
    )
    rfp_documents = docs_result.scalars().all()
    
    # Collect RFP content from documents
    rfp_content_parts = []
    for doc in rfp_documents:
        doc_content = None
        
        # Try to get parsed content first
        if doc.requirements:
            # Use stored requirements if available (maximum context for comprehensive proposals)
            doc_content = doc.requirements[:100000]  # Up to 100k chars per document
        elif doc.rfp_sections:
            # Use parsed sections if available
            doc_content = doc.rfp_sections[:100000]
        
        # If no parsed content, try to parse the document on-the-fly (comprehensive parse)
        if not doc_content and doc.file_path:
            try:
                import os
                file_path = doc.file_path
                if not os.path.exists(file_path) and not os.path.isabs(file_path):
                    file_path = os.path.abspath(file_path)
                
                if os.path.exists(file_path):
                    # Parse full document for maximum context (increased from 25 to 100 pages)
                    parsed = await parse_pdf(file_path, max_pages=100)
                    if "text" in parsed and not parsed.get("error"):
                        doc_content = parsed["text"][:100000]
            except Exception as e:
                print(f"Could not parse document {doc.id} on-the-fly: {e}")
        
        if doc_content:
            rfp_content_parts.append(f"Document: {doc.title or doc.filename}\n{doc_content}")
    
    # Combine all RFP content
    rfp_content = "\n\n---\n\n".join(rfp_content_parts) if rfp_content_parts else "No RFP documents found for this opportunity."
    
    # Get company profile context for proposal generation
    from app.services.company_profile_service import get_company_context_for_proposals
    company_context = await get_company_context_for_proposals(db, tenant_id)
    
    context = {
        "opportunity_name": opportunity.name,
        "agency": opportunity.agency or "N/A",
        "requirements": opportunity.requirements or "N/A",
        "description": opportunity.description or "N/A",
        "rfp_content": rfp_content,  # Add RFP document content
        "company_context": company_context,  # Add company profile information
    }
    
    return await draft_proposal_section(section_type, context, model=model, db=db, tenant_id=tenant_id)


async def get_win_theme_suggestions(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
    model: Optional[str] = None,
    regenerate: bool = False,
) -> List[str]:
    """Get AI-suggested win themes. Returns existing themes if available, unless regenerate=True."""
    result = await db.execute(
        select(Opportunity).where(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.tenant_id == tenant_id,
            )
        )
    )
    opportunity = result.scalar_one_or_none()
    
    if not opportunity:
        return []
    
    # Return existing win themes if they exist and we're not regenerating
    if not regenerate and opportunity.win_themes and len(opportunity.win_themes) > 0:
        return opportunity.win_themes
    
    # Generate new win themes
    opportunity_data = {
        "name": opportunity.name,
        "agency": opportunity.agency or "N/A",
        "description": opportunity.description or "N/A",
    }
    
    # Use AI Provider system
    from app.integrations.ai_provider_client import call_ai_provider
    prompt = f"""
    Based on this opportunity, suggest 3-5 win themes:
    
    Opportunity: {opportunity_data.get('name', 'N/A')}
    Agency: {opportunity_data.get('agency', 'N/A')}
    Description: {opportunity_data.get('description', 'N/A')[:500]}
    
    Provide win themes as a bulleted list.
    """
    
    themes = []
    try:
        response = await call_ai_provider(db, tenant_id, prompt, model, max_tokens=500)
        if response:
            # Parse bullet points
            themes = [line.strip("- ").strip() for line in response.split("\n") if line.strip().startswith("-")]
            themes = themes[:5]
    except Exception as e:
        print(f"AI Provider call failed, falling back to OpenAI: {e}")
        themes = await suggest_win_themes(opportunity_data, model)
    
    # Save generated themes to the opportunity
    if themes:
        from app.services.opportunity_service import update_opportunity
        await update_opportunity(db, opportunity_id, tenant_id, {"win_themes": themes})
    
    return themes


async def analyze_proposal_risks(
    proposal_text: str,
    model: Optional[str] = None,
    db: Optional[AsyncSession] = None,
    tenant_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Identify risks in proposal text using configured AI provider"""
    prompt = f"""You are an expert proposal reviewer specializing in government contracting. Analyze the following proposal text and identify potential risks, compliance gaps, evaluation factor weaknesses, and quality issues.

PROPOSAL TEXT:
{proposal_text[:2000]}

ANALYSIS REQUIREMENTS:

1. COMPLIANCE RISKS:
   - Missing mandatory requirements or evaluation factors
   - Format or structure non-compliance
   - Unsupported claims or missing evidence
   - Regulatory or certification gaps

2. EVALUATION FACTOR WEAKNESSES:
   - Weak alignment with evaluation criteria
   - Missing or insufficient responses to RFP requirements
   - Lack of quantifiable metrics or specific examples
   - Generic language that doesn't differentiate

3. PROPOSAL QUALITY ISSUES:
   - Unclear or confusing language
   - Missing win themes or value propositions
   - Weak connection between company capabilities and requirements
   - Lack of structure or logical flow
   - Insufficient detail or excessive verbosity

4. RISK ASSESSMENT:
   For each identified issue, assess:
   - Severity: High (could cause rejection), Medium (weakens proposal), Low (minor improvement needed)
   - Impact: How this affects evaluation scores or compliance
   - Recommendation: Specific, actionable steps to address the issue

OUTPUT FORMAT:
Provide each risk in the following format:
- [Risk Description]: [Severity] - [Impact Description]. Recommendation: [Specific action to address]

Analyze the proposal text and provide a comprehensive list of risks:"""
    
    # Use AI Provider system if available
    if db and tenant_id:
        from app.integrations.ai_provider_client import call_ai_provider
        try:
            response = await call_ai_provider(db, tenant_id, prompt, model, max_tokens=1500)
            if response:
                risks = []
                for line in response.split("\n"):
                    line = line.strip()
                    if line.startswith("-") or line.startswith("*"):
                        # Parse structured format: "- [Risk]: [Severity] - [Impact]. Recommendation: [Action]"
                        risk_text = line.lstrip("-* ").strip()
                        
                        # Try to extract severity from the line
                        severity = "medium"  # default
                        if "high" in risk_text.lower() or "critical" in risk_text.lower():
                            severity = "high"
                        elif "low" in risk_text.lower() or "minor" in risk_text.lower():
                            severity = "low"
                        
                        # Extract recommendation if present
                        recommendation = "Review and address this risk in the proposal."
                        if "recommendation:" in risk_text.lower() or "recommend:" in risk_text.lower():
                            parts = risk_text.split(":", 1)
                            if len(parts) > 1:
                                risk_text = parts[0].strip()
                                recommendation = parts[1].strip()
                        
                        # Clean up risk text (remove severity indicators)
                        risk_text = risk_text.split(" - ")[0].strip()
                        risk_text = risk_text.split(":")[0].strip() if ":" in risk_text and "recommendation" not in risk_text.lower() else risk_text
                        
                        if risk_text:
                            risks.append({
                                "risk": risk_text,
                                "severity": severity,
                                "impact": "See recommendation" if "recommendation" in line.lower() else "Review impact",
                                "recommendation": recommendation,
                            })
                return risks[:15]  # Increased limit for more comprehensive analysis
        except Exception as e:
            print(f"AI Provider call failed, falling back to OpenAI: {e}")
    
    # Fallback to original implementation
    return await identify_risks(proposal_text, model)


async def generate_company_profile_field(
    website_url: str,
    field_name: str,
    model: Optional[str] = None,
    db: Optional[AsyncSession] = None,
    tenant_id: Optional[str] = None,
) -> str:
    """Generate company profile field content from website URL"""
    try:
        # Fetch website content
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = await client.get(website_url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            html_content = response.text
        
        # Parse HTML and extract text
        soup = BeautifulSoup(html_content, 'html.parser')
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Get text content (limit to first 10000 chars for efficiency)
        text_content = soup.get_text(separator=' ', strip=True)[:10000]
        
        # Create field-specific prompts
        field_prompts = {
            "company_overview": f"""Based on the website content below, write a comprehensive company overview (2-3 paragraphs) that describes what the company does, its mission, and key services or products.

Website content:
{text_content}

Provide only the company overview text, no additional commentary.""",
            
            "mission_statement": f"""Based on the website content below, extract or generate a mission statement for this company. If a mission statement is found, use it. If not, create one based on the company's purpose and values.

Website content:
{text_content}

Provide only the mission statement, no additional commentary.""",
            
            "vision_statement": f"""Based on the website content below, extract or generate a vision statement for this company. If a vision statement is found, use it. If not, create one based on the company's goals and aspirations.

Website content:
{text_content}

Provide only the vision statement, no additional commentary.""",
            
            "core_values": f"""Based on the website content below, extract or identify the company's core values. Return them as a comma-separated list. If no explicit values are mentioned, infer them from the company's messaging and culture.

Website content:
{text_content}

Provide only the core values as a comma-separated list, no additional commentary.""",
            
            "differentiators": f"""Based on the website content below, identify the company's key differentiators or unique selling points. Return them as a comma-separated list.

Website content:
{text_content}

Provide only the differentiators as a comma-separated list, no additional commentary.""",
            
            "core_capabilities": f"""Based on the website content below, identify the company's core capabilities or main service offerings. Return them as a comma-separated list.

Website content:
{text_content}

Provide only the capabilities as a comma-separated list, no additional commentary.""",
            
            "technical_expertise": f"""Based on the website content below, identify the company's technical expertise areas or technologies. Return them as a comma-separated list.

Website content:
{text_content}

Provide only the technical expertise areas as a comma-separated list, no additional commentary.""",
            
            "service_offerings": f"""Based on the website content below, identify the company's service offerings. Return them as a comma-separated list.

Website content:
{text_content}

Provide only the service offerings as a comma-separated list, no additional commentary.""",
        }
        
        prompt = field_prompts.get(field_name)
        if not prompt:
            return f"Field '{field_name}' is not supported for AI generation."
        
        # Use AI Provider system if available
        if db and tenant_id:
            from app.integrations.ai_provider_client import call_ai_provider
            try:
                result = await call_ai_provider(db, tenant_id, prompt, model, max_tokens=1000, temperature=0.7)
                if result and not result.startswith("[Error"):
                    return result.strip()
            except Exception as e:
                print(f"AI Provider call failed, falling back to OpenAI: {e}")
        
        # Fallback to OpenAI
        result = await call_openai(prompt, max_tokens=1000, model=model, temperature=0.7)
        return result.strip() if result else ""
        
    except httpx.HTTPError as e:
        return f"[Error: Failed to fetch website: {str(e)}]"
    except Exception as e:
        return f"[Error: {str(e)}]"

