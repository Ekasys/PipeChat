"""RFP parsing utilities"""
from typing import Dict, Any, List
import re


async def extract_rfp_sections(text: str) -> Dict[str, str]:
    """Extract RFP sections (L, M, C, etc.) from text"""
    sections = {}
    
    # Pattern to match section headers (e.g., "SECTION L", "Section M", "C. Statement of Work")
    section_pattern = r'(?:SECTION|Section)\s+([A-Z])\s*[:\-]?\s*(.+?)(?=(?:SECTION|Section)\s+[A-Z]|$)'
    
    matches = re.finditer(section_pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
    
    for match in matches:
        section_letter = match.group(1).upper()
        section_content = match.group(2).strip()
        sections[section_letter] = section_content
    
    # Also try alternative patterns
    alt_pattern = r'([A-Z])\.\s+([A-Z][^A-Z]+?)(?=[A-Z]\.\s+[A-Z]|$)'
    alt_matches = re.finditer(alt_pattern, text, re.MULTILINE | re.DOTALL)
    
    for match in alt_matches:
        section_letter = match.group(1).upper()
        if section_letter not in sections:
            section_content = match.group(2).strip()
            sections[section_letter] = section_content
    
    return sections


def parse_rfp_requirements(text: str) -> List[Dict[str, Any]]:
    """Parse requirements from RFP text"""
    requirements = []
    
    # Pattern for numbered requirements
    pattern = r'(\d+[\.\)])\s+(.+?)(?=\d+[\.\)]|$)'
    matches = re.finditer(pattern, text, re.MULTILINE | re.DOTALL)
    
    for match in matches:
        req_num = match.group(1).strip()
        req_text = match.group(2).strip()
        
        requirements.append({
            "number": req_num,
            "text": req_text,
            "compliance_status": "not_addressed",
        })
    
    return requirements


def generate_compliance_matrix(rfp_sections: Dict[str, str]) -> Dict[str, Any]:
    """Generate compliance matrix from RFP sections"""
    matrix = {
        "section_l": [],
        "section_m": [],
        "section_c": [],
    }
    
    # Parse Section L (Instructions)
    if rfp_sections.get("L"):
        matrix["section_l"] = parse_rfp_requirements(rfp_sections["L"])
    
    # Parse Section M (Evaluation Criteria)
    if rfp_sections.get("M"):
        matrix["section_m"] = parse_rfp_requirements(rfp_sections["M"])
    
    # Parse Section C (Statement of Work)
    if rfp_sections.get("C"):
        matrix["section_c"] = parse_rfp_requirements(rfp_sections["C"])
    
    return matrix

