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

# Stricter fit buckets (aligned with admin filters and UI).
STRONG_FIT_MIN = 88.0
GOOD_FIT_MIN = 72.0
MODERATE_FIT_MIN = 52.0
WEAK_FIT_MIN = 30.0

MATCH_SCORE_CAPS = {
    "full": 100.0,
    "partial": 62.0,
    "weak": 32.0,
    "none": 8.0,
    "unknown": 22.0,
}

CATEGORY_WEIGHTS = {
    "experience": 1.35,
    "skills": 1.25,
    "certifications": 1.1,
    "education": 0.9,
    "responsibilities": 1.0,
    "other": 1.0,
}


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
            parts.append(f"{field.title()}: {value.strip()[:3500]}")
    return "\n".join(parts)


def _parse_ai_json(content: str) -> Dict[str, Any]:
    return extract_json_object(content)


def _normalize_match_level(value: Any) -> str:
    match = str(value or "unknown").strip().lower()
    if match in MATCH_SCORE_CAPS:
        return match
    if match in {"strong", "complete", "met", "yes"}:
        return "full"
    if match in {"moderate", "some", "limited"}:
        return "partial"
    if match in {"minimal", "low"}:
        return "weak"
    if match in {"missing", "no", "not_met", "not met"}:
        return "none"
    return "unknown"


def _clamp_requirement_score(requirement: Dict[str, Any]) -> float:
    match = _normalize_match_level(requirement.get("match"))
    try:
        raw_score = float(requirement.get("score", 0))
    except (TypeError, ValueError):
        raw_score = 0.0
    raw_score = max(0.0, min(100.0, raw_score))
    return min(raw_score, MATCH_SCORE_CAPS[match])


def _requirement_weight(requirement: Dict[str, Any]) -> float:
    try:
        criticality = float(requirement.get("criticality", 1))
    except (TypeError, ValueError):
        criticality = 1.0
    criticality = max(1.0, min(3.0, criticality))

    category = str(requirement.get("category", "other")).strip().lower()
    category_weight = CATEGORY_WEIGHTS.get(category, CATEGORY_WEIGHTS["other"])
    return criticality * category_weight


def _compute_final_score(parsed: Dict[str, Any], cv_available: bool) -> float:
    requirements = [
        item for item in (parsed.get("requirements") or []) if isinstance(item, dict)
    ]
    if requirements:
        weighted_total = 0.0
        weight_sum = 0.0
        none_count = 0
        unknown_count = 0

        for requirement in requirements:
            clamped = _clamp_requirement_score(requirement)
            weight = _requirement_weight(requirement)
            weighted_total += clamped * weight
            weight_sum += weight

            match = _normalize_match_level(requirement.get("match"))
            if match == "none":
                none_count += 1
            elif match == "unknown":
                unknown_count += 1

        base_score = weighted_total / weight_sum if weight_sum else 0.0
        penalty = (none_count * 4.5) + (unknown_count * (1.5 if cv_available else 0.75))
        if none_count >= 2:
            penalty += 3.0
        final_score = base_score - penalty
    else:
        dimension_scores = parsed.get("dimension_scores") or {}
        numeric_scores = []
        for key, value in dimension_scores.items():
            if not isinstance(value, (int, float)):
                continue
            category = str(key).strip().lower()
            weight = CATEGORY_WEIGHTS.get(category, CATEGORY_WEIGHTS["other"])
            numeric_scores.append((float(value), weight))

        if numeric_scores:
            weighted_total = sum(score * weight for score, weight in numeric_scores)
            weight_sum = sum(weight for _, weight in numeric_scores)
            final_score = weighted_total / weight_sum if weight_sum else 0.0
        else:
            try:
                final_score = float(parsed.get("score", 0))
            except (TypeError, ValueError):
                final_score = 0.0

    return round(max(0.0, min(100.0, final_score)), 1)


