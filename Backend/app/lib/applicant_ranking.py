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

MAX_CV_CHARS = 8_000
MAX_ANSWER_CHARS = 4_000
MAX_JOB_FIELD_CHARS = 2_000

# LLM call budget — keep client AI_RANK_TIMEOUT_MS above CV fetch + (timeout × (retries + 1)).
LLM_RANK_TIMEOUT_S = 270.0
LLM_RANK_RETRIES = 1
LLM_RANK_MAX_TOKENS = 3200

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
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
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
            parts.append(f"{field.title()}: {value.strip()[:MAX_JOB_FIELD_CHARS]}")
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


def _normalize_requirement_entry(item: Dict[str, Any]) -> Dict[str, Any]:
    match = _normalize_match_level(item.get("match"))
    try:
        criticality = int(item.get("criticality", 1))
    except (TypeError, ValueError):
        criticality = 1
    criticality = max(1, min(3, criticality))

    category = str(item.get("category", "other")).strip().lower()
    if category not in CATEGORY_WEIGHTS:
        category = "other"

    clamped_score = round(_clamp_requirement_score(item), 1)

    return {
        "requirement": str(item.get("requirement", "")).strip(),
        "jdQuote": str(item.get("jd_quote") or item.get("jdQuote") or "").strip(),
        "category": category,
        "criticality": criticality,
        "match": match,
        "score": clamped_score,
        "evidence": str(item.get("evidence", "")).strip() or "not evidenced",
        "gapNote": str(item.get("gap_note") or item.get("gapNote") or "").strip(),
    }


