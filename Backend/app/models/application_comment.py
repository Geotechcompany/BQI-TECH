from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CommentMention(BaseModel):
    userId: str
    email: str
    name: str


class ApplicationCommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)
    parentId: Optional[str] = None
    mentions: List[CommentMention] = Field(default_factory=list)


class ApplicationCommentUpdate(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)
    mentions: List[CommentMention] = Field(default_factory=list)


class ApplicationCommentResponse(BaseModel):
    id: str
    applicationId: str
    jobId: Optional[str] = None
    body: str
    parentId: Optional[str] = None
    authorId: str
    authorName: str
    authorEmail: str
    mentions: List[CommentMention] = Field(default_factory=list)
    createdAt: str
    updatedAt: str

    @classmethod
    def from_document(cls, doc: Dict[str, Any]) -> "ApplicationCommentResponse":
        created = doc.get("createdAt")
        updated = doc.get("updatedAt")
        if isinstance(created, datetime):
            created = created.isoformat()
        if isinstance(updated, datetime):
            updated = updated.isoformat()

        raw_mentions = doc.get("mentions") or []
        mentions = [
            CommentMention(
                userId=str(item.get("userId", "")),
                email=str(item.get("email", "")),
                name=str(item.get("name", "")),
            )
            for item in raw_mentions
            if isinstance(item, dict) and item.get("userId")
        ]

        return cls(
            id=str(doc.get("_id", doc.get("id", ""))),
            applicationId=str(doc.get("applicationId", "")),
            jobId=str(doc["jobId"]) if doc.get("jobId") else None,
            body=str(doc.get("body", "")),
            parentId=str(doc["parentId"]) if doc.get("parentId") else None,
            authorId=str(doc.get("authorId", "")),
            authorName=str(doc.get("authorName", "")),
            authorEmail=str(doc.get("authorEmail", "")),
            mentions=mentions,
            createdAt=str(created or ""),
            updatedAt=str(updated or ""),
        )
