"""Extract professional summary and work experience from CV text.

Fill-if-empty only when applied to applications. Never invents roles —
only returns text found under Summary / Experience-style sections.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from bson import ObjectId

logger = logging.getLogger(__name__)

SUMMARY_HEADERS = (
    "professional summary",
    "professional profile",
    "career summary",
    "career profile",
    "personal profile",
    "profile summary",
    "executive summary",
    "about me",
    "about",
    "objective",
    "career objective",
    "summary",
    "profile",
)

EXPERIENCE_HEADERS = (
    "work experience",
    "professional experience",
    "employment history",
    "employment experience",
    "career history",
    "work history",
    "relevant experience",
    "experience",
    "employment",
)

# Sections that end summary/experience blocks
STOP_HEADERS = (
    "education",
    "academic",
    "qualifications",
    "skills",
    "technical skills",
    "core competencies",
    "competencies",
    "certifications",
    "certificates",
    "licenses",
    "projects",
    "key projects",
    "awards",
    "achievements",
    "publications",
    "interests",
    "hobbies",
    "references",
    "languages",
    "volunteer",
    "volunteering",
    "activities",
    "contact",
    "personal details",
    "personal information",
)

HEADER_LINE_RE = re.compile(
    r"^[\s•\-\*]*([A-Za-z][A-Za-z0-9 /&'\-]{1,48})\s*:?\s*$"
)

DATE_RANGE_RE = re.compile(
    r"(?:"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)\.?\s+\d{4}"
    r"|"
    r"\d{1,2}/\d{4}"
    r"|"
    r"\d{4}"
    r")"
    r"\s*[-–—to]+\s*"
    r"(?:"
    r"present|current|now|"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)\.?\s+\d{4}"
    r"|"
    r"\d{1,2}/\d{4}"
    r"|"
    r"\d{4}"
    r")",
    re.IGNORECASE,
)

TITLE_COMPANY_RE = re.compile(
    r"^(.+?)\s+(?:at|@|[-–—|·•])\s+(.+)$",
    re.IGNORECASE,
)

BULLET_RE = re.compile(r"^[\s]*[-•*▪●◦]\s+")


def _normalize_header(line: str) -> str:
    cleaned = line.strip().strip(":").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.lower()


def _is_header(line: str, candidates: tuple[str, ...]) -> bool:
    normalized = _normalize_header(line)
    if not normalized:
        return False
    if normalized in candidates:
        return True
    # Allow ALL-CAPS or Title Case short headers
    match = HEADER_LINE_RE.match(line.strip())
    if not match:
        return False
    return _normalize_header(match.group(1)) in candidates


def _is_any_known_header(line: str) -> bool:
    return (
        _is_header(line, SUMMARY_HEADERS)
        or _is_header(line, EXPERIENCE_HEADERS)
        or _is_header(line, STOP_HEADERS)
    )


def _section_body(lines: List[str], start_idx: int) -> List[str]:
    body: List[str] = []
    for line in lines[start_idx + 1 :]:
        if _is_any_known_header(line):
            break
        body.append(line)
    return body


def _find_section(lines: List[str], headers: tuple[str, ...]) -> List[str]:
    for idx, line in enumerate(lines):
        if _is_header(line, headers):
            return _section_body(lines, idx)
    return []


def _looks_like_date_line(line: str) -> bool:
    return bool(DATE_RANGE_RE.search(line))


def _strip_bullet(line: str) -> str:
    return BULLET_RE.sub("", line).strip()


def _is_bullet(line: str) -> bool:
    return bool(BULLET_RE.match(line))


def _split_job_blocks(body_lines: List[str]) -> List[List[str]]:
    """Split experience section into job blocks using blank lines / date heuristics."""
    cleaned = [ln.rstrip() for ln in body_lines]
    # Drop leading/trailing empties but keep internal blanks as separators
    while cleaned and not cleaned[0].strip():
        cleaned.pop(0)
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    if not cleaned:
        return []

    blocks: List[List[str]] = []
    current: List[str] = []

    def flush() -> None:
        nonlocal current
        meaningful = [ln for ln in current if ln.strip()]
        if meaningful:
            blocks.append(meaningful)
        current = []

    for line in cleaned:
        stripped = line.strip()
        if not stripped:
            if current:
                flush()
            continue

        # New job often starts with a title line after a date line ended previous
        if (
            current
            and not _is_bullet(stripped)
            and _looks_like_date_line(current[-1])
            and not _looks_like_date_line(stripped)
            and not _is_bullet(current[-1])
        ):
            # Date was last line of previous job; this is a new title
            flush()
            current.append(stripped)
            continue

        # Orphan date-only line starting a block is odd; keep with current
        current.append(stripped)

    flush()
    return blocks


def _parse_job_block(block: List[str]) -> Optional[Dict[str, Any]]:
    if not block:
        return None

    title = ""
    company = ""
    dates = ""
    bullets: List[str] = []
    remainder = list(block)

    # Pull date from any of the first 3 lines
    for i, line in enumerate(remainder[:3]):
        if _looks_like_date_line(line) and not _is_bullet(line):
            # Prefer full match span if the line is mostly a date
            match = DATE_RANGE_RE.search(line)
            if match and len(line.strip()) <= len(match.group(0)) + 8:
                dates = match.group(0).strip()
                remainder.pop(i)
                break
            if match and len(line) < 60:
                dates = match.group(0).strip()
                # Keep rest of line as title/company if present
                leftover = (line[: match.start()] + line[match.end() :]).strip(" |·•-–—,")
                if leftover:
                    remainder[i] = leftover
                else:
                    remainder.pop(i)
                break

    non_bullets = [ln for ln in remainder if not _is_bullet(ln)]
    bullet_lines = [_strip_bullet(ln) for ln in remainder if _is_bullet(ln)]
    bullets = [b for b in bullet_lines if b]

    if non_bullets:
        first = non_bullets[0]
        title_match = TITLE_COMPANY_RE.match(first)
        if title_match:
            title = title_match.group(1).strip()
            company = title_match.group(2).strip()
            non_bullets = non_bullets[1:]
        else:
            title = first.strip()
            non_bullets = non_bullets[1:]

        if not company and non_bullets and not _looks_like_date_line(non_bullets[0]):
            company = non_bullets[0].strip()
            non_bullets = non_bullets[1:]

        # Remaining non-bullets without dates become bullets (dense PDFs)
        for line in non_bullets:
            if _looks_like_date_line(line) and not dates:
                match = DATE_RANGE_RE.search(line)
                if match:
                    dates = match.group(0).strip()
                continue
            cleaned = line.strip()
            if cleaned and cleaned.lower() not in {title.lower(), company.lower()}:
                bullets.append(cleaned)

    if not title and not company and not bullets:
        return None

    # Reject pure section leftovers
    if not title:
        title = company or "Role"
        if company == title:
            company = ""

    entry: Dict[str, Any] = {
        "title": title[:120],
        "bullets": bullets[:12],
    }
    if company:
        entry["company"] = company[:120]
    if dates:
        entry["dates"] = dates[:80]
    return entry


def format_experience_text(
    summary: str,
    jobs: List[Dict[str, Any]],
) -> str:
    """Serialize summary + jobs into the application ``experience`` string."""
    parts: List[str] = []
    if summary.strip():
        parts.append(summary.strip())

    for job in jobs:
        lines: List[str] = []
        title = (job.get("title") or "").strip()
        company = (job.get("company") or "").strip()
        dates = (job.get("dates") or "").strip()
        if title and company:
            lines.append(f"{title} at {company}")
        elif title:
            lines.append(title)
        elif company:
            lines.append(company)
        if dates:
            lines.append(dates)
        for bullet in job.get("bullets") or []:
            text = str(bullet).strip()
            if text:
                lines.append(f"- {text}")
        if lines:
            parts.append("\n".join(lines))

    return "\n\n".join(parts).strip()


def extract_experience_from_text(text: str) -> Dict[str, Any]:
    """Parse professional summary and work history from raw CV text."""
    if not (text or "").strip():
        return {"summary": "", "jobs": [], "experience": ""}

    raw_lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    lines = [ln.strip() for ln in raw_lines]

    summary_body = _find_section(lines, SUMMARY_HEADERS)
    experience_body = _find_section(lines, EXPERIENCE_HEADERS)

    summary = " ".join(
        ln for ln in summary_body if ln and not _is_any_known_header(ln)
    ).strip()
    # Cap summary length; drop if it looks like a whole resume dump
    if len(summary) > 1200:
        summary = summary[:1200].rsplit(" ", 1)[0].strip()

    jobs: List[Dict[str, Any]] = []
    for block in _split_job_blocks(experience_body):
        parsed = _parse_job_block(block)
        if not parsed:
            continue
        # Require some signal beyond a single orphan word
        if (
            parsed.get("company")
            or parsed.get("dates")
            or (parsed.get("bullets") or [])
            or len((parsed.get("title") or "").split()) >= 2
        ):
            jobs.append(parsed)
        if len(jobs) >= 12:
            break

    # Fallback: if no EXPERIENCE header, try to find dated job-like blocks in the doc
    if not jobs:
        jobs = _fallback_jobs_from_full_text(lines)

    experience = format_experience_text(summary, jobs)
    return {
        "summary": summary,
        "jobs": jobs,
        "experience": experience,
    }


def _fallback_jobs_from_full_text(lines: List[str]) -> List[Dict[str, Any]]:
    """When no Experience header exists, look for title+date clusters."""
    # Skip early contact/summary area
    start = 0
    for idx, line in enumerate(lines[:40]):
        if _is_header(line, SUMMARY_HEADERS):
            start = idx
            break

    window = lines[start:]
    # Build pseudo-blocks around date lines
    date_indexes = [i for i, ln in enumerate(window) if ln and _looks_like_date_line(ln)]
    if not date_indexes:
        return []

    jobs: List[Dict[str, Any]] = []
    for di in date_indexes[:8]:
        # Title/company usually 1–2 lines before the date
        block_start = max(0, di - 2)
        block_end = di + 1
        # Collect following bullets until blank or header
        for j in range(di + 1, min(len(window), di + 8)):
            if not window[j]:
                break
            if _is_any_known_header(window[j]):
                break
            block_end = j + 1
        block = [ln for ln in window[block_start:block_end] if ln]
        # Skip education-like date clusters (GPA, Bachelor, etc.)
        joined = " ".join(block).lower()
        if any(
            token in joined
            for token in ("bachelor", "master", "university", "college", "gpa", "diploma")
        ):
            continue
        parsed = _parse_job_block(block)
        if parsed and (parsed.get("company") or parsed.get("bullets") or parsed.get("dates")):
            jobs.append(parsed)
    return jobs[:8]


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len(value) == 0
    return False


def experience_fields_needing_fill(application: Dict[str, Any]) -> Set[str]:
    needed: Set[str] = set()
    if _is_blank(application.get("experience")):
        # Also treat questionnaire-only experience as present via answers
        has_answer = False
        for answer in application.get("answers") or []:
            if not isinstance(answer, dict):
                continue
            question = str(answer.get("questionText", "")).lower()
            value = answer.get("answer")
            if not isinstance(value, str) or not value.strip():
                continue
            if any(
                token in question
                for token in (
                    "experience",
                    "years of experience",
                    "work history",
                    "background",
                    "employment",
                )
            ):
                # Skip resume upload questions
                if any(t in question for t in ("resume", "cv", "upload", "attach")):
                    continue
                has_answer = True
                break
        if not has_answer:
            needed.add("experience")
    if _is_blank(application.get("cvProfessionalSummary")) and _is_blank(
        application.get("aiRankSummary")
    ):
        needed.add("cvProfessionalSummary")
    if _is_blank(application.get("cvWorkExperience")):
        needed.add("cvWorkExperience")
    return needed


def merge_experience_fill_empty(
    application: Dict[str, Any],
    extracted: Dict[str, Any],
) -> Dict[str, Any]:
    """Return only empty experience fields present in extracted."""
    updates: Dict[str, Any] = {}
    needed = experience_fields_needing_fill(application)

    summary = (extracted.get("summary") or "").strip()
    jobs = extracted.get("jobs") or []
    experience = (extracted.get("experience") or "").strip()

    if "experience" in needed and experience:
        updates["experience"] = experience
    if "cvProfessionalSummary" in needed and summary:
        updates["cvProfessionalSummary"] = summary
    if "cvWorkExperience" in needed and jobs:
        updates["cvWorkExperience"] = jobs

    # If we have jobs/summary but experience string empty (edge), still fill experience
    if "experience" in needed and not updates.get("experience"):
        rebuilt = format_experience_text(summary, jobs)
        if rebuilt:
            updates["experience"] = rebuilt

    return updates


def _cv_url_from_application(application: Dict[str, Any]) -> str:
    from app.lib.cv_contact_extract import _cv_url_from_application as contact_cv_url

    return contact_cv_url(application)


async def sync_application_experience_from_cv(
    db,
    application_or_id: Any,
    *,
    force: bool = False,
    cv_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Download/parse CV and upsert empty experience fields on the application."""
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

    needed = experience_fields_needing_fill(application)
    already_synced = (
        (application.get("experienceSyncedCvUrl") or "").strip() == cv_url
        and application.get("experienceSyncedFromCvAt")
    )
    if not force and already_synced and not needed:
        return {
            "updated": False,
            "skipped": "already_complete",
            "filled": {},
            "extracted": {},
            "applicationId": str(obj_id),
        }
    if not needed and not force:
        return {
            "updated": False,
            "skipped": "no_empty_fields",
            "filled": {},
            "extracted": {},
            "applicationId": str(obj_id),
        }

    text = cv_text
    fetch_failed = False
    if text is None:
        from app.lib.applicant_ranking import extract_text_from_cv_url
        from app.lib.cv_contact_extract import _dropbox_path_for_application

        dropbox_path = await _dropbox_path_for_application(db, application, cv_url)
        text = await extract_text_from_cv_url(cv_url, dropbox_path=dropbox_path or None)
        fetch_failed = not (text or "").strip()

    text_len = len((text or "").strip())
    extracted = extract_experience_from_text(text or "")
    filled = merge_experience_fill_empty(application, extracted)

    now = datetime.utcnow()
    set_fields: Dict[str, Any] = {"updatedAt": now}
    unset_fields: Dict[str, str] = {}

    if fetch_failed or (text_len == 0 and not filled):
        unset_fields["experienceSyncedCvUrl"] = ""
        unset_fields["experienceSyncedFromCvAt"] = ""
        if unset_fields:
            await db.applications.update_one(
                {"_id": obj_id},
                {"$set": set_fields, "$unset": unset_fields},
            )
        logger.warning(
            "CV experience sync for %s: empty extract (text_len=%s needed=%s)",
            obj_id,
            text_len,
            sorted(needed),
        )
        return {
            "updated": False,
            "skipped": "cv_text_unavailable" if fetch_failed else "nothing_extractable",
            "filled": {},
            "extracted": {},
            "applicationId": str(obj_id),
            "textLength": text_len,
            "error": "Could not read text from CV" if fetch_failed else None,
        }

    set_fields["experienceSyncedFromCvAt"] = now
    set_fields["experienceSyncedCvUrl"] = cv_url
    set_fields.update(filled)

    await db.applications.update_one({"_id": obj_id}, {"$set": set_fields})

    logger.info(
        "CV experience sync for %s: filled=%s jobs=%s text_len=%s",
        obj_id,
        list(filled.keys()),
        len(extracted.get("jobs") or []),
        text_len,
    )

    return {
        "updated": bool(filled),
        "skipped": None if filled else "nothing_extractable",
        "filled": filled,
        "extracted": {
            "summary": extracted.get("summary") or "",
            "jobs": extracted.get("jobs") or [],
            "experience": extracted.get("experience") or "",
        },
        "applicationId": str(obj_id),
        "experienceSyncedFromCvAt": now.isoformat(),
        "experienceSyncedCvUrl": cv_url,
        "textLength": text_len,
    }
