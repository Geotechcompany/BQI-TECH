"""CV Vault utilities: Dropbox listing, metadata extraction, application matching."""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, unquote

import dropbox
from dropbox.exceptions import ApiError
from dropbox.files import FileMetadata

logger = logging.getLogger(__name__)

CV_EXTENSIONS = {".pdf", ".doc", ".docx"}
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
INVALID_NAMES = frozenset(
    {
        "",
        "unknown",
        "Unknown",
        "incomplete application",
        "Incomplete Application",
        "n/a",
        "N/A",
        "not set",
        "none",
    }
)

DROPBOX_CV_FOLDERS = [
    p.strip()
    for p in os.getenv("DROPBOX_CV_FOLDERS", "/uploads").split(",")
    if p.strip()
]


def normalize_cv_url(url: str) -> str:
    """Normalize Dropbox URLs for deduplication."""
    if not url:
        return ""
    u = url.strip().lower()
    u = u.replace("www.dropbox.com", "dropbox.com")
    u = u.replace("dl.dropboxusercontent.com", "dropbox.com")
    if "?" in u:
        base, _ = u.split("?", 1)
        return base.rstrip("/")
    return u.rstrip("/")


def parse_name_from_filename(filename: str) -> str:
    """Derive a display name from common CV filename patterns."""
    if not filename:
        return ""
    base = os.path.splitext(filename)[0]
    # Remove trailing timestamp segments (10+ digits)
    base = re.sub(r"[-_]?\d{10,}[-_]?\d*$", "", base)
    base = re.sub(r"[-_]?\d{10,}$", "", base)
    # Remove common suffixes
    for suffix in (
        "_resume", "-resume", "_cv", "-cv", "_curriculum", "-curriculum",
        " resume", " cv", "_ats", "-ats",
    ):
        if base.lower().endswith(suffix):
            base = base[: -len(suffix)]
    base = base.strip(" _-")
    if not base:
        return ""
    # First_Last or First-Last
    parts = re.split(r"[_\-\s]+", base)
    parts = [p for p in parts if p and not p.isdigit()]
    if not parts:
        return ""
    # Skip generic prefixes
    skip = {"cv", "resume", "curriculum", "vitae", "application", "document"}
    while parts and parts[0].lower() in skip:
        parts.pop(0)
    if not parts:
        return ""
    return " ".join(word.capitalize() for word in parts[:4])


def extract_email_from_text(text: str) -> str:
    if not text:
        return ""
    matches = EMAIL_RE.findall(text)
    for email in matches:
        lower = email.lower()
        if any(x in lower for x in ("example.com", "email.com", "test.com", "domain.com")):
            continue
        return email
    return ""


SKIP_NAME_PATTERNS = (
    "curriculum vitae",
    "resume",
    "résumé",
    "curriculum",
    "vitae",
    "personal details",
    "contact",
    "profile",
    "objective",
    "summary",
    "professional summary",
    "about me",
    "work experience",
    "education",
    "skills",
)

CONTACT_SOURCE_APPLICATION = "application"
CONTACT_SOURCE_FILENAME = "filename"
CONTACT_SOURCE_CV_TEXT = "cv_text"


def _is_missing_name(name: str) -> bool:
    stripped = (name or "").strip()
    return not stripped or stripped.lower() in INVALID_NAMES


def _needs_cv_text_extraction(name: str, email: str) -> bool:
    return _is_missing_name(name) or not (email or "").strip()


def extract_name_from_cv_text(text: str) -> str:
    """Heuristic name from CV body text (first lines, skip headers)."""
    if not text:
        return ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines[:20]:
        lower = line.lower().strip(":- ")
        if "@" in line or len(line) > 55:
            continue
        if re.search(r"\d{3,}", line):
            continue
        if any(pattern in lower for pattern in SKIP_NAME_PATTERNS):
            continue
        if not re.match(r"^[A-Za-z][A-Za-z\s'\-\.]{2,48}$", line):
            continue
        words = line.split()
        if not 1 <= len(words) <= 5:
            continue
        return " ".join(
            word.capitalize() if word.isupper() and len(word) > 1 else word
            for word in words
        )
    return ""


def extract_text_from_pdf_bytes(data: bytes, max_pages: int = 4) -> str:
    if not data:
        return ""
    try:
        from pypdf import PdfReader
        import io

        reader = PdfReader(io.BytesIO(data))
        chunks: List[str] = []
        for page in reader.pages[:max_pages]:
            chunks.append(page.extract_text() or "")
        return "\n".join(chunks)
    except ImportError as missing:
        logger.error("PDF text extraction unavailable: install pypdf (%s)", missing)
        return ""
    except Exception as e:
        logger.warning("PDF text extraction failed: %s", e)
        return ""


def extract_contact_from_cv_text(text: str) -> Tuple[str, str]:
    return extract_name_from_cv_text(text), extract_email_from_text(text)


def extract_phone_from_cv_text(text: str) -> str:
    """Delegate to shared CV contact extractor."""
    from app.lib.cv_contact_extract import extract_phone_from_text

    return extract_phone_from_text(text)


def extract_name_from_answers(answers: List[Dict[str, Any]]) -> str:
    if not isinstance(answers, list):
        return ""
    first_name = ""
    last_name = ""
    for answer in answers:
        q = str(answer.get("questionText", "")).lower()
        a = str(answer.get("answer", "")).strip()
        if not a:
            continue
        if "first name" in q or q == "firstname":
            first_name = a
        elif "last name" in q or q == "surname" or "family name" in q:
            last_name = a
        elif any(k in q for k in ("full name", "your name", "applicant name")) and "@" not in a:
            return a
    if first_name and last_name:
        return f"{first_name} {last_name}".strip()
    if first_name:
        return first_name
    if last_name:
        return last_name
    return ""


def extract_email_from_answers(answers: List[Dict[str, Any]]) -> str:
    if not isinstance(answers, list):
        return ""
    for answer in answers:
        q = str(answer.get("questionText", "")).lower()
        a = str(answer.get("answer", "")).strip()
        if "email" in q and "@" in a:
            return a
    return ""


def get_cv_url_from_application(app: Dict[str, Any]) -> str:
    cv = (app.get("cvUrl") or app.get("resumeUrl") or "").strip()
    if cv:
        return cv
    for answer in app.get("answers") or []:
        q = str(answer.get("questionText", "")).lower()
        if any(k in q for k in ("cv", "resume", "upload")):
            a = str(answer.get("answer", "")).strip()
            if a.startswith("http"):
                return a
    return ""


