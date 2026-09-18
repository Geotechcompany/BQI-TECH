from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ApplicationEmailCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=50000)
    to: Optional[str] = Field(default=None, max_length=320)


class ApplicationEmailResponse(BaseModel):
    id: str
    applicationId: str
    jobId: Optional[str] = None
    channel: str = "email"
    to: str
    subject: str
    body: str
    status: str
    error: Optional[str] = None
    sentById: str
    sentByName: str
    sentByEmail: str
    sentAt: str

    @classmethod
    def from_document(cls, doc: Dict[str, Any]) -> "ApplicationEmailResponse":
        sent_at = doc.get("sentAt")
        if isinstance(sent_at, datetime):
            sent_at = sent_at.isoformat()

        return cls(
            id=str(doc.get("_id", doc.get("id", ""))),
            applicationId=str(doc.get("applicationId", "")),
            jobId=str(doc["jobId"]) if doc.get("jobId") else None,
            channel=str(doc.get("channel") or "email"),
            to=str(doc.get("to") or ""),
            subject=str(doc.get("subject") or ""),
            body=str(doc.get("body") or ""),
            status=str(doc.get("status") or "sent"),
            error=str(doc["error"]) if doc.get("error") else None,
            sentById=str(doc.get("sentById") or ""),
            sentByName=str(doc.get("sentByName") or ""),
            sentByEmail=str(doc.get("sentByEmail") or ""),
            sentAt=str(sent_at or ""),
        )
