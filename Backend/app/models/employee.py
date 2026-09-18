"""Pydantic models for HR employees and departments."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field

EmployeeStatus = Literal[
    "active",
    "on_leave",
    "probation",
    "onboarding",
    "offboarding",
    "terminated",
]
EmploymentType = Literal["full_time", "part_time", "contract", "intern"]
OnboardingStage = Literal[
    "paperwork", "it_setup", "orientation", "buddy_assigned", "complete"
]
OffboardingStage = Literal[
    "notice",
    "knowledge_transfer",
    "asset_return",
    "exit_interview",
    "complete",
]


class EmployeeAddress(BaseModel):
    line1: str = ""
    line2: Optional[str] = None
    city: str = ""
    state: Optional[str] = None
    postalCode: Optional[str] = None
    country: str = ""


class EmployeeSkill(BaseModel):
    name: str
    level: Optional[Literal["beginner", "intermediate", "advanced", "expert"]] = None


class EmployeeCreate(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = ""
    jobTitle: str = Field(..., min_length=1, max_length=200)
    departmentId: Optional[str] = None
    managerId: Optional[str] = None
    location: str = "Nairobi"
    status: EmployeeStatus = "onboarding"
    employmentType: EmploymentType = "full_time"
    startDate: str = Field(..., min_length=8, max_length=32)
    endDate: Optional[str] = None
    workEmail: Optional[EmailStr] = None
    personalEmail: Optional[str] = None
    dateOfBirth: Optional[str] = None
    nationality: Optional[str] = None
    displayName: Optional[str] = None
    pronouns: Optional[str] = None
    gender: Optional[str] = None
    maritalStatus: Optional[str] = None
    jobGrade: Optional[str] = None
    probationMonths: Optional[int] = None
    workArrangement: Optional[str] = None
    weeklyHours: Optional[float] = None
    address: Optional[EmployeeAddress] = None
    emergencyContact: Optional[Dict[str, Any]] = None
    skills: List[EmployeeSkill] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    leaveBalanceDays: float = 0
    performanceRating: float = 0
    baseSalary: float = 0
    currency: str = "USD"
    totalCompensation: Optional[float] = None
    equityValue: float = 0
    bonusTarget: Optional[float] = None
    signOnBonus: Optional[float] = None
    bankDetails: Optional[Dict[str, Any]] = None
    onboardingChecklist: Optional[Dict[str, Any]] = None
    invitePreferences: Optional[Dict[str, Any]] = None
    onboardingStage: Optional[OnboardingStage] = None
    offboardingStage: Optional[OffboardingStage] = None
    avatarUrl: Optional[str] = None


class EmployeeUpdate(BaseModel):
    firstName: Optional[str] = Field(None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    jobTitle: Optional[str] = Field(None, min_length=1, max_length=200)
    departmentId: Optional[str] = None
    managerId: Optional[str] = None
    location: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    employmentType: Optional[EmploymentType] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    workEmail: Optional[EmailStr] = None
    personalEmail: Optional[str] = None
    dateOfBirth: Optional[str] = None
    nationality: Optional[str] = None
    displayName: Optional[str] = None
    pronouns: Optional[str] = None
    gender: Optional[str] = None
    maritalStatus: Optional[str] = None
    jobGrade: Optional[str] = None
    probationMonths: Optional[int] = None
    workArrangement: Optional[str] = None
    weeklyHours: Optional[float] = None
    address: Optional[EmployeeAddress] = None
    emergencyContact: Optional[Dict[str, Any]] = None
    skills: Optional[List[EmployeeSkill]] = None
    tags: Optional[List[str]] = None
    leaveBalanceDays: Optional[float] = None
    performanceRating: Optional[float] = None
    baseSalary: Optional[float] = None
    currency: Optional[str] = None
    totalCompensation: Optional[float] = None
    equityValue: Optional[float] = None
    bonusTarget: Optional[float] = None
    signOnBonus: Optional[float] = None
    bankDetails: Optional[Dict[str, Any]] = None
    onboardingChecklist: Optional[Dict[str, Any]] = None
    invitePreferences: Optional[Dict[str, Any]] = None
    compensationBreakdown: Optional[List[Dict[str, Any]]] = None
    compensationHistory: Optional[List[Dict[str, Any]]] = None
    equityGrants: Optional[List[Dict[str, Any]]] = None
    attendanceSummary: Optional[Dict[str, Any]] = None
    attendanceTrend: Optional[Dict[str, Any]] = None
    timesheet: Optional[List[Dict[str, Any]]] = None
    leaveHistory: Optional[List[Dict[str, Any]]] = None
    goals: Optional[List[Dict[str, Any]]] = None
    peerFeedback: Optional[List[Dict[str, Any]]] = None
    ratingHistory: Optional[Dict[str, Any]] = None
    documents: Optional[List[Dict[str, Any]]] = None
    activity: Optional[List[Dict[str, Any]]] = None
    onboardingStage: Optional[OnboardingStage] = None
    offboardingStage: Optional[OffboardingStage] = None
    avatarUrl: Optional[str] = None
    tenureYears: Optional[float] = None


EmployeeDocumentCategory = Literal[
    "national_id",
    "good_conduct",
    "cv",
    "tax_id",
    "contract",
    "certificate",
    "other",
]


class EmployeeDocumentCreate(BaseModel):
    """Metadata for a file already uploaded via /api/upload."""

    name: str = Field(..., min_length=1, max_length=200)
    category: EmployeeDocumentCategory = "other"
    fileUrl: str = Field(..., min_length=1, max_length=2000)
    fileName: str = Field(..., min_length=1, max_length=500)
    fileSize: int = Field(0, ge=0)


class EmployeeSelfServiceUpdate(BaseModel):
    """Fields an employee may update on their own roster profile."""

    firstName: Optional[str] = Field(None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(None, min_length=1, max_length=100)
    displayName: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=40)
    personalEmail: Optional[str] = Field(None, max_length=254)
    location: Optional[str] = Field(None, max_length=200)
    dateOfBirth: Optional[str] = Field(None, max_length=32)
    nationality: Optional[str] = Field(None, max_length=100)
    pronouns: Optional[str] = Field(None, max_length=40)
    gender: Optional[str] = Field(None, max_length=40)
    maritalStatus: Optional[str] = Field(None, max_length=40)
    address: Optional[EmployeeAddress] = None
    emergencyContact: Optional[Dict[str, Any]] = None
    avatarUrl: Optional[str] = Field(None, max_length=2000)


class EmployeeLeaveRequestCreate(BaseModel):
    """Employee self-service leave request payload."""

    leaveTypeId: str = Field(..., min_length=1, max_length=64)
    startDate: str = Field(..., min_length=10, max_length=32)
    endDate: str = Field(..., min_length=10, max_length=32)
    startPeriod: Optional[str] = Field("morning", max_length=32)
    endPeriod: Optional[str] = Field("end_of_day", max_length=32)
    reason: Optional[str] = Field(None, max_length=1000)
    substituteEmployeeId: Optional[str] = Field(None, max_length=64)


class EmployeeLeaveCommentCreate(BaseModel):
    """Comment on the employee's own leave request."""

    body: str = Field(..., min_length=1, max_length=2000)


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: str = Field(..., min_length=1, max_length=32)
    headEmployeeId: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    parentId: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    headEmployeeId: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    parentId: Optional[str] = None


class EmployeeImportRow(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    jobTitle: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = None
    location: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    employmentType: Optional[EmploymentType] = None
    startDate: Optional[str] = None
    workEmail: Optional[EmailStr] = None
    departmentCode: Optional[str] = None
    departmentName: Optional[str] = None


class EmployeeImportRequest(BaseModel):
    # Pydantic v1 enforces list size via min_items/max_items (not min_length/max_length).
    rows: List[EmployeeImportRow] = Field(..., min_items=1, max_items=500)