def filename_from_url(url: str) -> str:
    try:
        path = urlparse(url).path
        name = unquote(path.split("/")[-1] or "")
        return name.split("?")[0]
    except Exception:
        return ""


async def build_application_index(db) -> Dict[str, Dict[str, Any]]:
    """Map normalized CV URL -> application metadata."""
    index: Dict[str, Dict[str, Any]] = {}
    cursor = db.applications.find(
        {},
        {
            "cvUrl": 1,
            "resumeUrl": 1,
            "answers": 1,
            "status": 1,
            "appliedDate": 1,
            "user": 1,
            "aiRankScore": 1,
            "aiRankRecommendation": 1,
        },
    )
    async for app in cursor:
        cv_url = get_cv_url_from_application(app)
        if not cv_url:
            continue
        key = normalize_cv_url(cv_url)
        if not key:
            continue
        user = app.get("user") or {}
        name = (
            extract_name_from_answers(app.get("answers") or [])
            or (user.get("name") if isinstance(user, dict) else "")
            or ""
        )
        email = (
            extract_email_from_answers(app.get("answers") or [])
            or (user.get("email") if isinstance(user, dict) else "")
            or ""
        )
        index[key] = {
            "applicationId": str(app.get("_id", "")),
            "name": name,
            "email": email,
            "status": app.get("status", ""),
            "appliedDate": app.get("appliedDate"),
            "cvUrl": cv_url,
            "aiRankScore": app.get("aiRankScore"),
            "aiRankRecommendation": app.get("aiRankRecommendation"),
        }
    return index


def list_dropbox_files(dbx: dropbox.Dropbox, folder: str) -> List[FileMetadata]:
    """Recursively list files under a Dropbox folder."""
    files: List[FileMetadata] = []
    try:
        result = dbx.files_list_folder(folder, recursive=True)
        while True:
            for entry in result.entries:
                if isinstance(entry, FileMetadata):
                    ext = os.path.splitext(entry.name)[1].lower()
                    if ext in CV_EXTENSIONS:
                        files.append(entry)
            if not result.has_more:
                break
            result = dbx.files_list_folder_continue(result.cursor)
    except ApiError as e:
        if e.error.is_path() and e.error.get_path().is_not_found():
            logger.warning("Dropbox folder not found: %s", folder)
            return []
        raise
    return files


def get_shared_link(dbx: dropbox.Dropbox, dropbox_path: str) -> str:
    """Get or create a public shared link for a Dropbox file."""
    try:
        links = dbx.sharing_list_shared_links(path=dropbox_path).links
        if links:
            url = links[0].url
        else:
            link = dbx.sharing_create_shared_link_with_settings(
                dropbox_path,
                settings=dropbox.sharing.SharedLinkSettings(
                    requested_visibility=dropbox.sharing.RequestedVisibility.public
                ),
            )
            url = link.url
        return url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "?dl=1")
    except ApiError as e:
        if e.error.is_shared_link_already_exists():
            links = dbx.sharing_list_shared_links(path=dropbox_path).links
            if links:
                url = links[0].url
                return url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
        logger.error("Failed to get shared link for %s: %s", dropbox_path, e)
        return ""


def try_extract_pdf_metadata(dbx: dropbox.Dropbox, dropbox_path: str) -> Tuple[str, str]:
    """Download PDF and extract name/email from text (best-effort; never raises)."""
    if not dropbox_path.lower().endswith(".pdf"):
        return "", ""
    try:
        _, response = dbx.files_download(dropbox_path)
        data = response.content
    except Exception as e:
        logger.debug("PDF download failed for %s: %s", dropbox_path, e)
        return "", ""

    text = extract_text_from_pdf_bytes(data)
    if not text:
        return "", ""
    return extract_contact_from_cv_text(text)


CV_VAULT_COLLECTION = "cv_vault"
CV_VAULT_META_COLLECTION = "cv_vault_meta"
CV_VAULT_META_ID = "sync_state"


def _serialize_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        text = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(text)
    except (TypeError, ValueError):
        return None


def _quality_fields(entry: Dict[str, Any], synced_at: datetime) -> Dict[str, Any]:
    name = (entry.get("name") or "").strip()
    email = (entry.get("email") or "").strip()
    has_name = bool(name and name.lower() not in ("unknown", "incomplete application"))
    has_email = bool(email and "@" in email)
    has_application = bool(entry.get("applicationId"))
    completeness = int(has_name) + int(has_email) + int(has_application)
    sort_ts = (
        _parse_timestamp(entry.get("modifiedAt"))
        or _parse_timestamp(entry.get("appliedDate"))
        or synced_at
    )
    return {
        "hasEmail": has_email,
        "hasName": has_name,
        "hasApplication": has_application,
        "completenessScore": completeness,
        "sortTimestamp": sort_ts,
    }


def entry_to_db_doc(entry: Dict[str, Any], synced_at: datetime) -> Dict[str, Any]:
    """Map API entry shape to MongoDB document."""
    quality = _quality_fields(entry, synced_at)
    doc = {
        "vaultId": entry["id"],
        "name": entry.get("name") or "Unknown",
        "email": entry.get("email") or "",
        "cvUrl": entry.get("cvUrl") or "",
        "dropboxPath": entry.get("dropboxPath") or "",
        "fileName": entry.get("fileName") or "",
        "source": entry.get("source") or "dropbox",
        "applicationId": entry.get("applicationId"),
        "applicationStatus": entry.get("applicationStatus"),
        "appliedDate": _serialize_date(entry.get("appliedDate")),
        "modifiedAt": entry.get("modifiedAt"),
        "size": entry.get("size"),
        "aiRankScore": entry.get("aiRankScore"),
        "aiRankRecommendation": entry.get("aiRankRecommendation"),
        "nameSource": entry.get("nameSource"),
        "emailSource": entry.get("emailSource"),
        "syncedAt": synced_at,
        "updatedAt": synced_at,
        **quality,
    }
    if entry.get("linkSource"):
        doc["linkSource"] = entry["linkSource"]
    return doc


VALID_SORTS = {
    "complete_first",
    "dropbox_newest",
    "dropbox_oldest",
    "applied_newest",
    "applied_oldest",
    "name_asc",
    "name_desc",
}


EMAIL_PRESENT_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+", re.IGNORECASE)


