"""HR employees / departments helpers (Mongo collections: employees, departments)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value
    return None


def parse_oid(value: str) -> ObjectId:
    return ObjectId(value)


def tenure_years_from_start(start_date: Optional[str]) -> float:
    if not start_date:
        return 0.0
    try:
        start = datetime.fromisoformat(start_date[:10])
        days = (datetime.utcnow() - start).days
        return round(max(days / 365.25, 0.0), 2)
    except Exception:
        return 0.0


def format_department(doc: dict[str, Any], employee_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id") or ""),
        "name": str(doc.get("name") or ""),
        "code": str(doc.get("code") or ""),
        "headEmployeeId": str(doc.get("headEmployeeId") or "") or None,
        "headName": str(doc.get("headName") or "") or None,
        "employeeCount": int(employee_count),
        "description": str(doc.get("description") or "") or None,
        "parentId": str(doc.get("parentId") or "") or None,
        "createdAt": _iso(doc.get("createdAt")),
        "updatedAt": _iso(doc.get("updatedAt")),
    }


_LEGACY_DOC_CATEGORIES = {
    "id": "national_id",
    "tax": "tax_id",
    "policy": "other",
    "certification": "certificate",
    "resume": "cv",
}


def _normalize_document(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {
            "id": "",
            "name": "Document",
            "category": "other",
            "uploadedAt": "",
            "sizeKb": 0,
            "status": "uploaded",
        }
    category = str(raw.get("category") or "other")
    category = _LEGACY_DOC_CATEGORIES.get(category, category)
    allowed = {
        "national_id",
        "good_conduct",
        "cv",
        "tax_id",
        "contract",
        "certificate",
        "other",
    }
    if category not in allowed:
        category = "other"
    size_kb = raw.get("sizeKb")
    if size_kb is None and raw.get("fileSize") is not None:
        try:
            size_kb = max(1, round(int(raw.get("fileSize") or 0) / 1024))
        except (TypeError, ValueError):
            size_kb = 0
    try:
        size_kb = int(size_kb or 0)
    except (TypeError, ValueError):
        size_kb = 0
    return {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or raw.get("fileName") or "Document"),
        "category": category,
        "uploadedAt": str(raw.get("uploadedAt") or ""),
        "sizeKb": size_kb,
        "url": raw.get("url") or raw.get("fileUrl") or None,
        "fileName": raw.get("fileName") or None,
        "status": str(raw.get("status") or "uploaded"),
    }


def format_employee(doc: dict[str, Any]) -> dict[str, Any]:
    start = doc.get("startDate")
    tenure = doc.get("tenureYears")
    if tenure is None:
        tenure = tenure_years_from_start(start if isinstance(start, str) else None)

    documents = [
        _normalize_document(item) for item in (doc.get("documents") or [])
    ]

    return {
        "id": str(doc.get("_id") or ""),
        "employeeNumber": str(doc.get("employeeNumber") or ""),
        "firstName": str(doc.get("firstName") or ""),
        "lastName": str(doc.get("lastName") or ""),
        "email": str(doc.get("email") or ""),
        "phone": str(doc.get("phone") or ""),
        "avatarUrl": doc.get("avatarUrl") or None,
        "jobTitle": str(doc.get("jobTitle") or ""),
        "departmentId": str(doc.get("departmentId") or "") or None,
        "departmentName": str(doc.get("departmentName") or ""),
        "managerId": str(doc.get("managerId") or "") or None,
        "managerName": str(doc.get("managerName") or "") or None,
        "location": str(doc.get("location") or ""),
        "status": str(doc.get("status") or "active"),
        "employmentType": str(doc.get("employmentType") or "full_time"),
        "startDate": str(doc.get("startDate") or ""),
        "endDate": doc.get("endDate") or None,
        "workEmail": str(doc.get("workEmail") or doc.get("email") or ""),
        "personalEmail": doc.get("personalEmail") or None,
        "dateOfBirth": doc.get("dateOfBirth") or None,
        "nationality": doc.get("nationality") or None,
        "displayName": doc.get("displayName") or None,
        "pronouns": doc.get("pronouns") or None,
        "gender": doc.get("gender") or None,
        "maritalStatus": doc.get("maritalStatus") or None,
        "jobGrade": doc.get("jobGrade") or None,
        "probationMonths": doc.get("probationMonths"),
        "workArrangement": doc.get("workArrangement") or None,
        "weeklyHours": doc.get("weeklyHours"),
        "address": doc.get("address") or None,
        "emergencyContact": doc.get("emergencyContact") or None,
        "skills": doc.get("skills") or [],
        "tags": doc.get("tags") or [],
        "tenureYears": float(tenure or 0),
        "leaveBalanceDays": float(doc.get("leaveBalanceDays") or 0),
        "performanceRating": float(doc.get("performanceRating") or 0),
        "baseSalary": float(doc.get("baseSalary") or 0),
        "currency": str(doc.get("currency") or "USD"),
        "totalCompensation": float(
            doc.get("totalCompensation")
            if doc.get("totalCompensation") is not None
            else (doc.get("baseSalary") or 0)
        ),
        "equityValue": float(doc.get("equityValue") or 0),
        "bonusTarget": float(doc.get("bonusTarget") or 0),
        "signOnBonus": float(doc.get("signOnBonus") or 0),
        "bankDetails": doc.get("bankDetails") or None,
        "onboardingChecklist": doc.get("onboardingChecklist") or None,
        "invitePreferences": doc.get("invitePreferences") or None,
        "compensationBreakdown": doc.get("compensationBreakdown") or [],
        "compensationHistory": doc.get("compensationHistory") or [],
        "equityGrants": doc.get("equityGrants") or [],
        "attendanceSummary": doc.get("attendanceSummary")
        or {"presentDays": 0, "leaveDays": 0, "lateDays": 0, "overtimeHours": 0},
        "attendanceTrend": doc.get("attendanceTrend") or {"labels": [], "values": []},
        "timesheet": doc.get("timesheet") or [],
        "leaveHistory": doc.get("leaveHistory") or [],
        "goals": doc.get("goals") or [],
        "peerFeedback": doc.get("peerFeedback") or [],
        "ratingHistory": doc.get("ratingHistory") or {"labels": [], "values": []},
        "documents": documents,
        "activity": doc.get("activity") or [],
        "onboardingStage": doc.get("onboardingStage") or None,
        "offboardingStage": doc.get("offboardingStage") or None,
        "createdAt": _iso(doc.get("createdAt")),
        "updatedAt": _iso(doc.get("updatedAt")),
    }


def build_employees_query(
    *,
    search: Optional[str] = None,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    employment_type: Optional[str] = None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if department_id and department_id not in ("all", ""):
        query["departmentId"] = department_id
    if status and status not in ("all", ""):
        query["status"] = status
    if employment_type and employment_type not in ("all", ""):
        query["employmentType"] = employment_type

    needle = (search or "").strip()
    if needle:
        query["$or"] = [
            {"firstName": {"$regex": needle, "$options": "i"}},
            {"lastName": {"$regex": needle, "$options": "i"}},
            {"email": {"$regex": needle, "$options": "i"}},
            {"workEmail": {"$regex": needle, "$options": "i"}},
            {"jobTitle": {"$regex": needle, "$options": "i"}},
            {"employeeNumber": {"$regex": needle, "$options": "i"}},
            {"departmentName": {"$regex": needle, "$options": "i"}},
        ]
    return query


def empty_profile_arrays() -> dict[str, Any]:
    return {
        "skills": [],
        "tags": [],
        "compensationBreakdown": [],
        "compensationHistory": [],
        "equityGrants": [],
        "attendanceSummary": {
            "presentDays": 0,
            "leaveDays": 0,
            "lateDays": 0,
            "overtimeHours": 0,
        },
        "attendanceTrend": {"labels": [], "values": []},
        "timesheet": [],
        "leaveHistory": [],
        "goals": [],
        "peerFeedback": [],
        "ratingHistory": {"labels": [], "values": []},
        "documents": [],
        "activity": [],
    }


def _comp_breakdown(base: float, bonus: float, equity: float) -> list[dict[str, Any]]:
    return [
        {"label": "Base", "amount": base, "color": "#272156"},
        {"label": "Bonus", "amount": bonus, "color": "#31CDFF"},
        {"label": "Equity", "amount": equity, "color": "#5B8DEF"},
    ]


def seed_department_docs(now: datetime) -> list[dict[str, Any]]:
    """Initial department rows when collection is empty (Mongo only — not UI)."""
    return [
        {
            "name": "Engineering",
            "code": "ENG",
            "description": "Product engineering and platform",
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "People & Culture",
            "code": "HR",
            "description": "HR operations and talent",
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "Operations",
            "code": "OPS",
            "description": "Facilities and internal ops",
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "Finance",
            "code": "FIN",
            "description": "Accounting and payroll",
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "name": "Client Success",
            "code": "CS",
            "description": "Client delivery and success",
            "createdAt": now,
            "updatedAt": now,
        },
    ]


def seed_employee_docs(
    now: datetime, dept_by_code: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Initial employee rows when collection is empty (Mongo only — not UI)."""

    def dept(code: str) -> tuple[str, str]:
        d = dept_by_code[code]
        return str(d["_id"]), str(d["name"])

    eng_id, eng_name = dept("ENG")
    hr_id, hr_name = dept("HR")
    ops_id, ops_name = dept("OPS")
    fin_id, fin_name = dept("FIN")
    cs_id, cs_name = dept("CS")

    def row(**kwargs: Any) -> dict[str, Any]:
        base = float(kwargs.get("baseSalary") or 0)
        equity = float(kwargs.get("equityValue") or 0)
        bonus = round(base * 0.12)
        total = float(kwargs.get("totalCompensation") or (base + bonus + equity))
        doc = {
            **empty_profile_arrays(),
            "currency": "USD",
            "createdAt": now,
            "updatedAt": now,
            "compensationBreakdown": _comp_breakdown(base, bonus, equity),
            "compensationHistory": [
                {
                    "effectiveDate": "2025-01-01",
                    "type": "raise",
                    "previousBase": round(base * 0.92),
                    "newBase": base,
                    "note": "Annual merit increase",
                }
            ],
            "equityGrants": [
                {
                    "id": f"eq-{kwargs['employeeNumber']}",
                    "grantDate": "2023-07-01",
                    "shares": 4000,
                    "vestedShares": 2000,
                    "vestSchedule": "4-year monthly after 1-year cliff",
                    "cliffMonths": 12,
                    "status": "active",
                }
            ]
            if equity > 0
            else [],
            "attendanceSummary": {
                "presentDays": 18,
                "leaveDays": 2,
                "lateDays": 1,
                "overtimeHours": 6,
            },
            "attendanceTrend": {
                "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                "values": [95, 92, 98, 94, 96, 97],
            },
            "timesheet": [
                {
                    "date": "2026-07-28",
                    "status": "present",
                    "checkIn": "08:52",
                    "checkOut": "17:10",
                },
                {
                    "date": "2026-07-27",
                    "status": "remote",
                    "checkIn": "09:05",
                    "checkOut": "17:40",
                },
            ],
            "leaveHistory": [
                {
                    "id": f"lv-{kwargs['employeeNumber']}-1",
                    "type": "Annual leave",
                    "startDate": "2026-07-24",
                    "endDate": "2026-07-24",
                    "days": 1,
                    "status": "approved",
                }
            ],
            "goals": [
                {
                    "id": f"g-{kwargs['employeeNumber']}-1",
                    "title": "Ship Q3 roadmap milestones",
                    "progress": 62,
                    "dueDate": "2026-09-30",
                    "status": "on_track",
                }
            ],
            "peerFeedback": [],
            "ratingHistory": {
                "labels": ["2024 H2", "2025 H1", "2025 H2"],
                "values": [3.8, 4.0, float(kwargs.get("performanceRating") or 0)],
            },
            "documents": [
                {
                    "id": f"d-{kwargs['employeeNumber']}-1",
                    "name": "Employment contract.pdf",
                    "category": "contract",
                    "uploadedAt": kwargs.get("startDate", "2024-01-01"),
                    "sizeKb": 420,
                }
            ],
            "activity": [
                {
                    "id": f"a-{kwargs['employeeNumber']}-1",
                    "date": now.isoformat() + "Z",
                    "actor": "System",
                    "action": "Employee record created",
                    "detail": "Initial HR seed",
                }
            ],
            "totalCompensation": total,
            "tenureYears": tenure_years_from_start(kwargs.get("startDate")),
        }
        doc.update(kwargs)
        return doc

    # Temporary keys for manager wiring after insert — use employeeNumber refs
    return [
        row(
            employeeNumber="BQI-1001",
            firstName="Amina",
            lastName="Okonkwo",
            email="amina.okonkwo@bqitech.com",
            workEmail="amina.okonkwo@bqitech.com",
            phone="+254 712 345 001",
            jobTitle="Head of Engineering",
            departmentId=eng_id,
            departmentName=eng_name,
            location="Nairobi",
            status="active",
            employmentType="full_time",
            startDate="2021-03-15",
            leaveBalanceDays=14,
            performanceRating=4.6,
            baseSalary=95000,
            totalCompensation=128000,
            equityValue=22000,
            skills=[
                {"name": "Architecture", "level": "expert"},
                {"name": "TypeScript", "level": "expert"},
            ],
            tags=["Leadership", "Platform"],
            nationality="Kenyan",
            dateOfBirth="1988-04-12",
            address={
                "line1": "12 Riverside Drive",
                "city": "Nairobi",
                "country": "Kenya",
            },
        ),
        row(
            employeeNumber="BQI-1002",
            firstName="Brian",
            lastName="Otieno",
            email="brian.otieno@bqitech.com",
            workEmail="brian.otieno@bqitech.com",
            phone="+254 712 345 002",
            jobTitle="Senior Frontend Engineer",
            departmentId=eng_id,
            departmentName=eng_name,
            location="Nairobi",
            status="active",
            employmentType="full_time",
            startDate="2022-08-01",
            leaveBalanceDays=9,
            performanceRating=4.2,
            baseSalary=62000,
            totalCompensation=78000,
            equityValue=9000,
            skills=[{"name": "React", "level": "expert"}],
            tags=["Frontend"],
            _managerNumber="BQI-1001",
        ),
        row(
            employeeNumber="BQI-1003",
            firstName="Fatuma",
            lastName="Hassan",
            email="fatuma.hassan@bqitech.com",
            workEmail="fatuma.hassan@bqitech.com",
            phone="+254 712 345 003",
            jobTitle="Backend Engineer",
            departmentId=eng_id,
            departmentName=eng_name,
            location="Mombasa (remote)",
            status="probation",
            employmentType="full_time",
            startDate="2026-04-01",
            leaveBalanceDays=4,
            performanceRating=3.8,
            baseSalary=48000,
            totalCompensation=54000,
            equityValue=4000,
            skills=[{"name": "Python", "level": "advanced"}],
            tags=["Backend", "New hire"],
            onboardingStage="buddy_assigned",
            _managerNumber="BQI-1001",
        ),
        row(
            employeeNumber="BQI-1004",
            firstName="James",
            lastName="Mwangi",
            email="james.mwangi@bqitech.com",
            workEmail="james.mwangi@bqitech.com",
            phone="+254 712 345 004",
            jobTitle="People Operations Lead",
            departmentId=hr_id,
            departmentName=hr_name,
            location="Nairobi",
            status="active",
            employmentType="full_time",
            startDate="2020-11-01",
            leaveBalanceDays=11,
            performanceRating=4.4,
            baseSalary=72000,
            totalCompensation=88000,
            equityValue=11000,
            skills=[{"name": "Employee relations", "level": "expert"}],
            tags=["HR"],
        ),
        row(
            employeeNumber="BQI-1005",
            firstName="Lucy",
            lastName="Njeri",
            email="lucy.njeri@bqitech.com",
            workEmail="lucy.njeri@bqitech.com",
            phone="+254 712 345 005",
            jobTitle="HR Generalist",
            departmentId=hr_id,
            departmentName=hr_name,
            location="Nairobi",
            status="onboarding",
            employmentType="full_time",
            startDate="2026-07-15",
            leaveBalanceDays=2,
            performanceRating=0,
            baseSalary=38000,
            totalCompensation=40000,
            equityValue=1500,
            skills=[{"name": "Onboarding", "level": "intermediate"}],
            tags=["Onboarding"],
            onboardingStage="it_setup",
            _managerNumber="BQI-1004",
        ),
        row(
            employeeNumber="BQI-1006",
            firstName="Sarah",
            lastName="Chen",
            email="sarah.chen@bqitech.com",
            workEmail="sarah.chen@bqitech.com",
            phone="+254 712 345 006",
            jobTitle="Operations Manager",
            departmentId=ops_id,
            departmentName=ops_name,
            location="Nairobi",
            status="active",
            employmentType="full_time",
            startDate="2019-06-01",
            leaveBalanceDays=16,
            performanceRating=4.3,
            baseSalary=68000,
            totalCompensation=82000,
            equityValue=10000,
            skills=[{"name": "Facilities", "level": "expert"}],
            tags=["Ops"],
        ),
        row(
            employeeNumber="BQI-1007",
            firstName="Peter",
            lastName="Kamau",
            email="peter.kamau@bqitech.com",
            workEmail="peter.kamau@bqitech.com",
            phone="+254 712 345 007",
            jobTitle="Office Coordinator",
            departmentId=ops_id,
            departmentName=ops_name,
            location="Nairobi",
            status="on_leave",
            employmentType="full_time",
            startDate="2024-02-12",
            leaveBalanceDays=3,
            performanceRating=3.9,
            baseSalary=32000,
            totalCompensation=35000,
            equityValue=2000,
            skills=[{"name": "Scheduling", "level": "advanced"}],
            tags=["Ops"],
            _managerNumber="BQI-1006",
        ),
        row(
            employeeNumber="BQI-1008",
            firstName="David",
            lastName="Kimani",
            email="david.kimani@bqitech.com",
            workEmail="david.kimani@bqitech.com",
            phone="+254 712 345 008",
            jobTitle="Finance Manager",
            departmentId=fin_id,
            departmentName=fin_name,
            location="Nairobi",
            status="active",
            employmentType="full_time",
            startDate="2021-09-01",
            leaveBalanceDays=10,
            performanceRating=4.1,
            baseSalary=78000,
            totalCompensation=92000,
            equityValue=9000,
            skills=[{"name": "Payroll", "level": "expert"}],
            tags=["Finance"],
        ),
        row(
            employeeNumber="BQI-1009",
            firstName="Grace",
            lastName="Wanjiru",
            email="grace.wanjiru@bqitech.com",
            workEmail="grace.wanjiru@bqitech.com",
            phone="+254 712 345 009",
            jobTitle="Client Success Lead",
            departmentId=cs_id,
            departmentName=cs_name,
            location="Nairobi",
            status="active",
            employmentType="full_time",
            startDate="2022-01-10",
            leaveBalanceDays=8,
            performanceRating=4.5,
            baseSalary=70000,
            totalCompensation=90000,
            equityValue=12000,
            skills=[{"name": "Account management", "level": "expert"}],
            tags=["Client"],
        ),
        row(
            employeeNumber="BQI-1010",
            firstName="Kevin",
            lastName="Ouma",
            email="kevin.ouma@bqitech.com",
            workEmail="kevin.ouma@bqitech.com",
            phone="+254 712 345 010",
            jobTitle="Client Success Associate",
            departmentId=cs_id,
            departmentName=cs_name,
            location="Kisumu (hybrid)",
            status="offboarding",
            employmentType="full_time",
            startDate="2023-05-01",
            endDate="2026-08-31",
            leaveBalanceDays=5,
            performanceRating=3.7,
            baseSalary=42000,
            totalCompensation=46000,
            equityValue=3000,
            skills=[{"name": "CRM", "level": "advanced"}],
            tags=["Offboarding"],
            offboardingStage="knowledge_transfer",
            _managerNumber="BQI-1009",
        ),
        row(
            employeeNumber="BQI-1011",
            firstName="Nia",
            lastName="Mutua",
            email="nia.mutua@bqitech.com",
            workEmail="nia.mutua@bqitech.com",
            phone="+254 712 345 011",
            jobTitle="QA Engineer",
            departmentId=eng_id,
            departmentName=eng_name,
            location="Nairobi",
            status="active",
            employmentType="contract",
            startDate="2025-11-01",
            leaveBalanceDays=6,
            performanceRating=4.0,
            baseSalary=45000,
            totalCompensation=48000,
            equityValue=0,
            skills=[{"name": "Playwright", "level": "advanced"}],
            tags=["QA", "Contract"],
            _managerNumber="BQI-1001",
        ),
    ]


async def ensure_hr_seed(db: Any) -> bool:
    """Ensure baseline department rows exist when the departments collection is empty.

    Does **not** insert demo employees. Fake people (Sarah Chen, Fatuma Hassan, etc.)
    are only created via the explicit `/api/admin/employees/seed` endpoint.
    Returns True if departments were inserted.
    """
    dept_count = await db.departments.count_documents({})
    if dept_count > 0:
        return False

    now = datetime.utcnow()
    dept_docs = seed_department_docs(now)
    result = await db.departments.insert_many(dept_docs)
    for doc, _id in zip(dept_docs, result.inserted_ids):
        doc["_id"] = _id
    return True


async def next_employee_number(db: Any) -> str:
    latest = await db.employees.find_one(
        {}, sort=[("employeeNumber", -1)], projection={"employeeNumber": 1}
    )
    if not latest or not latest.get("employeeNumber"):
        return "BQI-1001"
    raw = str(latest["employeeNumber"])
    digits = "".join(ch for ch in raw if ch.isdigit())
    try:
        n = int(digits) + 1
    except ValueError:
        n = (await db.employees.count_documents({})) + 1001
    return f"BQI-{n}"
