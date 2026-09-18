"""Welcome / invite emails for newly created HR employees."""

from __future__ import annotations

import asyncio
import logging
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId

from app.auth import get_password_hash
from app.config import settings
from app.database import get_database, is_connected
from app.lib.email import send_generic_email_logged
from app.lib.email_brand import (
    BQI_BRAND,
    branded_email_header_html,
    escape_email_text,
    primary_button_html,
    wrap_branded_email,
)
from app.lib.email_transport import is_email_configured
from app.lib.roles import is_admin_role
from app.lib.runtime_environment import get_frontend_url

logger = logging.getLogger(__name__)

# Africa/Nairobi (no DST). Fixed offset so Windows works without tzdata.
INVITE_TZ = timezone(timedelta(hours=3))
TICK_SECONDS = 60
PASSWORD_SETUP_TOKEN_DAYS = 7

NAVY = BQI_BRAND["navy"]
CYAN = BQI_BRAND["cyan"]
LIGHT_TEXT = "#F1F5F9"
MUTED_LIGHT = "#CBD5E1"


def _normalize_prefs(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return dict(raw)


def should_send_employee_invite(prefs: dict[str, Any]) -> bool:
    """True when an invite should send immediately on create (timing=now)."""
    method = str(prefs.get("method") or "").strip().lower()
    timing = str(prefs.get("timing") or "now").strip().lower()
    send_flag = prefs.get("sendInvite")

    if method in ("none", "manual"):
        return False
    if timing in ("later", "on_start"):
        return False
    if method == "email":
        # Explicit uncheck opts out; missing flag still sends for Email method.
        return send_flag is not False
    return bool(send_flag)


def should_schedule_on_start_invite(prefs: dict[str, Any]) -> bool:
    """True when invite waits for the employee start date."""
    method = str(prefs.get("method") or "").strip().lower()
    timing = str(prefs.get("timing") or "").strip().lower()
    if method != "email" or timing != "on_start":
        return False
    return prefs.get("sendInvite") is not False


def parse_start_date(value: Any) -> Optional[date]:
    raw = str(value or "").strip()[:10]
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def scheduled_invite_at_iso(start_date: Any) -> Optional[str]:
    """ISO timestamp for midnight on startDate in Africa/Nairobi."""
    day = parse_start_date(start_date)
    if day is None:
        return None
    local_midnight = datetime(
        day.year, day.month, day.day, 0, 0, 0, tzinfo=INVITE_TZ
    )
    utc = local_midnight.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def invite_today() -> date:
    return datetime.now(INVITE_TZ).date()


def employee_invite_portal_url() -> str:
    """Employee portal login."""
    return f"{get_frontend_url().rstrip('/')}/employee/login"


def employee_forgot_password_url() -> str:
    return f"{get_frontend_url().rstrip('/')}/forgot-password"


def employee_contact_url() -> str:
    return f"{get_frontend_url().rstrip('/')}/contact-us"


def employee_password_setup_url(token: str) -> str:
    """Direct set-password link (existing /reset-password page)."""
    return f"{get_frontend_url().rstrip('/')}/reset-password?token={token}"


def user_needs_password_setup(user: Optional[dict[str, Any]]) -> bool:
    """True when the account has no usable password yet (new or incomplete setup)."""
    if not user:
        return True
    if user.get("needsPasswordSetup"):
        return True
    return not bool(user.get("password"))


def format_start_date_label(start_date: Optional[str]) -> str:
    raw = (start_date or "").strip()
    if not raw:
        return ""
    try:
        parsed = datetime.strptime(raw[:10], "%Y-%m-%d")
        return parsed.strftime("%B %d, %Y")
    except ValueError:
        return raw


def _employee_invite_footer_html() -> str:
    year = datetime.utcnow().year
    hr_email = escape_email_text(settings.hr_email)
    return f"""
    <tr>
      <td style="padding: 20px 40px 28px; background: #1E1A40; border-top: 1px solid rgba(49,205,255,0.2);">
        <p style="margin: 0; font-size: 12px; line-height: 1.6; color: {MUTED_LIGHT}; text-align: center;">
          Questions? Contact
          <a href="mailto:{hr_email}" style="color: {CYAN}; text-decoration: underline;">{hr_email}</a>.
        </p>
        <p style="margin: 10px 0 0; font-size: 11px; line-height: 1.5; color: #94A3B8; text-align: center;">
          © {year} BQI Tech. All rights reserved.
        </p>
      </td>
    </tr>
    """


async def _upsert_password_setup_token(db, email: str, user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(days=PASSWORD_SETUP_TOKEN_DAYS)
    now = datetime.utcnow()
    await db.password_resets.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "userId": user_id,
                "token": token,
                "expiresAt": expires_at,
                "createdAt": now,
            }
        },
        upsert=True,
    )
    return token