def _email_present_match() -> Dict[str, Any]:
    """Match rows with an email (flag or raw field — supports legacy cache docs)."""
    return {
        "$or": [
            {"hasEmail": True},
            {"email": {"$regex": EMAIL_PRESENT_RE.pattern, "$options": "i"}},
        ]
    }


def _email_absent_match() -> Dict[str, Any]:
    return {
        "$and": [
            {
                "$or": [
                    {"hasEmail": False},
                    {"hasEmail": {"$exists": False}},
                ]
            },
            {
                "$or": [
                    {"email": {"$in": [None, ""]}},
                    {"email": {"$exists": False}},
                    {"email": {"$not": {"$regex": "@", "$options": "i"}}},
                ]
            },
        ]
    }


def _name_present_match() -> Dict[str, Any]:
    return {
        "$or": [
            {"hasName": True},
            {
                "name": {
                    "$exists": True,
                    "$type": "string",
                    "$nin": list(INVALID_NAMES),
                    "$regex": r"\S",
                }
            },
        ]
    }


def _name_absent_match() -> Dict[str, Any]:
    return {
        "$or": [
            {"hasName": False},
            {"hasName": {"$exists": False}},
            {"name": {"$in": [None, ""]}},
            {"name": {"$exists": False}},
            {"name": {"$regex": r"^\s*unknown\s*$", "$options": "i"}},
        ]
    }


def _linked_application_match() -> Dict[str, Any]:
    return {
        "$or": [
            {"hasApplication": True},
            {"applicationId": {"$exists": True, "$nin": [None, ""]}},
        ]
    }


