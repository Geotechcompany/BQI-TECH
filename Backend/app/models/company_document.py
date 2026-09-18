from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


DocumentCategory = Literal["policies", "handbooks", "templates", "forms"]
DocumentFormat = Literal["PDF", "DOC", "XLS"]


class CompanyDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category: DocumentCategory
    format: DocumentFormat
    fileUrl: str = Field(..., min_length=1, max_length=2000)
    fileName: str = Field(..., min_length=1, max_length=255)
    fileSize: int = Field(..., ge=0)


class CompanyDocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[DocumentCategory] = None