def _derive_recommendation(score: float) -> str:
    if score >= STRONG_FIT_MIN:
        return "Strong Fit"
    if score >= GOOD_FIT_MIN:
        return "Good Fit"
    if score >= MODERATE_FIT_MIN:
        return "Moderate Fit"
    if score >= WEAK_FIT_MIN:
        return "Weak Fit"
    return "Not a Fit"


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
    cv_available = bool(cv_text.strip())
    job_summary = _build_job_summary(job, position)

    prompt = f"""You are a strict hiring evaluator for BQI Technologies.
Score this ONE candidate against EVERY explicit requirement in the job posting.

Step 1 — Extract requirements from the job text (skills, years of experience, education, certifications, industry background, responsibilities, tools, leadership scope). List each as a separate requirement. Mark criticality 1 (nice-to-have), 2 (important), or 3 (must-have).

Step 2 — For EACH requirement, compare the candidate's CV and application answers. Assign:
- match: full | partial | weak | none | unknown
- score: 0.0–100.0 with ONE decimal place (e.g. 73.4, 58.7). Avoid round numbers (90, 85, 80, 75, 70, 65, 60, 55, 50).
- evidence: brief quote or fact from CV/answers, or "not evidenced"
- gap_note: what is missing if not a full match

Scoring rules (be strict):
- full: clear, direct evidence the requirement is met
- partial: related experience but missing depth, recency, or scope
- weak: tangential or outdated evidence only
- none: requirement clearly not met
- unknown: no evidence found (penalize when CV is available)
- Missing a must-have (criticality 3) should usually be partial at best
- Do not inflate scores for generic finance/leadership buzzwords without role-specific proof
- Differentiate candidates: use the full 0–100 range; profiles with different depth MUST get different scores

Return STRICT JSON only:
{{
  "requirements": [
    {{
      "requirement": "<specific requirement from job posting>",
      "category": "<experience|skills|education|certifications|responsibilities|other>",
      "criticality": <1|2|3>,
      "match": "<full|partial|weak|none|unknown>",
      "score": <number with one decimal>,
      "evidence": "<brief evidence or 'not evidenced'>",
      "gap_note": "<gap if any>"
    }}
  ],
  "dimension_scores": {{
    "experience": <number one decimal>,
    "skills": <number one decimal>,
    "education": <number one decimal>,
    "certifications": <number one decimal>
  }},
  "summary": "<2-3 sentences on fit for '{position}'. Name specific requirements met and missed.>",
  "strengths": ["<strength tied to a requirement>", "..."],
  "gaps": ["<gap tied to a requirement>", "..."]
}}

Fit bands (for your reference only — final score is computed server-side):
- 88–100 Strong Fit | 72–87.9 Good Fit | 52–71.9 Moderate Fit | 30–51.9 Weak Fit | below 30 Not a Fit

JOB POSTING:
{job_summary}

CANDIDATE ({candidate_name}):
Email: {application.get('email', 'N/A')}
Application status: {application.get('status', 'New')}
CV available: {'yes' if cv_available else 'no'}

APPLICATION ANSWERS:
{answers_text or 'No structured answers provided.'}

CV TEXT:
{cv_text or 'CV text unavailable — rely on application answers; mark most requirements unknown or weak unless clearly answered.'}
"""

    content = await nvidia_chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "You are a strict, evidence-based recruiter. "
                    "Evaluate each job requirement independently. "
                    "Output only valid JSON. Use decimal scores with real variance."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.35,
        max_tokens=1800,
    )

    parsed = _parse_ai_json(content)

    score = _compute_final_score(parsed, cv_available)
    strengths = [str(item) for item in (parsed.get("strengths") or [])[:6]]
    gaps = [str(item) for item in (parsed.get("gaps") or [])[:6]]

    return {
        "aiRankScore": score,
        "aiRankSummary": str(parsed.get("summary", "")).strip(),
        "aiRankStrengths": strengths,
        "aiRankGaps": gaps,
        "aiRankRecommendation": _derive_recommendation(score),
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