async def ensure_employee_portal_user(
    db,
    *,
    email: str,
    recipient_name: str,
) -> Optional[dict[str, Any]]:
    """
    Find or create a users row for the employee invite.

    - New accounts: needsPasswordSetup=True, role EMPLOYEE, temp password hash.
    - Existing accounts with a usable password: keep credentials; do not force setup.
    - Existing accounts without a usable password: keep needsPasswordSetup=True.
    - Admin/SUPER_ADMIN roles are preserved; other non-employee roles become EMPLOYEE.
    """
    normalized = (email or "").strip().lower()
    if not normalized or "@" not in normalized:
        return None

    pattern = f"^{re.escape(normalized)}$"
    user = await db.users.find_one({"email": {"$regex": pattern, "$options": "i"}})
    now = datetime.utcnow()
    display = (recipient_name or "").strip() or normalized.split("@")[0]

    if user:
        updates: dict[str, Any] = {"updatedAt": now}
        needs_setup = user_needs_password_setup(user)
        if needs_setup:
            updates["needsPasswordSetup"] = True
        if not str(user.get("name") or "").strip():
            updates["name"] = display
        role = str(user.get("role") or "").strip().upper()
        if (
            not is_admin_role(role)
            and role not in {"EMPLOYEE", "STAFF"}
        ):
            # Grant employee portal role without stripping admin privileges.
            updates["role"] = "EMPLOYEE"
        if len(updates) > 1:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user = {**user, **updates}
        return user

    temp_password = secrets.token_urlsafe(24)
    hashed_password = await asyncio.to_thread(get_password_hash, temp_password)
    user_doc: dict[str, Any] = {
        "email": normalized,
        "name": display,
        "password": hashed_password,
        "role": "EMPLOYEE",
        "isEmailVerified": True,
        "needsPasswordSetup": True,
        "createdAt": now,
        "updatedAt": now,
    }
    insert_result = await db.users.insert_one(user_doc)
    return {**user_doc, "_id": insert_result.inserted_id}


async def prepare_employee_invite_access(
    db,
    *,
    email: str,
    recipient_name: str,
) -> dict[str, Any]:
    """
    Ensure portal user exists and decide invite CTA.

    Returns:
      password_setup_url: set only when create-password is required
      invite_cta: "create_password" | "sign_in"
      user_id: str | None
    """
    user = await ensure_employee_portal_user(
        db, email=email, recipient_name=recipient_name
    )
    if not user or not user.get("_id"):
        return {
            "password_setup_url": "",
            "invite_cta": "sign_in",
            "user_id": None,
        }

    user_id = str(user["_id"])
    if not user_needs_password_setup(user):
        return {
            "password_setup_url": "",
            "invite_cta": "sign_in",
            "user_id": user_id,
        }

    token = await _upsert_password_setup_token(
        db, (email or "").strip().lower(), user_id
    )
    return {
        "password_setup_url": employee_password_setup_url(token),
        "invite_cta": "create_password",
        "user_id": user_id,
    }


async def prepare_employee_password_setup_link(
    db,
    *,
    email: str,
    recipient_name: str,
) -> Optional[str]:
    """
    Ensure portal user exists. Return a create-password URL only when the account
    still needs password setup. Existing users with a usable password get None.
    """
    access = await prepare_employee_invite_access(
        db, email=email, recipient_name=recipient_name
    )
    url = str(access.get("password_setup_url") or "").strip()
    return url or None


