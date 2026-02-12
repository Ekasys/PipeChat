"""OpenAI API client"""
from typing import Optional, Dict, Any, List
from app.config import settings
import openai
import asyncio
from functools import partial
import httpx


async def call_openai(
    prompt: str,
    model: Optional[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.3,  # Lower temperature for more formal, deterministic output
) -> Optional[str]:
    """Call OpenAI API with fallback to stub"""
    if not settings.OPENAI_API_KEY:
        # Return informative message instead of stub
        print("WARNING: OPENAI_API_KEY not set. Cannot make API calls.")
        return f"[Error: OpenAI API key not configured. Please set OPENAI_API_KEY environment variable to use AI features.]"
    
    try:
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        model_name = model or settings.OPENAI_MODEL
        
        # Check if this is a GPT-5 model (requires different API)
        is_gpt5 = model_name and model_name.startswith('gpt-5')
        
        loop = asyncio.get_event_loop()
        
        if is_gpt5:
            # GPT-5 models require the Responses API. The official python SDK may not support
            # this yet depending on the installed version, so we call the REST endpoint directly.
            print(f"Using GPT-5 model: {model_name} with Responses API via HTTPX")
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            }
            payload: Dict[str, Any] = {
                "model": model_name,
                # Use the Responses API "input" with message list format (supported)
                "input": [
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "input_text",
                                "text": "You are an expert proposal writer specializing in government contracting proposals. You write formal, direct proposal sections for federal government submissions. You NEVER use conditional language, conversational tone, or meta-statements. You write as if the proposal is a completed, formal document describing what the company WILL deliver, not a conversation or offer.",
                            }
                        ],
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": prompt,
                            }
                        ],
                    },
                ],
                "max_output_tokens": max_tokens,
                "reasoning": {"effort": "medium"},
                "text": {"verbosity": "high"},  # Higher verbosity for more formal, complete writing
            }
            async with httpx.AsyncClient(timeout=120.0) as http_client:
                resp = await http_client.post(
                    "https://api.openai.com/v1/responses", json=payload, headers=headers
                )
                if resp.status_code >= 400:
                    print(f"Responses API error: {resp.status_code} {resp.text}")
                    return f"[Error: Responses API call failed ({resp.status_code}): {resp.text}]"
                data = resp.json()
                try:
                    import json

                    print(
                        "Responses API raw data:",
                        json.dumps(data, ensure_ascii=True)[:2000],
                    )
                except Exception:
                    # Fallback to basic repr if json dumps fails
                    print("Responses API raw data (repr):", repr(data)[:2000])

                def normalize_text_value(value: Any) -> List[str]:
                    texts: List[str] = []
                    if isinstance(value, str):
                        texts.append(value)
                    elif isinstance(value, dict):
                        # Common shapes: {"text": "..."}, {"value": "..."}, {"data": "..."}
                        for key in ("text", "value", "data", "string"):
                            if key in value:
                                texts.extend(normalize_text_value(value[key]))
                        # Sometimes there's {"type": "text", "text": {...}}
                        if not texts and "message" in value:
                            texts.extend(normalize_text_value(value["message"]))
                    elif isinstance(value, list):
                        for item in value:
                            texts.extend(normalize_text_value(item))
                    return texts

                def extract_text_from_content(content_value: Any) -> List[str]:
                    texts: List[str] = []
                    if isinstance(content_value, list):
                        for part in content_value:
                            texts.extend(normalize_text_value(part))
                    else:
                        texts.extend(normalize_text_value(content_value))
                    return texts

                def recursive_string_search(value: Any) -> List[str]:
                    """Fallback to grab any string fields from nested structures."""
                    results: List[str] = []
                    if isinstance(value, str):
                        results.append(value)
                    elif isinstance(value, list):
                        for item in value:
                            results.extend(recursive_string_search(item))
                    elif isinstance(value, dict):
                        for v in value.values():
                            results.extend(recursive_string_search(v))
                    return results

                output_texts: List[str] = []

                # First try the documented output structure
                for item in data.get("output", []) or []:
                    if isinstance(item, dict):
                        if "content" in item:
                            output_texts.extend(extract_text_from_content(item["content"]))
                        elif "text" in item and isinstance(item["text"], str):
                            output_texts.append(item["text"])
                        elif item.get("type") in {"text", "output_text"} and item.get("text"):
                            output_texts.append(item["text"])

                # Fallback to choices/message structure if present
                if not output_texts and isinstance(data.get("choices"), list):
                    for choice in data["choices"]:
                        message = choice.get("message")
                        if isinstance(message, dict):
                            output_texts.extend(extract_text_from_content(message.get("content")))
                            if "text" in message and isinstance(message["text"], str):
                                output_texts.append(message["text"])

                # Fallback to top-level fields
                if not output_texts:
                    if isinstance(data.get("output_text"), str):
                        output_texts.append(data["output_text"])
                    if isinstance(data.get("text"), str):
                        output_texts.append(data["text"])

                if not output_texts:
                    # final fallback: any string content in the response
                    fallback_strings = recursive_string_search(data)
                    output_texts.extend(
                        s
                        for s in fallback_strings
                        if isinstance(s, str) and len(s.strip()) > 0
                    )

                if not output_texts:
                    return "[Error: Responses API did not return any text output.]"
                return "\n".join(output_texts).strip()
        else:
            # Older models use standard Chat Completions
            create_completion = partial(
                client.chat.completions.create,
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are an expert proposal writer specializing in government contracting proposals. You write formal, direct proposal sections for federal government submissions. You NEVER use conditional language, conversational tone, or meta-statements. You write as if the proposal is a completed, formal document describing what the company WILL deliver, not a conversation or offer."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            # Run with timeout
            response = await asyncio.wait_for(
                loop.run_in_executor(None, create_completion),
                timeout=60.0,
            )
            return response.choices[0].message.content
    except asyncio.TimeoutError:
        # Timeout fallback
        return f"[AI Timeout] Request took too long. Please try again or use a smaller document."
    except Exception as e:
        # Log detailed error information
        import traceback
        error_details = traceback.format_exc()
        print(f"OpenAI API error: {e}")
        print(f"Error details: {error_details}")
        print(f"API Key present: {bool(settings.OPENAI_API_KEY)}")
        print(f"Model: {model or settings.OPENAI_MODEL}")
        print(f"Using Responses API: {is_gpt5 if 'is_gpt5' in locals() else 'N/A'}")
        
        # Return more informative error message
        if not settings.OPENAI_API_KEY:
            return f"[Error: OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.]"
        elif "Invalid" in str(e) or "401" in str(e) or "authentication" in str(e).lower():
            return f"[Error: Invalid OpenAI API key. Please check your API key configuration.]"
        elif "model" in str(e).lower() or "not found" in str(e).lower():
            return f"[Error: Model '{model or settings.OPENAI_MODEL}' not found or not available. Please check the model name.]"
        elif "responses" in str(e).lower() or "attribute" in str(e).lower():
            return f"[Error: Responses API not available. Please ensure you're using a compatible OpenAI SDK version. Error: {str(e)}]"
        else:
            return f"[Error: OpenAI API call failed: {str(e)}]"


async def draft_proposal_section(
    section_type: str,
    context: Dict[str, Any],
    model: Optional[str] = None,
    db: Optional[Any] = None,
    tenant_id: Optional[str] = None,
) -> str:
    """Draft a proposal section using AI, aligned with RFP requirements"""
    rfp_content = context.get('rfp_content', '')
    opportunity_name = context.get('opportunity_name', 'N/A')
    agency = context.get('agency', 'N/A')
    requirements = context.get('requirements', 'N/A')
    company_context = context.get('company_context', {})
    
    # Build company information section
    company_info = ""
    if company_context:
        company_info = f"""
    COMPANY INFORMATION:
    - Company Name: {company_context.get('company_name', 'N/A')}
    - Company Overview: {company_context.get('company_overview', 'N/A')[:500]}
    - Mission Statement: {company_context.get('mission_statement', 'N/A')[:300]}
    - Core Capabilities: {', '.join(company_context.get('core_capabilities', [])[:10])}
    - Technical Expertise: {', '.join(company_context.get('technical_expertise', [])[:10])}
    - Certifications: {', '.join(company_context.get('certifications', [])[:10])}
    - Contract Vehicles: {', '.join(company_context.get('contract_vehicles', [])[:10])}
    - Key Differentiators: {', '.join(company_context.get('differentiators', [])[:5])}
    - Win Themes: {', '.join(company_context.get('win_themes', [])[:5])}
    """
    
    # Build section-specific guidance
    section_guidance = {
        'executive_summary': """
    EXECUTIVE SUMMARY GUIDANCE:
    - Write as a direct narrative summary, not an offer or proposal
    - Lead with the customer's problem, need, or mission challenge
    - Present your differentiated solution clearly and concisely using declarative statements
    - Quantify benefits and outcomes with specific metrics (e.g., "reduces processing time by 40%", "achieves 99.9% uptime")
    - Incorporate win themes naturally throughout the narrative
    - Keep concise (typically 2-3 paragraphs, 300-500 words)
    - End with a compelling value proposition stated directly
    - Avoid generic language; be specific about what makes your solution unique
    - Write as if describing a committed solution, not a conditional offer
    """,
        'technical_approach': """
    TECHNICAL APPROACH GUIDANCE:
    - Write as a narrative describing your technical solution, not an offer to provide one
    - Provide detailed methodology aligned with the Statement of Work (SOW)
    - Specify exact technologies, tools, and platforms you will use (write "We use X technology" not "We can provide X technology")
    - Describe processes with clear, actionable steps in narrative form
    - Explain how each requirement is met or exceeded using direct statements
    - Highlight technical differentiators and innovative approaches through descriptive narrative
    - Include process descriptions in narrative format (avoid saying "we will provide a diagram" - describe the architecture/flow directly)
    - Demonstrate deep understanding of the technical challenges through detailed explanation
    - Show how your approach reduces risk and ensures success using declarative statements
    - Reference specific RFP technical requirements by section number when available
    - Write as if describing an implemented solution, not a future promise
    """,
        'management_approach': """
    MANAGEMENT APPROACH GUIDANCE:
    - Write as a narrative describing your management structure and processes
    - Describe organizational structure and reporting relationships using direct statements
    - Identify key personnel roles and responsibilities in narrative form
    - Outline quality assurance processes and controls as implemented procedures
    - Detail communication and reporting cadence (meetings, reports, updates) as established practices
    - Explain risk management approach and mitigation strategies through descriptive narrative
    - Show how you ensure continuity and knowledge transfer using declarative statements
    - Demonstrate understanding of agency priorities and mission through detailed explanation
    - Include specific metrics for performance measurement as part of the narrative
    - Highlight management tools and methodologies you will use (write "We employ X methodology" not "We can offer X")
    """,
        'past_performance': """
    PAST PERFORMANCE GUIDANCE:
    - Write as a narrative describing completed work and achievements
    - Lead with the most relevant contracts first, described in narrative form
    - Include quantifiable results and metrics (e.g., "delivered 15% under budget", "achieved 98% customer satisfaction")
    - Provide customer testimonials or references when available as part of the narrative
    - Demonstrate direct relevance to the current opportunity through descriptive examples
    - Show proof of ability to deliver similar scope and complexity using declarative statements
    - Highlight awards, recognition, or positive past performance ratings in narrative format
    - Connect past successes to current opportunity requirements through detailed explanation
    - Use specific examples rather than generic statements, written as completed achievements
    """
    }
    
    section_specific = section_guidance.get(section_type, "")
    
    # Build prompt with RFP alignment and company context
    prompt = f"""You are writing a {section_type.replace('_', ' ')} section for a FEDERAL GOVERNMENT CONTRACT PROPOSAL. This is a formal, binding document that will be evaluated by government contracting officers.

CRITICAL WRITING RULES - VIOLATE THESE AT YOUR PERIL:
1. NEVER use conditional language: NO "If you would like", "We can provide", "We will offer", "Should you need", "I will", "Which would you like"
2. NEVER use conversational tone: NO questions, NO offers, NO meta-statements about what you'll do later
3. NEVER write as an assistant: NO "I will populate", "I will prepare", "Which would you like next"
4. NEVER offer recommendations or suggestions: NO "If you would like, I will", NO "Which would you like", NO offering to do things
5. ALWAYS write in third person or first person plural: "We deliver", "Our approach includes", "The solution provides"
6. ALWAYS write as a completed formal document: Describe what WILL happen, not what COULD happen
7. ALWAYS use declarative statements: State facts about your solution, approach, and capabilities

EXAMPLES OF WHAT NOT TO WRITE:
❌ "If you would like, I will populate the Appendix diagrams"
❌ "Which would you like next?"
❌ "We can provide a mapping matrix"
❌ "Should you need additional information, we will prepare..."

EXAMPLES OF CORRECT WRITING:
✅ "The proposal includes a comprehensive mapping matrix that ties each SOW requirement to specific solution components and control references."
✅ "Our architecture diagram illustrates data flows and security zones across the solution."
✅ "The implementation timeline and cost estimate for Box for Gov, Azure Gov, and AWS GovCloud hosting options are detailed in Section X."

OPPORTUNITY INFORMATION:
- Opportunity Name: {opportunity_name}
- Agency: {agency}
- Opportunity Requirements: {requirements[:500]}
{company_info}

RFP DOCUMENT CONTENT:
{rfp_content[:150000] if rfp_content else "No RFP documents available."}
{section_specific}

CRITICAL REQUIREMENTS:

1. EVALUATION CRITERIA ALIGNMENT:
   - Identify all evaluation factors mentioned in the RFP (technical approach, past performance, price, etc.)
   - Explicitly address each evaluation criterion in your section
   - Map company capabilities directly to specific evaluation factors
   - Reference RFP section numbers when available (e.g., "As specified in Section L.3.2...")
   - Demonstrate how you exceed minimum requirements where possible

2. PROPOSAL BEST PRACTICES (FEDERAL GOVERNMENT STANDARDS):
   - This is a FORMAL FEDERAL GOVERNMENT PROPOSAL - write accordingly
   - Use quantifiable metrics and specific examples throughout (avoid vague statements like "excellent service")
   - Avoid generic language, buzzwords, and marketing fluff
   - Include win themes naturally and strategically throughout the section
   - Demonstrate understanding of the agency's mission, priorities, and pain points
   - Show compliance with all submission requirements and format specifications
   - Use active voice and clear, professional language suitable for government contracting
   - Write in direct, narrative style - describe what you WILL do, not what you COULD do
   - Write in third person or first person plural ("We", "Our company", "The solution") - NEVER use "I"
   - NEVER use conditional language: "If you would like", "We can provide", "We will offer", "Should you need", "I will", "Which would you like"
   - NEVER make meta-statements about what will be provided later - write the actual content now
   - NEVER write as a chatbot or assistant - this is a formal proposal document
   - Write as a completed proposal section, not an offer, conversation, or promise of future content
   - Use declarative statements: "We provide...", "Our approach includes...", "The solution delivers...", "The proposal contains..."
   - Write as if you are describing an already-completed proposal that is being submitted

3. STRUCTURE AND FORMATTING:
   - Use clear headings and subheadings for easy navigation
   - Follow logical flow: problem/need → solution → benefits/outcomes
   - Ensure appropriate length for section type (executive summary: concise; technical approach: detailed)
   - Format professionally with proper paragraph breaks and structure
   - Use bullet points or numbered lists where they improve clarity

4. DIFFERENTIATION:
   - Highlight what makes your company unique and better than competitors
   - Connect company strengths, certifications, and past performance to RFP requirements
   - Show innovation and value-add beyond basic requirements
   - Demonstrate understanding of the customer's specific needs and challenges

5. COMPLIANCE:
   - Address all mandatory requirements from the RFP
   - Follow any specified format or structure requirements
   - Ensure all claims are supportable and verifiable
   - Reference company certifications, clearances, and qualifications where relevant

OUTPUT REQUIREMENTS:
Write a formal federal government proposal section that:
- Directly addresses all relevant RFP requirements and evaluation criteria
- Incorporates company strengths, capabilities, and differentiators naturally
- Uses specific examples and quantifiable benefits
- Demonstrates clear understanding of the opportunity and agency needs
- Is compliant, professional, and compelling
- Avoids generic language and focuses on concrete value propositions
- Is written as a complete narrative describing your committed solution
- Uses direct, declarative language throughout (e.g., "We deliver...", "Our solution provides...", "The approach ensures...", "The proposal includes...")
- Is written in third person or first person plural - NEVER use "I" or conversational "you"
- Describes what IS in the proposal, what WILL be delivered, what the solution DOES
- Reads like a formal government document, not a conversation or offer

ABSOLUTELY FORBIDDEN LANGUAGE (DO NOT USE):
- "If you would like"
- "We can provide"
- "We will offer"
- "Should you need"
- "I will"
- "Which would you like"
- "We would be happy to"
- "Let me"
- "I can"
- Any question directed at the reader
- Any conditional or conversational phrasing
- Any recommendations or suggestions
- Any offers to do things
- Any meta-statements about what will be provided

REQUIRED WRITING STYLE:
- Write as if this is a completed, submitted federal proposal
- Write as if describing what IS in the document and what WILL be delivered
- Use formal, declarative statements about your solution
- Write in narrative form describing your approach, capabilities, and deliverables
- Write as a professional proposal writer, not as a helpful assistant
- DO NOT offer recommendations, suggestions, or options
- DO NOT ask questions or make offers
- Simply describe your solution, approach, and capabilities in narrative form

Write the complete {section_type.replace('_', ' ')} section now as a formal federal proposal narrative. Do not offer recommendations or suggestions. Just write the section content:"""
    
    # Set section-specific token limits (GPT-5 models support up to 128k output tokens)
    section_token_limits = {
        'executive_summary': 4000,  # Concise but comprehensive
        'technical_approach': 100000,  # Maximum detail for comprehensive technical sections
        'management_approach': 50000,  # Comprehensive management details
        'past_performance': 30000,  # Comprehensive past performance with examples
    }
    max_tokens = section_token_limits.get(section_type, 50000)  # Default to 50k for unknown sections
    
    # Use AI Provider system if available, otherwise fallback to OpenAI
    # Use lower temperature (0.3) for formal, deterministic proposal writing
    if db and tenant_id:
        from app.integrations.ai_provider_client import call_ai_provider
        try:
            return await call_ai_provider(db, tenant_id, prompt, model, max_tokens=max_tokens, temperature=0.3)
        except Exception as e:
            print(f"AI Provider call failed, falling back to OpenAI: {e}")
    
    # Fallback to original OpenAI implementation with low temperature for formal writing
    return await call_openai(prompt, max_tokens=max_tokens, model=model, temperature=0.3)


async def suggest_win_themes(opportunity_data: Dict[str, Any], model: Optional[str] = None) -> List[str]:
    """Suggest win themes using AI"""
    prompt = f"""
    Based on this opportunity, suggest 3-5 win themes:
    
    Opportunity: {opportunity_data.get('name', 'N/A')}
    Agency: {opportunity_data.get('agency', 'N/A')}
    Description: {opportunity_data.get('description', 'N/A')[:500]}
    
    Provide win themes as a bulleted list.
    """
    
    response = await call_openai(prompt, max_tokens=500, model=model)
    if response:
        # Parse bullet points
        themes = [line.strip("- ").strip() for line in response.split("\n") if line.strip().startswith("-")]
        return themes[:5]
    return []


async def identify_risks(proposal_text: str, model: Optional[str] = None) -> List[Dict[str, Any]]:
    """Identify risks in proposal text"""
    prompt = f"""
    Analyze this proposal text and identify potential risks or compliance gaps:
    
    {proposal_text[:2000]}
    
    Provide risks as a bulleted list with brief descriptions.
    """
    
    response = await call_openai(prompt, max_tokens=800, model=model)
    if response:
        risks = []
        for line in response.split("\n"):
            if line.strip().startswith("-"):
                risks.append({
                    "description": line.strip("- ").strip(),
                    "severity": "medium",  # Could be enhanced with AI classification
                })
        return risks[:10]
    return []

