"""Leave module helpers — Mongo document shaping and overview aggregates."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId

LEAVE_REQUEST_STATUSES = frozenset({"pending", "approved", "rejected", "cancelled"})

LEAVE_TYPE_CODES = frozenset(
    {
        "annual",
        "sick",
        "unpaid",
        "maternity",
        "paternity",
        "compassionate",
        "study",
        "birth_holiday",
        "toil",
    }
)

COLLECTIONS = (
    "leave_types",
    "leave_policies",
    "leave_requests",
    "leave_balances",
    "leave_calendar_events",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_object_id(value: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise ValueError(f"Invalid {label}") from exc


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _date_str(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value.strip()[:10]
    return None


def format_leave_type(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "name": str(doc.get("name") or ""),
        "code": str(doc.get("code") or "annual"),
        "color": str(doc.get("color") or "#272156"),
        "paid": bool(doc.get("paid", True)),
        "defaultAllowanceDays": int(doc.get("defaultAllowanceDays") or 0),
        "requiresApproval": bool(doc.get("requiresApproval", True)),
        "description": str(doc.get("description") or ""),
        "active": bool(doc.get("active", True)),
        "unlimited": bool(doc.get("unlimited", False)),
        "createdAt": _iso(doc.get("createdAt")),
        "updatedAt": _iso(doc.get("updatedAt")),
    }


def format_leave_policy(doc: dict[str, Any]) -> dict[str, Any]:
    tags = doc.get("teamTags") or []
    if not isinstance(tags, list):
        tags = []
    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "name": str(doc.get("name") or ""),
        "region": str(doc.get("region") or ""),
        "teamTags": [str(t) for t in tags],
        "headcount": int(doc.get("headcount") or 0),
        "updatedAt": _iso(doc.get("updatedAt")) or _iso(doc.get("createdAt")) or "",
        "accrualRule": str(doc.get("accrualRule") or ""),
        "approvalFlow": str(doc.get("approvalFlow") or ""),
        "carryOverDays": int(doc.get("carryOverDays") or 0),
        "description": str(doc.get("description") or ""),
        "createdAt": _iso(doc.get("createdAt")),
    }


def format_leave_request(doc: dict[str, Any]) -> dict[str, Any]:
    start_period = normalize_start_period(str(doc.get("startPeriod") or "morning"))
    end_period = normalize_end_period(str(doc.get("endPeriod") or "end_of_day"))
    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "employeeId": str(doc.get("employeeId") or ""),
        "employeeName": str(doc.get("employeeName") or ""),
        "departmentName": str(doc.get("departmentName") or ""),
        "leaveTypeId": str(doc.get("leaveTypeId") or ""),
        "leaveTypeName": str(doc.get("leaveTypeName") or ""),
        "startDate": _date_str(doc.get("startDate")) or "",
        "endDate": _date_str(doc.get("endDate")) or "",
        "startPeriod": start_period,
        "endPeriod": end_period,
        "days": float(doc.get("days") or 0),
        "status": str(doc.get("status") or "pending"),
        "reason": str(doc.get("reason") or "") or None,
        "substituteEmployeeId": str(doc.get("substituteEmployeeId") or "") or None,
        "substituteName": str(doc.get("substituteName") or "") or None,
        "requestedAt": _iso(doc.get("requestedAt")) or _iso(doc.get("createdAt")) or "",
        "approverName": str(doc.get("approverName") or "") or None,
        "createdAt": _iso(doc.get("createdAt")),
        "updatedAt": _iso(doc.get("updatedAt")),
    }


def format_leave_balance(doc: dict[str, Any]) -> dict[str, Any]:
    entitled = float(doc.get("entitled") or 0)
    used = float(doc.get("used") or 0)
    pending = float(doc.get("pending") or 0)
    remaining = doc.get("remaining")
    if remaining is None:
        remaining = entitled - used - pending
    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "employeeId": str(doc.get("employeeId") or ""),
        "employeeName": str(doc.get("employeeName") or ""),
        "departmentName": str(doc.get("departmentName") or ""),
        "leaveTypeId": str(doc.get("leaveTypeId") or ""),
        "leaveTypeName": str(doc.get("leaveTypeName") or ""),
        "entitled": entitled,
        "used": used,
        "pending": pending,
        "remaining": float(remaining),
        "updatedAt": _iso(doc.get("updatedAt")),
    }


def format_calendar_event(doc: dict[str, Any]) -> dict[str, Any]:
    paid_raw = doc.get("paid")
    paid = True if paid_raw is None else bool(paid_raw)
    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "employeeId": str(doc.get("employeeId") or ""),
        "employeeName": str(doc.get("employeeName") or ""),
        "jobTitle": str(doc.get("jobTitle") or ""),
        "departmentName": str(doc.get("departmentName") or ""),
        "leaveTypeId": str(doc.get("leaveTypeId") or "") or None,
        "leaveTypeName": str(doc.get("leaveTypeName") or ""),
        "leaveTypeColor": str(doc.get("leaveTypeColor") or "#272156"),
        "paid": paid,
        "startDate": _date_str(doc.get("startDate")) or "",
        "endDate": _date_str(doc.get("endDate")) or "",
        "days": float(doc.get("days") or 0),
        "requestId": str(doc.get("requestId") or "") or None,
        "status": str(doc.get("status") or "approved"),
    }


async def build_leave_calendar_month(
    db: Any, year: int, month: int
) -> dict[str, Any]:
    """Team leave calendar for a month (approved absences)."""
    start, end = month_bounds(year, month)

    type_by_id: dict[str, dict[str, Any]] = {}
    type_by_name: dict[str, dict[str, Any]] = {}
    async for tdoc in db.leave_types.find({}):
        tid = str(tdoc.get("_id") or "")
        tname = str(tdoc.get("name") or "").strip().lower()
        if tid:
            type_by_id[tid] = tdoc
        if tname:
            type_by_name[tname] = tdoc

    def enrich(event: dict[str, Any]) -> dict[str, Any]:
        type_doc = None
        leave_type_id = str(event.get("leaveTypeId") or "")
        if leave_type_id and leave_type_id in type_by_id:
            type_doc = type_by_id[leave_type_id]
        else:
            type_doc = type_by_name.get(
                str(event.get("leaveTypeName") or "").strip().lower()
            )
        if type_doc:
            if not event.get("leaveTypeId"):
                event["leaveTypeId"] = str(type_doc.get("_id") or "") or None
            event["paid"] = bool(type_doc.get("paid", True))
            if not event.get("leaveTypeColor") or event["leaveTypeColor"] == "#272156":
                event["leaveTypeColor"] = str(
                    type_doc.get("color") or event.get("leaveTypeColor") or "#272156"
                )
        elif event.get("paid") is None:
            event["paid"] = True
        return event

    events: list[dict[str, Any]] = []
    async for doc in db.leave_calendar_events.find(
        {"startDate": {"$lte": end}, "endDate": {"$gte": start}, "status": "approved"}
    ).sort("startDate", 1):
        events.append(enrich(format_calendar_event(doc)))

    if not events:
        async for req in db.leave_requests.find(
            {
                "status": "approved",
                "startDate": {"$lte": end},
                "endDate": {"$gte": start},
            }
        ).sort("startDate", 1):
            type_doc = None
            leave_type_id = str(req.get("leaveTypeId") or "")
            if leave_type_id and leave_type_id in type_by_id:
                type_doc = type_by_id[leave_type_id]
            else:
                type_doc = type_by_name.get(
                    str(req.get("leaveTypeName") or "").strip().lower()
                )
            events.append(
                enrich(
                    {
                        "id": str(req["_id"]),
                        "employeeId": str(req.get("employeeId") or ""),
                        "employeeName": str(req.get("employeeName") or ""),
                        "jobTitle": str(req.get("jobTitle") or ""),
                        "departmentName": str(req.get("departmentName") or ""),
                        "leaveTypeId": leave_type_id or None,
                        "leaveTypeName": str(req.get("leaveTypeName") or ""),
                        "leaveTypeColor": str(
                            (type_doc or {}).get("color") or "#272156"
                        ),
                        "paid": bool((type_doc or {}).get("paid", True))
                        if type_doc
                        else None,
                        "startDate": str(req.get("startDate") or "")[:10],
                        "endDate": str(req.get("endDate") or "")[:10],
                        "days": float(req.get("days") or 0),
                        "requestId": str(req["_id"]),
                        "status": "approved",
                    }
                )
            )

    last_day = int(end.split("-")[2])
    days_out: list[dict[str, Any]] = []
    for day in range(1, last_day + 1):
        d_str = f"{year:04d}-{month:02d}-{day:02d}"
        day_entries = [
            e for e in events if e["startDate"] <= d_str <= e["endDate"]
        ]
        days_out.append({"date": d_str, "entries": day_entries})

    return {"year": year, "month": month, "days": days_out, "events": events}


def month_bounds(year: int, month: int) -> tuple[str, str]:
    last = monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{last:02d}"


def parse_iso_date(value: str) -> date:
    return date.fromisoformat(value.strip()[:10])


def inclusive_days(start: date, end: date) -> int:
    return max((end - start).days + 1, 0)


LEAVE_START_PERIODS = frozenset({"morning", "afternoon"})
LEAVE_END_PERIODS = frozenset({"end_of_day", "morning", "afternoon"})


def normalize_start_period(value: str | None) -> str:
    raw = (value or "morning").strip().lower().replace(" ", "_").replace("-", "_")
    if raw in {"am", "first_half", "firsthalf"}:
        raw = "morning"
    if raw in {"pm", "second_half", "secondhalf"}:
        raw = "afternoon"
    return raw if raw in LEAVE_START_PERIODS else "morning"


def normalize_end_period(value: str | None) -> str:
    raw = (value or "end_of_day").strip().lower().replace(" ", "_").replace("-", "_")
    if raw in {"eod", "endofday", "full_day", "fullday"}:
        raw = "end_of_day"
    if raw in {"am", "first_half", "firsthalf"}:
        raw = "morning"
    if raw in {"pm", "second_half", "secondhalf"}:
        raw = "afternoon"
    return raw if raw in LEAVE_END_PERIODS else "end_of_day"


def leave_days_with_periods(
    start: date,
    end: date,
    start_period: str | None = "morning",
    end_period: str | None = "end_of_day",
) -> float:
    """Inclusive calendar days adjusted for morning/afternoon / end-of-day."""
    base = float(inclusive_days(start, end))
    if base <= 0:
        return 0.0

    start_p = normalize_start_period(start_period)
    end_p = normalize_end_period(end_period)

    if start == end:
        if start_p == "afternoon":
            return 0.5
        if end_p == "morning":
            return 0.5
        return 1.0

    days = base
    if start_p == "afternoon":
        days -= 0.5
    if end_p == "morning":
        days -= 0.5
    return max(days, 0.5)


async def find_leave_balance(
    db,
    *,
    employee_id: str,
    leave_type_id: str = "",
    leave_type_name: str = "",
) -> Optional[dict[str, Any]]:
    """Locate a balance row by leaveTypeId, then by leaveTypeName (case-insensitive)."""
    employee_id = str(employee_id or "").strip()
    leave_type_id = str(leave_type_id or "").strip()
    leave_type_name = str(leave_type_name or "").strip()
    if not employee_id:
        return None

    if leave_type_id:
        doc = await db.leave_balances.find_one(
            {"employeeId": employee_id, "leaveTypeId": leave_type_id}
        )
        if doc:
            return doc

    if leave_type_name:
        doc = await db.leave_balances.find_one(
            {"employeeId": employee_id, "leaveTypeName": leave_type_name}
        )
        if doc:
            return doc
        # Case-insensitive name fallback (legacy / seeded name drift)
        async for row in db.leave_balances.find({"employeeId": employee_id}):
            if str(row.get("leaveTypeName") or "").strip().lower() == leave_type_name.lower():
                return row
    return None


async def _resolve_leave_type(
    db,
    *,
    leave_type_id: str = "",
    leave_type_name: str = "",
    type_doc: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    if type_doc:
        return type_doc
    leave_type_id = str(leave_type_id or "").strip()
    leave_type_name = str(leave_type_name or "").strip()
    if leave_type_id:
        try:
            found = await db.leave_types.find_one({"_id": ObjectId(leave_type_id)})
            if found:
                return found
        except Exception:
            pass
    if leave_type_name:
        found = await db.leave_types.find_one({"name": leave_type_name})
        if found:
            return found
        async for row in db.leave_types.find({}):
            if str(row.get("name") or "").strip().lower() == leave_type_name.lower():
                return row
    return None


def _default_entitled_days(
    *,
    type_doc: Optional[dict[str, Any]],
    employee: Optional[dict[str, Any]],
) -> float:
    entitled = float((type_doc or {}).get("defaultAllowanceDays") or 0)
    roster = float((employee or {}).get("leaveBalanceDays") or 0)
    code = str((type_doc or {}).get("code") or "").lower()
    if roster > 0 and code in {"annual", ""}:
        entitled = roster
    return entitled


async def recompute_leave_balance(
    db,
    *,
    employee_id: str,
    leave_type_id: str = "",
    leave_type_name: str = "",
    employee_name: str = "",
    department_name: str = "",
    employee: Optional[dict[str, Any]] = None,
    type_doc: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Recompute used/pending/remaining from leave_requests (source of truth).

    Creates a balance row when missing (unless the type is unlimited or has no
    entitlement and no request activity). Rejected/cancelled requests do not
    consume days.
    """
    employee_id = str(employee_id or "").strip()
    if not employee_id:
        return None

    type_doc = await _resolve_leave_type(
        db,
        leave_type_id=leave_type_id,
        leave_type_name=leave_type_name,
        type_doc=type_doc,
    )
    if type_doc and type_doc.get("unlimited"):
        return None

    if type_doc:
        leave_type_id = str(type_doc["_id"])
        leave_type_name = str(type_doc.get("name") or leave_type_name or "Leave")
    else:
        leave_type_id = str(leave_type_id or "").strip()
        leave_type_name = str(leave_type_name or "").strip() or "Leave"

    req_query: dict[str, Any] = {"employeeId": employee_id}
    or_clauses: list[dict[str, Any]] = []
    if leave_type_id:
        or_clauses.append({"leaveTypeId": leave_type_id})
    if leave_type_name:
        or_clauses.append({"leaveTypeName": leave_type_name})
    if or_clauses:
        req_query["$or"] = or_clauses

    pending = 0.0
    used = 0.0
    async for req in db.leave_requests.find(req_query):
        days = float(req.get("days") or 0)
        if days <= 0:
            continue
        status = str(req.get("status") or "")
        if status == "pending":
            pending += days
        elif status == "approved":
            used += days

    balance = await find_leave_balance(
        db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        leave_type_name=leave_type_name,
    )

    if balance is not None:
        entitled = float(balance.get("entitled") or 0)
        if entitled <= 0:
            entitled = _default_entitled_days(type_doc=type_doc, employee=employee)
    else:
        entitled = _default_entitled_days(type_doc=type_doc, employee=employee)
        if entitled <= 0 and pending <= 0 and used <= 0:
            return None

    remaining = entitled - used - pending
    now = utc_now()
    fields: dict[str, Any] = {
        "employeeId": employee_id,
        "employeeName": (
            str(employee_name or "").strip()
            or str((balance or {}).get("employeeName") or "")
            or (
                f"{(employee or {}).get('firstName', '')} {(employee or {}).get('lastName', '')}".strip()
                if employee
                else ""
            )
        ),
        "departmentName": (
            str(department_name or "").strip()
            or str((balance or {}).get("departmentName") or "")
            or str((employee or {}).get("departmentName") or "")
        ),
        "leaveTypeId": leave_type_id,
        "leaveTypeName": leave_type_name,
        "entitled": entitled,
        "used": used,
        "pending": pending,
        "remaining": remaining,
        "updatedAt": now,
    }

    if balance is not None:
        await db.leave_balances.update_one({"_id": balance["_id"]}, {"$set": fields})
        return await db.leave_balances.find_one({"_id": balance["_id"]})

    fields["createdAt"] = now
    result = await db.leave_balances.insert_one(fields)
    fields["_id"] = result.inserted_id
    return fields


