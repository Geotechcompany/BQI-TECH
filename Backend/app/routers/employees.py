"""Admin HR: employees, departments, attendance overview."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_admin_user
from app.database import get_database
from app.lib.admin_permissions import has_admin_module
from app.lib.employee_invite_emails import (
    maybe_send_employee_invite_after_create,
    resend_employee_invite,
)
from app.lib.employees import (
    build_employees_query,
    empty_profile_arrays,
    ensure_hr_seed,
    format_department,
    format_employee,
    next_employee_number,
    parse_oid,
    tenure_years_from_start,
)
from app.lib.user_avatar import sync_avatar_to_user_doc
from app.models.employee import (
    DepartmentCreate,
    DepartmentUpdate,
    EmployeeCreate,
    EmployeeDocumentCreate,
    EmployeeImportRequest,
    EmployeeUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["employees"])


def _require_people_module(user: dict) -> None:
    if not has_admin_module(user, "people"):
        # Legacy admins with empty modules still get all keys via has_admin_module
        raise HTTPException(
            status_code=403, detail="People module access required"
        )


def _model_to_dict(obj: Any, **kwargs: Any) -> Any:
    """Serialize a Pydantic model (v1 .dict preferred; v2 .model_dump fallback)."""
    if obj is None or isinstance(obj, dict):
        return obj
    as_dict = getattr(obj, "dict", None)
    if callable(as_dict):
        return as_dict(**kwargs)
    dump = getattr(obj, "model_dump", None)
    if callable(dump):
        return dump(**kwargs)
    return obj


def _db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return db


async def _resolve_department(
    db: Any, department_id: Optional[str]
) -> tuple[Optional[str], str]:
    if not department_id:
        return None, ""
    try:
        oid = parse_oid(department_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid departmentId")
    dept = await db.departments.find_one({"_id": oid})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return str(dept["_id"]), str(dept.get("name") or "")


async def _resolve_manager(
    db: Any, manager_id: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    if not manager_id:
        return None, None
    try:
        oid = parse_oid(manager_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid managerId")
    mgr = await db.employees.find_one({"_id": oid})
    if not mgr:
        raise HTTPException(status_code=404, detail="Manager not found")
    return str(mgr["_id"]), f"{mgr.get('firstName', '')} {mgr.get('lastName', '')}".strip()


# ── Departments ──────────────────────────────────────────────────────────────


@router.get("/departments")
async def list_departments(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    await ensure_hr_seed(db)

    departments = []
    async for doc in db.departments.find({}).sort("name", 1):
        count = await db.employees.count_documents(
            {"departmentId": str(doc["_id"])}
        )
        departments.append(format_department(doc, count))
    return {"departments": departments, "total": len(departments)}


@router.post("/departments")
async def create_department(
    payload: DepartmentCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    now = datetime.utcnow()
    head_id, head_name = await _resolve_manager(db, payload.headEmployeeId)
    doc = {
        "name": payload.name.strip(),
        "code": payload.code.strip().upper(),
        "description": (payload.description or "").strip() or None,
        "parentId": payload.parentId,
        "headEmployeeId": head_id,
        "headName": head_name,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.departments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return format_department(doc, 0)


@router.patch("/departments/{department_id}")
async def update_department(
    department_id: str,
    payload: DepartmentUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(department_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid department id")

    existing = await db.departments.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Department not found")

    data = _model_to_dict(payload, exclude_unset=True)
    if "headEmployeeId" in data:
        head_id, head_name = await _resolve_manager(db, data.get("headEmployeeId"))
        data["headEmployeeId"] = head_id
        data["headName"] = head_name
    if "name" in data and data["name"]:
        data["name"] = data["name"].strip()
        await db.employees.update_many(
            {"departmentId": department_id},
            {"$set": {"departmentName": data["name"], "updatedAt": datetime.utcnow()}},
        )
    if "code" in data and data["code"]:
        data["code"] = data["code"].strip().upper()
    data["updatedAt"] = datetime.utcnow()
    await db.departments.update_one({"_id": oid}, {"$set": data})
    doc = await db.departments.find_one({"_id": oid})
    count = await db.employees.count_documents({"departmentId": department_id})
    return format_department(doc, count)


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(department_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid department id")
    existing = await db.departments.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Department not found")

    count = await db.employees.count_documents({"departmentId": department_id})
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot delete department with {count} employee"
                f"{'s' if count != 1 else ''}. "
                "Reassign or remove them first."
            ),
        )
    result = await db.departments.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"ok": True}


# ── Employees ────────────────────────────────────────────────────────────────


@router.get("/employees")
async def list_employees(
    search: Optional[str] = Query(None),
    departmentId: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    employmentType: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    seeded = await ensure_hr_seed(db)
    query = build_employees_query(
        search=search,
        department_id=departmentId,
        status=status,
        employment_type=employmentType,
    )
    total = await db.employees.count_documents(query)
    cursor = (
        db.employees.find(query)
        .sort([("lastName", 1), ("firstName", 1)])
        .skip(skip)
        .limit(limit)
    )
    employees = [format_employee(doc) async for doc in cursor]
    return {
        "employees": employees,
        "total": total,
        "skip": skip,
        "limit": limit,
        "seeded": seeded,
    }


@router.get("/employees/org-chart")
async def get_org_chart(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    await ensure_hr_seed(db)
    people = [
        format_employee(doc)
        async for doc in db.employees.find(
            {"status": {"$nin": ["terminated"]}}
        ).sort("lastName", 1)
    ]
    return {"nodes": people, "total": len(people)}


@router.get("/employees/attendance-overview")
async def attendance_overview(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    await ensure_hr_seed(db)

    present = leave = late = overtime = 0
    rows = []
    async for doc in db.employees.find(
        {"status": {"$nin": ["terminated"]}}
    ).sort("lastName", 1):
        summary = doc.get("attendanceSummary") or {}
        p = int(summary.get("presentDays") or 0)
        l = int(summary.get("leaveDays") or 0)
        la = int(summary.get("lateDays") or 0)
        ot = float(summary.get("overtimeHours") or 0)
        present += p
        leave += l
        late += la
        overtime += ot
        rows.append(
            {
                "id": str(doc["_id"]),
                "name": f"{doc.get('firstName', '')} {doc.get('lastName', '')}".strip(),
                "departmentName": doc.get("departmentName") or "",
                "presentDays": p,
                "leaveDays": l,
                "lateDays": la,
                "overtimeHours": ot,
                "status": doc.get("status"),
            }
        )

    return {
        "totals": {
            "presentDays": present,
            "leaveDays": leave,
            "lateDays": late,
            "overtimeHours": overtime,
            "employeeCount": len(rows),
        },
        "employees": rows,
    }


@router.post("/employees/seed")
async def seed_employees(
    current_user: dict = Depends(get_current_admin_user),
):
    """Seed departments + employees only when both collections are empty."""
    _require_people_module(current_user)
    db = _db()
    ran = await ensure_hr_seed(db)
    emp_count = await db.employees.count_documents({})
    dept_count = await db.departments.count_documents({})
    return {
        "seeded": ran,
        "employeeCount": emp_count,
        "departmentCount": dept_count,
        "message": "Seed inserted" if ran else "Collections already have data",
    }


@router.post("/employees/import")
async def import_employees(
    payload: EmployeeImportRequest,
    current_user: dict = Depends(get_current_admin_user),
):
    """Bulk-create employees from parsed CSV rows. Skips duplicate emails."""
    _require_people_module(current_user)
    db = _db()
    await ensure_hr_seed(db)
    now = datetime.utcnow()
    actor = current_user.get("name") or current_user.get("email") or "Admin"

    # Preload departments for code/name lookup
    dept_by_code: dict[str, dict] = {}
    dept_by_name: dict[str, dict] = {}
    async for d in db.departments.find({}):
        code = str(d.get("code") or "").strip().upper()
        name = str(d.get("name") or "").strip().lower()
        if code:
            dept_by_code[code] = d
        if name:
            dept_by_name[name] = d

    created = 0
    skipped = 0
    errors: list[dict[str, Any]] = []

    for index, row in enumerate(payload.rows, start=1):
        try:
            email = str(row.email).lower().strip()
            existing = await db.employees.find_one(
                {"email": {"$regex": f"^{email}$", "$options": "i"}}
            )
            if existing:
                skipped += 1
                continue

            dept_id: Optional[str] = None
            dept_name = ""
            if row.departmentCode:
                match = dept_by_code.get(row.departmentCode.strip().upper())
                if match:
                    dept_id = str(match["_id"])
                    dept_name = str(match.get("name") or "")
            if not dept_id and row.departmentName:
                match = dept_by_name.get(row.departmentName.strip().lower())
                if match:
                    dept_id = str(match["_id"])
                    dept_name = str(match.get("name") or "")

            status = row.status or "onboarding"
            employment_type = row.employmentType or "full_time"
            start_date = (row.startDate or now.date().isoformat())[:10]
            work_email = str(row.workEmail or email).lower().strip()

            doc: dict[str, Any] = {
                **empty_profile_arrays(),
                "employeeNumber": await next_employee_number(db),
                "firstName": row.firstName.strip(),
                "lastName": row.lastName.strip(),
                "email": email,
                "workEmail": work_email,
                "phone": row.phone or "",
                "jobTitle": row.jobTitle.strip(),
                "departmentId": dept_id,
                "departmentName": dept_name,
                "location": row.location or "Nairobi",
                "status": status,
                "employmentType": employment_type,
                "startDate": start_date,
                "leaveBalanceDays": 0,
                "performanceRating": 0,
                "baseSalary": 0,
                "currency": "USD",
                "totalCompensation": 0,
                "equityValue": 0,
                "compensationBreakdown": [
                    {"label": "Base", "amount": 0, "color": "#272156"},
                    {"label": "Bonus", "amount": 0, "color": "#31CDFF"},
                    {"label": "Equity", "amount": 0, "color": "#5B8DEF"},
                ],
                "tenureYears": tenure_years_from_start(start_date),
                "onboardingStage": "paperwork" if status == "onboarding" else None,
                "offboardingStage": "notice" if status == "offboarding" else None,
                "activity": [
                    {
                        "id": f"a-{ObjectId()}",
                        "date": now.isoformat() + "Z",
                        "actor": actor,
                        "action": "Employee imported",
                    }
                ],
                "createdAt": now,
                "updatedAt": now,
            }
            await db.employees.insert_one(doc)
            created += 1
        except Exception as exc:  # noqa: BLE001 — collect per-row failures
            errors.append({"row": index, "message": str(exc)})

    return {
        "created": created,
        "skipped": skipped,
        "errors": errors[:25],
        "totalRows": len(payload.rows),
    }


@router.get("/employees/{employee_id}")
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(employee_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid employee id")
    doc = await db.employees.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
    return format_employee(doc)


@router.post("/employees")
async def create_employee(
    payload: EmployeeCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    await ensure_hr_seed(db)
    now = datetime.utcnow()
    dept_id, dept_name = await _resolve_department(db, payload.departmentId)
    mgr_id, mgr_name = await _resolve_manager(db, payload.managerId)

    email = str(payload.email).lower().strip()
    existing = await db.employees.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Employee email already exists")

    base = float(payload.baseSalary or 0)
    equity = float(payload.equityValue or 0)
    bonus = float(payload.bonusTarget or 0)
    sign_on = float(payload.signOnBonus or 0)
    total = (
        float(payload.totalCompensation)
        if payload.totalCompensation is not None
        else base + bonus + equity
    )

    actor = current_user.get("name") or current_user.get("email") or "Admin"
    doc: dict[str, Any] = {
        **empty_profile_arrays(),
        "employeeNumber": await next_employee_number(db),
        "firstName": payload.firstName.strip(),
        "lastName": payload.lastName.strip(),
        "email": email,
        "workEmail": str(payload.workEmail or email).lower().strip(),
        "personalEmail": payload.personalEmail,
        "phone": payload.phone or "",
        "avatarUrl": payload.avatarUrl,
        "displayName": (payload.displayName or "").strip() or None,
        "pronouns": (payload.pronouns or "").strip() or None,
        "gender": (payload.gender or "").strip() or None,
        "maritalStatus": (payload.maritalStatus or "").strip() or None,
        "jobTitle": payload.jobTitle.strip(),
        "jobGrade": (payload.jobGrade or "").strip() or None,
        "departmentId": dept_id,
        "departmentName": dept_name,
        "managerId": mgr_id,
        "managerName": mgr_name,
        "location": payload.location or "",
        "status": payload.status,
        "employmentType": payload.employmentType,
        "startDate": payload.startDate,
        "endDate": payload.endDate,
        "probationMonths": payload.probationMonths,
        "workArrangement": (payload.workArrangement or "").strip() or None,
        "weeklyHours": payload.weeklyHours,
        "dateOfBirth": payload.dateOfBirth,
        "nationality": payload.nationality,
        "address": _model_to_dict(payload.address) if payload.address else None,
        "emergencyContact": payload.emergencyContact,
        "skills": [_model_to_dict(s) for s in payload.skills],
        "tags": payload.tags,
        "leaveBalanceDays": payload.leaveBalanceDays,
        "performanceRating": payload.performanceRating,
        "baseSalary": base,
        "currency": payload.currency or "USD",
        "totalCompensation": total,
        "equityValue": equity,
        "bonusTarget": bonus,
        "signOnBonus": sign_on,
        "bankDetails": payload.bankDetails,
        "onboardingChecklist": payload.onboardingChecklist,
        "invitePreferences": payload.invitePreferences,
        "compensationBreakdown": [
            {"label": "Base", "amount": base, "color": "#272156"},
            {"label": "Bonus", "amount": bonus, "color": "#31CDFF"},
            {"label": "Equity", "amount": equity, "color": "#5B8DEF"},
            {"label": "Sign-on", "amount": sign_on, "color": "#8B7EC8"},
        ],
        "tenureYears": tenure_years_from_start(payload.startDate),
        "onboardingStage": payload.onboardingStage
        or ("paperwork" if payload.status == "onboarding" else None),
        "offboardingStage": payload.offboardingStage,
        "activity": [
            {
                "id": f"a-{ObjectId()}",
                "date": now.isoformat() + "Z",
                "actor": actor,
                "action": "Employee created",
            }
        ],
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.employees.insert_one(doc)
    doc["_id"] = result.inserted_id

    if doc.get("avatarUrl"):
        await sync_avatar_to_user_doc(
            db,
            avatar_url=str(doc["avatarUrl"]),
            email=str(doc.get("workEmail") or doc.get("email") or ""),
        )

    # Invite failure must not roll back the employee record.
    try:
        invite_prefs = await maybe_send_employee_invite_after_create(
            db,
            employee_doc=doc,
            invited_by=actor,
        )
        doc["invitePreferences"] = invite_prefs
        status = str(invite_prefs.get("inviteStatus") or "")
        if status == "sent":
            activity = list(doc.get("activity") or [])
            activity.insert(
                0,
                {
                    "id": f"a-{ObjectId()}",
                    "date": now.isoformat() + "Z",
                    "actor": actor,
                    "action": "Welcome invite email sent",
                },
            )
            await db.employees.update_one(
                {"_id": result.inserted_id},
                {"$set": {"activity": activity[:100]}},
            )
            doc["activity"] = activity[:100]
        elif status == "failed":
            activity = list(doc.get("activity") or [])
            activity.insert(
                0,
                {
                    "id": f"a-{ObjectId()}",
                    "date": now.isoformat() + "Z",
                    "actor": actor,
                    "action": "Welcome invite email failed",
                },
            )
            await db.employees.update_one(
                {"_id": result.inserted_id},
                {"$set": {"activity": activity[:100]}},
            )
            doc["activity"] = activity[:100]
    except Exception:
        logger.exception(
            "Employee invite step failed after create for %s", result.inserted_id
        )

    return format_employee(doc)


@router.post("/employees/{employee_id}/documents")
async def upload_employee_document(
    employee_id: str,
    payload: EmployeeDocumentCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Attach an already-uploaded file to the employee documents list."""
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(employee_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid employee id")

    existing = await db.employees.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    name = payload.name.strip()
    file_url = payload.fileUrl.strip()
    file_name = payload.fileName.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Document name is required")
    if not file_url or not file_name:
        raise HTTPException(status_code=400, detail="File URL and name are required")

    now = datetime.utcnow()
    size_kb = max(1, round(int(payload.fileSize or 0) / 1024)) if payload.fileSize else 0
    document = {
        "id": f"d-{ObjectId()}",
        "name": name,
        "category": payload.category,
        "url": file_url,
        "fileName": file_name,
        "fileSize": int(payload.fileSize or 0),
        "sizeKb": size_kb,
        "uploadedAt": now.isoformat() + "Z",
        "status": "uploaded",
    }

    actor = current_user.get("name") or current_user.get("email") or "Admin"
    activity_entry = {
        "id": f"a-{ObjectId()}",
        "date": now.isoformat() + "Z",
        "actor": actor,
        "action": "Document uploaded",
        "detail": name,
    }

    await db.employees.update_one(
        {"_id": oid},
        {
            "$push": {
                "documents": {"$each": [document], "$position": 0},
                "activity": {"$each": [activity_entry], "$position": 0, "$slice": 100},
            },
            "$set": {"updatedAt": now},
        },
    )
    doc = await db.employees.find_one({"_id": oid})
    return format_employee(doc)


@router.patch("/employees/{employee_id}")
async def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(employee_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid employee id")

    existing = await db.employees.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    data = _model_to_dict(payload, exclude_unset=True)
    now = datetime.utcnow()

    if "departmentId" in data:
        dept_id, dept_name = await _resolve_department(db, data.get("departmentId"))
        data["departmentId"] = dept_id
        data["departmentName"] = dept_name
    if "managerId" in data:
        mgr_id, mgr_name = await _resolve_manager(db, data.get("managerId"))
        data["managerId"] = mgr_id
        data["managerName"] = mgr_name
    if "address" in data and data["address"] is not None:
        data["address"] = _model_to_dict(data["address"])
    if "skills" in data and data["skills"] is not None:
        data["skills"] = [_model_to_dict(s) for s in data["skills"]]
    if "email" in data and data["email"]:
        data["email"] = str(data["email"]).lower().strip()
    if "workEmail" in data and data["workEmail"]:
        data["workEmail"] = str(data["workEmail"]).lower().strip()
    if "startDate" in data and data["startDate"]:
        data["tenureYears"] = tenure_years_from_start(data["startDate"])

    # Keep total + mix in sync when compensation fields change.
    comp_keys = ("baseSalary", "equityValue", "bonusTarget", "signOnBonus")
    if any(k in data for k in comp_keys):
        base = float(
            data["baseSalary"]
            if "baseSalary" in data
            else (existing.get("baseSalary") or 0)
        )
        equity = float(
            data["equityValue"]
            if "equityValue" in data
            else (existing.get("equityValue") or 0)
        )
        bonus = float(
            data["bonusTarget"]
            if "bonusTarget" in data
            else (existing.get("bonusTarget") or 0)
        )
        sign_on = float(
            data["signOnBonus"]
            if "signOnBonus" in data
            else (existing.get("signOnBonus") or 0)
        )
        if "totalCompensation" not in data:
            data["totalCompensation"] = base + bonus + equity + sign_on
        if "compensationBreakdown" not in data:
            breakdown = [
                {"label": "Base", "amount": base, "color": "#272156"},
                {"label": "Bonus", "amount": bonus, "color": "#31CDFF"},
                {"label": "Equity", "amount": equity, "color": "#5B8DEF"},
            ]
            if sign_on > 0:
                breakdown.append(
                    {"label": "Sign-on", "amount": sign_on, "color": "#8B7EC8"}
                )
            data["compensationBreakdown"] = breakdown

    actor = current_user.get("name") or current_user.get("email") or "Admin"
    activity = list(existing.get("activity") or [])
    if "baseSalary" in data and float(data["baseSalary"]) != float(
        existing.get("baseSalary") or 0
    ):
        action = "Adjusted base salary"
        detail = f"{existing.get('baseSalary') or 0} → {data['baseSalary']}"
    elif "equityValue" in data and float(data["equityValue"]) != float(
        existing.get("equityValue") or 0
    ):
        action = "Granted equity"
        detail = f"Equity value → {data['equityValue']}"
    else:
        action = "Employee updated"
        detail = None
    entry: dict[str, Any] = {
        "id": f"a-{ObjectId()}",
        "date": now.isoformat() + "Z",
        "actor": actor,
        "action": action,
    }
    if detail:
        entry["detail"] = detail
    activity.insert(0, entry)
    data["activity"] = activity[:100]
    data["updatedAt"] = now

    await db.employees.update_one({"_id": oid}, {"$set": data})
    if "avatarUrl" in data and data.get("avatarUrl"):
        email = str(
            data.get("workEmail")
            or data.get("email")
            or existing.get("workEmail")
            or existing.get("email")
            or ""
        )
        await sync_avatar_to_user_doc(
            db,
            avatar_url=str(data["avatarUrl"]),
            email=email,
        )
    doc = await db.employees.find_one({"_id": oid})
    return format_employee(doc)


@router.post("/employees/{employee_id}/docusign/send-offer")
async def send_employee_offer_via_docusign(
    employee_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Create and send a DocuSign envelope for the employee's offer letter."""
    _require_people_module(current_user)
    try:
        from app.lib import docusign as ds

        actor = current_user.get("name") or current_user.get("email") or "Admin"
        result = await ds.send_offer_letter(
            employee_id=employee_id,
            actor=str(actor),
        )
        return {
            "message": f"Offer letter sent to {result.get('signerEmail')}",
            **result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("docusign send-offer error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to send offer via DocuSign")


@router.post("/employees/{employee_id}/resend-invite")
async def resend_employee_invite_email(
    employee_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Manually send or resend the employee welcome / invite email."""
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(employee_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid employee id")

    doc = await db.employees.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")

    actor = current_user.get("name") or current_user.get("email") or "Admin"
    try:
        result = await resend_employee_invite(
            db,
            employee_doc=doc,
            invited_by=str(actor),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=result.get("message") or "Invite email could not be delivered",
        )

    return result


@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_people_module(current_user)
    db = _db()
    try:
        oid = parse_oid(employee_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid employee id")
    result = await db.employees.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    # Clear manager refs pointing here
    await db.employees.update_many(
        {"managerId": employee_id},
        {"$unset": {"managerId": "", "managerName": ""}, "$set": {"updatedAt": datetime.utcnow()}},
    )
    await db.departments.update_many(
        {"headEmployeeId": employee_id},
        {
            "$unset": {"headEmployeeId": "", "headName": ""},
            "$set": {"updatedAt": datetime.utcnow()},
        },
    )
    return {"ok": True}
