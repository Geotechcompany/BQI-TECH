"""Record human-readable admin activity for the audit log UI."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId

COLLECTION = "admin_activities"

BLOG_FIELD_LABELS: dict[str, str] = {
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
    "createdAt": "created date",
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
}

SKIP_DIFF_KEYS = frozenset(
    {"_id", "id", "updatedAt", "authorId", "createdAt", "type"}
)


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


def diff_blog_post_changes(
    existing: dict[str, Any], updates: dict[str, Any]
) -> list[str]:
    """Return human-readable list of changed field labels."""
    changed: list[str] = []
    seen_labels: set[str] = set()

    for key, new_val in updates.items():
        if key in SKIP_DIFF_KEYS:
            continue
        label = BLOG_FIELD_LABELS.get(key)
        if not label or label in seen_labels:
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


def build_blog_activity_message(
    *,
    action: str,
    actor: str,
    title: str,
    changes: list[str] | None = None,
) -> str:
    safe_title = title or "Untitled post"
    quoted = f'"{safe_title}"'

    if action == "created":
        return f"{actor} created blog post {quoted}"
    if action == "deleted":
        return f"{actor} deleted blog post {quoted}"
    if action == "published":
        return f"{actor} published blog post {quoted}"
    if action == "unpublished":
        return f"{actor} unpublished blog post {quoted}"

    if changes:
        joined = ", ".join(changes)
        return f"{actor} updated blog post {quoted} — edited: {joined}"
    return f"{actor} updated blog post {quoted}"


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
) -> None:
    email = actor_email(user)
    name = actor_name(user)
    actor = email

    if not summary:
        if resource_type == "blog_post":
            summary = build_blog_activity_message(
                action=action,
                actor=actor,
                title=resource_title or "",
                changes=changes,
            )
        else:
            title_part = f' "{resource_title}"' if resource_title else ""
            summary = f"{actor} {action} {resource_type.replace('_', ' ')}{title_part}"

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


async def log_blog_created(db, user: dict[str, Any], post: dict[str, Any]) -> None:
    await record_admin_activity(
        db,
        user=user,
        action="created",
        resource_type="blog_post",
        resource_id=str(post.get("id") or post.get("_id") or ""),
        resource_title=str(post.get("title") or ""),
        resource_path=f"/admin/blog-management/{post.get('id')}/edit",
    )


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

    await record_admin_activity(
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
    post_id = str(post.get("_id") or "")
    await record_admin_activity(
        db,
        user=user,
        action="deleted",
        resource_type="blog_post",
        resource_id=post_id,
        resource_title=str(post.get("title") or ""),
    )