def build_employee_welcome_email(
    *,
    recipient_name: str,
    job_title: str,
    department_name: str = "",
    start_date: str = "",
    welcome_message: str = "",
    invited_by: str = "",
    timing: str = "now",
    portal_url: str,
    contact_url: str,
    password_setup_url: str = "",
    forgot_password_url: str = "",
    invite_cta: str = "",
) -> tuple[str, str]:
    """Return (subject, html) for a new-hire welcome / invite email."""
    display = (recipient_name or "").strip() or "there"
    title = (job_title or "").strip() or "your new role"
    start_label = format_start_date_label(start_date)
    subject = f"Welcome to BQI Tech - {title}"
    setup_url = (password_setup_url or "").strip()
    safe_setup = escape_email_text(setup_url)
    forgot_url = (forgot_password_url or "").strip() or employee_forgot_password_url()
    cta = (invite_cta or "").strip().lower()
    if not cta:
        cta = "create_password" if setup_url else "sign_in"

    start_html = ""
    if start_label:
        if (timing or "").lower() == "on_start":
            start_html = f"""
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: {MUTED_LIGHT};">
                Today is your start date (<strong style="color:{LIGHT_TEXT};">{escape_email_text(start_label)}</strong>).
                Welcome aboard.
            </p>
            """
        else:
            start_html = f"""
            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: {MUTED_LIGHT};">
                Start date: <strong style="color:{LIGHT_TEXT};">{escape_email_text(start_label)}</strong>
            </p>
            """

    dept_html = ""
    if department_name:
        dept_html = f"""
        <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: {MUTED_LIGHT};">
            Department: <strong style="color:{CYAN};">{escape_email_text(department_name)}</strong>
        </p>
        """

    message_html = ""
    note = (welcome_message or "").strip()
    if note:
        message_html = f"""
        <div style="margin: 20px 0; padding: 16px 18px; background: rgba(49,205,255,0.08); border-left: 3px solid {CYAN}; border-radius: 8px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: {CYAN};">
            Note from your team
          </p>
          <p style="margin: 0; font-size: 15px; line-height: 1.65; color: {LIGHT_TEXT}; white-space: pre-wrap;">
            {escape_email_text(note)}
          </p>
        </div>
        """

    inviter_html = ""
    if invited_by:
        inviter_html = f"""
        <p style="margin: 16px 0 0; font-size: 13px; color: {MUTED_LIGHT};">
            Added by {escape_email_text(invited_by)}
        </p>
        """

    hr_email = escape_email_text(settings.hr_email)

    if cta == "create_password" and setup_url:
        password_block = f"""
        <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: {MUTED_LIGHT};">
            Create your employee portal password with the button below.
            The link expires in {PASSWORD_SETUP_TOKEN_DAYS} days.
            After that, sign in at the portal with your work email.
        </p>
        {primary_button_html("Create your password", setup_url, accent=CYAN)}
        <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #94A3B8; word-break: break-all;">
            If the button does not work, copy and paste this URL:<br/>
            <a href="{safe_setup}" style="color: {CYAN}; text-decoration: underline;">{safe_setup}</a>
        </p>
        <p style="margin: 16px 0 0; font-size: 13px; line-height: 1.6; color: {MUTED_LIGHT}; text-align: center;">
            Already set a password?
            <a href="{escape_email_text(portal_url)}" style="color: {CYAN}; text-decoration: underline;">Sign in to the employee portal</a>
        </p>
        """
    else:
        password_block = f"""
        <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: {MUTED_LIGHT};">
            Your account already has a password. Sign in to the employee portal with
            your work email and current password.
        </p>
        {primary_button_html("Sign in to employee portal", portal_url, accent=CYAN)}
        <p style="margin: 16px 0 0; font-size: 13px; line-height: 1.6; color: {MUTED_LIGHT}; text-align: center;">
            Forgot your password?
            <a href="{escape_email_text(forgot_url)}" style="color: {CYAN}; text-decoration: underline;">Reset it here</a>
        </p>
        """

    content = f"""
        <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 1.3; font-weight: 700; color: {LIGHT_TEXT};">
            Welcome to BQI Tech
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {MUTED_LIGHT};">
            Hi {escape_email_text(display)},
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {MUTED_LIGHT};">
            You have been added to the BQI Tech roster as
            <strong style="color:{CYAN};">{escape_email_text(title)}</strong>.
        </p>
        {dept_html}
        {start_html}
        {message_html}
        {password_block}
        <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: #94A3B8;">
            Questions?
            <a href="mailto:{hr_email}" style="color: {CYAN}; text-decoration: underline;">{hr_email}</a>
            &nbsp;·&nbsp;
            <a href="{escape_email_text(contact_url)}" style="color: {CYAN}; text-decoration: underline;">Contact us</a>
        </p>
        {inviter_html}
    """
    html = wrap_branded_email(
        header=branded_email_header_html(),
        footer=_employee_invite_footer_html(),
        content=content,
        accent_color=CYAN,
        outer_bg="#12101F",
        card_bg=NAVY,
        preheader=subject[:120],
    )
    return subject, html


