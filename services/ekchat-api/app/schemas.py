"""API schemas for Ekchat API."""
from pydantic import BaseModel, Field
from typing import List, Optional


class NewChat(BaseModel):
    model: str = Field(..., min_length=1, max_length=200)
    title: Optional[str] = Field(default=None, max_length=500)


class SendMessage(BaseModel):
    content: str = Field(..., min_length=1, max_length=20000)
    model: Optional[str] = Field(default=None, max_length=200)
    sources: Optional[List[str]] = Field(default=None, max_length=200)


class SetModel(BaseModel):
    model: str = Field(..., min_length=1, max_length=200)


class RenameChat(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)


class RfpCapabilityMatrixGenerateRequest(BaseModel):
    rfp_name: str
    model: Optional[str] = None
    prompt_version: Optional[str] = None
    stream: Optional[bool] = None


class RfpShredDocumentGenerateRequest(BaseModel):
    rfp_name: str
    model: Optional[str] = None
    prompt_version: Optional[str] = None


class RfpSectionGenerateRequest(BaseModel):
    session_id: str
    section_index: int
    model: Optional[str] = None
    stream: Optional[bool] = None
