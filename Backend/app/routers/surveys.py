from fastapi import APIRouter, Depends, HTTPException, Body, Request
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Dict, Any, List, Optional
from datetime import datetime
from bson import ObjectId
from app.database import get_database
from app.auth import get_current_admin_user, get_current_user
from app.utils.ip_utils import get_real_client_ip
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["surveys"])


def to_object_id(id_or_str: str) -> ObjectId:
    try:
        return ObjectId(id_or_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid survey id")


@router.post("/admin/surveys")
async def create_survey(
    request: Request,
    survey: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    db = get_database()
    now = datetime.utcnow()
    doc = {
        "title": survey.get("title", "Untitled Survey"),
        "description": survey.get("description", ""),
        "questions": survey.get("questions", []),
        "isActive": bool(survey.get("isActive", True)),
        # Limit: one response per user (by IP / clientId)
        "limitPerUser": bool(survey.get("limitPerUser", False)),
        "createdAt": now,
        "updatedAt": now,
        "createdBy": str(current_admin.get("_id")),
    }
    result = await db.surveys.insert_one(doc)
    survey_id = str(result.inserted_id)
    
    # Construct the full public link
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    public_link = f"{frontend_url}/survey/{survey_id}"
    
    return {
        "id": survey_id,
        "link": public_link,
    }


@router.get("/admin/surveys")
async def list_surveys(
    current_admin: dict = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
):
    db = get_database()
    cursor = db.surveys.find().skip(skip).limit(min(limit, 200)).sort("createdAt", -1)
    items: List[Dict[str, Any]] = []
    async for s in cursor:
        s["id"] = str(s.pop("_id"))
        items.append(s)
    return {"items": items}


@router.get("/surveys/{survey_id}")
async def get_survey_public(survey_id: str):
    db = get_database()
    survey = await db.surveys.find_one({"_id": to_object_id(survey_id), "isActive": True})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    survey["id"] = str(survey.pop("_id"))
    return survey


@router.post("/surveys/{survey_id}/responses")
async def submit_survey_response(
    survey_id: str,
    payload: Dict[str, Any] = Body(...),
    request: Request = None,
):
    db = get_database()
    survey = await db.surveys.find_one({"_id": to_object_id(survey_id), "isActive": True}, {"_id": 1})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    # Enforce one-per-user limit if enabled on the survey
    # Identify user by IP and optional clientId token from the client
    client_ip = get_real_client_ip(request) if request else None
    client_id = payload.get("clientId")
    if client_ip and (await db.surveys.find_one({"_id": survey["_id"]})).get("limitPerUser", False):
        conditions = []
        if client_ip:
            conditions.append({"meta.ip": client_ip})
        if client_id:
            conditions.append({"meta.clientId": client_id})
        if conditions:
            existing = await db.survey_responses.find_one({
                "surveyId": str(survey["_id"]),
                "$or": conditions
            })
            if existing:
                raise HTTPException(status_code=409, detail="You have already submitted this survey")
    doc = {
        "surveyId": str(survey["_id"]),
        "answers": payload.get("answers", {}),
        "submittedAt": datetime.utcnow(),
        "meta": {
            "ip": get_real_client_ip(request) if request else None,
            "userAgent": request.headers.get("user-agent") if request else None,
            "clientId": client_id if client_id else None,
        },
    }
    await db.survey_responses.insert_one(doc)
    return {"message": "Response recorded"}


@router.put("/admin/surveys/{survey_id}")
async def update_survey(
    survey_id: str,
    update: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    db = get_database()
    update["updatedAt"] = datetime.utcnow()
    result = await db.surveys.update_one({"_id": to_object_id(survey_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    # Construct the public link
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    public_link = f"{frontend_url}/survey/{survey_id}"
    
    return {"id": survey_id, "link": public_link}


@router.delete("/admin/surveys/{survey_id}")
async def delete_survey(
    survey_id: str,
    current_admin: dict = Depends(get_current_admin_user),
):
    db = get_database()
    result = await db.surveys.delete_one({"_id": to_object_id(survey_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Survey not found")
    return {"id": survey_id}


# ---------------------- Analytics ----------------------
@router.get("/admin/surveys/{survey_id}/analytics")
async def get_survey_analytics(
    survey_id: str,
    current_admin: dict = Depends(get_current_admin_user),
):
    """Return analytics for a specific survey.

    Aggregates:
      - totalResponses
      - unique IPs and top user agents
      - responses by day (last 60 days)
      - per-question stats (option counts for choice questions; sample for text)
    """
    db = get_database()

    # Load survey
    survey = await db.surveys.find_one({"_id": to_object_id(survey_id)})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Load responses
    cursor = db.survey_responses.find({"surveyId": survey_id})
    responses = [r async for r in cursor]

    total = len(responses)
    unique_ips = len({(r.get("meta", {}) or {}).get("ip") for r in responses if (r.get("meta", {}) or {}).get("ip")})
    last_response_at = max((r.get("submittedAt") for r in responses if r.get("submittedAt")), default=None)

    # Responses by day
    from collections import defaultdict
    import datetime as dt

    by_day = defaultdict(int)
    for r in responses:
        ts = r.get("submittedAt")
        if ts:
            day = ts.date().isoformat()
            by_day[day] += 1
    responses_by_day = sorted(({"date": d, "count": c} for d, c in by_day.items()), key=lambda x: x["date"])[:365]

    # Top user agents
    ua_counts = defaultdict(int)
    for r in responses:
        ua = (r.get("meta", {}) or {}).get("userAgent") or "Unknown"
        ua_counts[ua] += 1
    top_user_agents = sorted(({"ua": k, "count": v} for k, v in ua_counts.items()), key=lambda x: x["count"], reverse=True)[:10]

    # Question stats
    survey_questions = survey.get("questions", [])
    question_stats = []
    for idx, q in enumerate(survey_questions):
        q_type = q.get("type")
        q_title = q.get("title", f"Question {idx+1}")
        stat: Dict[str, Any] = {"index": idx, "title": q_title, "type": q_type}
        # Collect answers for this index
        values = []
        for r in responses:
            ans = (r.get("answers") or {}).get(str(idx))
            if ans is None:
                ans = (r.get("answers") or {}).get(idx)  # handle numeric keys if any
            if ans is not None:
                values.append(ans)

        if q_type in ("single_choice",):
            counts = defaultdict(int)
            for v in values:
                counts[str(v)] += 1
            stat["options"] = q.get("options", [])
            stat["counts"] = {k: counts.get(k, 0) for k in stat["options"]}
        elif q_type in ("multiple_choice",):
            counts = defaultdict(int)
            for v in values:
                if isinstance(v, list):
                    for item in v:
                        counts[str(item)] += 1
                else:
                    counts[str(v)] += 1
            stat["options"] = q.get("options", [])
            stat["counts"] = {k: counts.get(k, 0) for k in stat["options"]}
        else:
            # Text answers: return a small sample
            samples = []
            for v in values[:20]:
                try:
                    samples.append(str(v)[:300])
                except Exception:
                    continue
            stat["samples"] = samples
            stat["count"] = len(values)

        question_stats.append(stat)

    return {
        "survey": {
            "id": str(survey.get("_id")),
            "title": survey.get("title"),
            "description": survey.get("description"),
            "createdAt": survey.get("createdAt"),
            "questions": survey.get("questions", []),
        },
        "totalResponses": total,
        "uniqueIPs": unique_ips,
        "lastResponseAt": last_response_at,
        "responsesByDay": responses_by_day,
        "topUserAgents": top_user_agents,
        "questionStats": question_stats,
    }


@router.get("/admin/surveys/{survey_id}/responses")
async def get_survey_responses(
    survey_id: str,
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin_user),
):
    """Return raw responses for a survey with basic pagination."""
    db = get_database()
    # ensure survey exists
    survey = await db.surveys.find_one({"_id": to_object_id(survey_id)})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    cursor = (
        db.survey_responses.find({"surveyId": survey_id})
        .skip(max(0, skip))
        .limit(min(500, max(1, limit)))
        .sort("submittedAt", -1)
    )
    items = []
    async for r in cursor:
        meta = r.get("meta", {}) or {}
        items.append(
            {
                "id": str(r.get("_id")),
                "submittedAt": r.get("submittedAt"),
                "ip": meta.get("ip"),
                "userAgent": meta.get("userAgent"),
                "answers": r.get("answers", {}),
            }
        )

    total = await db.survey_responses.count_documents({"surveyId": survey_id})
    return {"items": items, "total": total}

# ---------------------- AI Assistance ----------------------
@router.post("/admin/surveys/ai/generate")
async def ai_generate_survey(
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    """Generate survey title, description, and questions from a prompt using NVIDIA API.

    Request: { prompt: str, num_questions?: int }
    Response: { title, description, questions: [...] }
    """
    import os
    import httpx

    prompt = (payload.get("prompt") or "").strip()
    num_questions = int(payload.get("num_questions") or 5)
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    api_key = os.getenv("NVIDIA_API_KEY")
    model = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")

    if not api_key:
        raise HTTPException(status_code=500, detail="NVIDIA API key not configured")

    system = (
        "You are a professional survey generator. Create surveys with: "
        "1) A clear, engaging title (not 'Survey About: Topic') - return as plain text, NO HTML; "
        "2) A concise description as plain text, NO HTML; "
        "3) Meaningful questions with specific titles related to the topic. "
        "NEVER use generic titles like 'Question 1', 'Question 2'. "
        "Use varied question types: short_text, long_text, single_choice, multiple_choice, file_upload. "
        "For choice questions, provide 3-4 realistic options in the 'options' array. "
        "For file_upload questions, include acceptedTypes and maxFileSize fields. "
        "IMPORTANT: Return ONLY valid JSON, no markdown, no HTML, no extra text."
    )

    user_msg = (
        f"Create a survey about: {prompt}. "
        f"Generate {num_questions} questions with specific, meaningful titles. "
        f"Examples of good titles: 'How satisfied are you with your current role?', 'What is your biggest challenge at work?', 'Rate your work-life balance'. "
        f"Use ALL available question types: short_text, long_text, single_choice, multiple_choice, file_upload. "
        f"For single_choice or multiple_choice, include an 'options' array with 3-4 choices. "
        f"For file_upload questions, include acceptedTypes (e.g., ['image/*', '.pdf', '.doc']) and maxFileSize (e.g., 5) fields. "
        f"Ensure variety - don't use the same question type for all questions. "
        f"Return ONLY a valid JSON object with this exact structure: "
        f'{{"title": "Survey Title", "description": "Survey description", "questions": [{{"title": "Question text", "type": "question_type", "options": ["option1", "option2"]}}]}}'
    )

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.6,
        "max_tokens": 1200,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=body)
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"NVIDIA API error: {e}")

    data = resp.json()
    content = (
        data.get("choices", [{}])[0].get("message", {}).get("content", "")
    )
    
    # Log the AI response for debugging
    logger.info(f"AI Response: {content[:500]}...")  # Log first 500 chars

    # Parse JSON response from AI
    import json, re
    
    # Try to find JSON in the response
    json_patterns = [
        r'```json\s*(\{[\s\S]*?\})\s*```',  # JSON in code blocks
        r'```\s*(\{[\s\S]*?\})\s*```',      # JSON in generic code blocks
        r'(\{[\s\S]*?\})',                   # Any JSON object
    ]
    
    for pattern in json_patterns:
        match = re.search(pattern, content.strip(), re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(1))
                # Validate the structure
                if isinstance(parsed, dict) and 'questions' in parsed:
                    return parsed
            except (json.JSONDecodeError, KeyError):
                continue

    # fallback minimal structure with varied question types
    question_types = ["short_text", "long_text", "single_choice", "multiple_choice"]
    questions = []
    
    for i in range(num_questions):
        q_type = question_types[i % len(question_types)]
        question = {
            "title": f"Question {i+1}",
            "type": q_type
        }
        
        # Add options for choice questions
        if q_type in ["single_choice", "multiple_choice"]:
            question["options"] = [
                f"Option {j+1}" for j in range(3)
            ]
        
        # Add file upload settings
        if q_type == "file_upload":
            question["acceptedTypes"] = ["image/*", ".pdf", ".doc"]
            question["maxFileSize"] = 5
            
        questions.append(question)
    
    return {
        "title": prompt.title(),
        "description": f"<p>Survey about: {prompt}</p>",
        "questions": questions,
    }


@router.get("/admin/surveys/{survey_id}/export")
async def export_survey_responses(
    survey_id: str,
    format: str = "csv",
    current_admin: dict = Depends(get_current_admin_user),
):
    """Export survey responses as CSV or Excel (xlsx)."""
    import io
    import csv

    db = get_database()
    survey = await db.surveys.find_one({"_id": to_object_id(survey_id)})
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Fetch all responses
    cursor = db.survey_responses.find({"surveyId": survey_id})
    responses = [r async for r in cursor]

    # Build header from questions
    questions = survey.get("questions", [])
    headers = [f"Q{idx+1}: {q.get('title','')}" for idx, q in enumerate(questions)]
    headers = ["submittedAt", "ip", "userAgent", *headers]

    if format.lower() == "xlsx":
        try:
            import xlsxwriter  # type: ignore
        except Exception:
            raise HTTPException(status_code=500, detail="xlsxwriter not installed on server")

        out = io.BytesIO()
        wb = xlsxwriter.Workbook(out, {"in_memory": True})
        ws = wb.add_worksheet("Responses")

        # Write headers
        for c, h in enumerate(headers):
            ws.write(0, c, h)

        # Write rows
        for r_idx, r in enumerate(responses, start=1):
            meta = r.get("meta", {}) or {}
            ws.write(r_idx, 0, r.get("submittedAt").isoformat() if r.get("submittedAt") else None)
            ws.write(r_idx, 1, meta.get("ip"))
            ws.write(r_idx, 2, meta.get("userAgent"))
            for q_idx, _ in enumerate(questions):
                val = (r.get("answers") or {}).get(str(q_idx))
                if val is None:
                    val = (r.get("answers") or {}).get(q_idx)
                if isinstance(val, list):
                    val = ", ".join(map(str, val))
                ws.write(r_idx, 3 + q_idx, val)

        wb.close()
        out.seek(0)
        filename = f"survey_{survey_id}_responses.xlsx"
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-store",
            },
        )

    # Default CSV
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers)
    for r in responses:
        row = []
        meta = r.get("meta", {}) or {}
        row.append(r.get("submittedAt").isoformat() if r.get("submittedAt") else "")
        row.append(meta.get("ip", ""))
        row.append(meta.get("userAgent", ""))
        for q_idx, _ in enumerate(questions):
            val = (r.get("answers") or {}).get(str(q_idx))
            if val is None:
                val = (r.get("answers") or {}).get(q_idx)
            if isinstance(val, list):
                val = ", ".join(map(str, val))
            row.append(val if val is not None else "")
        writer.writerow(row)

    mem = io.BytesIO(out.getvalue().encode("utf-8"))
    filename = f"survey_{survey_id}_responses.csv"
    return StreamingResponse(
        mem,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-store",
        },
    )