async def send_employee_invite_email(
    *,
    to_email: str,
    recipient_name: str,
    job_title: str,
    department_name: str = "",
    start_date: str = "",
    welcome_message: str = "",
    invited_by: str = "",
    timing: str = "now",
    employee_id: str = "",
    db=None,
) -> bool:
    """Send welcome invite. Never raises — returns False on failure."""
    recipient = (to_email or "").strip().lower()
    if not recipient or "@" not in recipient:
        logger.warning("Skipping employee invite — missing email for %s", recipient_name)
        return False

    if not is_email_configured():
        logger.warning(
            "Email delivery not configured; skipped employee invite to %s", recipient
        )
        return False

    database = db
    if database is None and is_connected():
        database = get_database()

    password_setup_url = ""
    invite_cta = "sign_in"
    if database is not None:
        try:
            access = await prepare_employee_invite_access(
                database,
                email=recipient,
                recipient_name=recipient_name,
            )
            password_setup_url = str(access.get("password_setup_url") or "")
            invite_cta = str(access.get("invite_cta") or "sign_in")
        except Exception:
            logger.exception(
                "Failed to prepare employee invite access for %s",
                recipient,
            )
            # Keep sign-in CTA rather than inventing a create-password link.
            invite_cta = "sign_in"

    subject, html = build_employee_welcome_email(
        recipient_name=recipient_name,
        job_title=job_title,
        department_name=department_name,
        start_date=start_date,
        welcome_message=welcome_message,
        invited_by=invited_by,
        timing=timing,
        portal_url=employee_invite_portal_url(),
        contact_url=employee_contact_url(),
        password_setup_url=password_setup_url,
        forgot_password_url=employee_forgot_password_url(),
        invite_cta=invite_cta,
    )

    try:
        ok = await send_generic_email_logged(
            recipient,
            subject,
            html,
            email_type="employee_invite",
            sent_by_name=invited_by or None,
            metadata={
                "employee_id": employee_id,
                "timing": timing,
                "has_password_setup_link": bool(password_setup_url),
                "invite_cta": invite_cta,
            },
        )
        if not ok:
            logger.error("Employee invite email delivery returned false for %s", recipient)
        return bool(ok)
    except Exception:
        logger.exception("Failed to send employee invite email to %s", recipient)
        return False


async def maybe_send_employee_invite_after_create(
    db,
    *,
    employee_doc: dict[str, Any],
    invited_by: str,
) -> dict[str, Any]:
    """Update invitePreferences with send or schedule result. Does not raise."""
    prefs = _normalize_prefs(employee_doc.get("invitePreferences"))
    employee_id = str(employee_doc.get("_id") or employee_doc.get("id") or "")
    now_iso = datetime.utcnow().isoformat() + "Z"
    timing = str(prefs.get("timing") or "now").strip().lower()
    method = str(prefs.get("method") or "").strip().lower()

    if method in ("none", "manual"):
        prefs.update(
            {
                "inviteStatus": "skipped",
                "pendingInvite": False,
                "inviteSentAt": None,
                "scheduledInviteAt": None,
            }
        )
    elif method == "email" and prefs.get("sendInvite") is False:
        prefs.update(
            {
                "inviteStatus": "skipped",
                "pendingInvite": False,
                "inviteSentAt": None,
                "scheduledInviteAt": None,
            }
        )
    elif timing == "later":
        prefs.update(
            {
                "inviteStatus": "deferred",
                "pendingInvite": True,
                "inviteSentAt": None,
                "scheduledInviteAt": None,
            }
        )
    elif should_schedule_on_start_invite(prefs):
        scheduled_at = scheduled_invite_at_iso(employee_doc.get("startDate"))
        prefs.update(
            {
                "inviteStatus": "deferred",
                "pendingInvite": True,
                "inviteSentAt": None,
                "scheduledInviteAt": scheduled_at,
                "sendInvite": True,
            }
        )
        if not scheduled_at:
            logger.warning(
                "on_start invite for employee %s has no valid startDate; left deferred",
                employee_id,
            )
    elif should_send_employee_invite(prefs):
        to_email = (
            str(employee_doc.get("workEmail") or employee_doc.get("email") or "")
            .strip()
            .lower()
        )
        name = f"{employee_doc.get('firstName', '')} {employee_doc.get('lastName', '')}".strip()
        sent = await send_employee_invite_email(
            to_email=to_email,
            recipient_name=name,
            job_title=str(employee_doc.get("jobTitle") or ""),
            department_name=str(employee_doc.get("departmentName") or ""),
            start_date=str(employee_doc.get("startDate") or ""),
            welcome_message=str(prefs.get("welcomeMessage") or ""),
            invited_by=invited_by,
            timing=timing,
            employee_id=employee_id,
            db=db,
        )
        prefs.update(
            {
                "inviteStatus": "sent" if sent else "failed",
                "pendingInvite": not sent,
                "inviteSentAt": now_iso if sent else None,
                "scheduledInviteAt": None,
                "sendInvite": True,
            }
        )
    else:
        prefs.update(
            {
                "inviteStatus": "skipped",
                "pendingInvite": False,
                "inviteSentAt": None,
                "scheduledInviteAt": None,
            }
        )

    try:
        oid = employee_doc.get("_id")
        if oid is not None:
            await db.employees.update_one(
                {"_id": oid if isinstance(oid, ObjectId) else ObjectId(str(oid))},
                {"$set": {"invitePreferences": prefs, "updatedAt": datetime.utcnow()}},
            )
    except Exception:
        logger.exception(
            "Failed to persist invitePreferences for employee %s", employee_id
        )

    return prefs


