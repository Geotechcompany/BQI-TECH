from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema: Any, handler: Any) -> dict[str, Any]:
        json_schema = handler(core_schema)
        json_schema.update(type="string")
        return json_schema

class Answer(BaseModel):
    value: Any

    model_config = {
        "json_schema_extra": {
            "example": {
                "value": "answer1"
            }
        }
    }

class StatusHistoryEntry(BaseModel):
    """Individual status change entry in the status history"""
    status: str
    date: datetime
    changedBy: Optional[str] = None  # User ID who made the change
    reason: Optional[str] = None     # Reason for the status change
    metadata: Optional[Dict[str, Any]] = None  # Additional context (scores, notes, etc.)

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "Shortlisted",
                "date": "2025-05-27T06:16:17.269Z",
                "changedBy": "admin_user_id",
                "reason": "Strong technical background",
                "metadata": {
                    "previousStatus": "New",
                    "automatedChange": False,
                    "reviewerNotes": "Excellent experience with required technologies"
                }
            }
        }
    }

class Application(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    jobId: PyObjectId
    cvUrl: str
    answers: List[Answer]
    appliedDate: datetime
    status: str = "New"
    position: str
    userId: Optional[PyObjectId] = None
    
    # Legacy date fields - kept for backward compatibility
    shortlistedDate: Optional[datetime] = None
    assessmentDate: Optional[datetime] = None
    interviewDate: Optional[datetime] = None
    hireDate: Optional[datetime] = None
    disqualifiedDate: Optional[datetime] = None
    
    # New status history tracking
    statusHistory: Optional[List[StatusHistoryEntry]] = []
    
    # Archive tracking
    isArchived: Optional[bool] = False
    archivedAt: Optional[datetime] = None
    archivedBy: Optional[str] = None
    
    # Additional fields for enhanced tracking
    name: Optional[str] = None
    email: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    model_config = {
        "arbitrary_types_allowed": True,
        "json_encoders": {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        },
        "json_schema_extra": {
            "example": {
                "_id": "683558b1dd79cc67e0a4926a",
                "jobId": "682b293a27eefc80eae4f51a",
                "cvUrl": "https://dl.dropboxusercontent.com/scl/fi/f17p451wySnmgcdm4cGbc/Aggrey-_",
                "answers": [{"value": "answer1"}, {"value": "answer2"}],
                "appliedDate": "2025-05-27T06:16:17.269Z",
                "status": "Shortlisted",
                "position": "Junior Salesforce Developer",
                "userId": "6833934f545a3e59dbff6c2c",
                "statusHistory": [
                    {
                        "status": "New",
                        "date": "2025-05-27T06:16:17.269Z",
                        "changedBy": None,
                        "reason": "Application submitted"
                    },
                    {
                        "status": "Shortlisted",
                        "date": "2025-05-28T10:30:00.000Z",
                        "changedBy": "admin_user_id",
                        "reason": "Strong technical background",
                        "metadata": {
                            "reviewerNotes": "Excellent experience"
                        }
                    }
                ]
            }
        }
    }

class ApplicationCreate(BaseModel):
    """Model for creating new applications"""
    jobId: PyObjectId
    cvUrl: str
    answers: List[Answer]
    position: str
    userId: Optional[PyObjectId] = None

class ApplicationUpdate(BaseModel):
    """Model for updating applications with status tracking"""
    status: Optional[str] = None
    changedBy: Optional[str] = None  # User making the change
    reason: Optional[str] = None     # Reason for the change
    metadata: Optional[Dict[str, Any]] = None  # Additional context
    
    # Allow updating other fields
    cvUrl: Optional[str] = None
    position: Optional[str] = None
    answers: Optional[List[Answer]] = None

class ApplicationStatusChange(BaseModel):
    """Model specifically for status changes with proper tracking"""
    newStatus: str
    changedBy: str  # Required for status changes
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "newStatus": "Shortlisted",
                "changedBy": "admin_user_id",
                "reason": "Candidate meets all requirements",
                "metadata": {
                    "reviewScore": 8.5,
                    "reviewerNotes": "Strong background in required technologies"
                }
            }
        }
    } 