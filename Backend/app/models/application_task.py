from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ApplicationTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    dueAt: Optional[datetime] = None


class ApplicationTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    dueAt: Optional[datetime] = None
    completed: Optional[bool] = None


class ApplicationReminderCreate(BaseModel):
    dueAt: datetime
    note: Optional[str] = Field(None, max_length=1000)


class ApplicationPrivacyUpdate(BaseModel):
    isPrivate: bool


class ApplicationFollowUpdate(BaseModel):
    followed: bool


class ApplicationAssignee(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = ""
    email: str = ""
    role: str = "Reviewer"


class ApplicationAssigneesUpdate(BaseModel):
    assignees: list[ApplicationAssignee] = Field(default_factory=list)


class ApplicationBulkTagsUpdate(BaseModel):
    ids: list[str] = Field(..., min_length=1)
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class ApplicationMergeRequest(BaseModel):
    primaryId: str = Field(..., min_length=1)
    sourceIds: list[str] = Field(..., min_length=1)


class ApplicationSendQuestionnaireRequest(BaseModel):
    ids: list[str] = Field(..., min_length=1)
    jobId: str = Field(..., min_length=1)
    questionnaireId: str = Field(..., min_length=1)