async def _send_and_finalize_invite(
    db,
    *,
    employee_doc: dict[str, Any],
) -> str:
    """Send a claimed invite and persist sent/failed. Returns 'sent' or 'failed'."""
    prefs = _normalize_prefs(employee_doc.get("invitePreferences"))
    employee_id = str(employee_doc.get("_id") or "")
    to_email = (
        str(employee_doc.get("workEmail") or employee_doc.get("email") or "")
        .strip()
        .lower()
    )
    name = f"{employee_doc.get('firstName', '')} {employee_doc.get('lastName', '')}".strip()
    invited_by = str(prefs.get("invitedBy") or "System")
    now_iso = datetime.utcnow().isoformat() + "Z"

    sent = await send_employee_invite_email(
        to_email=to_email,
        recipient_name=name,
        job_title=str(employee_doc.get("jobTitle") or ""),
        department_name=str(employee_doc.get("departmentName") or ""),
        start_date=str(employee_doc.get("startDate") or ""),
        welcome_message=str(prefs.get("welcomeMessage") or ""),
        invited_by=invited_by,
        timing="on_start",
        employee_id=employee_id,
        db=db,
    )

    next_prefs = {
        **prefs,
        "inviteStatus": "sent" if sent else "failed",
        "pendingInvite": not sent,
        "inviteSentAt": now_iso if sent else None,
    }
    update: dict[str, Any] = {
        "invitePreferences": next_prefs,
        "updatedAt": datetime.utcnow(),
    }
    if sent:
        activity_entry = {
            "id": f"a-{ObjectId()}",
            "date": now_iso,
            "actor": "System",
            "action": "Welcome invite email sent (scheduled for start date)",
        }
        await db.employees.update_one(
            {"_id": employee_doc["_id"]},
            {
                "$set": update,
                "$push": {
                    "activity": {
                        "$each": [activity_entry],
                        "$position": 0,
                        "$slice": 100,
                    }
                },
            },
        )
    else:
        await db.employees.update_one(
            {"_id": employee_doc["_id"]},
            {"$set": update},
        )

    return "sent" if sent else "failed"


def resolve_employee_invite_email(employee_doc: dict[str, Any]) -> str:
    """Work email first, then personal, then primary email."""
    for key in ("workEmail", "personalEmail", "email"):
        candidate = str(employee_doc.get(key) or "").strip().lower()
        if candidate and "@" in candidate:
            return candidate
    return ""


