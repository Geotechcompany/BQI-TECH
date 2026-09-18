"""Admin Leave module API — requests, balances, types, policies, calendar, overview."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.auth import get_current_admin_user
from app.database import get_database, is_connected
from app.lib.admin_permissions import has_admin_module
from app.lib.leave import (
    LEAVE_REQUEST_STATUSES,
    LEAVE_TYPE_CODES,
    SEED_POLICIES,
    SEED_TYPES,
    build_overview,
    ensure_leave_types_seed,
    build_leave_calendar_month,
    format_calendar_event,
    format_leave_balance,
    format_leave_policy,
    format_leave_request,
    format_leave_type,
    inclusive_days,
    month_bounds,
    parse_iso_date,
    parse_object_id,
    recompute_all_leave_balances,
    sync_balance_for_request,
    utc_now,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/leave", tags=["leave"])


def _require_leave_access(user: dict) -> None:
    if not (
        has_admin_module(user, "leave")
        or has_admin_module(user, "people")
    ):
        raise HTTPException(status_code=403, detail="Leave module access required")


def _require_db():
    if not is_connected() or get_database() is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    return get_database()


# ── Overview ───────────────────────────────────────────────────────────────


@router.get("/overview")
async def leave_overview(current_admin: dict = Depends(get_current_admin_user)):
    _require_leave_access(current_admin)
    db = _require_db()
    return await build_overview(db)


# ── Requests ───────────────────────────────────────────────────────────────


@router.get("/requests")
async def list_leave_requests(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    query: Dict[str, Any] = {}
    if status and status != "all":
        if status not in LEAVE_REQUEST_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        query["status"] = status

    total = await db.leave_requests.count_documents(query)
    items: List[Dict[str, Any]] = []
    cursor = (
        db.leave_requests.find(query)
        .sort("requestedAt", -1)
        .skip(skip)
        .limit(limit)
    )
    async for doc in cursor:
        items.append(format_leave_request(doc))
    return {"items": items, "total": total}


@router.post("/requests")
async def create_leave_request(
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()

    start_raw = str(payload.get("startDate") or "").strip()
    end_raw = str(payload.get("endDate") or "").strip()
    if not start_raw or not end_raw:
        raise HTTPException(status_code=400, detail="startDate and endDate are required")
    try:
        start = parse_iso_date(start_raw)
        end = parse_iso_date(end_raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    if end < start:
        raise HTTPException(status_code=400, detail="endDate must be on or after startDate")

    leave_type_id = str(payload.get("leaveTypeId") or "").strip()
    leave_type_name = str(payload.get("leaveTypeName") or "").strip()
    type_doc = None
    if leave_type_id:
        try:
            type_doc = await db.leave_types.find_one({"_id": parse_object_id(leave_type_id, "leaveTypeId")})
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    if not type_doc and leave_type_name:
        type_doc = await db.leave_types.find_one({"name": leave_type_name})
    if type_doc:
        leave_type_id = str(type_doc["_id"])
        leave_type_name = str(type_doc.get("name") or leave_type_name)

    days = payload.get("days")
    if days is None:
        days = inclusive_days(start, end)
    else:
        days = float(days)

    status_val = str(payload.get("status") or "pending")
    if status_val not in LEAVE_REQUEST_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    now = utc_now()
    doc = {
        "employeeId": str(payload.get("employeeId") or ""),
        "employeeName": str(payload.get("employeeName") or "").strip() or "Unknown",
        "departmentName": str(payload.get("departmentName") or ""),
        "jobTitle": str(payload.get("jobTitle") or ""),
        "leaveTypeId": leave_type_id,
        "leaveTypeName": leave_type_name or "Leave",
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "days": days,
        "status": status_val,
        "reason": str(payload.get("reason") or "") or None,
        "approverName": str(payload.get("approverName") or "") or None,
        "requestedAt": now,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": str(current_admin.get("_id")),
    }
    result = await db.leave_requests.insert_one(doc)
    doc["_id"] = result.inserted_id

    await sync_balance_for_request(db, doc, type_doc=type_doc)

    if status_val == "approved":
        await _upsert_calendar_event_from_request(db, doc, type_doc)

    return format_leave_request(doc)


@router.patch("/requests/{request_id}")
async def update_leave_request(
    request_id: str,
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    try:
        oid = parse_object_id(request_id, "request id")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = await db.leave_requests.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Leave request not found")

    previous_status = str(existing.get("status") or "pending")
    updates: Dict[str, Any] = {"updatedAt": utc_now()}
    if "status" in payload:
        status_val = str(payload["status"])
        if status_val not in LEAVE_REQUEST_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        updates["status"] = status_val
        if status_val == "approved" and not payload.get("approverName"):
            name = (
                current_admin.get("name")
                or f"{current_admin.get('firstName', '')} {current_admin.get('lastName', '')}".strip()
                or current_admin.get("email")
            )
            updates["approverName"] = name
    for field in (
        "employeeName",
        "departmentName",
        "leaveTypeName",
        "reason",
        "approverName",
        "jobTitle",
    ):
        if field in payload:
            updates[field] = payload[field]
    if "days" in payload:
        updates["days"] = float(payload["days"])
    if "startDate" in payload:
        updates["startDate"] = str(payload["startDate"])[:10]
    if "endDate" in payload:
        updates["endDate"] = str(payload["endDate"])[:10]

    await db.leave_requests.update_one({"_id": oid}, {"$set": updates})
    updated = await db.leave_requests.find_one({"_id": oid})

    type_doc = None
    if updated and updated.get("leaveTypeId"):
        try:
            type_doc = await db.leave_types.find_one(
                {"_id": ObjectId(str(updated["leaveTypeId"]))}
            )
        except Exception:
            type_doc = None

    # Recompute from requests so approve/reject/cancel stay in sync even when no
    # leave_balances row existed yet (UI used to fall back to type default 21/21).
    if updated and (
        "status" in updates
        or "days" in updates
        or "leaveTypeName" in updates
        or previous_status != str(updated.get("status") or "")
    ):
        await sync_balance_for_request(db, updated, type_doc=type_doc)

    if updated and updated.get("status") == "approved":
        await _upsert_calendar_event_from_request(db, updated, type_doc)
    elif updated and updated.get("status") in ("rejected", "cancelled"):
        await db.leave_calendar_events.delete_many({"requestId": str(oid)})

    return format_leave_request(updated)


async def _upsert_calendar_event_from_request(db, req: dict, type_doc: Optional[dict]) -> None:
    request_id = str(req["_id"])
    color = (type_doc or {}).get("color") or "#272156"
    event = {
        "requestId": request_id,
        "employeeId": str(req.get("employeeId") or ""),
        "employeeName": str(req.get("employeeName") or ""),
        "jobTitle": str(req.get("jobTitle") or ""),
        "departmentName": str(req.get("departmentName") or ""),
        "leaveTypeId": str(req.get("leaveTypeId") or "") or None,
        "leaveTypeName": str(req.get("leaveTypeName") or ""),
        "leaveTypeColor": str(color),
        "paid": bool((type_doc or {}).get("paid", True)) if type_doc else True,
        "startDate": str(req.get("startDate") or "")[:10],
        "endDate": str(req.get("endDate") or "")[:10],
        "days": float(req.get("days") or 0),
        "status": "approved",
        "updatedAt": utc_now(),
    }
    existing = await db.leave_calendar_events.find_one({"requestId": request_id})
    if existing:
        await db.leave_calendar_events.update_one({"_id": existing["_id"]}, {"$set": event})
    else:
        event["createdAt"] = utc_now()
        await db.leave_calendar_events.insert_one(event)


# ── Balances ───────────────────────────────────────────────────────────────


@router.get("/balances")
async def list_leave_balances(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    total = await db.leave_balances.count_documents({})
    items: List[Dict[str, Any]] = []
    cursor = (
        db.leave_balances.find({})
        .sort([("employeeName", 1), ("leaveTypeName", 1)])
        .skip(skip)
        .limit(limit)
    )
    async for doc in cursor:
        items.append(format_leave_balance(doc))
    return {"items": items, "total": total}


@router.post("/balances/recompute")
async def recompute_leave_balances(
    current_admin: dict = Depends(get_current_admin_user),
):
    """Backfill used/pending/remaining from leave_requests for all employees."""
    _require_leave_access(current_admin)
    db = _require_db()
    result = await recompute_all_leave_balances(db)
    return {
        "ok": True,
        "message": "Leave balances recomputed from requests.",
        **result,
    }


@router.post("/balances")
async def upsert_leave_balance(
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    now = utc_now()
    entitled = float(payload.get("entitled") or 0)
    used = float(payload.get("used") or 0)
    pending = float(payload.get("pending") or 0)
    remaining = payload.get("remaining")
    if remaining is None:
        remaining = entitled - used - pending

    doc = {
        "employeeId": str(payload.get("employeeId") or ""),
        "employeeName": str(payload.get("employeeName") or "").strip() or "Unknown",
        "departmentName": str(payload.get("departmentName") or ""),
        "leaveTypeId": str(payload.get("leaveTypeId") or ""),
        "leaveTypeName": str(payload.get("leaveTypeName") or "Annual leave"),
        "entitled": entitled,
        "used": used,
        "pending": pending,
        "remaining": float(remaining),
        "updatedAt": now,
    }

    balance_id = str(payload.get("id") or "").strip()
    if balance_id:
        try:
            oid = parse_object_id(balance_id, "balance id")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        await db.leave_balances.update_one({"_id": oid}, {"$set": doc}, upsert=False)
        saved = await db.leave_balances.find_one({"_id": oid})
        if not saved:
            raise HTTPException(status_code=404, detail="Balance not found")
        return format_leave_balance(saved)

    doc["createdAt"] = now
    result = await db.leave_balances.insert_one(doc)
    doc["_id"] = result.inserted_id
    return format_leave_balance(doc)


# ── Calendar ───────────────────────────────────────────────────────────────


@router.get("/calendar")
async def leave_calendar(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    return await build_leave_calendar_month(db, year, month)


# ── Types ──────────────────────────────────────────────────────────────────


@router.get("/types")
async def list_leave_types(current_admin: dict = Depends(get_current_admin_user)):
    _require_leave_access(current_admin)
    db = _require_db()
    await ensure_leave_types_seed(db)
    items: List[Dict[str, Any]] = []
    async for doc in db.leave_types.find({}).sort("name", 1):
        if not doc.get("_id"):
            continue
        items.append(format_leave_type(doc))
    return {"items": items, "total": len(items)}


@router.post("/types/ensure")
async def ensure_leave_types(current_admin: dict = Depends(get_current_admin_user)):
    """Insert missing Calamari leave types; never overwrites admin edits."""
    _require_leave_access(current_admin)
    db = _require_db()
    result = await ensure_leave_types_seed(db)
    return {
        "seeded": result["inserted"] > 0 or result.get("migratedAnnual", 0) > 0,
        "message": (
            f"Inserted {result['inserted']} leave type(s); "
            f"skipped {result.get('skipped', 0)}; "
            f"annual migration {result.get('migratedAnnual', 0)}."
        ),
        **result,
    }


@router.post("/types")
async def create_leave_type(
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    code = str(payload.get("code") or "annual").strip().lower()
    if code not in LEAVE_TYPE_CODES:
        raise HTTPException(status_code=400, detail="Invalid leave type code")

    now = utc_now()
    doc = {
        "name": name,
        "code": code,
        "color": str(payload.get("color") or "#272156"),
        "paid": bool(payload.get("paid", True)),
        "defaultAllowanceDays": int(payload.get("defaultAllowanceDays") or 0),
        "requiresApproval": bool(payload.get("requiresApproval", True)),
        "description": str(payload.get("description") or ""),
        "active": bool(payload.get("active", True)),
        "unlimited": bool(payload.get("unlimited", False)),
        "createdAt": now,
        "updatedAt": now,
        "createdBy": str(current_admin.get("_id")),
    }
    result = await db.leave_types.insert_one(doc)
    doc["_id"] = result.inserted_id
    return format_leave_type(doc)


@router.patch("/types/{type_id}")
async def update_leave_type(
    type_id: str,
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    """Update an existing leave type. Seed ensure never overwrites these fields."""
    _require_leave_access(current_admin)
    db = _require_db()
    raw_id = str(type_id or "").strip()
    if not raw_id:
        raise HTTPException(status_code=400, detail="leave type id is required")

    existing = None
    oid: Optional[ObjectId] = None
    try:
        oid = parse_object_id(raw_id, "leave type id")
        existing = await db.leave_types.find_one({"_id": oid})
    except ValueError:
        # Fallback when UI accidentally sends code (e.g. "annual") instead of ObjectId.
        code_key = raw_id.lower()
        if code_key in LEAVE_TYPE_CODES:
            existing = await db.leave_types.find_one({"code": code_key})
            if existing:
                oid = existing["_id"]
        if existing is None:
            raise HTTPException(status_code=400, detail="Invalid leave type id")

    if not existing or oid is None:
        raise HTTPException(status_code=404, detail="Leave type not found")

    updates: Dict[str, Any] = {"updatedAt": utc_now()}

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")
        updates["name"] = name

    if "code" in payload:
        code = str(payload.get("code") or "").strip().lower()
        if code not in LEAVE_TYPE_CODES:
            raise HTTPException(status_code=400, detail="Invalid leave type code")
        clash = await db.leave_types.find_one({"code": code, "_id": {"$ne": oid}})
        if clash:
            raise HTTPException(
                status_code=400, detail=f"Leave type code '{code}' already exists"
            )
        updates["code"] = code

    if "color" in payload:
        updates["color"] = str(payload.get("color") or "#272156")
    if "description" in payload:
        updates["description"] = str(payload.get("description") or "")
    if "paid" in payload:
        updates["paid"] = bool(payload["paid"])
    if "requiresApproval" in payload:
        updates["requiresApproval"] = bool(payload["requiresApproval"])
    if "active" in payload:
        updates["active"] = bool(payload["active"])
    if "unlimited" in payload:
        updates["unlimited"] = bool(payload["unlimited"])
    if "defaultAllowanceDays" in payload:
        try:
            days = int(payload["defaultAllowanceDays"])
        except (TypeError, ValueError) as e:
            raise HTTPException(
                status_code=400, detail="defaultAllowanceDays must be an integer"
            ) from e
        if days < 0:
            raise HTTPException(
                status_code=400, detail="defaultAllowanceDays cannot be negative"
            )
        updates["defaultAllowanceDays"] = days

    await db.leave_types.update_one({"_id": oid}, {"$set": updates})
    updated = await db.leave_types.find_one({"_id": oid})
    return format_leave_type(updated)


# ── Policies ───────────────────────────────────────────────────────────────


@router.get("/policies")
async def list_leave_policies(current_admin: dict = Depends(get_current_admin_user)):
    _require_leave_access(current_admin)
    db = _require_db()
    items: List[Dict[str, Any]] = []
    async for doc in db.leave_policies.find({}).sort("name", 1):
        items.append(format_leave_policy(doc))
    return {"items": items, "total": len(items)}


@router.get("/policies/{policy_id}")
async def get_leave_policy(
    policy_id: str,
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    try:
        oid = parse_object_id(policy_id, "policy id")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    doc = await db.leave_policies.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Policy not found")
    return format_leave_policy(doc)


@router.post("/policies")
async def create_leave_policy(
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    _require_leave_access(current_admin)
    db = _require_db()
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    now = utc_now()
    tags = payload.get("teamTags") or []
    if not isinstance(tags, list):
        tags = []
    doc = {
        "name": name,
        "region": str(payload.get("region") or ""),
        "teamTags": [str(t) for t in tags],
        "headcount": int(payload.get("headcount") or 0),
        "accrualRule": str(payload.get("accrualRule") or ""),
        "approvalFlow": str(payload.get("approvalFlow") or ""),
        "carryOverDays": int(payload.get("carryOverDays") or 0),
        "description": str(payload.get("description") or ""),
        "createdAt": now,
        "updatedAt": now,
        "createdBy": str(current_admin.get("_id")),
    }
    result = await db.leave_policies.insert_one(doc)
    doc["_id"] = result.inserted_id
    return format_leave_policy(doc)


# ── Seed (ops one-shot) ────────────────────────────────────────────────────


@router.post("/seed")
async def seed_leave_data(
    force: bool = Query(False),
    types_only: bool = Query(False, alias="typesOnly"),
    current_admin: dict = Depends(get_current_admin_user),
):
    """Seed leave data.

    - Default / typesOnly=true: idempotent Calamari leave types (no wipe).
    - force=true: wipe leave collections and insert demo policies/requests/balances.
    """
    _require_leave_access(current_admin)
    role = str(current_admin.get("role", "")).upper()
    if role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required to seed leave data")

    db = _require_db()
    now = utc_now()

    if types_only and not force:
        ensure_result = await ensure_leave_types_seed(db)
        return {
            "seeded": ensure_result["inserted"] > 0 or ensure_result.get("updated", 0) > 0,
            "message": (
                f"Leave types ensure: inserted {ensure_result['inserted']}, "
                f"updated {ensure_result.get('updated', 0)}."
            ),
            "counts": {
                "types": ensure_result["total"],
                "inserted": ensure_result["inserted"],
                "updated": ensure_result.get("updated", 0),
            },
        }

    type_count = await db.leave_types.count_documents({})
    policy_count = await db.leave_policies.count_documents({})
    request_count = await db.leave_requests.count_documents({})

    if not force and (type_count or policy_count or request_count):
        # Still upsert Calamari types without wiping
        ensure_result = await ensure_leave_types_seed(db)
        return {
            "seeded": ensure_result["inserted"] > 0 or ensure_result.get("updated", 0) > 0,
            "message": (
                "Leave collections already have data; upserted Calamari types only. "
                "Pass force=true to wipe and reseed demo data, or typesOnly=true."
            ),
            "counts": {
                "types": ensure_result["total"],
                "policies": policy_count,
                "requests": request_count,
                "typesInserted": ensure_result["inserted"],
                "typesUpdated": ensure_result.get("updated", 0),
            },
        }

    if force:
        await db.leave_types.delete_many({})
        await db.leave_policies.delete_many({})
        await db.leave_requests.delete_many({})
        await db.leave_balances.delete_many({})
        await db.leave_calendar_events.delete_many({})

    type_ids: Dict[str, ObjectId] = {}
    for t in SEED_TYPES:
        doc = {**t, "createdAt": now, "updatedAt": now}
        result = await db.leave_types.insert_one(doc)
        type_ids[t["code"]] = result.inserted_id

    for p in SEED_POLICIES:
        await db.leave_policies.insert_one({**p, "createdAt": now, "updatedAt": now})

    today = date.today()
    sample_people = [
        ("emp-007", "Peter Njoroge", "Client Success", "Account Manager"),
        ("emp-006", "Sarah Chen", "Operations", "Operations Lead"),
        ("emp-003", "Fatuma Hassan", "Engineering", "Backend Engineer"),
        ("emp-009", "Grace Wanjiku", "Client Success", "Client Success Lead"),
        ("emp-002", "Brian Otieno", "Engineering", "Senior Frontend Engineer"),
        ("emp-005", "Lucy Achieng", "People & Culture", "HR Generalist"),
        ("emp-001", "Amina Okonkwo", "Engineering", "Head of Engineering"),
        ("emp-008", "David Kimani", "Finance", "Finance Lead"),
    ]

    # Balances
    annual_id = type_ids.get("annual")
    annual_entitled = next(
        (t["defaultAllowanceDays"] for t in SEED_TYPES if t["code"] == "annual"),
        16,
    )
    for emp_id, name, dept, _title in sample_people:
        entitled = annual_entitled
        used = abs(hash(emp_id)) % 12
        pending = abs(hash(name)) % 3
        remaining = max(entitled - used - pending, 0)
        await db.leave_balances.insert_one(
            {
                "employeeId": emp_id,
                "employeeName": name,
                "departmentName": dept,
                "leaveTypeId": str(annual_id) if annual_id else "",
                "leaveTypeName": "Annual leave",
                "entitled": entitled,
                "used": used,
                "pending": pending,
                "remaining": remaining,
                "createdAt": now,
                "updatedAt": now,
            }
        )

    # Requests spanning current week / month
    week_start = today
    samples = [
        {
            "employeeId": "emp-007",
            "employeeName": "Peter Njoroge",
            "departmentName": "Client Success",
            "jobTitle": "Account Manager",
            "code": "annual",
            "start": (week_start - timedelta(days=2)).isoformat(),
            "end": (week_start + timedelta(days=2)).isoformat(),
            "status": "approved",
            "reason": "Family travel",
            "approverName": "Grace Wanjiku",
        },
        {
            "employeeId": "emp-006",
            "employeeName": "Sarah Chen",
            "departmentName": "Operations",
            "jobTitle": "Operations Lead",
            "code": "compassionate",
            "start": week_start.isoformat(),
            "end": (week_start + timedelta(days=2)).isoformat(),
            "status": "approved",
            "reason": None,
            "approverName": "James Mwangi",
        },
        {
            "employeeId": "emp-003",
            "employeeName": "Fatuma Hassan",
            "departmentName": "Engineering",
            "jobTitle": "Backend Engineer",
            "code": "sick",
            "start": today.isoformat(),
            "end": (today + timedelta(days=1)).isoformat(),
            "status": "pending",
            "reason": "Fever",
            "approverName": None,
        },
        {
            "employeeId": "emp-005",
            "employeeName": "Lucy Achieng",
            "departmentName": "People & Culture",
            "jobTitle": "HR Generalist",
            "code": "annual",
            "start": (today + timedelta(days=12)).isoformat(),
            "end": (today + timedelta(days=16)).isoformat(),
            "status": "pending",
            "reason": "Wedding travel",
            "approverName": None,
        },
        {
            "employeeId": "emp-002",
            "employeeName": "Brian Otieno",
            "departmentName": "Engineering",
            "jobTitle": "Senior Frontend Engineer",
            "code": "study",
            "start": (today + timedelta(days=5)).isoformat(),
            "end": (today + timedelta(days=6)).isoformat(),
            "status": "approved",
            "reason": "AWS exam",
            "approverName": "Amina Okonkwo",
        },
        {
            "employeeId": "emp-010",
            "employeeName": "Kevin Mutua",
            "departmentName": "Engineering",
            "jobTitle": "Platform Engineer",
            "code": "annual",
            "start": (today - timedelta(days=10)).isoformat(),
            "end": (today - timedelta(days=6)).isoformat(),
            "status": "rejected",
            "reason": "Release week conflict",
            "approverName": "Amina Okonkwo",
        },
    ]

    for s in samples:
        tid = type_ids.get(s["code"])
        type_name = next((t["name"] for t in SEED_TYPES if t["code"] == s["code"]), "Leave")
        start_d = parse_iso_date(s["start"])
        end_d = parse_iso_date(s["end"])
        req_doc = {
            "employeeId": s["employeeId"],
            "employeeName": s["employeeName"],
            "departmentName": s["departmentName"],
            "jobTitle": s["jobTitle"],
            "leaveTypeId": str(tid) if tid else "",
            "leaveTypeName": type_name,
            "startDate": start_d.isoformat(),
            "endDate": end_d.isoformat(),
            "days": inclusive_days(start_d, end_d),
            "status": s["status"],
            "reason": s["reason"],
            "approverName": s["approverName"],
            "requestedAt": now - timedelta(days=5),
            "createdAt": now,
            "updatedAt": now,
        }
        result = await db.leave_requests.insert_one(req_doc)
        req_doc["_id"] = result.inserted_id
        if s["status"] == "approved":
            type_doc = {
                "color": next(
                    (t["color"] for t in SEED_TYPES if t["code"] == s["code"]),
                    "#272156",
                )
            }
            await _upsert_calendar_event_from_request(db, req_doc, type_doc)

    return {
        "seeded": True,
        "message": "Leave demo data inserted into MongoDB.",
        "counts": {
            "types": await db.leave_types.count_documents({}),
            "policies": await db.leave_policies.count_documents({}),
            "requests": await db.leave_requests.count_documents({}),
            "balances": await db.leave_balances.count_documents({}),
            "calendarEvents": await db.leave_calendar_events.count_documents({}),
        },
    }
