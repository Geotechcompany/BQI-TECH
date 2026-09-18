"""Extract contact fields from CV text and backfill empty application fields.

Fill-if-empty only: never overwrites non-empty phone/email/location/name unless
``force=True`` is used with an empty-only merge (force only re-runs extraction
for the current CV URL; non-empty fields still win).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, Optional, Set

from bson import ObjectId

logger = logging.getLogger(__name__)

INVALID_NAMES = frozenset(
    {
        "",
        "unknown",
        "incomplete application",
        "n/a",
        "not set",
        "none",
        "applicant",
    }
)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Prefer labeled phone lines (Phone:, Mobile:, Tel:, WhatsApp:)
LABELED_PHONE_RE = re.compile(
    r"(?:(?:phone|mobile|tel(?:ephone)?|cell|whatsapp|contact\s*(?:no|number)?)"
    r"\s*[:\-–]?\s*)"
    r"((?:\+|00)?[\d][\d\s\-().]{6,22}\d)",
    re.IGNORECASE,
)

# International / local candidates (Kenya +254 with spaces, US, generic)
PHONE_CANDIDATE_RE = re.compile(
    r"(?<![\w])"
    r"(?:"
    # +254 700 000 000 / +254-700-000-000 / +254700000000
    r"\+(?:254|1|44|27|234|255|256|250|251)[\s\-().]*[\d][\d\s\-().]{6,18}\d"
    r"|"
    r"0(?:7|1)\d[\d\s\-().]{7,12}\d"
    r"|"
    r"\+?\d{1,3}[\s\-().]*\d{2,4}[\s\-().]*\d{3,4}[\s\-().]*\d{3,4}"
    r")"
    r"(?![\w])"
)

LOCATION_LABEL_RE = re.compile(
    r"(?:location|address|based\s+in|residing\s+in|city)\s*[:\-–]?\s*"
    r"([A-Za-z][A-Za-z0-9\s,.'\-/]{2,60})",
    re.IGNORECASE,
)

# Common "City, Country" near the top of a CV
CITY_COUNTRY_RE = re.compile(
    r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?,\s*"
    r"(?:Kenya|Uganda|Tanzania|Rwanda|Ethiopia|Nigeria|South Africa|"
    r"United Kingdom|UK|USA|United States|Canada|India|Germany|France))\b"
)

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

CONTACT_FIELDS = ("phoneNumber", "email", "location", "name")


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def _is_weak_name(name: Any) -> bool:
    if not isinstance(name, str):
        return True
    stripped = name.strip()
    return not stripped or stripped.lower() in INVALID_NAMES


def _digit_count(text: str) -> int:
    return sum(1 for ch in text if ch.isdigit())


def normalize_phone(raw: str) -> str:
    """Collapse odd whitespace while keeping a readable international form."""
    if not raw:
        return ""
    cleaned = re.sub(r"[^\d+]", " ", raw.strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Prefer +prefix without space after +
    cleaned = re.sub(r"^\+\s+", "+", cleaned)
    digits = _digit_count(cleaned)
    if digits < 9 or digits > 15:
        return ""
    # Reject year-like or sequential junk
    if re.fullmatch(r"20\d{2}", cleaned.replace(" ", "")):
        return ""
    return cleaned


def extract_phone_from_text(text: str) -> str:
    if not text:
        return ""

    for match in LABELED_PHONE_RE.finditer(text):
        phone = normalize_phone(match.group(1))
        if phone:
            return phone

    # Pipe / bullet contact headers: email | +254 700 000 000 | Nairobi, Kenya
    for line in text.splitlines()[:20]:
        if "|" not in line and "•" not in line and "·" not in line:
            continue
        parts = re.split(r"[|•·]", line)
        for part in parts:
            if _digit_count(part) < 9:
                continue
            for match in PHONE_CANDIDATE_RE.finditer(part):
                phone = normalize_phone(match.group(0))
                if phone:
                    return phone

    # Scan early lines first (contact header)
    head = "\n".join(text.splitlines()[:25])
    for match in PHONE_CANDIDATE_RE.finditer(head):
        phone = normalize_phone(match.group(0))
        if phone:
            return phone

    for match in PHONE_CANDIDATE_RE.finditer(text):
        phone = normalize_phone(match.group(0))
        if phone:
            return phone
    return ""


def extract_email_from_text(text: str) -> str:
    if not text:
        return ""
    for email in EMAIL_RE.findall(text):
        lower = email.lower()
        if any(x in lower for x in ("example.com", "email.com", "test.com", "domain.com")):
            continue
        return email
    return ""


def extract_location_from_text(text: str) -> str:
    if not text:
        return ""

    for match in LOCATION_LABEL_RE.finditer(text):
        location = match.group(1).splitlines()[0].strip(" ,;-|")
        if 3 <= len(location) <= 60 and "@" not in location:
            return location

    head = "\n".join(text.splitlines()[:20])
    city = CITY_COUNTRY_RE.search(head) or CITY_COUNTRY_RE.search(text)
    if city:
        return city.group(1).strip()

    # Pipe / bullet contact lines: email | phone | Nairobi, Kenya
    for line in text.splitlines()[:15]:
        if "|" not in line:
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        for part in parts:
            if "@" in part or _digit_count(part) >= 7:
                continue
            if CITY_COUNTRY_RE.search(part) or (
                "," in part and 3 <= len(part) <= 50 and re.search(r"[A-Za-z]", part)
            ):
                return part
    return ""


def extract_name_from_cv_text(text: str) -> str:
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


def extract_contact_fields_from_text(text: str) -> Dict[str, str]:
    """Parse phone, email, location, and name from raw CV text."""
    return {
        "phoneNumber": extract_phone_from_text(text),
        "email": extract_email_from_text(text),
        "location": extract_location_from_text(text),
        "name": extract_name_from_cv_text(text),
    }


async def preview_contact_from_cv(
    *,
    cv_url: Optional[str] = None,
    cv_bytes: Optional[bytes] = None,
    filename: str = "",
) -> Dict[str, Any]:
    """Extract contact fields from a CV URL or raw bytes without writing to the DB.

    Never invents values — only returns what regex finds in CV text.
    """
    text = ""
    source = "none"
    if cv_bytes:
        from app.lib.applicant_ranking import extract_text_from_cv_bytes

        text = extract_text_from_cv_bytes(cv_bytes, filename=filename)
        source = "bytes"
    elif cv_url and str(cv_url).strip():
        from app.lib.applicant_ranking import extract_text_from_cv_url

        text = await extract_text_from_cv_url(str(cv_url).strip())
        source = "url"

    if not (text or "").strip():
        return {
            "extracted": {},
            "hasText": False,
            "source": source,
            "warning": (
                "Could not read text from this resume. "
                "PDF and DOCX work best; try another file or fill the form manually."
            ),
        }

    extracted = extract_contact_fields_from_text(text)
    found = {key: value for key, value in extracted.items() if value}
    warning = None
    if not found:
        warning = (
            "Resume text was read, but no name, email, phone, or location was found. "
            "Fill the form manually."
        )
    elif not found.get("email"):
        warning = "No email found on the resume. Enter an email before adding the candidate."

    return {
        "extracted": found,
        "hasText": True,
        "source": source,
        "warning": warning,
    }


def fields_needing_fill(application: Dict[str, Any]) -> Set[str]:
    needed: Set[str] = set()
    if _is_blank(application.get("phoneNumber")):
        needed.add("phoneNumber")
    if _is_blank(application.get("email")):
        needed.add("email")
    if _is_blank(application.get("location")):
        needed.add("location")
    if _is_weak_name(application.get("name") or application.get("fullName")):
        needed.add("name")
    return needed


def merge_contact_fill_empty(
    application: Dict[str, Any],
    extracted: Dict[str, str],
) -> Dict[str, str]:
    """Return only fields that are empty on the application and present in extracted."""
    updates: Dict[str, str] = {}
    needed = fields_needing_fill(application)
    for field in CONTACT_FIELDS:
        if field not in needed:
            continue
        value = (extracted.get(field) or "").strip()
        if value:
            updates[field] = value
    return updates


def _cv_url_from_application(application: Dict[str, Any]) -> str:
    for key in ("cvUrl", "resumeUrl"):
        value = application.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for answer in application.get("answers") or []:
        if not isinstance(answer, dict):
            continue
        question = str(answer.get("questionText", "")).lower()
        answer_value = answer.get("answer")
        if not isinstance(answer_value, str):
            continue
        if any(token in question for token in ("resume", "cv", "curriculum")):
            if answer_value.startswith("http"):
                return answer_value.strip()
    return ""


async def _dropbox_path_for_application(db, application: Dict[str, Any], cv_url: str) -> str:
    """Resolve a Dropbox API path from vault metadata or the CV URL."""
    app_id = application.get("_id") or application.get("id")
    if db is not None and app_id is not None:
        try:
            from app.lib.cv_vault import CV_VAULT_COLLECTION

            vault = await db[CV_VAULT_COLLECTION].find_one(
                {
                    "$or": [
                        {"applicationId": str(app_id)},
                        {"applicationId": app_id},
                    ]
                },
                {"dropboxPath": 1},
            )
            path = (vault or {}).get("dropboxPath") or ""
            if isinstance(path, str) and path.strip():
                return path.strip()
        except Exception as exc:
            logger.debug("Vault dropboxPath lookup failed: %s", exc)

    direct = application.get("dropboxPath")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    from app.lib.applicant_ranking import _dropbox_path_hint_from_url

    return _dropbox_path_hint_from_url(cv_url)


async def sync_application_contact_from_cv(
    db,
    application_or_id: Any,
    *,
    force: bool = False,
    cv_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Download/parse CV and upsert empty contact fields on the application.

    Skips when the same ``cvUrl`` was already synced *and* no empty fields remain,
    unless ``force`` is True. Failed/empty extracts do not permanently mark the CV
    as synced, so re-open can retry.
    Never invents values — only writes what regex finds in CV text.
    """
    if isinstance(application_or_id, dict):
        application = application_or_id
        app_id = application.get("_id") or application.get("id")
    else:
        app_id = application_or_id
        application = None

    try:
        obj_id = app_id if isinstance(app_id, ObjectId) else ObjectId(str(app_id))
    except Exception as exc:
        raise ValueError("Invalid application ID") from exc

    if application is None or application.get("_id") is None:
        application = await db.applications.find_one({"_id": obj_id})
    if not application:
        raise ValueError("Application not found")

    cv_url = _cv_url_from_application(application)
    if not cv_url:
        return {
            "updated": False,
            "skipped": "no_cv_url",
            "filled": {},
            "extracted": {},
            "applicationId": str(obj_id),
        }

    needed = fields_needing_fill(application)
    already_synced = (
        (application.get("contactSyncedCvUrl") or "").strip() == cv_url
        and application.get("contactSyncedFromCvAt")
    )
    skip_contact = (not force and already_synced and not needed) or (
        not needed and not force
    )

    async def _sync_experience(cv_text_value: Optional[str]) -> Dict[str, Any]:
        try:
            from app.lib.cv_experience_extract import sync_application_experience_from_cv

            refreshed = await db.applications.find_one({"_id": obj_id})
            return await sync_application_experience_from_cv(
                db,
                refreshed or application,
                force=force,
                cv_text=cv_text_value,
            )
        except Exception as exp_err:
            logger.debug(
                "CV experience sync after contact failed for %s: %s",
                obj_id,
                exp_err,
            )
            return {}

    def _pack_result(
        *,
        filled: Dict[str, Any],
        extracted: Dict[str, Any],
        experience_result: Dict[str, Any],
        skipped: Optional[str],
        text_len: int = 0,
        contact_synced_at: Optional[str] = None,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        exp_filled = experience_result.get("filled") or {}
        combined_filled = {**filled, **exp_filled}
        exp_extracted = experience_result.get("extracted") or {}
        combined_extracted = {**{k: v for k, v in extracted.items() if v}}
        if exp_extracted.get("summary"):
            combined_extracted["cvProfessionalSummary"] = exp_extracted["summary"]
        if exp_extracted.get("jobs"):
            combined_extracted["cvWorkExperience"] = exp_extracted["jobs"]
        if exp_extracted.get("experience"):
            combined_extracted["experience"] = exp_extracted["experience"]
        result: Dict[str, Any] = {
            "updated": bool(combined_filled),
            "skipped": None if combined_filled else skipped,
            "filled": combined_filled,
            "extracted": combined_extracted,
            "experience": {
                "updated": experience_result.get("updated", False),
                "skipped": experience_result.get("skipped"),
                "filled": exp_filled,
            },
            "applicationId": str(obj_id),
            "textLength": text_len,
        }
        if contact_synced_at:
            result["contactSyncedFromCvAt"] = contact_synced_at
            result["contactSyncedCvUrl"] = cv_url
        if error:
            result["error"] = error
        return result

    # Contact already complete — still fill experience if empty (same CV).
    if skip_contact:
        experience_result = await _sync_experience(cv_text)
        return _pack_result(
            filled={},
            extracted={},
            experience_result=experience_result,
            skipped="already_complete" if already_synced else "no_empty_fields",
            text_len=len((cv_text or "").strip()) if cv_text is not None else 0,
        )

    text = cv_text
    fetch_failed = False
    if text is None:
        from app.lib.applicant_ranking import extract_text_from_cv_url

        dropbox_path = await _dropbox_path_for_application(db, application, cv_url)
        text = await extract_text_from_cv_url(cv_url, dropbox_path=dropbox_path or None)
        fetch_failed = not (text or "").strip()

    text_len = len((text or "").strip())
    extracted = extract_contact_fields_from_text(text or "")
    filled = merge_contact_fill_empty(application, extracted)

    now = datetime.utcnow()
    set_fields: Dict[str, Any] = {"updatedAt": now}
    unset_fields: Dict[str, str] = {}

    if fetch_failed or (text_len == 0 and not filled):
        # Do not stamp contactSyncedCvUrl — leave the door open for retry.
        unset_fields["contactSyncedCvUrl"] = ""
        unset_fields["contactSyncedFromCvAt"] = ""
        if unset_fields:
            await db.applications.update_one(
                {"_id": obj_id},
                {"$set": set_fields, "$unset": unset_fields},
            )
        logger.warning(
            "CV contact sync for %s: empty extract (text_len=%s needed=%s url=%s)",
            obj_id,
            text_len,
            sorted(needed),
            cv_url[:120],
        )
        # Still attempt experience if we somehow have text; otherwise mark for retry.
        experience_result = await _sync_experience(text if text_len else None)
        return _pack_result(
            filled={},
            extracted={},
            experience_result=experience_result,
            skipped="cv_text_unavailable" if fetch_failed else "nothing_extractable",
            text_len=text_len,
            error="Could not read text from CV" if fetch_failed else None,
        )

    set_fields["contactSyncedFromCvAt"] = now
    set_fields["contactSyncedCvUrl"] = cv_url
    set_fields.update(filled)

    # Only mark synced when we actually read CV text. If needed fields remain
    # empty after a successful read, still mark synced (nothing more to find).
    await db.applications.update_one({"_id": obj_id}, {"$set": set_fields})

    logger.info(
        "CV contact sync for %s: filled=%s extracted_phone=%s text_len=%s",
        obj_id,
        list(filled.keys()),
        bool(extracted.get("phoneNumber")),
        text_len,
    )

    experience_result = await _sync_experience(text or "")
    return _pack_result(
        filled=filled,
        extracted=extracted,
        experience_result=experience_result,
        skipped="nothing_extractable",
        text_len=text_len,
        contact_synced_at=now.isoformat(),
    )


async def sync_contact_after_insert(
    db,
    application_id: Any,
    *,
    cv_url: Optional[str] = None,
) -> None:
    """Best-effort background sync (contact + experience); never raises to callers."""
    try:
        if cv_url is not None and not str(cv_url).strip():
            return
        await sync_application_contact_from_cv(db, application_id, force=True)
    except Exception as exc:
        logger.debug("Background CV contact sync failed for %s: %s", application_id, exc)
