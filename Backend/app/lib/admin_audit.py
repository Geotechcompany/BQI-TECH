"""Record human-readable admin activity for the audit log UI."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from bson import ObjectId

logger = logging.getLogger(__name__)

COLLECTION = "admin_activities"

DEFAULT_SKIP_KEYS = frozenset(
    {
        "_id",
        "id",
        "updatedAt",
        "createdAt",
        "authorId",
        "createdBy",
        "type",
        "password",
    }
)

SENSITIVE_KEYS = frozenset(
    {
        "password",
        "token",
        "secret",
        "secretKey",
        "apiKey",
        "api_key",
        "smtpPassword",
        "smtp_password",
        "credentials",
        "accessToken",
        "refreshToken",
    }
)

RESOURCE_TYPE_LABELS: dict[str, str] = {
    "blog_post": "blog post",
    "job_posting": "job posting",
    "user": "user",
    "admin_invite": "admin invite",
    "application": "application",
    "question": "screening question",
    "settings": "settings",
    "backup": "backup settings",
    "email_transport": "email transport",
    "email_broadcast": "email broadcast",
    "notification": "notification",
    "recaptcha": "reCAPTCHA settings",
    "database_sync": "database sync",
    "cv_vault": "CV vault",
    "survey": "survey",
    "broadcast_list": "broadcast list",
}

FIELD_LABELS: dict[str, dict[str, str]] = {
    "blog_post": {
        "title": "title",
        "slug": "slug",
        "excerpt": "excerpt",
        "content": "content",
        "category": "category",
        "readTime": "read time",
        "published": "publish status",
        "isPublished": "publish status",
        "tags": "tags",
        "metaDescription": "meta description",
        "imageUrl": "featured image",
        "author": "author",
        "authorProfile": "author profile",
        "authorName": "author name",
        "authorBio": "author bio",
        "authorTitle": "author title",
        "authorProfileImage": "author photo",
        "authorTwitter": "author Twitter",
        "authorLinkedin": "author LinkedIn",
        "authorGithub": "author GitHub",
        "authorWebsite": "author website",
    },
    "job_posting": {
        "title": "title",
        "department": "department",
        "location": "location",
        "employmentType": "employment type",
        "description": "description",
        "requirements": "requirements",
        "salary": "salary",
        "isActive": "active status",
        "postedDate": "posted date",
        "closingDate": "closing date",
    },
    "user": {
        "name": "name",
        "email": "email",
        "role": "role",
        "adminModules": "admin modules",
        "isEmailVerified": "email verified",
        "invitePending": "invite pending",
    },
    "application": {
        "status": "status",
        "isArchived": "archive status",
        "notes": "notes",
        "rating": "rating",
        "position": "position",
    },
    "question": {
        "question": "question text",
        "type": "question type",
        "options": "options",
        "required": "required",
        "order": "order",
        "jobIds": "linked jobs",
        "isActive": "active status",
    },
    "settings": {
        "siteName": "site name",
        "siteUrl": "site URL",
        "contactEmail": "contact email",
        "maintenanceMode": "maintenance mode",
        "allowRegistrations": "registrations",
        "defaultUserRole": "default user role",
        "emailNotifications": "email notifications",
        "analyticsEnabled": "analytics",
    },
    "backup": {
        "enabled": "enabled",
        "schedule": "schedule",
        "destinations": "destinations",
        "retentionDays": "retention",
    },
    "email_transport": {
        "provider": "provider",
        "fromEmail": "from email",
        "fromName": "from name",
        "smtpHost": "SMTP host",
        "smtpPort": "SMTP port",
        "smtpUser": "SMTP user",
    },
    "notification": {
        "title": "title",
        "message": "message",
        "type": "type",
        "priority": "priority",
    },
    "survey": {
        "title": "title",
        "description": "description",
        "questions": "questions",
        "isActive": "active status",
        "limitPerUser": "one response per user",
    },
    "broadcast_list": {
        "name": "name",
        "description": "description",
        "userIds": "members",
    },
}

# Backward-compatible alias used by blog diff helpers
BLOG_FIELD_LABELS = FIELD_LABELS["blog_post"]
SKIP_DIFF_KEYS = DEFAULT_SKIP_KEYS


def actor_email(user: dict[str, Any]) -> str:
    return (
        str(user.get("email") or user.get("username") or "").strip()
        or "unknown@admin"
    )


def actor_name(user: dict[str, Any]) -> str:
    first = str(user.get("firstName") or "").strip()
    last = str(user.get("lastName") or "").strip()
    full = f"{first} {last}".strip()
    return full or str(user.get("name") or "").strip() or actor_email(user)


def resource_path(resource_type: str, resource_id: str | None = None) -> str | None:
    paths: dict[str, str] = {
        "blog_post": "/admin/blog-management",
        "job_posting": "/admin/job-postings",
        "user": "/admin/user-management",
        "admin_invite": "/admin/user-management",
        "application": "/admin/applications",
        "question": "/admin/job-postings/questions",
        "settings": "/admin/settings",
        "backup": "/admin/backup",
        "email_transport": "/admin/settings",
        "email_broadcast": "/admin/email-broadcast",
        "notification": "/admin/notifications",
        "recaptcha": "/admin/settings",
        "database_sync": "/admin/settings",
        "cv_vault": "/admin/cv-vault",
        "survey": "/admin/surveys",
        "broadcast_list": "/admin/email-broadcast",
    }
    base = paths.get(resource_type)
    if not base:
        return None
    if resource_type == "blog_post" and resource_id:
        return f"{base}/{resource_id}/edit"
    if resource_type == "application" and resource_id:
        return f"{base}?id={resource_id}"
    return base


def _normalize_compare(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return tuple(_normalize_compare(v) for v in value)
    if isinstance(value, dict):
        return tuple(sorted((k, _normalize_compare(v)) for k, v in value.items()))
    return value


def _values_differ(old: Any, new: Any) -> bool:
    return _normalize_compare(old) != _normalize_compare(new)


def diff_field_changes(
    existing: dict[str, Any],
    updates: dict[str, Any],
    field_labels: dict[str, str] | None = None,
    *,
    skip_keys: frozenset[str] | None = None,
) -> list[str]:
    """Return human-readable list of changed field labels."""
    labels = field_labels or {}
    skip = skip_keys or DEFAULT_SKIP_KEYS
    changed: list[str] = []
    seen_labels: set[str] = set()

    for key, new_val in updates.items():
        if key in skip or key in SENSITIVE_KEYS:
            continue
        label = labels.get(key) or key.replace("_", " ").replace("Id", " ID")
        if label in seen_labels:
            continue
        old_val = existing.get(key)
        if key == "published" and "isPublished" in existing:
            old_val = existing.get("isPublished")
        if key == "isPublished" and "published" in existing and old_val is None:
            old_val = existing.get("published")
        if _values_differ(old_val, new_val):
            changed.append(label)
            seen_labels.add(label)

    return changed


def diff_blog_post_changes(
    existing: dict[str, Any], updates: dict[str, Any]
) -> list[str]:
    return diff_field_changes(existing, updates, BLOG_FIELD_LABELS)


def _resource_label(resource_type: str) -> str:
    return RESOURCE_TYPE_LABELS.get(resource_type, resource_type.replace("_", " "))


def build_activity_summary(
    *,
    actor: str,
    action: str,
    resource_type: str,
    resource_title: str | None = None,
    changes: list[str] | None = None,
    detail: str | None = None,
) -> str:
    label = _resource_label(resource_type)
    title = (resource_title or "").strip()
    quoted = f' "{title}"' if title else ""

    if action == "created":
        return f"{actor} created {label}{quoted}"
    if action == "deleted":
        return f"{actor} deleted {label}{quoted}"
    if action == "published":
        return f"{actor} published {label}{quoted}"
    if action == "unpublished":
        return f"{actor} unpublished {label}{quoted}"
    if action == "invited":
        return f"{actor} invited admin {quoted or detail or ''}".strip()
    if action == "revoked":
        return f"{actor} revoked admin invite{quoted or detail or ''}".strip()
    if action == "resent":
        return f"{actor} resent admin invite{quoted or detail or ''}".strip()
    if action == "activated":
        return f"{actor} activated {label}{quoted}"
    if action == "deactivated":
        return f"{actor} deactivated {label}{quoted}"
    if action == "archived":
        if detail:
            return f"{actor} archived {detail}"
        return f"{actor} archived {label}{quoted}"
    if action == "restored":
        if detail:
            return f"{actor} restored {detail}"
        return f"{actor} restored {label}{quoted}"
    if action == "sent":
        return detail or f"{actor} sent {label}"
    if action == "executed":
        return detail or f"{actor} ran {label}"
    if action == "synced":
        return detail or f"{actor} synced {label}"
    if action == "reordered":
        return detail or f"{actor} reordered {label}"
    if action == "ranked":
        return detail or f"{actor} ran AI ranking on applications"

    if changes:
        joined = ", ".join(changes)
        return f"{actor} updated {label}{quoted} — edited: {joined}"
    if detail:
        return f"{actor} updated {label}{quoted} — {detail}"
    return f"{actor} updated {label}{quoted}".strip()


def build_blog_activity_message(
    *,
    action: str,
    actor: str,
    title: str,
    changes: list[str] | None = None,
) -> str:
    return build_activity_summary(
        actor=actor,
        action=action,
        resource_type="blog_post",
        resource_title=title,
        changes=changes,
    )


def _resource_title(doc: dict[str, Any], title_field: str = "title") -> str:
    for key in (title_field, "title", "name", "email", "question", "subject"):
        value = doc.get(key)
        if value:
            return str(value).strip()
    return ""


async def record_admin_activity(
    db,
    *,
    user: dict[str, Any],
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    resource_title: str | None = None,
    resource_path: str | None = None,
    changes: list[str] | None = None,
    summary: str | None = None,
    detail: str | None = None,
) -> None:
    email = actor_email(user)
    name = actor_name(user)
    actor = email

    if not summary:
        summary = build_activity_summary(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_title=resource_title,
            changes=changes,
            detail=detail,
        )

    if not resource_path:
        resource_path = resource_path_for(resource_type, resource_id)

    doc = {
        "actorId": str(user.get("_id") or user.get("id") or ""),
        "actorEmail": email,
        "actorName": name,
        "action": action,
        "resourceType": resource_type,
        "resourceId": resource_id,
        "resourceTitle": resource_title,
        "resourcePath": resource_path,
        "changes": changes or [],
        "summary": summary,
        "createdAt": datetime.utcnow(),
    }
    await db[COLLECTION].insert_one(doc)


def resource_path_for(resource_type: str, resource_id: str | None = None) -> str | None:
    return resource_path(resource_type, resource_id)


async def safe_record_admin_activity(db, **kwargs: Any) -> None:
    try:
        await record_admin_activity(db, **kwargs)
    except Exception:
        logger.warning("Failed to record admin activity", exc_info=True)


async def log_resource_created(
    db,
    user: dict[str, Any],
    *,
    resource_type: str,
    doc: dict[str, Any],
    title_field: str = "title",
    resource_id: str | None = None,
) -> None:
    rid = resource_id or str(doc.get("id") or doc.get("_id") or "")
    title = _resource_title(doc, title_field)
    await safe_record_admin_activity(
        db,
        user=user,
        action="created",
        resource_type=resource_type,
        resource_id=rid or None,
        resource_title=title or None,
    )


async def log_resource_updated(
    db,
    user: dict[str, Any],
    *,
    resource_type: str,
    existing: dict[str, Any],
    updates: dict[str, Any],
    resource_id: str | None = None,
    title_field: str = "title",
    action: str = "updated",
    detail: str | None = None,
) -> None:
    labels = FIELD_LABELS.get(resource_type, {})
    changes = diff_field_changes(existing, updates, labels)
    if not changes and not updates and not detail:
        return

    rid = resource_id or str(existing.get("_id") or existing.get("id") or "")
    title = str(updates.get(title_field) or existing.get(title_field) or _resource_title(existing, title_field))

    await safe_record_admin_activity(
        db,
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=rid or None,
        resource_title=title or None,
        changes=changes,
        detail=detail,
    )


async def log_resource_deleted(
    db,
    user: dict[str, Any],
    *,
    resource_type: str,
    doc: dict[str, Any],
    title_field: str = "title",
    resource_id: str | None = None,
) -> None:
    rid = resource_id or str(doc.get("_id") or doc.get("id") or "")
    title = _resource_title(doc, title_field)
    await safe_record_admin_activity(
        db,
        user=user,
        action="deleted",
        resource_type=resource_type,
        resource_id=rid or None,
        resource_title=title or None,
    )


async def log_bulk_operation(
    db,
    user: dict[str, Any],
    *,
    action: str,
    resource_type: str,
    count: int,
    detail: str | None = None,
) -> None:
    if count <= 0:
        return
    label = _resource_label(resource_type)
    plural = label if count == 1 else f"{label}s"
    detail_text = detail or f"{count} {plural}"
    await safe_record_admin_activity(
        db,
        user=user,
        action=action,
        resource_type=resource_type,
        detail=detail_text,
        summary=build_activity_summary(
            actor=actor_email(user),
            action=action,
            resource_type=resource_type,
            detail=detail_text,
        ),
    )


async def log_custom_action(
    db,
    user: dict[str, Any],
    *,
    action: str,
    resource_type: str,
    summary: str | None = None,
    resource_id: str | None = None,
    resource_title: str | None = None,
    resource_path: str | None = None,
    changes: list[str] | None = None,
    detail: str | None = None,
) -> None:
    await safe_record_admin_activity(
        db,
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_title=resource_title,
        resource_path=resource_path,
        changes=changes,
        summary=summary,
        detail=detail,
    )


# --- Blog-specific helpers (preserve existing call sites) ---

async def log_blog_created(db, user: dict[str, Any], post: dict[str, Any]) -> None:
    await log_resource_created(db, user, resource_type="blog_post", doc=post)


async def log_blog_updated(
    db,
    user: dict[str, Any],
    existing: dict[str, Any],
    updates: dict[str, Any],
) -> None:
    post_id = str(existing.get("_id") or "")
    title = str(updates.get("title") or existing.get("title") or "")
    changes = diff_blog_post_changes(existing, updates)

    if not changes and not updates:
        return

    action = "updated"
    if set(changes) <= {"publish status"} or (
        "published" in updates or "isPublished" in updates
    ):
        pub = updates.get("published", updates.get("isPublished"))
        if pub is True:
            action = "published"
            changes = []
        elif pub is False:
            action = "unpublished"
            changes = []

    await safe_record_admin_activity(
        db,
        user=user,
        action=action,
        resource_type="blog_post",
        resource_id=post_id,
        resource_title=title,
        resource_path=f"/admin/blog-management/{post_id}/edit",
        changes=changes,
    )


async def log_blog_deleted(
    db, user: dict[str, Any], post: dict[str, Any]
) -> None:
    await log_resource_deleted(db, user, resource_type="blog_post", doc=post)
