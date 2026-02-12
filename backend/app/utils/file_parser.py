"""File parsing utilities"""
from typing import Dict, Any, Optional
import PyPDF2
import pdfplumber


async def parse_pdf(file_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Parse PDF file and extract text"""
    text_content = ""
    
    try:
        # Try pdfplumber first (better for structured content)
        with pdfplumber.open(file_path) as pdf:
            pages_to_read = min(len(pdf.pages), max_pages) if max_pages else len(pdf.pages)
            text_content = "\n".join([page.extract_text() or "" for page in pdf.pages[:pages_to_read]])
    except Exception:
        # Fallback to PyPDF2
        try:
            with open(file_path, "rb") as file:
                pdf_reader = PyPDF2.PdfReader(file)
                pages_to_read = min(len(pdf_reader.pages), max_pages) if max_pages else len(pdf_reader.pages)
                text_content = "\n".join([page.extract_text() for page in pdf_reader.pages[:pages_to_read]])
        except Exception as e:
            return {"error": str(e), "text": ""}
    
    return {
        "text": text_content,
        "length": len(text_content),
    }


async def extract_rfp_sections(text: str) -> Dict[str, str]:
    """Extract RFP sections (L, M, C) from text"""
    sections = {
        "L": "",
        "M": "",
        "C": "",
    }
    
    # Simple pattern matching for section headers
    lines = text.split("\n")
    current_section = None
    
    for i, line in enumerate(lines):
        line_upper = line.upper().strip()
        
        # Look for section markers
        if "SECTION L" in line_upper or "L. " in line_upper:
            current_section = "L"
            sections["L"] = line + "\n"
        elif "SECTION M" in line_upper or "M. " in line_upper:
            current_section = "M"
            sections["M"] = line + "\n"
        elif "SECTION C" in line_upper or "C. " in line_upper:
            current_section = "C"
            sections["C"] = line + "\n"
        elif current_section and line.strip():
            sections[current_section] += line + "\n"
    
    return sections

