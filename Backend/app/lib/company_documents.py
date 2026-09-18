"""Helpers for company document library (policies, handbooks, templates, forms)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId

VALID_CATEGORIES = frozenset({"policies", "handbooks", "templates", "forms"})
VALID_FORMATS = frozenset({"PDF", "DOC", "XLS"})


def format_company_document(doc: dict[str, Any]) -> dict[str, Any]:
    created_at = doc.get("createdAt")
    updated_at = doc.get("updatedAt")
    last_accessed = doc.get("lastAccessedAt")
    category = str(doc.get("category") or "policies").lower()
    if category not in VALID_CATEGORIES:
        category = "policies"
    fmt = str(doc.get("format") or "PDF").upper()
    if fmt not in VALID_FORMATS:
        fmt = "PDF"

    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "title": str(doc.get("title") or ""),
        "description": str(doc.get("description") or ""),
        "category": category,
        "format": fmt,
        "fileUrl": str(doc.get("fileUrl") or ""),
        "fileName": str(doc.get("fileName") or ""),
        "fileSize": int(doc.get("fileSize") or 0),
        "authorId": str(doc.get("authorId") or "") or None,
        "authorName": str(doc.get("authorName") or "") or None,
        "createdAt": _iso(created_at),
        "updatedAt": _iso(updated_at),
        "lastAccessedAt": _iso(last_accessed),
    }


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value
    return None


def parse_document_object_id(document_id: str) -> ObjectId:
    return ObjectId(document_id)


def build_documents_query(
    *,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if category and category != "all":
        normalized = category.strip().lower()
        if normalized in VALID_CATEGORIES:
            query["category"] = normalized

    needle = (search or "").strip()
    if needle:
        query["$or"] = [
            {"title": {"$regex": needle, "$options": "i"}},
            {"description": {"$regex": needle, "$options": "i"}},
            {"fileName": {"$regex": needle, "$options": "i"}},
            {"authorName": {"$regex": needle, "$options": "i"}},
        ]
    return query


def detect_document_format(filename: str) -> Optional[str]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "PDF"
    if ext in ("doc", "docx"):
        return "DOC"
    if ext in ("xls", "xlsx"):
        return "XLS"
    return None
