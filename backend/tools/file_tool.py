import io
from typing import Optional
from tools.pdf_tools import extract_pdf_text

def process_uploaded_document(filename: str, file_bytes: bytes, category: str) -> Optional[dict]:
    """
    Parses the uploaded document based on category and returns a dict with
    the extracted text context and metadata.
    """
    if not filename.lower().endswith(".pdf"):
        return None
        
    extracted_text = extract_pdf_text(file_bytes)
    if not extracted_text:
        return None
        
    return {
        "name": filename,
        "category": category, # "business_plan", "competitor_report", "prd"
        "content": extracted_text
    }