async def sync_balance_for_request(
    db,
    req: dict[str, Any],
    *,
    employee: Optional[dict[str, Any]] = None,
    type_doc: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Recompute the balance row that owns this leave request."""
    return await recompute_leave_balance(
        db,
        employee_id=str(req.get("employeeId") or ""),
        leave_type_id=str(req.get("leaveTypeId") or ""),
        leave_type_name=str(req.get("leaveTypeName") or ""),
        employee_name=str(req.get("employeeName") or ""),
        department_name=str(req.get("departmentName") or ""),
        employee=employee,
        type_doc=type_doc,
    )


async def recompute_employee_leave_balances(
    db,
    employee_id: str,
    *,
    employee: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """Ensure/recompute balance rows for an employee from requests + active types."""
    employee_id = str(employee_id or "").strip()
    if not employee_id:
        return []

    if employee is None:
        try:
            employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
        except Exception:
            employee = None

    keys: dict[tuple[str, str], dict[str, str]] = {}

    async for req in db.leave_requests.find({"employeeId": employee_id}):
        tid = str(req.get("leaveTypeId") or "").strip()
        tname = str(req.get("leaveTypeName") or "").strip()
        key = (tid, tname.lower())
        keys[key] = {"leaveTypeId": tid, "leaveTypeName": tname}

    async for bal in db.leave_balances.find({"employeeId": employee_id}):
        tid = str(bal.get("leaveTypeId") or "").strip()
        tname = str(bal.get("leaveTypeName") or "").strip()
        key = (tid, tname.lower())
        keys.setdefault(key, {"leaveTypeId": tid, "leaveTypeName": tname})

    async for type_doc in db.leave_types.find({"active": {"$ne": False}}):
        if type_doc.get("unlimited"):
            continue
        allowance = float(type_doc.get("defaultAllowanceDays") or 0)
        code = str(type_doc.get("code") or "").lower()
        roster = float((employee or {}).get("leaveBalanceDays") or 0)
        if allowance <= 0 and not (roster > 0 and code in {"annual", ""}):
            continue
        tid = str(type_doc["_id"])
        tname = str(type_doc.get("name") or "")
        key = (tid, tname.lower())
        keys.setdefault(key, {"leaveTypeId": tid, "leaveTypeName": tname})

    out: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for meta in keys.values():
        type_doc = await _resolve_leave_type(
            db,
            leave_type_id=meta["leaveTypeId"],
            leave_type_name=meta["leaveTypeName"],
        )
        saved = await recompute_leave_balance(
            db,
            employee_id=employee_id,
            leave_type_id=meta["leaveTypeId"],
            leave_type_name=meta["leaveTypeName"],
            employee=employee,
            type_doc=type_doc,
        )
        if saved and str(saved.get("_id")) not in seen_ids:
            seen_ids.add(str(saved["_id"]))
            out.append(saved)
    return out


async def recompute_all_leave_balances(db) -> dict[str, int]:
    """Backfill used/pending/remaining for every employee with leave activity."""
    employee_ids: set[str] = set()
    async for req in db.leave_requests.find({}, {"employeeId": 1}):
        eid = str(req.get("employeeId") or "").strip()
        if eid:
            employee_ids.add(eid)
    async for bal in db.leave_balances.find({}, {"employeeId": 1}):
        eid = str(bal.get("employeeId") or "").strip()
        if eid:
            employee_ids.add(eid)

    updated = 0
    for eid in employee_ids:
        rows = await recompute_employee_leave_balances(db, eid)
        updated += len(rows)
    return {"employees": len(employee_ids), "balances": updated}


async def build_overview(db) -> dict[str, Any]:
    today = date.today()
    today_str = today.isoformat()
    month_start = today.replace(day=1).isoformat()
    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)
    month_end = (next_month - timedelta(days=1)).isoformat()

    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()

    on_leave_today = await db.leave_requests.count_documents(
        {
            "status": "approved",
            "startDate": {"$lte": today_str},
            "endDate": {"$gte": today_str},
        }
    )
    # Also count calendar events if requests empty but events exist
    if on_leave_today == 0:
        on_leave_today = await db.leave_calendar_events.count_documents(
            {
                "status": "approved",
                "startDate": {"$lte": today_str},
                "endDate": {"$gte": today_str},
            }
        )

    pending_requests = await db.leave_requests.count_documents({"status": "pending"})
    approved_this_month = await db.leave_requests.count_documents(
        {
            "status": "approved",
            "startDate": {"$lte": month_end},
            "endDate": {"$gte": month_start},
        }
    )

    balance_cursor = db.leave_balances.find({})
    remaining_vals: list[float] = []
    async for bal in balance_cursor:
        remaining = bal.get("remaining")
        if remaining is None:
            remaining = float(bal.get("entitled") or 0) - float(bal.get("used") or 0) - float(
                bal.get("pending") or 0
            )
        remaining_vals.append(float(remaining))
    avg_balance = round(sum(remaining_vals) / len(remaining_vals), 1) if remaining_vals else 0.0

    type_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": "$leaveTypeName", "days": {"$sum": "$days"}}},
        {"$sort": {"days": -1}},
        {"$limit": 1},
    ]
    top_usage = "—"
    async for row in db.leave_requests.aggregate(type_pipeline):
        top_usage = str(row.get("_id") or "—")

    # 12-month usage trend ending this month
    trend: list[dict[str, Any]] = []
    for offset in range(11, -1, -1):
        y = today.year
        m = today.month - offset
        while m <= 0:
            m += 12
            y -= 1
        start, end = month_bounds(y, m)
        total_days = 0.0
        async for req in db.leave_requests.find(
            {
                "status": "approved",
                "startDate": {"$lte": end},
                "endDate": {"$gte": start},
            }
        ):
            total_days += float(req.get("days") or 0)
        label = date(y, m, 1).strftime("%b")
        trend.append({"label": label, "days": round(total_days, 1)})

    # Sparklines: last 7 days counts
    spark_on: list[int] = []
    spark_pending: list[int] = []
    spark_approved: list[int] = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        spark_on.append(
            await db.leave_requests.count_documents(
                {
                    "status": "approved",
                    "startDate": {"$lte": d_str},
                    "endDate": {"$gte": d_str},
                }
            )
        )
        spark_pending.append(
            await db.leave_requests.count_documents(
                {
                    "status": "pending",
                    "requestedAt": {
                        "$gte": datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                        "$lt": datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
                        + timedelta(days=1),
                    },
                }
            )
        )
        spark_approved.append(
            await db.leave_requests.count_documents(
                {
                    "status": "approved",
                    "updatedAt": {
                        "$gte": datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                        "$lt": datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
                        + timedelta(days=1),
                    },
                }
            )
        )

    # Avg balance sparkline: use current avg repeated if no history collection
    spark_avg = [avg_balance] * 7

    on_leave_week: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    async for ev in db.leave_calendar_events.find(
        {
            "status": "approved",
            "startDate": {"$lte": week_end_str},
            "endDate": {"$gte": week_start_str},
        }
    ).sort("startDate", 1):
        formatted = format_calendar_event(ev)
        if formatted["id"] not in seen_ids:
            seen_ids.add(formatted["id"])
            on_leave_week.append(formatted)

    if not on_leave_week:
        async for req in db.leave_requests.find(
            {
                "status": "approved",
                "startDate": {"$lte": week_end_str},
                "endDate": {"$gte": week_start_str},
            }
        ).sort("startDate", 1):
            type_doc = None
            if req.get("leaveTypeId"):
                try:
                    type_doc = await db.leave_types.find_one(
                        {"_id": ObjectId(str(req["leaveTypeId"]))}
                    )
                except Exception:
                    type_doc = await db.leave_types.find_one({"name": req.get("leaveTypeName")})
            on_leave_week.append(
                {
                    "id": str(req["_id"]),
                    "employeeId": str(req.get("employeeId") or ""),
                    "employeeName": str(req.get("employeeName") or ""),
                    "jobTitle": str(req.get("jobTitle") or ""),
                    "departmentName": str(req.get("departmentName") or ""),
                    "leaveTypeName": str(req.get("leaveTypeName") or ""),
                    "leaveTypeColor": str(
                        (type_doc or {}).get("color") or "#272156"
                    ),
                    "startDate": _date_str(req.get("startDate")) or "",
                    "endDate": _date_str(req.get("endDate")) or "",
                    "days": float(req.get("days") or 0),
                }
            )

    return {
        "kpis": {
            "onLeaveToday": on_leave_today,
            "pendingRequests": pending_requests,
            "approvedThisMonth": approved_this_month,
            "avgBalanceDays": avg_balance,
            "topUsageType": top_usage,
            "sparklines": {
                "onLeaveToday": spark_on,
                "pendingRequests": spark_pending,
                "approvedThisMonth": spark_approved,
                "avgBalanceDays": spark_avg,
            },
        },
        "usageTrend": trend,
        "onLeaveThisWeek": on_leave_week,
    }


# Calamari Entitlement reference — insert-if-missing by code (fallback: name).
# Existing docs are never overwritten by ensure; admins edit via PATCH.
SEED_TYPES = [
    {
        "name": "Annual leave",
        "code": "annual",
        "color": "#1e3a8a",
        "paid": True,
        "defaultAllowanceDays": 21,
        "requiresApproval": True,
        "unlimited": False,
        "description": "Paid annual vacation (21 days default entitlement).",
        "active": True,
    },
    {
        "name": "Birth-Holiday",
        "code": "birth_holiday",
        "color": "#16a34a",
        "paid": True,
        "defaultAllowanceDays": 1,
        "requiresApproval": True,
        "unlimited": False,
        "description": "Paid day off for your birthday.",
        "active": True,
    },
    {
        "name": "Compassionate Leave",
        "code": "compassionate",
        "color": "#5b21b6",
        "paid": True,
        "defaultAllowanceDays": 1,
        "requiresApproval": True,
        "unlimited": False,
        "description": "Bereavement or family emergency.",
        "active": True,
    },
    {
        "name": "Paternity Leave",
        "code": "paternity",
        "color": "#db2777",
        "paid": True,
        "defaultAllowanceDays": 15,
        "requiresApproval": True,
        "unlimited": False,
        "description": "Paid leave for new fathers.",
        "active": True,
    },
    {
        "name": "Sick leave",
        "code": "sick",
        "color": "#059669",
        "paid": True,
        "defaultAllowanceDays": 0,
        "requiresApproval": False,
        "unlimited": True,
        "description": "Illness or medical appointments. No fixed annual cap.",
        "active": True,
    },
    {
        "name": "Study Leave",
        "code": "study",
        "color": "#7c3aed",
        "paid": True,
        "defaultAllowanceDays": 4,
        "requiresApproval": True,
        "unlimited": False,
        "description": "Exams and approved professional courses.",
        "active": True,
    },
    {
        "name": "Time off In Lieu (TOIL)",
        "code": "toil",
        "color": "#64748b",
        "paid": True,
        "defaultAllowanceDays": 0,
        "requiresApproval": True,
        "unlimited": False,
        "description": "Compensatory time off for overtime. Entitlement is flexible.",
        "active": True,
    },
]


async def migrate_annual_allowance_16_to_21(db) -> int:
    """One-time bump: Annual leave still at the old 16-day default → 21.

    Skips docs already customized away from 16 so admin edits stay intact.
    """
    now = utc_now()
    result = await db.leave_types.update_one(
        {
            "code": "annual",
            "defaultAllowanceDays": 16,
        },
        {
            "$set": {
                "defaultAllowanceDays": 21,
                "description": "Paid annual vacation (21 days default entitlement).",
                "updatedAt": now,
            }
        },
    )
    return int(result.modified_count or 0)


async def ensure_leave_types_seed(db) -> dict[str, int]:
    """Insert missing Calamari leave types by code (fallback: name). Idempotent.

    Never overwrites existing type fields — admin edits via PATCH persist.
    Also runs the one-time annual 16→21 allowance migration when still at 16.
    """
    now = utc_now()
    inserted = 0
    skipped = 0
    for t in SEED_TYPES:
        existing = await db.leave_types.find_one({"code": t["code"]})
        if not existing:
            existing = await db.leave_types.find_one({"name": t["name"]})
        if existing:
            skipped += 1
            continue
        fields = {
            "name": t["name"],
            "code": t["code"],
            "color": t["color"],
            "paid": t["paid"],
            "defaultAllowanceDays": t["defaultAllowanceDays"],
            "requiresApproval": t["requiresApproval"],
            "description": t["description"],
            "active": True,
            "unlimited": bool(t.get("unlimited", False)),
            "createdAt": now,
            "updatedAt": now,
        }
        await db.leave_types.insert_one(fields)
        inserted += 1

    migrated = await migrate_annual_allowance_16_to_21(db)
    return {
        "inserted": inserted,
        "updated": migrated,
        "skipped": skipped,
        "migratedAnnual": migrated,
        "total": await db.leave_types.count_documents({}),
    }

SEED_POLICIES = [
    {
        "name": "Kenya HQ standard",
        "region": "Kenya",
        "teamTags": ["All staff", "Nairobi"],
        "headcount": 48,
        "accrualRule": "1.75 days/month annual · 10 sick/year",
        "approvalFlow": "Manager → People Ops",
        "carryOverDays": 5,
        "description": "Default policy for Nairobi HQ and Kenya-based full-time staff.",
    },
    {
        "name": "Engineering flex",
        "region": "Kenya",
        "teamTags": ["Engineering"],
        "headcount": 18,
        "accrualRule": "21 annual + 2 floating holidays",
        "approvalFlow": "Team lead → Head of Engineering",
        "carryOverDays": 7,
        "description": "Extra floating days for engineering; blackout weeks around releases.",
    },
    {
        "name": "East Africa remote",
        "region": "East Africa",
        "teamTags": ["Remote", "Mombasa", "Kampala"],
        "headcount": 12,
        "accrualRule": "Prorated annual from start date",
        "approvalFlow": "Manager only",
        "carryOverDays": 3,
        "description": "Remote and satellite-office staff across East Africa.",
    },
    {
        "name": "Contractors (unpaid)",
        "region": "Global",
        "teamTags": ["Contract", "Intern"],
        "headcount": 6,
        "accrualRule": "Unpaid only · no accrual",
        "approvalFlow": "Hiring manager → Finance",
        "carryOverDays": 0,
        "description": "Contractors and interns request unpaid time off only.",
    },
    {
        "name": "Parental leave overlay",
        "region": "Kenya",
        "teamTags": ["All staff"],
        "headcount": 48,
        "accrualRule": "90 maternity / 14 paternity (statutory)",
        "approvalFlow": "Manager → People Ops → Payroll",
        "carryOverDays": 0,
        "description": "Overlay on Kenya HQ for maternity and paternity entitlements.",
    },
    {
        "name": "Operations shift cover",
        "region": "Kenya",
        "teamTags": ["Operations"],
        "headcount": 8,
        "accrualRule": "21 annual · max 2 concurrent on leave",
        "approvalFlow": "Ops lead → Cover confirmation",
        "carryOverDays": 5,
        "description": "Caps concurrent leave so facilities coverage stays staffed.",
    },
]