def _not_linked_application_match() -> Dict[str, Any]:
    return {
        "$and": [
            {
                "$or": [
                    {"hasApplication": False},
                    {"hasApplication": {"$exists": False}},
                ]
            },
            {
                "$or": [
                    {"applicationId": {"$in": [None, ""]}},
                    {"applicationId": {"$exists": False}},
                ]
            },
        ]
    }


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    if not value or not str(value).strip():
        return None
    try:
        text = str(value).strip()
        if len(text) == 10:
            return datetime.fromisoformat(text)
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _build_applied_date_clause(
    date_from: Optional[str], date_to: Optional[str]
) -> Optional[Dict[str, Any]]:
    from_dt = _parse_iso_date(date_from)
    to_dt = _parse_iso_date(date_to)
    if not from_dt and not to_dt:
        return None
    range_filter: Dict[str, Any] = {}
    if from_dt:
        range_filter["$gte"] = from_dt.strftime("%Y-%m-%d")
    if to_dt:
        range_filter["$lt"] = (to_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    return {"appliedDate": range_filter}


def _build_vault_match_query(
    *,
    search: str = "",
    has_email: Optional[bool] = None,
    has_name: Optional[bool] = None,
    linked_application: Optional[bool] = None,
    source: Optional[str] = None,
    contact_filter: str = "all",
    application_status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    clauses: List[Dict[str, Any]] = []

    if search.strip():
        pattern = re.escape(search.strip())
        clauses.append(
            {
                "$or": [
                    {"name": {"$regex": pattern, "$options": "i"}},
                    {"email": {"$regex": pattern, "$options": "i"}},
                    {"fileName": {"$regex": pattern, "$options": "i"}},
                    {"dropboxPath": {"$regex": pattern, "$options": "i"}},
                ]
            }
        )

    if has_email is True:
        clauses.append(_email_present_match())
    elif has_email is False:
        clauses.append(_email_absent_match())

    if has_name is True:
        clauses.append(_name_present_match())
    elif has_name is False:
        clauses.append(_name_absent_match())

    if linked_application is True:
        clauses.append(_linked_application_match())
    elif linked_application is False:
        clauses.append(_not_linked_application_match())

    if source and source != "all":
        clauses.append({"source": source})

    if contact_filter == "complete":
        clauses.append(_email_present_match())
        clauses.append(_name_present_match())
    elif contact_filter == "missing":
        clauses.append({"$or": [_email_absent_match(), _name_absent_match()]})

    if application_status and application_status != "all":
        clauses.append({"applicationStatus": application_status})

    date_clause = _build_applied_date_clause(date_from, date_to)
    if date_clause:
        clauses.append(date_clause)

    if not clauses:
        return {}
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


async def repair_cv_vault_quality_flags(db) -> int:
    """Backfill quality flags on legacy cache documents (fast bulk updates)."""
    collection = db[CV_VAULT_COLLECTION]
    repaired = 0
    email_re = EMAIL_PRESENT_RE.pattern

    updates = [
        (
            {
                "email": {"$regex": email_re, "$options": "i"},
                "hasEmail": {"$ne": True},
            },
            {"hasEmail": True},
        ),
        (
            {
                "$or": [
                    {"email": {"$in": [None, ""]}},
                    {"email": {"$exists": False}},
                    {"email": {"$not": {"$regex": "@", "$options": "i"}}},
                ],
                "hasEmail": {"$ne": False},
            },
            {"hasEmail": False},
        ),
        (
            {
                "applicationId": {"$exists": True, "$nin": [None, ""]},
                "hasApplication": {"$ne": True},
            },
            {"hasApplication": True},
        ),
        (
            {
                "$or": [
                    {"applicationId": {"$in": [None, ""]}},
                    {"applicationId": {"$exists": False}},
                ],
                "hasApplication": {"$ne": False},
            },
            {"hasApplication": False},
        ),
        (
            {
                "name": {
                    "$exists": True,
                    "$type": "string",
                    "$nin": list(INVALID_NAMES),
                    "$regex": r"\S",
                },
                "hasName": {"$ne": True},
            },
            {"hasName": True},
        ),
        (
            {
                "$or": [
                    {"name": {"$in": [None, ""]}},
                    {"name": {"$exists": False}},
                    {"name": {"$regex": r"^\s*unknown\s*$", "$options": "i"}},
                ],
                "hasName": {"$ne": False},
            },
            {"hasName": False},
        ),
    ]

    for match, sets in updates:
        result = await collection.update_many(match, {"$set": sets})
        repaired += result.modified_count

    return repaired


def _vault_sort_spec(sort: str) -> List[tuple]:
    if sort == "dropbox_newest":
        return [("sortTimestamp", -1), ("name", 1)]
    if sort == "dropbox_oldest":
        return [("sortTimestamp", 1), ("name", 1)]
    if sort == "applied_newest":
        return [("appliedDate", -1), ("sortTimestamp", -1), ("name", 1)]
    if sort == "applied_oldest":
        return [("appliedDate", 1), ("sortTimestamp", -1), ("name", 1)]
    if sort == "name_desc":
        return [("name", -1)]
    if sort == "name_asc":
        return [("name", 1)]
    # complete_first (default): richest profiles first, then newest on Dropbox
    return [("completenessScore", -1), ("sortTimestamp", -1), ("name", 1)]


def db_doc_to_entry(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Map MongoDB document to API entry shape."""
    return {
        "id": doc.get("vaultId", ""),
        "name": doc.get("name") or "Unknown",
        "email": doc.get("email") or "",
        "cvUrl": doc.get("cvUrl") or "",
        "dropboxPath": doc.get("dropboxPath") or "",
        "fileName": doc.get("fileName") or "",
        "source": doc.get("source") or "dropbox",
        "applicationId": doc.get("applicationId"),
        "applicationStatus": doc.get("applicationStatus"),
        "appliedDate": doc.get("appliedDate"),
        "modifiedAt": doc.get("modifiedAt"),
        "size": doc.get("size"),
        "aiRankScore": doc.get("aiRankScore"),
        "aiRankRecommendation": doc.get("aiRankRecommendation"),
        "nameSource": doc.get("nameSource"),
        "emailSource": doc.get("emailSource"),
    }


async def _enrich_vault_items_with_application_data(
    db, items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Overlay live application status, AI rank, and applied date on cached vault rows."""
    from bson import ObjectId

    app_ids = [item["applicationId"] for item in items if item.get("applicationId")]
    if not app_ids:
        return items

    object_ids = []
    for app_id in app_ids:
        try:
            object_ids.append(ObjectId(app_id))
        except Exception:
            continue
    if not object_ids:
        return items

    app_map: Dict[str, Dict[str, Any]] = {}
    cursor = db.applications.find(
        {"_id": {"$in": object_ids}},
        {
            "status": 1,
            "aiRankScore": 1,
            "aiRankRecommendation": 1,
            "appliedDate": 1,
            "position": 1,
            "phoneNumber": 1,
            "location": 1,
            "jobId": 1,
            "user": 1,
        },
    )
    async for doc in cursor:
        app_map[str(doc["_id"])] = doc

    for item in items:
        app_id = item.get("applicationId")
        if not app_id or app_id not in app_map:
            continue
        app = app_map[app_id]
        if app.get("status"):
            item["applicationStatus"] = app["status"]
        if app.get("aiRankScore") is not None:
            item["aiRankScore"] = app["aiRankScore"]
        if app.get("aiRankRecommendation"):
            item["aiRankRecommendation"] = app["aiRankRecommendation"]
        if app.get("appliedDate"):
            item["appliedDate"] = _serialize_date(app["appliedDate"])
        if app.get("position"):
            item["position"] = app["position"]
        phone = app.get("phoneNumber") or ""
        if not phone and isinstance(app.get("user"), dict):
            phone = app["user"].get("phoneNumber") or ""
        if phone:
            item["phoneNumber"] = phone
        if app.get("location"):
            item["location"] = app["location"]
        job_id = app.get("jobId")
        if job_id is not None:
            if isinstance(job_id, dict):
                job_id = job_id.get("_id") or job_id.get("id")
            item["jobId"] = str(job_id) if job_id else None

    return items


def _compute_stats(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "withEmail": sum(1 for e in entries if e.get("email")),
        "withApplication": sum(1 for e in entries if e.get("applicationId")),
        "dropboxFolders": DROPBOX_CV_FOLDERS,
    }


async def build_cv_vault_entries(
    db,
    dbx,
    *,
    extract_pdf: bool = True,
) -> List[Dict[str, Any]]:
    """Build CV vault entries from Dropbox + applications (live fetch)."""
    app_index = await build_application_index(db)

    all_files: List[FileMetadata] = []
    for folder in DROPBOX_CV_FOLDERS:
        path = folder if folder.startswith("/") else f"/{folder}"
        try:
            all_files.extend(list_dropbox_files(dbx, path))
        except Exception as e:
            logger.error("Failed to list Dropbox folder %s: %s", path, e)

    return merge_vault_entries(
        all_files,
        dbx,
        app_index,
        extract_pdf=extract_pdf,
    )


async def _load_manual_vault_links(db) -> Dict[str, Dict[str, Any]]:
    """Vault rows linked manually in admin (survive Dropbox resync)."""
    collection = db[CV_VAULT_COLLECTION]
    manual: Dict[str, Dict[str, Any]] = {}
    cursor = collection.find(
        {
            "linkSource": "manual",
            "applicationId": {"$exists": True, "$nin": [None, ""]},
        },
        {"vaultId": 1, "applicationId": 1},
    )
    async for doc in cursor:
        vault_id = doc.get("vaultId")
        app_id = doc.get("applicationId")
        if vault_id and app_id:
            manual[vault_id] = {"applicationId": app_id}
    return manual


async def _apply_manual_link_to_entry(
    db, entry: Dict[str, Any], application_id: str
) -> None:
    """Overlay application metadata on a vault entry after manual link."""
    from bson import ObjectId

    try:
        app = await db.applications.find_one(
            {"_id": ObjectId(application_id)},
            {
                "status": 1,
                "appliedDate": 1,
                "aiRankScore": 1,
                "aiRankRecommendation": 1,
                "answers": 1,
                "name": 1,
                "email": 1,
                "user": 1,
            },
        )
    except Exception:
        app = None
    if not app:
        entry["applicationId"] = application_id
        entry["linkSource"] = "manual"
        return

    user = app.get("user") or {}
    app_name = (
        extract_name_from_answers(app.get("answers") or [])
        or app.get("name")
        or (user.get("name") if isinstance(user, dict) else "")
        or ""
    )
    app_email = (
        extract_email_from_answers(app.get("answers") or [])
        or app.get("email")
        or (user.get("email") if isinstance(user, dict) else "")
        or ""
    )

    entry["applicationId"] = application_id
    entry["linkSource"] = "manual"
    entry["applicationStatus"] = app.get("status", "")
    entry["appliedDate"] = app.get("appliedDate")
    entry["aiRankScore"] = app.get("aiRankScore")
    entry["aiRankRecommendation"] = app.get("aiRankRecommendation")

    if app_name and _is_missing_name(entry.get("name", "")):
        entry["name"] = app_name
        entry["nameSource"] = CONTACT_SOURCE_APPLICATION
    if app_email and not (entry.get("email") or "").strip():
        entry["email"] = app_email
        entry["emailSource"] = CONTACT_SOURCE_APPLICATION


async def persist_cv_vault_entries(db, entries: List[Dict[str, Any]]) -> Dict[str, int]:
    """Upsert CV vault entries into MongoDB; remove stale records."""
    collection = db[CV_VAULT_COLLECTION]
    now = datetime.utcnow()
    vault_ids: List[str] = []
    manual_links = await _load_manual_vault_links(db)

    for entry in entries:
        vault_id = entry.get("id")
        if not vault_id:
            continue
        if not entry.get("applicationId") and vault_id in manual_links:
            await _apply_manual_link_to_entry(
                db, entry, manual_links[vault_id]["applicationId"]
            )
        vault_ids.append(vault_id)
        doc = entry_to_db_doc(entry, now)
        await collection.update_one(
            {"vaultId": vault_id},
            {"$set": doc, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )

    removed = 0
    if vault_ids:
        result = await collection.delete_many({"vaultId": {"$nin": vault_ids}})
        removed = result.deleted_count
    else:
        result = await collection.delete_many({})
        removed = result.deleted_count

    stats = _compute_stats(entries)
    await db[CV_VAULT_META_COLLECTION].update_one(
        {"_id": CV_VAULT_META_ID},
        {
            "$set": {
                "lastSyncedAt": now,
                "total": len(entries),
                "stats": stats,
                "updatedAt": now,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )

    extracted_names = sum(
        1 for entry in entries if entry.get("nameSource") == CONTACT_SOURCE_CV_TEXT
    )
    extracted_emails = sum(
        1 for entry in entries if entry.get("emailSource") == CONTACT_SOURCE_CV_TEXT
    )

    return {
        "upserted": len(vault_ids),
        "removed": removed,
        "extractedNames": extracted_names,
        "extractedEmails": extracted_emails,
    }


async def list_cv_vault_from_db(
    db,
    *,
    search: str = "",
    sort: str = "complete_first",
    has_email: Optional[bool] = None,
    has_name: Optional[bool] = None,
    linked_application: Optional[bool] = None,
    source: Optional[str] = None,
    contact_filter: str = "all",
    application_status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
) -> Dict[str, Any]:
    """Read CV vault entries from MongoDB with filters and sorting."""
    if sort not in VALID_SORTS:
        sort = "complete_first"

    try:
        await repair_cv_vault_quality_flags(db)
    except Exception as e:
        logger.warning("CV vault quality flag repair skipped: %s", e)

    query = _build_vault_match_query(
        search=search,
        has_email=has_email,
        has_name=has_name,
        linked_application=linked_application,
        source=source,
        contact_filter=contact_filter,
        application_status=application_status,
        date_from=date_from,
        date_to=date_to,
    )

    collection = db[CV_VAULT_COLLECTION]
    safe_skip = max(0, skip)
    safe_limit = max(1, min(limit, 100))
    cursor = (
        collection.find(query)
        .sort(_vault_sort_spec(sort))
        .skip(safe_skip)
        .limit(safe_limit)
    )
    items: List[Dict[str, Any]] = []
    async for doc in cursor:
        items.append(db_doc_to_entry(doc))

    items = await _enrich_vault_items_with_application_data(db, items)

    meta = await db[CV_VAULT_META_COLLECTION].find_one({"_id": CV_VAULT_META_ID})
    last_synced = None
    if meta and meta.get("lastSyncedAt"):
        last_synced = _serialize_date(meta["lastSyncedAt"])

    filtered_total = await collection.count_documents(query)
    cache_total = await collection.count_documents({})
    global_stats = (meta or {}).get("stats") or {}
    matched_stats = _compute_stats(items)

    total_pages = (filtered_total + safe_limit - 1) // safe_limit if filtered_total else 0

    return {
        "items": items,
        "total": filtered_total,
        "filteredTotal": filtered_total,
        "cacheTotal": cache_total,
        "skip": safe_skip,
        "limit": safe_limit,
        "page": safe_skip // safe_limit + 1 if safe_limit else 1,
        "totalPages": total_pages,
        "stats": {
            "withEmail": global_stats.get("withEmail", 0),
            "withApplication": global_stats.get("withApplication", 0),
            "dropboxFolders": DROPBOX_CV_FOLDERS,
            "matchingFilters": filtered_total,
        },
        "matchedStats": matched_stats,
        "lastSyncedAt": last_synced,
        "cached": True,
        "sort": sort,
        "filters": {
            "search": search,
            "has_email": has_email,
            "has_name": has_name,
            "linked_application": linked_application,
            "source": source or "all",
            "contact_filter": contact_filter,
            "application_status": application_status or "all",
            "date_from": date_from,
            "date_to": date_to,
        },
    }


async def sync_cv_vault_from_dropbox(
    db,
    dbx,
    *,
    extract_pdf: bool = True,
    search: str = "",
    sort: str = "complete_first",
    has_email: Optional[bool] = None,
    has_name: Optional[bool] = None,
    linked_application: Optional[bool] = None,
    source: Optional[str] = None,
    contact_filter: str = "all",
    application_status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
) -> Dict[str, Any]:
    """Sync Dropbox CVs into MongoDB and return the vault payload."""
    entries = await build_cv_vault_entries(db, dbx, extract_pdf=extract_pdf)
    sync_result = await persist_cv_vault_entries(db, entries)
    logger.info(
        "CV vault synced: %s entries, %s removed from cache",
        sync_result["upserted"],
        sync_result["removed"],
    )
    payload = await list_cv_vault_from_db(
        db,
        search=search,
        sort=sort,
        has_email=has_email,
        has_name=has_name,
        linked_application=linked_application,
        source=source,
        contact_filter=contact_filter,
        application_status=application_status,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    payload["cached"] = False
    payload["sync"] = sync_result
    return payload


async def link_cv_vault_entry(
    db,
    vault_id: str,
    application_id: str,
) -> Dict[str, Any]:
    """Link a cached CV vault row to an existing application."""
    from bson import ObjectId

    if not vault_id or not application_id:
        raise ValueError("vaultId and applicationId are required")

    collection = db[CV_VAULT_COLLECTION]
    vault_doc = await collection.find_one({"vaultId": vault_id})
    if not vault_doc:
        raise ValueError("CV vault entry not found")

    try:
        app_oid = ObjectId(application_id)
    except Exception:
        raise ValueError("Invalid application ID")

    app = await db.applications.find_one({"_id": app_oid})
    if not app:
        raise ValueError("Application not found")

    cv_url = (vault_doc.get("cvUrl") or "").strip()
    app_cv = get_cv_url_from_application(app)
    now = datetime.utcnow()

    if cv_url and not app_cv:
        await db.applications.update_one(
            {"_id": app_oid},
            {"$set": {"cvUrl": cv_url, "updatedAt": now}},
        )

    entry = db_doc_to_entry(vault_doc)
    await _apply_manual_link_to_entry(db, entry, application_id)

    doc = entry_to_db_doc(entry, now)
    doc["linkSource"] = "manual"
    doc["updatedAt"] = now
    await collection.update_one({"vaultId": vault_id}, {"$set": doc})

    updated = await collection.find_one({"vaultId": vault_id})
    item = db_doc_to_entry(updated)
    items = await _enrich_vault_items_with_application_data(db, [item])
    return items[0]


CV_VAULT_APPLICATION_STATUSES = [
    "New",
    "Shortlisted",
    "Technical Assessment",
    "Interviewing",
    "Hired",
    "Rejected",
    "Disqualified",
]


async def _upsert_password_reset_token(db, email: str, user_id: str) -> str:
    import secrets

    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(days=7)
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


async def create_application_from_cv_vault(
    db,
    vault_id: str,
    job_id: str,
    status: str = "New",
    *,
    email_override: Optional[str] = None,
    name_override: Optional[str] = None,
    created_by: Optional[str] = None,
    frontend_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an application (and user if needed) from a CV vault row, then link it."""
    import asyncio
    import secrets
    from bson import ObjectId

    from app.auth import get_password_hash
    from app.utils.status_history import StatusHistoryManager

    if not vault_id or not job_id:
        raise ValueError("vaultId and jobId are required")

    normalized_status = (status or "New").strip()
    if normalized_status not in CV_VAULT_APPLICATION_STATUSES:
        raise ValueError(
            f"Invalid status. Must be one of: {', '.join(CV_VAULT_APPLICATION_STATUSES)}"
        )

    collection = db[CV_VAULT_COLLECTION]
    vault_doc = await collection.find_one({"vaultId": vault_id})
    if not vault_doc:
        raise ValueError("CV vault entry not found")

    if vault_doc.get("applicationId"):
        raise ValueError("This CV is already linked to an application")

    email = (email_override or vault_doc.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("A valid email is required. Enter one manually if the CV has none.")

    name = (name_override or vault_doc.get("name") or "").strip()
    if not name or name.lower() in INVALID_NAMES:
        stem = os.path.splitext(vault_doc.get("fileName") or "")[0]
        name = parse_name_from_filename(stem) if stem else ""
    if not name or name.lower() in INVALID_NAMES:
        name = email.split("@")[0]

    try:
        job_oid = ObjectId(job_id)
    except Exception:
        raise ValueError("Invalid job ID")

    job = await db.jobpostings.find_one({"_id": job_oid})
    if not job:
        raise ValueError("Job posting not found")

    email_filter = {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
    user = await db.users.find_one(email_filter)
    user_created = False
    password_setup_email_sent = False
    now = datetime.utcnow()

    if not user:
        temp_password = secrets.token_urlsafe(24)
        hashed_password = await asyncio.to_thread(get_password_hash, temp_password)
        user_doc = {
            "email": email,
            "name": name,
            "password": hashed_password,
            "role": "USER",
            "isEmailVerified": True,
            "needsPasswordSetup": True,
            "createdAt": now,
            "updatedAt": now,
        }
        insert_result = await db.users.insert_one(user_doc)
        user = {**user_doc, "_id": insert_result.inserted_id}
        user_created = True

    user_id = str(user["_id"])

    existing_application = await db.applications.find_one(
        {"userId": user_id, "jobId": job_id}
    )
    if existing_application:
        raise ValueError("This user already has an application for the selected job")

    cv_url = (vault_doc.get("cvUrl") or "").strip()
    position = job.get("title") or "Position"

    status_history = StatusHistoryManager.initialize_status_history(
        initial_status=normalized_status,
        applied_date=now,
        user_id=created_by,
    )
    if status_history:
        status_history[0]["reason"] = "Created from CV vault"
        status_history[0]["metadata"] = {
            "source": "cv_vault_link",
            "automatedChange": True,
            "vaultId": vault_id,
        }

    legacy_fields = StatusHistoryManager.sync_legacy_fields(status_history)
    application_doc: Dict[str, Any] = {
        "userId": user_id,
        "jobId": job_id,
        "name": name,
        "email": email,
        "position": position,
        "status": normalized_status,
        "cvUrl": cv_url,
        "appliedDate": now,
        "createdAt": now,
        "updatedAt": now,
        "statusHistory": status_history,
        "source": "cv_vault",
        "user": {"id": user_id, "email": email, "name": name},
    }
    application_doc.update(legacy_fields)

    insert_result = await db.applications.insert_one(application_doc)
    application_id = str(insert_result.inserted_id)

    if cv_url:
        from app.lib.cv_contact_extract import sync_contact_after_insert

        await sync_contact_after_insert(db, insert_result.inserted_id, cv_url=cv_url)

    entry = db_doc_to_entry(vault_doc)
    await _apply_manual_link_to_entry(db, entry, application_id)
    doc = entry_to_db_doc(entry, now)
    doc["linkSource"] = "manual"
    doc["updatedAt"] = now
    await collection.update_one({"vaultId": vault_id}, {"$set": doc})

    updated = await collection.find_one({"vaultId": vault_id})
    item = db_doc_to_entry(updated)
    items = await _enrich_vault_items_with_application_data(db, [item])
    linked_item = items[0]

    needs_password_email = user_created or bool(
        user.get("needsPasswordSetup")
    ) or not user.get("password")

    if needs_password_email and frontend_url:
        try:
            from app.lib.email import send_password_reset_email

            token = await _upsert_password_reset_token(db, email, user_id)
            reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={token}"
            sent = await send_password_reset_email(
                email=email,
                reset_link=reset_link,
                frontend_url=frontend_url,
            )
            password_setup_email_sent = bool(sent)
            if needs_password_email:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"needsPasswordSetup": True, "updatedAt": now}},
                )
        except Exception as exc:
            logger.warning("Failed to send password setup email to %s: %s", email, exc)

    return {
        "item": linked_item,
        "applicationId": application_id,
        "userId": user_id,
        "userCreated": user_created,
        "passwordSetupEmailSent": password_setup_email_sent,
    }


async def create_manual_application_for_job(
    db,
    job_id: str,
    *,
    email: str,
    name: str,
    status: str = "New",
    cv_url: Optional[str] = None,
    phone_number: Optional[str] = None,
    location: Optional[str] = None,
    created_by: Optional[str] = None,
    frontend_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an application (and user if needed) from admin manual pipeline entry."""
    import asyncio
    import secrets
    from bson import ObjectId

    from app.auth import get_password_hash
    from app.utils.status_history import StatusHistoryManager

    if not job_id:
        raise ValueError("jobId is required")

    normalized_status = (status or "New").strip()
    if normalized_status not in CV_VAULT_APPLICATION_STATUSES:
        raise ValueError(
            f"Invalid status. Must be one of: {', '.join(CV_VAULT_APPLICATION_STATUSES)}"
        )

    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("A valid email is required.")

    name = (name or "").strip()
    if not name or name.lower() in INVALID_NAMES:
        name = email.split("@")[0]

    phone_number = (phone_number or "").strip() or None
    location = (location or "").strip() or None

    try:
        job_oid = ObjectId(job_id)
    except Exception:
        raise ValueError("Invalid job ID")

    job = await db.jobpostings.find_one({"_id": job_oid})
    if not job:
        raise ValueError("Job posting not found")

    email_filter = {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
    user = await db.users.find_one(email_filter)
    user_created = False
    password_setup_email_sent = False
    now = datetime.utcnow()

    if not user:
        temp_password = secrets.token_urlsafe(24)
        hashed_password = await asyncio.to_thread(get_password_hash, temp_password)
        user_doc = {
            "email": email,
            "name": name,
            "password": hashed_password,
            "role": "USER",
            "isEmailVerified": True,
            "needsPasswordSetup": True,
            "createdAt": now,
            "updatedAt": now,
        }
        insert_result = await db.users.insert_one(user_doc)
        user = {**user_doc, "_id": insert_result.inserted_id}
        user_created = True

    user_id = str(user["_id"])

    existing_application = await db.applications.find_one(
        {"userId": user_id, "jobId": job_id}
    )
    if existing_application:
        raise ValueError("This user already has an application for the selected job")

    position = job.get("title") or "Position"
    status_history = StatusHistoryManager.initialize_status_history(
        initial_status=normalized_status,
        applied_date=now,
        user_id=created_by,
    )
    if status_history:
        status_history[0]["reason"] = "Added manually from pipeline"
        status_history[0]["metadata"] = {
            "source": "admin_manual",
            "automatedChange": True,
        }

    legacy_fields = StatusHistoryManager.sync_legacy_fields(status_history)
    application_doc: Dict[str, Any] = {
        "userId": user_id,
        "jobId": job_id,
        "name": name,
        "email": email,
        "position": position,
        "status": normalized_status,
        "cvUrl": (cv_url or "").strip(),
        "appliedDate": now,
        "createdAt": now,
        "updatedAt": now,
        "statusHistory": status_history,
        "source": "admin_manual",
        "user": {"id": user_id, "email": email, "name": name},
    }
    if phone_number:
        application_doc["phoneNumber"] = phone_number
    if location:
        application_doc["location"] = location
    application_doc.update(legacy_fields)

    insert_result = await db.applications.insert_one(application_doc)
    application_id = str(insert_result.inserted_id)

    if (cv_url or "").strip():
        from app.lib.cv_contact_extract import sync_contact_after_insert

        await sync_contact_after_insert(
            db, insert_result.inserted_id, cv_url=(cv_url or "").strip()
        )

    needs_password_email = user_created or bool(
        user.get("needsPasswordSetup")
    ) or not user.get("password")

    if needs_password_email and frontend_url:
        try:
            from app.lib.email import send_password_reset_email

            token = await _upsert_password_reset_token(db, email, user_id)
            reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={token}"
            sent = await send_password_reset_email(
                email=email,
                reset_link=reset_link,
                frontend_url=frontend_url,
            )
            password_setup_email_sent = bool(sent)
            if needs_password_email:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"needsPasswordSetup": True, "updatedAt": now}},
                )
        except Exception as exc:
            logger.warning("Failed to send password setup email to %s: %s", email, exc)

    saved = await db.applications.find_one({"_id": insert_result.inserted_id})
    if saved:
        saved["id"] = str(saved.pop("_id"))
        if "userId" in saved and not isinstance(saved["userId"], str):
            saved["userId"] = str(saved["userId"])
        if "jobId" in saved and not isinstance(saved["jobId"], str):
            try:
                saved["jobId"] = str(saved["jobId"])
            except Exception:
                pass

    return {
        "applicationId": application_id,
        "application": saved,
        "userId": user_id,
        "userCreated": user_created,
        "passwordSetupEmailSent": password_setup_email_sent,
    }


async def suggest_applications_for_vault(
    db,
    vault_id: str,
    *,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Suggest applications that may match an unlinked vault row."""
    collection = db[CV_VAULT_COLLECTION]
    vault_doc = await collection.find_one({"vaultId": vault_id})
    if not vault_doc:
        return []

    email = (vault_doc.get("email") or "").strip().lower()
    name = (vault_doc.get("name") or "").strip()
    file_name = (vault_doc.get("fileName") or "").strip()

    clauses: List[Dict[str, Any]] = []
    if email and "@" in email:
        clauses.append({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
        clauses.append({"user.email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if name and name.lower() not in ("unknown", "incomplete application"):
        pattern = re.escape(name)
        clauses.append({"name": {"$regex": pattern, "$options": "i"}})
        clauses.append({"user.name": {"$regex": pattern, "$options": "i"}})
    if file_name:
        stem = os.path.splitext(file_name)[0]
        parsed = parse_name_from_filename(file_name)
        if parsed:
            pattern = re.escape(parsed)
            clauses.append({"name": {"$regex": pattern, "$options": "i"}})
        if stem and len(stem) >= 4:
            clauses.append(
                {"cvUrl": {"$regex": re.escape(stem), "$options": "i"}}
            )

    if not clauses:
        return []

    match_query = {"$or": clauses}
    safe_limit = max(1, min(limit, 25))
    cursor = db.applications.find(
        match_query,
        {
            "name": 1,
            "email": 1,
            "status": 1,
            "position": 1,
            "appliedDate": 1,
            "cvUrl": 1,
            "answers": 1,
            "user": 1,
        },
    ).sort("appliedDate", -1).limit(safe_limit)

    results: List[Dict[str, Any]] = []
    async for doc in cursor:
        user = doc.get("user") or {}
        display_name = (
            doc.get("name")
            or extract_name_from_answers(doc.get("answers") or [])
            or (user.get("name") if isinstance(user, dict) else "")
            or "Unknown"
        )
        display_email = (
            doc.get("email")
            or extract_email_from_answers(doc.get("answers") or [])
            or (user.get("email") if isinstance(user, dict) else "")
            or ""
        )
        results.append(
            {
                "id": str(doc["_id"]),
                "name": display_name,
                "email": display_email,
                "position": doc.get("position") or "",
                "status": doc.get("status") or "",
                "appliedDate": _serialize_date(doc.get("appliedDate")),
                "hasCvUrl": bool(get_cv_url_from_application(doc)),
            }
        )
    return results


async def get_cv_vault_filter_options(db) -> Dict[str, Any]:
    """Distinct application statuses present in the vault cache."""
    collection = db[CV_VAULT_COLLECTION]
    statuses = await collection.distinct(
        "applicationStatus",
        {"applicationStatus": {"$exists": True, "$nin": [None, ""]}},
    )
    return {
        "sorts": [
            {"value": "complete_first", "label": "Complete profiles first"},
            {"value": "dropbox_newest", "label": "Newest on Dropbox"},
            {"value": "dropbox_oldest", "label": "Oldest on Dropbox"},
            {"value": "applied_newest", "label": "Latest application date"},
            {"value": "applied_oldest", "label": "Earliest application date"},
            {"value": "name_asc", "label": "Name (A–Z)"},
            {"value": "name_desc", "label": "Name (Z–A)"},
        ],
        "applicationStatuses": sorted(s for s in statuses if s),
    }


async def fetch_cv_vault_list(
    db,
    dbx,
    *,
    search: str = "",
    extract_pdf: bool = True,
) -> Dict[str, Any]:
    """Legacy: always sync from Dropbox. Prefer sync_cv_vault_from_dropbox + list_cv_vault_from_db."""
    return await sync_cv_vault_from_dropbox(
        db, dbx, extract_pdf=extract_pdf, search=search
    )


def _resolve_contact_from_application(
    app_meta: Dict[str, Any], filename: str
) -> Tuple[str, str, Optional[str], Optional[str]]:
    """Pick name/email from application answers, with filename fallback for name."""
    app_name = (app_meta.get("name") or "").strip()
    app_email = (app_meta.get("email") or "").strip()

    name_source: Optional[str] = None
    email_source: Optional[str] = None
    name = app_name
    email = app_email

    if app_name:
        name_source = CONTACT_SOURCE_APPLICATION
    else:
        parsed = parse_name_from_filename(filename)
        if parsed:
            name = parsed
            name_source = CONTACT_SOURCE_FILENAME

    if app_email:
        email_source = CONTACT_SOURCE_APPLICATION

    return name, email, name_source, email_source


def merge_vault_entries(
    dropbox_files: List[FileMetadata],
    dbx: dropbox.Dropbox,
    app_index: Dict[str, Dict[str, Any]],
    *,
    extract_pdf: bool = True,
) -> List[Dict[str, Any]]:
    """Build unified CV vault entries from Dropbox files + applications."""
    entries: Dict[str, Dict[str, Any]] = {}
    seen_paths: Set[str] = set()

    # Applications first (may reference files outside /uploads listing)
    for key, app_meta in app_index.items():
        cv_url = app_meta.get("cvUrl", "")
        filename = filename_from_url(cv_url)
        name, email, name_source, email_source = _resolve_contact_from_application(
            app_meta, filename
        )
        entries[key] = {
            "id": key,
            "name": name or "Unknown",
            "email": email,
            "cvUrl": cv_url,
            "dropboxPath": "",
            "fileName": filename,
            "source": "application",
            "applicationId": app_meta.get("applicationId"),
            "applicationStatus": app_meta.get("status"),
            "appliedDate": app_meta.get("appliedDate"),
            "modifiedAt": None,
            "size": None,
            "aiRankScore": app_meta.get("aiRankScore"),
            "aiRankRecommendation": app_meta.get("aiRankRecommendation"),
            "nameSource": name_source,
            "emailSource": email_source,
        }

    # Dropbox files
    for meta in dropbox_files:
        path = meta.path_display or ""
        if path in seen_paths:
            continue
        seen_paths.add(path)

        cv_url = get_shared_link(dbx, path)
        key = normalize_cv_url(cv_url) if cv_url else f"path:{path}"
        filename = meta.name

        existing = entries.get(key, {})
        name = (existing.get("name") or "").strip()
        email = (existing.get("email") or "").strip()
        name_source = existing.get("nameSource")
        email_source = existing.get("emailSource")

        if _is_missing_name(name):
            parsed = parse_name_from_filename(filename)
            if parsed:
                name = parsed
                name_source = CONTACT_SOURCE_FILENAME

        if extract_pdf and _needs_cv_text_extraction(name, email):
            try:
                pdf_name, pdf_email = try_extract_pdf_metadata(dbx, path)
            except Exception as e:
                logger.debug("CV text extraction skipped for %s: %s", path, e)
                pdf_name, pdf_email = "", ""
            if pdf_name and _is_missing_name(name):
                name = pdf_name
                name_source = CONTACT_SOURCE_CV_TEXT
            if pdf_email and not email:
                email = pdf_email
                email_source = CONTACT_SOURCE_CV_TEXT

        modified = None
        if meta.client_modified:
            modified = meta.client_modified.isoformat() if hasattr(meta.client_modified, "isoformat") else str(meta.client_modified)

        entries[key] = {
            "id": key,
            "name": name or "Unknown",
            "email": email,
            "cvUrl": cv_url or existing.get("cvUrl", ""),
            "dropboxPath": path,
            "fileName": filename,
            "source": existing.get("source", "dropbox"),
            "applicationId": existing.get("applicationId"),
            "applicationStatus": existing.get("applicationStatus"),
            "appliedDate": existing.get("appliedDate"),
            "modifiedAt": modified,
            "size": meta.size,
            "aiRankScore": existing.get("aiRankScore"),
            "aiRankRecommendation": existing.get("aiRankRecommendation"),
            "nameSource": name_source,
            "emailSource": email_source,
        }

    result = list(entries.values())
    result.sort(key=lambda x: (x.get("name") or "").lower())
    return result
