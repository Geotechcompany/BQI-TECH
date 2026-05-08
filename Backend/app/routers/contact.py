from fastapi import APIRouter, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any
import logging
import traceback
import re
from datetime import datetime, timedelta
from app.lib.email import send_contact_form_email, send_contact_confirmation_email
from app.database import get_database
from app.utils.ip_utils import get_real_client_ip

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to get more detailed logs

router = APIRouter(tags=["contact"])

MIN_MESSAGE_CHARS = 25
MAX_SUBMISSIONS_PER_IP = 5
IP_WINDOW_MINUTES = 15
BLOCK_WINDOW_MINUTES = 60
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
URL_REGEX = re.compile(r"(https?://|www\.)", re.IGNORECASE)


def _is_valid_email(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    normalized = email.strip().lower()
    if len(normalized) > 254:
        return False
    if ".." in normalized:
        return False
    if not EMAIL_REGEX.match(normalized):
        return False
    local, _, domain = normalized.rpartition("@")
    if not local or not domain:
        return False
    return "." in domain and not domain.startswith("-") and not domain.endswith("-")


def _compute_message_quality(message: str) -> Dict[str, Any]:
    """AI-inspired quality scoring to catch gibberish/nonsense spam."""
    trimmed = (message or "").strip()
    lowered = trimmed.lower()
    words = re.findall(r"[a-zA-Z']+", trimmed)
    unique_words = {w.lower() for w in words}
    alpha_chars = [c for c in trimmed if c.isalpha()]
    total_chars = len(trimmed)
    alpha_ratio = (len(alpha_chars) / total_chars) if total_chars else 0.0
    unique_ratio = (len(unique_words) / len(words)) if words else 0.0
    has_many_urls = len(URL_REGEX.findall(lowered)) >= 2
    repeated_chars = bool(re.search(r"(.)\1{5,}", lowered))
    repeated_word_spam = bool(re.search(r"\b(\w+)\b(?:\s+\1\b){3,}", lowered))
    has_vowels = bool(re.search(r"[aeiou]", lowered))

    score = 100
    reasons = []

    if len(words) < 5:
        score -= 25
        reasons.append("too_few_words")
    if alpha_ratio < 0.6:
        score -= 20
        reasons.append("low_alpha_ratio")
    if unique_ratio < 0.35 and len(words) >= 8:
        score -= 20
        reasons.append("low_unique_word_ratio")
    if has_many_urls:
        score -= 20
        reasons.append("too_many_urls")
    if repeated_chars:
        score -= 25
        reasons.append("repeated_characters")
    if repeated_word_spam:
        score -= 20
        reasons.append("repeated_words")
    if len(words) >= 6 and not has_vowels:
        score -= 25
        reasons.append("vowel_free_text")

    return {
        "score": max(0, score),
        "is_suspicious": score < 55,
        "reasons": reasons,
    }


async def _get_contact_form_enabled() -> bool:
    db = get_database()
    settings = await db.settings.find_one({"type": "admin"}, {"contactFormEnabled": 1})
    if not settings:
        return True
    return bool(settings.get("contactFormEnabled", True))


async def _check_and_track_ip_submission(request: Request) -> None:
    db = get_database()
    client_ip = get_real_client_ip(request) or (request.client.host if request.client else "unknown")
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=IP_WINDOW_MINUTES)

    # Check if the IP is actively blocked
    blocked_record = await db.contact_abuse.find_one(
        {"ip": client_ip, "blockedUntil": {"$gt": now}},
        {"blockedUntil": 1}
    )
    if blocked_record:
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this IP. Please try again later."
        )

    # Count submissions in the rolling window
    recent_count = await db.contact_submissions.count_documents({
        "ip": client_ip,
        "createdAt": {"$gte": window_start}
    })
    if recent_count >= MAX_SUBMISSIONS_PER_IP:
        blocked_until = now + timedelta(minutes=BLOCK_WINDOW_MINUTES)
        await db.contact_abuse.update_one(
            {"ip": client_ip},
            {"$set": {"ip": client_ip, "blockedUntil": blocked_until, "updatedAt": now}, "$setOnInsert": {"createdAt": now}},
            upsert=True
        )
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this IP. Please try again in an hour."
        )

    # Track this submission attempt early to throttle burst spam (before email sending)
    await db.contact_submissions.insert_one({
        "ip": client_ip,
        "createdAt": now,
    })


@router.get("/status")
async def get_contact_form_status():
    enabled = await _get_contact_form_enabled()
    return {
        "enabled": enabled,
        "minMessageChars": MIN_MESSAGE_CHARS
    }

@router.post("/submit")
async def submit_contact_form(
    request: Request,
    form_data: Dict[str, Any] = Body(...)
):
    """
    Submit contact form and send email
    
    Expected payload:
    {
        "name": str,
        "email": str,
        "phone": str (optional),
        "organization": str (optional),
        "service": str (optional),
        "message": str
    }
    """
    try:
        # Respect admin-level contact form toggle
        if not await _get_contact_form_enabled():
            raise HTTPException(status_code=503, detail="Contact form is currently disabled.")

        # Apply IP-based anti-spam protection
        await _check_and_track_ip_submission(request)

        # Log incoming request details for debugging
        logger.debug(f"Received contact form submission request")
        logger.debug(f"Request method: {request.method}")
        logger.debug(f"Request headers: {dict(request.headers)}")
        logger.debug(f"Request body: {form_data}")

        # Validate required fields
        required_fields = ['name', 'email', 'message']
        for field in required_fields:
            if not form_data.get(field):
                logger.warning(f"Missing required field: {field}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing required field: {field}"
                )

        email = str(form_data.get("email", "")).strip().lower()
        message = str(form_data.get("message", "")).strip()
        name = str(form_data.get("name", "")).strip()

        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name is too short.")

        if not _is_valid_email(email):
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")

        if len(message) < MIN_MESSAGE_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Message must be at least {MIN_MESSAGE_CHARS} characters."
            )

        quality = _compute_message_quality(message)
        if quality["is_suspicious"]:
            logger.warning(f"Blocked suspicious contact message from {email}: {quality}")
            raise HTTPException(
                status_code=400,
                detail="Your message appears invalid. Please provide a clear, meaningful message."
            )
        
        # Send email
        email_sent = await send_contact_form_email(
            name=name,
            email=email,
            phone=form_data.get('phone', 'Not provided'),
            organization=form_data.get('organization', 'Not provided'),
            service=form_data.get('service', 'Not specified'),
            message=message
        )
        
        if not email_sent:
            logger.error("Failed to send contact form email")
            raise HTTPException(
                status_code=500, 
                detail="Failed to send contact form email"
            )
        
        # Fire-and-forget confirmation to user (non-blocking)
        try:
            _ = await send_contact_confirmation_email(
                name=name,
                email=email,
                service=form_data.get('service', 'Not specified'),
                message=message
            )
        except Exception as _e:
            logger.warning(f"Contact confirmation email failed but will not block response: {_e}")

        # Log successful submission
        logger.info(f"Contact form submitted by {email}")
        
        return JSONResponse(
            content={
                "message": "Contact form submitted successfully",
                "status": "success"
            },
            status_code=200
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Contact form submission error: {str(e)}")
        logger.error(traceback.format_exc())  # Log full traceback
        raise HTTPException(
            status_code=500, 
            detail="Internal server error during contact form submission"
        ) 