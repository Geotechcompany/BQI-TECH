from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


TaskStatus = Literal["open", "completed"]


class AdminTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    assigneeId: Optional[str] = Field(None, max_length=64)
    assigneeName: Optional[str] = Field(None, max_length=200)
    dueDate: Optional[datetime] = None
    positionId: Optional[str] = Field(None, max_length=64)


class AdminTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    assigneeId: Optional[str] = Field(None, max_length=64)
    assigneeName: Optional[str] = Field(None, max_length=200)
    dueDate: Optional[datetime] = None
    status: Optional[TaskStatus] = None
    positionId: Optional[str] = Field(None, max_length=64)
