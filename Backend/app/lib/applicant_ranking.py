"""AI-powered applicant ranking based on CV content and application responses."""

from __future__ import annotations

import io
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from bson import ObjectId

from app.lib.ai_provider_settings import get_active_ai_config
from app.lib.nvidia_ai import nvidia_chat_completion
from app.lib.error_utils import extract_json_object, format_exception_message

logger = logging.getLogger(__name__)

MAX_CV_CHARS = 12_000
MAX_ANSWER_CHARS = 6_000


def _normalize_dropbox_url(url: str) -> str:
    if not url:
        return ""
    normalized = url.strip()
    if "dropbox.com" in normalized and "dl=1" not in normalized:
        separator = "&" if "?" in normalized else "?"
        normalized = f"{normalized}{separator}dl=1"
    normalized = normalized.replace("www.dropbox.com", "dl.dropboxusercontent.com")
    return normalized


async def extract_text_from_cv_url(url: str) -> str:
    """Best-effort PDF text extraction from a public CV URL."""
    if not url:
        return ""

    fetch_url = _normalize_dropbox_url(url)
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(fetch_url)
        if response.status_code != 200:
            return ""

        content_type = (response.headers.get("content-type") or "").lower()
        data = response.content
        if not data:
            return ""

        is_pdf = "pdf" in content_type or fetch_url.lower().endswith(".pdf")
        if not is_pdf and data[:4] != b"%PDF":
            return ""

        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        chunks: List[str] = []
        for page in reader.pages[:6]:
            chunks.append(page.extract_text() or "")
        text = "\n".join(chunks).strip()
        return text[:MAX_CV_CHARS]
    except Exception as error:
        logger.debug("CV text extraction failed for %s: %s", url, error)
        return ""


def _get_cv_url(application: Dict[str, Any]) -> str:
    for key in ("cvUrl", "resumeUrl"):
        value = application.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    for answer in application.get("answers") or []:
        question = str(answer.get("questionText", "")).lower()
        answer_value = answer.get("answer")
        if not isinstance(answer_value, str):
            continue
        if any(token in question for token in ("resume", "cv", "curriculum")):
            if answer_value.startswith("http"):
                return answer_value.strip()
    return ""


def _format_answers(application: Dict[str, Any]) -> str:
    lines: List[str] = []
    for answer in application.get("answers") or []:
        question = str(answer.get("questionText", "")).strip()
        value = str(answer.get("answer", "")).strip()
        if not question or not value:
            continue
        if any(token in question.lower() for token in ("resume", "cv", "upload")):
            continue
        lines.append(f"Q: {question}\nA: {value}")
    combined = "\n\n".join(lines)
    return combined[:MAX_ANSWER_CHARS]


def _build_job_summary(job: Optional[Dict[str, Any]], fallback_position: str) -> str:
    if not job:
        return fallback_position or "Role not specified"

    parts = [
        f"Title: {job.get('title') or fallback_position or 'Unknown'}",
        f"Department: {job.get('department') or 'N/A'}",
        f"Location: {job.get('location') or 'N/A'}",
    ]
    for field in ("description", "requirements", "responsibilities", "qualifications", "summary"):
        value = job.get(field)
        if isinstance(value, str) and value.strip():
            parts.append(f"{field.title()}: {value.strip()[:2500]}")
    return "\n".join(parts)


def _parse_ai_json(content: str) -> Dict[str, Any]:
    return extract_json_object(content)


async def rank_application_with_ai(
    application: Dict[str, Any],
    job: Optional[Dict[str, Any]],
    cv_text: str,
) -> Dict[str, Any]:
    _, api_key, _ = await get_active_ai_config()
    if not api_key:
        raise ValueError(
            "AI service not configured — add an AI provider in admin settings or set NVIDIA_API_KEY in Backend/.env"
        )

    candidate_name = (
        application.get("name")
        or application.get("email")
        or "Candidate"
    )
    position = application.get("position") or (job or {}).get("title") or "Unknown role"
    answers_text = _format_answers(application)

    prompt = f"""You are an expert technical recruiter for BQI Technologies.
Evaluate how well this candidate matches the job based on their CV text and application answers.

Return STRICT JSON only with this schema:
{{
  "score": <integer 0-100>,
  "summary": "<2-3 sentences explaining fit specifically for the role '{position}'. Reference required skills from the job and how the candidate matches or falls short.>",
  "strengths": ["<strength>", "..."],
  "gaps": ["<gap>", "..."],
  "recommendation": "<one of: Strong Fit, Good Fit, Moderate Fit, Weak Fit, Not a Fit>"
}}

Scoring guidance:
- 85-100: Strong match on required skills and experience
- 70-84: Good match with minor gaps
- 50-69: Partial match, notable gaps
- 0-49: Poor match for this role

JOB:
{_build_job_summary(job, position)}

CANDIDATE:
Name: {candidate_name}
Email: {application.get('email', 'N/A')}
Current application status: {application.get('status', 'New')}

APPLICATION ANSWERS:
{answers_text or 'No structured answers provided.'}

CV TEXT (may be partial):
{cv_text or 'CV text unavailable — score primarily from application answers and metadata.'}
"""

    content = await nvidia_chat_completion(
        [
            {"role": "system", "content": "You are a strict hiring evaluator. Output only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=700,
    )

    parsed = _parse_ai_json(content)

    score = int(max(0, min(100, round(float(parsed.get("score", 0))))))
    strengths = [str(item) for item in (parsed.get("strengths") or [])[:5]]
    gaps = [str(item) for item in (parsed.get("gaps") or [])[:5]]

    return {
        "aiRankScore": score,
        "aiRankSummary": str(parsed.get("summary", "")).strip(),
        "aiRankStrengths": strengths,
        "aiRankGaps": gaps,
        "aiRankRecommendation": str(parsed.get("recommendation", "")).strip(),
        "aiRankedAt": datetime.utcnow(),
    }


async def rank_application_by_id(db, application_id: str) -> Dict[str, Any]:
    try:
        obj_id = ObjectId(application_id)
    except Exception as exc:
        raise ValueError("Invalid application ID format") from exc

    application = await db.applications.find_one({"_id": obj_id})
    if not application:
        raise ValueError("Application not found")

    job = None
    job_id = application.get("jobId")
    if job_id:
        try:
            job_oid = job_id if isinstance(job_id, ObjectId) else ObjectId(str(job_id))
            job = await db.jobpostings.find_one({"_id": job_oid})
        except Exception:
            job = None

    cv_url = _get_cv_url(application)
    cv_text = await extract_text_from_cv_url(cv_url) if cv_url else ""
    ranking = await rank_application_with_ai(application, job, cv_text)
    ranked_at = ranking["aiRankedAt"]

    await db.applications.update_one(
        {"_id": obj_id},
        {"$set": {**ranking, "updatedAt": datetime.utcnow()}},
    )

    return {
        "id": str(obj_id),
        **ranking,
        "aiRankedAt": ranked_at.isoformat() if hasattr(ranked_at, "isoformat") else ranked_at,
    }
