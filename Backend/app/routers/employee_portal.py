"""Employee self-service portal API — profile, leave, documents."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import get_database
from app.lib.employee_portal_access import (
    format_employee_portal_profile,
    require_employee_for_user,
)
from app.lib.user_avatar import sync_avatar_to_user_doc
from app.lib.leave import (
    build_leave_calendar_month,
    ensure_leave_types_seed,
    format_leave_balance,
    format_leave_request,
    format_leave_type,
    leave_days_with_periods,
    normalize_end_period,
    normalize_start_period,
    parse_iso_date,
    parse_object_id,
    recompute_employee_leave_balances,
    recompute_leave_balance,
    sync_balance_for_request,
    utc_now,
)
from app.models.employee import (
    EmployeeDocumentCreate,
    EmployeeLeaveCommentCreate,
    EmployeeLeaveRequestCreate,
    EmployeeSelfServiceUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/employee", tags=["employee-portal"])

NO_ROSTER_ROW = {
    "code": "no_employee_roster",
    "message": "Your account is not linked to an employee record yet. Contact HR.",
}


def _db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return db


def _require_roster_employee(employee: dict[str, Any]) -> ObjectId:
    """Reject synthesized thin profiles that have no Mongo employees row."""
    raw_id = employee.get("_id")
    if not raw_id:
        raise HTTPException(status_code=403, detail=NO_ROSTER_ROW)
    try:
        return ObjectId(str(raw_id)) if not isinstance(raw_id, ObjectId) else raw_id
    except Exception:
        raise HTTPException(status_code=403, detail=NO_ROSTER_ROW)


def _model_to_dict(model: BaseModel, *, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


async def _current_employee(
    current_user: dict = Depends(get_current_user),
) -> tuple[dict[str, Any], dict[str, Any]]:
    db = _db()
    employee = await require_employee_for_user(db, current_user)
    return current_user, employee


def _sanitize_emergency_contact(raw: Optional[dict[str, Any]]) -> Optional[dict[str, str]]:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Invalid emergency contact")
    name = str(raw.get("name") or "").strip()[:120]
    relation = str(raw.get("relation") or "").strip()[:80]
    phone = str(raw.get("phone") or "").strip()[:40]
    if not name and not relation and not phone:
        return {"name": "", "relation": "", "phone": ""}
    return {"name": name, "relation": relation, "phone": phone}


def _employee_display_name(employee: dict[str, Any], fallback: str = "Employee") -> str:
    return (
        str(employee.get("displayName") or "").strip()
        or f"{employee.get('firstName', '')} {employee.get('lastName', '')}".strip()
        or fallback
    )


def _history_event(
    *,
    action: str,
    label: str,
    at: Any,
    actor_name: Optional[str] = None,
    actor_avatar_url: Optional[str] = None,
) -> dict[str, Any]:
    if isinstance(at, str) and at:
        at_iso = at
    elif hasattr(at, "isoformat"):
        at_iso = at.isoformat()
    else:
        at_iso = utc_now().isoformat()
    return {
        "id": str(ObjectId()),
        "action": action,
        "label": label,
        "at": at_iso,
        "actorName": actor_name,
        "actorAvatarUrl": actor_avatar_url,
    }


def _format_history_event(raw: dict[str, Any]) -> dict[str, Any]:
    at = raw.get("at")
    if hasattr(at, "isoformat"):
        at = at.isoformat()
    return {
        "id": str(raw.get("id") or ObjectId()),
        "action": str(raw.get("action") or ""),
        "label": str(raw.get("label") or raw.get("action") or "Event"),
        "at": str(at or ""),
        "actorName": str(raw.get("actorName") or "") or None,
        "actorAvatarUrl": str(raw.get("actorAvatarUrl") or "") or None,
    }


def _format_comment(raw: dict[str, Any]) -> dict[str, Any]:
    created = raw.get("createdAt")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    return {
        "id": str(raw.get("id") or ""),
        "body": str(raw.get("body") or ""),
        "authorName": str(raw.get("authorName") or "Employee"),
        "authorAvatarUrl": str(raw.get("authorAvatarUrl") or "") or None,
        "createdAt": str(created or ""),
    }


def _synthesize_history(doc: dict[str, Any]) -> list[dict[str, Any]]:
    """Merge stored history with Created / status-final events from request fields."""
    stored = [
        _format_history_event(h)
        for h in (doc.get("history") or [])
        if isinstance(h, dict)
    ]
    actions = {e["action"] for e in stored}
    employee_name = str(doc.get("employeeName") or "Employee")
    created_at = doc.get("requestedAt") or doc.get("createdAt")
    if "created" not in actions and created_at:
        stored.insert(
            0,
            _format_history_event(
                _history_event(
                    action="created",
                    label="Created",
                    at=created_at,
                    actor_name=employee_name,
                )
            ),
        )

    status = str(doc.get("status") or "pending")
    updated_at = doc.get("updatedAt") or doc.get("requestedAt")
    approver = str(doc.get("approverName") or "") or None
    if status == "approved" and "approved" not in actions and updated_at:
        stored.append(
            _format_history_event(
                _history_event(
                    action="approved",
                    label="Final approval",
                    at=updated_at,
                    actor_name=approver or "Approver",
                )
            )
        )
    elif status == "rejected" and "rejected" not in actions and updated_at:
        stored.append(
            _format_history_event(
                _history_event(
                    action="rejected",
                    label="Rejected",
                    at=updated_at,
                    actor_name=approver or "Approver",
                )
            )
        )
    elif status == "cancelled" and "cancelled" not in actions and updated_at:
        stored.append(
            _format_history_event(
                _history_event(
                    action="cancelled",
                    label="Cancelled",
                    at=updated_at,
                    actor_name=employee_name,
                )
            )
        )

    stored.sort(key=lambda e: e.get("at") or "")
    return stored


async def _load_own_leave_request(
    db: Any,
    employee_id: str,
    request_id: str,
) -> dict[str, Any]:
    try:
        oid = parse_object_id(request_id, "request id")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    doc = await db.leave_requests.find_one({"_id": oid})
    if not doc or str(doc.get("employeeId") or "") != employee_id:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return doc


async def _balance_for_request(
    db: Any, employee: dict[str, Any], req: dict[str, Any]
) -> tuple[Optional[float], Optional[float], Optional[bool]]:
    """Return (remaining, entitled, unlimited)."""
    leave_type_id = str(req.get("leaveTypeId") or "")
    leave_type_name = str(req.get("leaveTypeName") or "")
    type_doc = None
    if leave_type_id:
        try:
            type_doc = await db.leave_types.find_one(
                {"_id": ObjectId(leave_type_id)}
            )
        except Exception:
            type_doc = None
    unlimited = bool(type_doc.get("unlimited")) if type_doc else False
    if unlimited:
        return None, None, True

    balance = await recompute_leave_balance(
        db,
        employee_id=str(req.get("employeeId") or employee.get("_id") or ""),
        leave_type_id=leave_type_id,
        leave_type_name=leave_type_name,
        employee_name=str(req.get("employeeName") or ""),
        department_name=str(req.get("departmentName") or ""),
        employee=employee,
        type_doc=type_doc,
    )
    if balance:
        entitled = float(balance.get("entitled") or 0)
        remaining = balance.get("remaining")
        if remaining is None:
            remaining = (
                entitled
                - float(balance.get("used") or 0)
                - float(balance.get("pending") or 0)
            )
        return float(remaining), entitled, False

    if float(employee.get("leaveBalanceDays") or 0) > 0:
        days = float(employee.get("leaveBalanceDays") or 0)
        return days, days, False
    return None, None, False


def _format_request_detail(
    doc: dict[str, Any],
    *,
    remaining: Optional[float],
    entitled: Optional[float],
    unlimited: Optional[bool],
    avatar_url: Optional[str] = None,
) -> dict[str, Any]:
    base = format_leave_request(doc)
    comments = [
        _format_comment(c) for c in (doc.get("comments") or []) if isinstance(c, dict)
    ]
    attachments = [
        {
            "id": str(a.get("id") or ""),
            "name": str(a.get("name") or ""),
            "url": str(a.get("url") or "") or None,
        }
        for a in (doc.get("attachments") or [])
        if isinstance(a, dict)
    ]
    return {
        **base,
        "avatarUrl": avatar_url,
        "history": _synthesize_history(doc),
        "comments": comments,
        "attachments": attachments,
        "remainingDays": remaining,
        "entitledDays": entitled,
        "unlimited": bool(unlimited),
    }


@router.get("/me")
async def get_my_employee_profile(
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    return format_employee_portal_profile(employee)


@router.patch("/me")
async def update_my_employee_profile(
    payload: EmployeeSelfServiceUpdate,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Update employee-owned profile fields on the caller's roster row."""
    current_user, employee = ctx
    oid = _require_roster_employee(employee)
    data = _model_to_dict(payload, exclude_unset=True)
    if not data:
        return format_employee_portal_profile(employee)

    if "address" in data and data["address"] is not None:
        address = data["address"]
        if isinstance(address, BaseModel):
            data["address"] = _model_to_dict(address)
        elif isinstance(address, dict):
            data["address"] = {
                "line1": str(address.get("line1") or "").strip()[:200],
                "line2": (str(address.get("line2") or "").strip()[:200] or None),
                "city": str(address.get("city") or "").strip()[:120],
                "state": (str(address.get("state") or "").strip()[:120] or None),
                "postalCode": (
                    str(address.get("postalCode") or "").strip()[:40] or None
                ),
                "country": str(address.get("country") or "").strip()[:120],
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid address")

    if "emergencyContact" in data:
        data["emergencyContact"] = _sanitize_emergency_contact(
            data.get("emergencyContact")
        )

    if "personalEmail" in data and data["personalEmail"]:
        data["personalEmail"] = str(data["personalEmail"]).lower().strip()

    for text_key in (
        "firstName",
        "lastName",
        "displayName",
        "phone",
        "location",
        "dateOfBirth",
        "nationality",
        "pronouns",
        "gender",
        "maritalStatus",
        "avatarUrl",
    ):
        if text_key in data and data[text_key] is not None:
            data[text_key] = str(data[text_key]).strip()

    now = datetime.utcnow()
    actor = (
        current_user.get("name")
        or current_user.get("email")
        or "Employee"
    )
    activity_entry = {
        "id": f"a-{ObjectId()}",
        "date": now.isoformat() + "Z",
        "actor": actor,
        "action": "Updated profile (self-service)",
    }

    db = _db()
    await db.employees.update_one(
        {"_id": oid},
        {
            "$set": {**data, "updatedAt": now},
            "$push": {
                "activity": {
                    "$each": [activity_entry],
                    "$position": 0,
                    "$slice": 100,
                }
            },
        },
    )

    # Keep auth session avatar in sync so sidebar/header show the photo.
    if "avatarUrl" in data and data.get("avatarUrl"):
        await sync_avatar_to_user_doc(
            db,
            avatar_url=str(data["avatarUrl"]),
            user_id=current_user.get("_id"),
            email=str(
                current_user.get("email")
                or employee.get("workEmail")
                or employee.get("email")
                or ""
            ),
        )

    doc = await db.employees.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
    return format_employee_portal_profile(doc)


@router.get("/leave/types")
async def get_my_leave_types(
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Active leave types available for self-service requests."""
    _user, _employee = ctx
    db = _db()
    await ensure_leave_types_seed(db)
    items = []
    async for doc in db.leave_types.find({"active": {"$ne": False}}).sort(
        "name", 1
    ):
        items.append(format_leave_type(doc))
    return {"items": items, "total": len(items)}


@router.get("/leave/calendar")
async def get_team_leave_calendar(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Team leave calendar (approved absences) for the employee portal."""
    _user, _employee = ctx
    db = _db()
    return await build_leave_calendar_month(db, year, month)


@router.get("/leave/calendar/filters")
async def get_leave_calendar_filters(
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Roster facets for Users / Teams / Positions calendar search."""
    _user, _employee = ctx
    db = _db()

    users: list[dict[str, str]] = []
    teams: set[str] = set()
    positions: set[str] = set()

    cursor = db.employees.find(
        {"status": {"$ne": "terminated"}},
        {
            "firstName": 1,
            "lastName": 1,
            "departmentName": 1,
            "jobTitle": 1,
        },
    ).sort([("firstName", 1), ("lastName", 1)])

    async for doc in cursor:
        first = str(doc.get("firstName") or "").strip()
        last = str(doc.get("lastName") or "").strip()
        name = f"{first} {last}".strip() or "Employee"
        dept = str(doc.get("departmentName") or "").strip()
        title = str(doc.get("jobTitle") or "").strip()
        users.append(
            {
                "id": str(doc["_id"]),
                "name": name,
                "departmentName": dept,
                "jobTitle": title,
            }
        )
        if dept:
            teams.add(dept)
        if title:
            positions.add(title)

    return {
        "users": users,
        "teams": sorted(teams, key=str.lower),
        "positions": sorted(positions, key=str.lower),
    }


@router.get("/leave/balances")
async def get_my_leave_balances(
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        return {"items": [], "total": 0}

    db = _db()
    # Recompute from requests so entitlement/Apply reflect approved/pending days.
    recomputed = await recompute_employee_leave_balances(
        db, employee_id, employee=employee
    )
    items = [format_leave_balance(doc) for doc in recomputed]

    # Fallback: roster leaveBalanceDays when no typed balances exist
    if not items and float(employee.get("leaveBalanceDays") or 0) > 0:
        items.append(
            {
                "id": "roster-balance",
                "employeeId": employee_id,
                "employeeName": f"{employee.get('firstName', '')} {employee.get('lastName', '')}".strip(),
                "departmentName": str(employee.get("departmentName") or ""),
                "leaveTypeId": "",
                "leaveTypeName": "Annual leave",
                "entitled": float(employee.get("leaveBalanceDays") or 0),
                "used": 0,
                "pending": 0,
                "remaining": float(employee.get("leaveBalanceDays") or 0),
                "updatedAt": None,
            }
        )

    return {"items": items, "total": len(items)}


@router.get("/leave/requests")
async def get_my_leave_requests(
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        return {"items": [], "total": 0}

    db = _db()
    items = []
    cursor = db.leave_requests.find({"employeeId": employee_id}).sort(
        "requestedAt", -1
    )
    async for doc in cursor:
        items.append(format_leave_request(doc))

    # Fallback to embedded leaveHistory on the employee doc
    if not items:
        for raw in employee.get("leaveHistory") or []:
            if not isinstance(raw, dict):
                continue
            items.append(
                {
                    "id": str(raw.get("id") or ""),
                    "employeeId": employee_id,
                    "employeeName": f"{employee.get('firstName', '')} {employee.get('lastName', '')}".strip(),
                    "departmentName": str(employee.get("departmentName") or ""),
                    "leaveTypeId": "",
                    "leaveTypeName": str(raw.get("type") or "Leave"),
                    "startDate": str(raw.get("startDate") or ""),
                    "endDate": str(raw.get("endDate") or ""),
                    "days": float(raw.get("days") or 0),
                    "status": str(raw.get("status") or "pending"),
                    "reason": None,
                    "requestedAt": str(raw.get("startDate") or ""),
                    "approverName": None,
                    "createdAt": None,
                    "updatedAt": None,
                }
            )

    return {"items": items, "total": len(items)}


@router.post("/leave/requests")
async def create_my_leave_request(
    payload: EmployeeLeaveRequestCreate,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Submit a pending leave request for the logged-in employee."""
    current_user, employee = ctx
    oid = _require_roster_employee(employee)
    employee_id = str(oid)

    start_raw = payload.startDate.strip()
    end_raw = payload.endDate.strip()
    try:
        start = parse_iso_date(start_raw)
        end = parse_iso_date(end_raw)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format (use YYYY-MM-DD)"
        )
    if end < start:
        raise HTTPException(
            status_code=400, detail="End date must be on or after start date"
        )

    start_period = normalize_start_period(payload.startPeriod)
    end_period = normalize_end_period(payload.endPeriod)
    days = leave_days_with_periods(start, end, start_period, end_period)
    if days <= 0:
        raise HTTPException(status_code=400, detail="Leave must cover at least one day")

    db = _db()
    leave_type_id = payload.leaveTypeId.strip()
    try:
        type_oid = parse_object_id(leave_type_id, "leaveTypeId")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    type_doc = await db.leave_types.find_one({"_id": type_oid})
    if not type_doc or type_doc.get("active") is False:
        raise HTTPException(status_code=400, detail="Leave type not found or inactive")

    leave_type_name = str(type_doc.get("name") or "Leave")
    leave_type_id = str(type_doc["_id"])

    # Enforce remaining balance when a typed (or roster) balance exists
    balance = await recompute_leave_balance(
        db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        leave_type_name=leave_type_name,
        employee_name=_employee_display_name(
            employee,
            str(current_user.get("name") or current_user.get("email") or "Employee"),
        ),
        department_name=str(employee.get("departmentName") or ""),
        employee=employee,
        type_doc=type_doc,
    )

    remaining: Optional[float] = None
    if type_doc.get("unlimited"):
        remaining = None
    elif balance is not None:
        entitled = float(balance.get("entitled") or 0)
        used = float(balance.get("used") or 0)
        pending = float(balance.get("pending") or 0)
        remaining = balance.get("remaining")
        if remaining is None:
            remaining = entitled - used - pending
        remaining = float(remaining)
    elif float(employee.get("leaveBalanceDays") or 0) > 0 and str(
        type_doc.get("code") or ""
    ).lower() in {"annual", ""}:
        remaining = float(employee.get("leaveBalanceDays") or 0)

    if remaining is not None and days > remaining:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient balance: {remaining:g} day"
                f"{'' if remaining == 1 else 's'} remaining for {leave_type_name}, "
                f"but this request needs {days:g}."
            ),
        )

    employee_name = _employee_display_name(
        employee,
        str(current_user.get("name") or current_user.get("email") or "Employee"),
    )
    reason = (payload.reason or "").strip() or None
    substitute_id = (payload.substituteEmployeeId or "").strip() or None
    now = utc_now()
    doc = {
        "employeeId": employee_id,
        "employeeName": employee_name,
        "departmentName": str(employee.get("departmentName") or ""),
        "jobTitle": str(employee.get("jobTitle") or ""),
        "leaveTypeId": leave_type_id,
        "leaveTypeName": leave_type_name,
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "startPeriod": start_period,
        "endPeriod": end_period,
        "days": days,
        "status": "pending",
        "reason": reason,
        "substituteEmployeeId": substitute_id,
        "substituteName": None,
        "approverName": None,
        "requestedAt": now,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": str(current_user.get("_id") or current_user.get("id") or ""),
        "source": "employee_portal",
        "history": [
            _history_event(
                action="created",
                label="Created",
                at=now,
                actor_name=employee_name,
                actor_avatar_url=str(employee.get("avatarUrl") or "") or None,
            )
        ],
        "comments": [],
        "attachments": [],
    }
    result = await db.leave_requests.insert_one(doc)
    doc["_id"] = result.inserted_id

    await sync_balance_for_request(db, doc, employee=employee, type_doc=type_doc)

    return format_leave_request(doc)