async def resend_employee_invite(
    db,
    *,
    employee_doc: dict[str, Any],
    invited_by: str,
) -> dict[str, Any]:
    """
    Manually send (or resend) the welcome invite email.

    Updates invitePreferences to sent/failed and clears pendingInvite on success.
    Raises ValueError when the employee has no usable email.
    """
    prefs = _normalize_prefs(employee_doc.get("invitePreferences"))
    employee_id = str(employee_doc.get("_id") or "")
    to_email = resolve_employee_invite_email(employee_doc)
    if not to_email:
        raise ValueError(
            "This employee has no work or personal email to send the invite to"
        )

    name = f"{employee_doc.get('firstName', '')} {employee_doc.get('lastName', '')}".strip()
    actor = (invited_by or "").strip() or str(prefs.get("invitedBy") or "Admin")
    timing = str(prefs.get("timing") or "now").strip().lower() or "now"
    now_iso = datetime.utcnow().isoformat() + "Z"

    sent = await send_employee_invite_email(
        to_email=to_email,
        recipient_name=name,
        job_title=str(employee_doc.get("jobTitle") or ""),
        department_name=str(employee_doc.get("departmentName") or ""),
        start_date=str(employee_doc.get("startDate") or ""),
        welcome_message=str(prefs.get("welcomeMessage") or ""),
        invited_by=actor,
        timing=timing if timing != "later" else "now",
        employee_id=employee_id,
        db=db,
    )

    next_prefs = {
        **prefs,
        "method": prefs.get("method") or "email",
        "sendInvite": True,
        "inviteStatus": "sent" if sent else "failed",
        "pendingInvite": not sent,
        "inviteSentAt": now_iso if sent else prefs.get("inviteSentAt"),
        "invitedBy": actor,
    }
    if sent:
        next_prefs["scheduledInviteAt"] = None

    update: dict[str, Any] = {
        "invitePreferences": next_prefs,
        "updatedAt": datetime.utcnow(),
    }
    activity_entry = {
        "id": f"a-{ObjectId()}",
        "date": now_iso,
        "actor": actor,
        "action": (
            "Welcome invite email resent"
            if sent
            else "Welcome invite email resend failed"
        ),
    }
    await db.employees.update_one(
        {"_id": employee_doc["_id"]},
        {
            "$set": update,
            "$push": {
                "activity": {
                    "$each": [activity_entry],
                    "$position": 0,
                    "$slice": 100,
                }
            },
        },
    )

    return {
        "ok": sent,
        "inviteStatus": next_prefs["inviteStatus"],
        "toEmail": to_email,
        "invitePreferences": next_prefs,
        "message": (
            f"Invite sent to {to_email}"
            if sent
            else f"Invite could not be delivered to {to_email}"
        ),
    }


async def process_due_employee_invites() -> dict[str, int]:
    """Find deferred on_start invites whose start date has arrived and send them."""
    result = {"sent": 0, "failed": 0, "skipped": 0}
    if not is_connected():
        return result

    db = get_database()
    if db is None:
        return result

    today = invite_today().isoformat()
    cursor = db.employees.find(
        {
            "invitePreferences.pendingInvite": True,
            "invitePreferences.inviteStatus": "deferred",
            "invitePreferences.timing": "on_start",
            "invitePreferences.sendInvite": {"$ne": False},
            "startDate": {"$lte": today, "$regex": r"^\d{4}-\d{2}-\d{2}"},
            "$or": [
                {"invitePreferences.inviteSentAt": None},
                {"invitePreferences.inviteSentAt": {"$exists": False}},
            ],
        }
    ).limit(50)

    async for doc in cursor:
        oid = doc.get("_id")
        if oid is None:
            result["skipped"] += 1
            continue

        # Atomic claim — prevents double-send across overlapping ticks.
        claimed = await db.employees.find_one_and_update(
            {
                "_id": oid,
                "invitePreferences.pendingInvite": True,
                "invitePreferences.inviteStatus": "deferred",
                "invitePreferences.timing": "on_start",
            },
            {
                "$set": {
                    "invitePreferences.inviteStatus": "sending",
                    "invitePreferences.pendingInvite": False,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        if not claimed:
            result["skipped"] += 1
            continue

        # Re-read prefs from claimed doc (pre-update snapshot still has deferred prefs).
        try:
            outcome = await _send_and_finalize_invite(db, employee_doc=claimed)
            result[outcome] += 1
        except Exception:
            logger.exception(
                "Employee invite scheduler failed for %s", oid
            )
            try:
                prefs = _normalize_prefs(claimed.get("invitePreferences"))
                prefs.update(
                    {
                        "inviteStatus": "failed",
                        "pendingInvite": True,
                    }
                )
                await db.employees.update_one(
                    {"_id": oid},
                    {
                        "$set": {
                            "invitePreferences": prefs,
                            "updatedAt": datetime.utcnow(),
                        }
                    },
                )
            except Exception:
                logger.exception("Failed to mark invite failed for %s", oid)
            result["failed"] += 1

    return result