def _normalize_requirements(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    requirements = [
        _normalize_requirement_entry(item)
        for item in (parsed.get("requirements") or [])
        if isinstance(item, dict) and str(item.get("requirement", "")).strip()
    ]
    requirements.sort(
        key=lambda item: (
            -item["criticality"],
            {"none": 0, "weak": 1, "unknown": 2, "partial": 3, "full": 4}.get(
                item["match"], 2
            ),
        ),
    )
    return requirements


def _match_label(match: str) -> str:
    return {
        "full": "Met",
        "partial": "Partial",
        "weak": "Weak",
        "none": "Missing",
        "unknown": "Not evidenced",
    }.get(match, match.title())


def _build_score_reason(
    requirements: List[Dict[str, Any]],
    score: float,
    parsed: Dict[str, Any],
) -> str:
    model_reason = str(
        parsed.get("score_rationale") or parsed.get("scoreRationale") or ""
    ).strip()
    if len(model_reason) >= 80:
        return model_reason

    if not requirements:
        return model_reason or f"Overall fit score: {score}/100."

    must_have = [r for r in requirements if r["criticality"] >= 3]
    must_have_misses = [r for r in must_have if r["match"] in {"none", "weak", "unknown"}]
    none_count = sum(1 for r in requirements if r["match"] == "none")

    parts = [f"Weighted score {score}/100 from {len(requirements)} job requirements."]
    if must_have_misses:
        missed = "; ".join(
            f'"{r["jdQuote"] or r["requirement"]}" ({_match_label(r["match"]).lower()})'
            for r in must_have_misses[:4]
        )
        parts.append(f"Must-have gaps: {missed}.")
    if none_count:
        parts.append(f"{none_count} requirement(s) clearly not met.")
    recommendation = _derive_recommendation(score)
    parts.append(f"Band: {recommendation}.")
    return " ".join(parts)


def _build_strengths_and_gaps(
    requirements: List[Dict[str, Any]],
    parsed: Dict[str, Any],
) -> tuple[List[str], List[str]]:
    strengths = [
        str(item).strip()
        for item in (parsed.get("strengths") or [])
        if str(item).strip()
    ]
    gaps = [
        str(item).strip()
        for item in (parsed.get("gaps") or [])
        if str(item).strip()
    ]

    if strengths and gaps:
        return strengths[:8], gaps[:8]

    derived_strengths: List[str] = []
    derived_gaps: List[str] = []
    for req in requirements:
        jd_ref = req["jdQuote"] or req["requirement"]
        label = _match_label(req["match"])
        if req["match"] == "full":
            derived_strengths.append(
                f'JD: "{jd_ref}" — Met. Evidence: {req["evidence"]}'
            )
        elif req["match"] in {"none", "weak", "partial", "unknown"}:
            gap_detail = req["gapNote"] or req["evidence"]
            derived_gaps.append(
                f'JD: "{jd_ref}" — {label}. {gap_detail}'
            )

    if not strengths:
        strengths = derived_strengths[:8]
    if not gaps:
        gaps = derived_gaps[:8]
    return strengths[:8], gaps[:8]


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
Score this ONE candidate against EVERY explicit requirement in the job posting below.

Step 1 — Extract requirements from the job text (skills, years of experience, education, certifications, industry background, responsibilities, tools, leadership scope). List each as a separate requirement. For each, copy a short jd_quote (verbatim phrase from the job posting). Mark criticality 1 (nice-to-have), 2 (important), or 3 (must-have).

Step 2 — For EACH requirement, compare the candidate's CV and application answers. Assign:
- match: full | partial | weak | none | unknown
- score: 0.0–100.0 with ONE decimal place (e.g. 73.4, 58.7). Avoid round numbers (90, 85, 80, 75, 70, 65, 60, 55, 50).
- evidence: specific quote, role, project, tool, or year from CV/answers. Write "not evidenced" only when nothing supports the requirement.
- gap_note: what is missing or weaker than the JD asks for (empty string if full match)

Scoring rules (be strict):
- full: clear, direct evidence the requirement is met
- partial: related experience but missing depth, recency, or scope
- weak: tangential or outdated evidence only
- none: requirement clearly not met
- unknown: no evidence found (penalize when CV is available)
- Missing a must-have (criticality 3) should usually be partial at best
- Do not inflate scores for generic finance/leadership buzzwords without role-specific proof
- Differentiate candidates: use the full 0–100 range; profiles with different depth MUST get different scores

Step 3 — Write notes tied to THIS job posting only:
- summary: 3–5 sentences. Name the role, cite specific JD requirements met and missed, reference concrete CV evidence. No generic praise.
- strengths: each item must cite a JD requirement (quote or paraphrase) AND specific CV evidence
- gaps: each item must cite the JD requirement AND what is missing or weak in the candidate profile
- score_rationale: 2–4 sentences explaining why the overall fit lands at the level it does. Reference must-have misses, partial matches, and evidence quality. The server computes the final numeric score.

Return STRICT JSON only:
{{
  "requirements": [
    {{
      "requirement": "<specific requirement distilled from job posting>",
      "jd_quote": "<verbatim or near-verbatim phrase from the job posting>",
      "category": "<experience|skills|education|certifications|responsibilities|other>",
      "criticality": <1|2|3>,
      "match": "<full|partial|weak|none|unknown>",
      "score": <number with one decimal>,
      "evidence": "<specific CV/answer evidence or 'not evidenced'>",
      "gap_note": "<what is missing; empty if full match>"
    }}
  ],
  "dimension_scores": {{
    "experience": <number one decimal>,
    "skills": <number one decimal>,
    "education": <number one decimal>,
    "certifications": <number one decimal>
  }},
  "summary": "<3-5 sentences: fit for '{position}' with JD-specific met/missed requirements and CV evidence>",
  "strengths": ["<JD requirement + evidence>", "..."],
  "gaps": ["<JD requirement + gap>", "..."],
  "score_rationale": "<why this candidate scores at this level; reference must-haves and evidence>"
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
                    "Evaluate each job requirement independently against the posted JD text. "
                    "Every note must reference a specific JD requirement and CV evidence. "
                    "Output only valid JSON. Use decimal scores with real variance."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.35,
        max_tokens=LLM_RANK_MAX_TOKENS,
        timeout=LLM_RANK_TIMEOUT_S,
        retries=LLM_RANK_RETRIES,
    )

    parsed = _parse_ai_json(content)

    score = _compute_final_score(parsed, cv_available)
    requirements = _normalize_requirements(parsed)
    strengths, gaps = _build_strengths_and_gaps(requirements, parsed)
    score_reason = _build_score_reason(requirements, score, parsed)
    summary = str(parsed.get("summary", "")).strip()
    if len(summary) < 60 and requirements:
        met = [r for r in requirements if r["match"] == "full"]
        missed = [r for r in requirements if r["match"] in {"none", "weak", "partial"}]
        summary_parts = [f"Fit for {position}: score {score}/100."]
        if met:
            summary_parts.append(
                "Met: "
                + "; ".join(
                    f'"{r["jdQuote"] or r["requirement"]}"' for r in met[:3]
                )
                + "."
            )
        if missed:
            summary_parts.append(
                "Gaps: "
                + "; ".join(
                    f'"{r["jdQuote"] or r["requirement"]}" ({_match_label(r["match"]).lower()})'
                    for r in missed[:3]
                )
                + "."
            )
        summary = " ".join(summary_parts)

    return {
        "aiRankScore": score,
        "aiRankSummary": summary,
        "aiRankStrengths": strengths,
        "aiRankGaps": gaps,
        "aiRankRequirements": requirements,
        "aiRankScoreReason": score_reason,
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