@router.get("/leave/requests/{request_id}")
async def get_my_leave_request_detail(
    request_id: str,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        raise HTTPException(status_code=404, detail="Leave request not found")
    db = _db()
    doc = await _load_own_leave_request(db, employee_id, request_id)
    remaining, entitled, unlimited = await _balance_for_request(db, employee, doc)
    return _format_request_detail(
        doc,
        remaining=remaining,
        entitled=entitled,
        unlimited=unlimited,
        avatar_url=str(employee.get("avatarUrl") or "") or None,
    )


@router.post("/leave/requests/{request_id}/cancel")
async def cancel_my_leave_request(
    request_id: str,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Cancel a pending or approved leave request owned by the employee."""
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        raise HTTPException(status_code=404, detail="Leave request not found")
    db = _db()
    doc = await _load_own_leave_request(db, employee_id, request_id)
    previous_status = str(doc.get("status") or "pending")
    if previous_status not in ("pending", "approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a {previous_status} request",
        )

    now = utc_now()
    employee_name = _employee_display_name(employee, str(doc.get("employeeName") or "Employee"))
    history = list(doc.get("history") or [])
    history.append(
        _history_event(
            action="cancelled",
            label="Cancelled",
            at=now,
            actor_name=employee_name,
            actor_avatar_url=str(employee.get("avatarUrl") or "") or None,
        )
    )
    await db.leave_requests.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "cancelled",
                "updatedAt": now,
                "history": history,
            }
        },
    )
    cancelled = {**doc, "status": "cancelled", "updatedAt": now, "history": history}
    await sync_balance_for_request(db, cancelled, employee=employee)
    await db.leave_calendar_events.delete_many({"requestId": str(doc["_id"])})

    updated = await db.leave_requests.find_one({"_id": doc["_id"]})
    remaining, entitled, unlimited = await _balance_for_request(
        db, employee, updated or doc
    )
    return _format_request_detail(
        updated or doc,
        remaining=remaining,
        entitled=entitled,
        unlimited=unlimited,
        avatar_url=str(employee.get("avatarUrl") or "") or None,
    )


@router.get("/leave/requests/{request_id}/overlaps")
async def get_my_leave_request_overlaps(
    request_id: str,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Colleagues absent during the same period (department + company)."""
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        raise HTTPException(status_code=404, detail="Leave request not found")
    db = _db()
    doc = await _load_own_leave_request(db, employee_id, request_id)
    start = str(doc.get("startDate") or "")[:10]
    end = str(doc.get("endDate") or start)[:10]
    department = str(doc.get("departmentName") or employee.get("departmentName") or "")

    query = {
        "status": "approved",
        "employeeId": {"$ne": employee_id},
        "startDate": {"$lte": end},
        "endDate": {"$gte": start},
    }
    company: list[dict[str, Any]] = []
    department_items: list[dict[str, Any]] = []
    async for other in db.leave_requests.find(query).sort("startDate", 1).limit(100):
        entry = {
            "id": str(other.get("_id") or ""),
            "employeeId": str(other.get("employeeId") or ""),
            "employeeName": str(other.get("employeeName") or "Colleague"),
            "departmentName": str(other.get("departmentName") or ""),
            "jobTitle": str(other.get("jobTitle") or ""),
            "leaveTypeName": str(other.get("leaveTypeName") or "Leave"),
            "startDate": str(other.get("startDate") or "")[:10],
            "endDate": str(other.get("endDate") or "")[:10],
            "days": float(other.get("days") or 0),
            "avatarUrl": None,
        }
        company.append(entry)
        if department and entry["departmentName"] == department:
            department_items.append(entry)

    return {
        "department": department_items,
        "company": company,
        "departmentName": department or None,
    }


@router.get("/leave/requests/{request_id}/comments")
async def list_my_leave_request_comments(
    request_id: str,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        raise HTTPException(status_code=404, detail="Leave request not found")
    db = _db()
    doc = await _load_own_leave_request(db, employee_id, request_id)
    items = [
        _format_comment(c) for c in (doc.get("comments") or []) if isinstance(c, dict)
    ]
    return {"items": items, "total": len(items)}


@router.post("/leave/requests/{request_id}/comments")
async def add_my_leave_request_comment(
    request_id: str,
    payload: EmployeeLeaveCommentCreate,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    employee_id = str(employee.get("_id") or "")
    if not employee_id:
        raise HTTPException(status_code=404, detail="Leave request not found")
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    db = _db()
    doc = await _load_own_leave_request(db, employee_id, request_id)
    now = utc_now()
    comment = {
        "id": str(ObjectId()),
        "body": body[:2000],
        "authorName": _employee_display_name(
            employee, str(doc.get("employeeName") or "Employee")
        ),
        "authorAvatarUrl": str(employee.get("avatarUrl") or "") or None,
        "createdAt": now,
    }
    await db.leave_requests.update_one(
        {"_id": doc["_id"]},
        {
            "$push": {"comments": comment},
            "$set": {"updatedAt": now},
        },
    )
    return _format_comment(comment)


@router.get("/documents")
async def get_my_documents(
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    _user, employee = ctx
    profile = format_employee_portal_profile(employee)
    documents = profile.get("documents") or []
    return {"items": documents, "total": len(documents)}


def _build_document(
    payload: EmployeeDocumentCreate,
    *,
    document_id: Optional[str] = None,
) -> dict[str, Any]:
    name = payload.name.strip()
    file_url = payload.fileUrl.strip()
    file_name = payload.fileName.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Document name is required")
    if not file_url or not file_name:
        raise HTTPException(status_code=400, detail="File URL and name are required")

    now = datetime.utcnow()
    size_kb = (
        max(1, round(int(payload.fileSize or 0) / 1024)) if payload.fileSize else 0
    )
    return {
        "id": document_id or f"d-{ObjectId()}",
        "name": name,
        "category": payload.category,
        "url": file_url,
        "fileName": file_name,
        "fileSize": int(payload.fileSize or 0),
        "sizeKb": size_kb,
        "uploadedAt": now.isoformat() + "Z",
        "status": "uploaded",
    }


@router.post("/documents")
async def add_my_document(
    payload: EmployeeDocumentCreate,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Attach an already-uploaded file to the caller's employee documents list."""
    current_user, employee = ctx
    oid = _require_roster_employee(employee)
    document = _build_document(payload)

    now = datetime.utcnow()
    actor = (
        current_user.get("name")
        or current_user.get("email")
        or "Employee"
    )
    activity_entry = {
        "id": f"a-{ObjectId()}",
        "date": now.isoformat() + "Z",
        "actor": actor,
        "action": "Document uploaded (self-service)",
        "detail": document["name"],
    }

    db = _db()
    await db.employees.update_one(
        {"_id": oid},
        {
            "$push": {
                "documents": {"$each": [document], "$position": 0},
                "activity": {
                    "$each": [activity_entry],
                    "$position": 0,
                    "$slice": 100,
                },
            },
            "$set": {"updatedAt": now},
        },
    )
    profile = format_employee_portal_profile(
        await db.employees.find_one({"_id": oid}) or employee
    )
    return {"document": document, "items": profile.get("documents") or []}


@router.patch("/documents/{document_id}")
async def replace_my_document(
    document_id: str,
    payload: EmployeeDocumentCreate,
    ctx: tuple[dict[str, Any], dict[str, Any]] = Depends(_current_employee),
):
    """Replace an existing document on the caller's roster row."""
    current_user, employee = ctx
    oid = _require_roster_employee(employee)
    docs = list(employee.get("documents") or [])
    index = next(
        (
            i
            for i, raw in enumerate(docs)
            if isinstance(raw, dict) and str(raw.get("id") or "") == document_id
        ),
        None,
    )
    if index is None:
        raise HTTPException(status_code=404, detail="Document not found")

    document = _build_document(payload, document_id=document_id)
    docs[index] = document

    now = datetime.utcnow()
    actor = (
        current_user.get("name")
        or current_user.get("email")
        or "Employee"
    )
    activity_entry = {
        "id": f"a-{ObjectId()}",
        "date": now.isoformat() + "Z",
        "actor": actor,
        "action": "Document updated (self-service)",
        "detail": document["name"],
    }

    db = _db()
    await db.employees.update_one(
        {"_id": oid},
        {
            "$set": {"documents": docs, "updatedAt": now},
            "$push": {
                "activity": {
                    "$each": [activity_entry],
                    "$position": 0,
                    "$slice": 100,
                }
            },
        },
    )
    profile = format_employee_portal_profile(
        await db.employees.find_one({"_id": oid}) or {**employee, "documents": docs}
    )
    return {"document": document, "items": profile.get("documents") or []}
