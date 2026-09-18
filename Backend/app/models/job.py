from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Job(BaseModel):
    id: str
    title: str
    description: str
    requirements: List[str]
    responsibilities: List[str]
    location: str
    type: str  # full-time, part-time, contract
    status: str = "active"  # active, closed, draft
    department: Optional[str] = None
    salary_range: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    expires_at: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    questions: Optional[List[str]] = None  # List of question IDs
    auto_open_enabled: Optional[bool] = False
    auto_open_at: Optional[datetime] = None
    auto_open_cron: Optional[str] = None
    auto_close_enabled: Optional[bool] = False
    auto_close_at: Optional[datetime] = None
    auto_close_cron: Optional[str] = None
 