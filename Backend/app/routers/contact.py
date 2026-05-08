from fastapi import APIRouter, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any
import logging
import traceback
import re
import random
import httpx
from datetime import datetime, timedelta
from app.lib.email import send_contact_form_email, send_contact_confirmation_email
from app.database import get_database
from app.utils.ip_utils import get_real_client_ip
from app.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter(tags=["contact"])

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")
URL_REGEX = re.compile(r"(https?://|www\.)", re.IGNORECASE)
DOMAIN_LABEL_REGEX = re.compile(r"^[A-Za-z0-9-]+$")
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "yopmail.com",
    "trashmail.com",
    "throwawaymail.com",
    "maildrop.cc",
    "fakeinbox.com",
    "temp-mail.org",
    "dispostable.com",
}

DEFAULT_CONTACT_PROTECTION = {
    "minMessageChars": 25,
    "maxSubmissionsPerIp": 5,
    "ipWindowMinutes": 15,
    "blockWindowMinutes": 60,
    "captchaEnabled": True,
    "captchaScoreThreshold": 55,
    "blockScoreThreshold": 35,
}


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
    if "." not in domain or domain.startswith("-") or domain.endswith("-"):
        return False
    domain_parts = domain.split(".")
    if any((not part) or (not DOMAIN_LABEL_REGEX.match(part)) for part in domain_parts):
        return False
    tld = domain_parts[-1]
    if len(tld) < 2 or not tld.isalpha():
        return False
    if len(local) < 2:
        return False
    return True


def _is_disposable_email_domain(email: str) -> bool:
    normalized = (email or "").strip().lower()
    if "@" not in normalized:
        return False
    domain = normalized.split("@", 1)[1]
    if domain in DISPOSABLE_EMAIL_DOMAINS:
        return True
    # Catch subdomains such as inbox.mailinator.com
    return any(domain.endswith(f".{base}") for base in DISPOSABLE_EMAIL_DOMAINS)


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
    has_single_long_token = len(words) == 1 and len(words[0]) >= 10
    consonant_clusters = re.findall(r"(?i)[^aeiou\W]{5,}", trimmed)
    has_heavy_consonant_clusters = len(consonant_clusters) >= 1
    token_lengths = [len(w) for w in words]
    avg_token_length = (sum(token_lengths) / len(token_lengths)) if token_lengths else 0

    score = 100
    reasons = []

    if len(words) < 5:
        score -= 25
        reasons.append("too_few_words")
    if len(words) <= 2:
        score -= 15
        reasons.append("too_few_tokens")
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
    if has_single_long_token:
        score -= 40
        reasons.append("single_long_token")
    if has_heavy_consonant_clusters:
        score -= 30
        reasons.append("heavy_consonant_clusters")
    if avg_token_length > 12:
        score -= 15
        reasons.append("abnormally_long_tokens")

    return {
        "score": max(0, score),
        "reasons": reasons,
    }


async def _get_contact_form_enabled() -> bool:
    db = get_database()
    settings = await db.settings.find_one({"type": "admin"}, {"contactFormEnabled": 1})
    if not settings:
        return True
    return bool(settings.get("contactFormEnabled", True))


async def _get_contact_protection_settings() -> Dict[str, Any]:
    db = get_database()
    settings = await db.settings.find_one({"type": "admin"}, {"contactProtection": 1})
    configured = settings.get("contactProtection", {}) if settings else {}
    merged = {**DEFAULT_CONTACT_PROTECTION, **(configured if isinstance(configured, dict) else {})}
    merged["minMessageChars"] = max(5, int(merged.get("minMessageChars", DEFAULT_CONTACT_PROTECTION["minMessageChars"])))
    merged["maxSubmissionsPerIp"] = max(1, int(merged.get("maxSubmissionsPerIp", DEFAULT_CONTACT_PROTECTION["maxSubmissionsPerIp"])))
    merged["ipWindowMinutes"] = max(1, int(merged.get("ipWindowMinutes", DEFAULT_CONTACT_PROTECTION["ipWindowMinutes"])))
    merged["blockWindowMinutes"] = max(1, int(merged.get("blockWindowMinutes", DEFAULT_CONTACT_PROTECTION["blockWindowMinutes"])))
    merged["captchaScoreThreshold"] = max(1, min(100, int(merged.get("captchaScoreThreshold", DEFAULT_CONTACT_PROTECTION["captchaScoreThreshold"]))))
    merged["blockScoreThreshold"] = max(0, min(100, int(merged.get("blockScoreThreshold", DEFAULT_CONTACT_PROTECTION["blockScoreThreshold"]))))
    if merged["blockScoreThreshold"] >= merged["captchaScoreThreshold"]:
        merged["blockScoreThreshold"] = max(0, merged["captchaScoreThreshold"] - 1)
    merged["captchaEnabled"] = bool(merged.get("captchaEnabled", DEFAULT_CONTACT_PROTECTION["captchaEnabled"]))
    return merged


async def _log_spam_event(
    *,
    request: Request,
    event_type: str,
    reason: str,
    email: str = "",
    quality: Dict[str, Any] = None,
) -> None:
    try:
        db = get_database()
        client_ip = get_real_client_ip(request) or (request.client.host if request.client else "unknown")
        now = datetime.utcnow()
        await db.contact_spam_events.insert_one({
            "ip": client_ip,
            "email": email,
            "eventType": event_type,
            "reason": reason,
            "quality": quality or {},
            "createdAt": now,
        })
    except Exception as event_error:
        logger.warning(f"Failed to log contact spam event: {event_error}")


async def _check_and_track_ip_submission(request: Request, protection: Dict[str, Any]) -> None:
    db = get_database()
    client_ip = get_real_client_ip(request) or (request.client.host if request.client else "unknown")
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=protection["ipWindowMinutes"])

    blocked_record = await db.contact_abuse.find_one(
        {"ip": client_ip, "blockedUntil": {"$gt": now}},
        {"blockedUntil": 1}
    )
    if blocked_record:
        await _log_spam_event(request=request, event_type="ip_blocked", reason="existing_ip_block")
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this IP. Please try again later."
        )

    recent_count = await db.contact_submissions.count_documents({
        "ip": client_ip,
        "createdAt": {"$gte": window_start}
    })
    if recent_count >= protection["maxSubmissionsPerIp"]:
        blocked_until = now + timedelta(minutes=protection["blockWindowMinutes"])
        await db.contact_abuse.update_one(
            {"ip": client_ip},
            {"$set": {"ip": client_ip, "blockedUntil": blocked_until, "updatedAt": now}, "$setOnInsert": {"createdAt": now}},
            upsert=True
        )
        await _log_spam_event(
            request=request,
            event_type="ip_rate_limit_block",
            reason=f"rate_limit_exceeded_{protection['maxSubmissionsPerIp']}_in_{protection['ipWindowMinutes']}m"
        )
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this IP. Please try again in an hour."
        )

    await db.contact_submissions.insert_one({
        "ip": client_ip,
        "createdAt": now,
    })


async def _create_math_captcha(request: Request) -> Dict[str, str]:
    db = get_database()
    left = random.randint(2, 9)
    right = random.randint(1, 9)
    challenge_id = f"cc_{random.randint(100000, 999999)}_{int(datetime.utcnow().timestamp())}"
    answer = str(left + right)
    now = datetime.utcnow()
    await db.contact_captcha_challenges.insert_one({
        "challengeId": challenge_id,
        "answer": answer,
        "ip": get_real_client_ip(request) or (request.client.host if request.client else "unknown"),
        "createdAt": now,
        "expiresAt": now + timedelta(minutes=10),
        "used": False,
    })
    return {"challengeId": challenge_id, "question": f"What is {left} + {right}?"}


async def _validate_math_captcha(request: Request, challenge_id: str, answer: str) -> bool:
    if not challenge_id or not answer:
        return False
    db = get_database()
    now = datetime.utcnow()
    ip = get_real_client_ip(request) or (request.client.host if request.client else "unknown")
    challenge = await db.contact_captcha_challenges.find_one({
        "challengeId": challenge_id,
        "used": False,
        "expiresAt": {"$gt": now},
    })
    if not challenge:
        return False
    if challenge.get("ip") and challenge.get("ip") != ip:
        return False
    is_valid = str(challenge.get("answer", "")).strip() == str(answer).strip()
    if is_valid:
        await db.contact_captcha_challenges.update_one(
            {"_id": challenge["_id"]},
            {"$set": {"used": True, "usedAt": now}}
        )
    return is_valid


async def _verify_google_recaptcha(request: Request, token: str) -> bool:
    if not token:
        return False
    secret_key = settings.recaptcha_secret_key
    if not secret_key:
        logger.error("Missing RECAPTCHA_SECRET_KEY in environment")
        return False

    remote_ip = get_real_client_ip(request) or (request.client.host if request.client else "")
    payload = {
        "secret": secret_key,
        "response": token,
        "remoteip": remote_ip,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data=payload,
            )
        if response.status_code != 200:
            logger.warning(f"Google reCAPTCHA verification returned HTTP {response.status_code}")
            return False
        verification = response.json()
        return bool(verification.get("success"))
    except Exception as recaptcha_error:
        logger.warning(f"Google reCAPTCHA verification exception: {recaptcha_error}")
        return False


@router.get("/status")
async def get_contact_form_status():
    protection = await _get_contact_protection_settings()
    enabled = await _get_contact_form_enabled()
    return {
        "enabled": enabled,
        "minMessageChars": protection["minMessageChars"],
        "captchaEnabled": protection["captchaEnabled"],
    }


@router.get("/captcha-challenge")
async def get_contact_captcha_challenge(request: Request):
    challenge = await _create_math_captcha(request)
    return {"status": "success", **challenge}


@router.post("/submit")
async def submit_contact_form(
    request: Request,
    form_data: Dict[str, Any] = Body(...)
):
    """
    Submit contact form and send email
    """
    try:
        protection = await _get_contact_protection_settings()

        if not await _get_contact_form_enabled():
            raise HTTPException(status_code=503, detail="Contact form is currently disabled.")

        await _check_and_track_ip_submission(request, protection)

        logger.debug("Received contact form submission request")
        logger.debug(f"Request method: {request.method}")
        logger.debug(f"Request headers: {dict(request.headers)}")
        logger.debug(f"Request body: {form_data}")

        required_fields = ["name", "email", "message"]
        for field in required_fields:
            if not form_data.get(field):
                logger.warning(f"Missing required field: {field}")
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        email = str(form_data.get("email", "")).strip().lower()
        message = str(form_data.get("message", "")).strip()
        name = str(form_data.get("name", "")).strip()
        recaptcha_token = str(form_data.get("recaptchaToken", "")).strip()

        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name is too short.")

        if not _is_valid_email(email):
            await _log_spam_event(request=request, event_type="invalid_email", reason="email_validation_failed", email=email)
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")
        if _is_disposable_email_domain(email):
            await _log_spam_event(request=request, event_type="temp_email_blocked", reason="disposable_email_domain", email=email)
            raise HTTPException(
                status_code=400,
                detail="Temporary/disposable email addresses are not allowed."
            )

        if len(message) < protection["minMessageChars"]:
            await _log_spam_event(request=request, event_type="min_chars_failed", reason="message_too_short", email=email)
            raise HTTPException(status_code=400, detail=f"Message must be at least {protection['minMessageChars']} characters.")

        if protection["captchaEnabled"]:
            recaptcha_ok = await _verify_google_recaptcha(request, recaptcha_token)
            if not recaptcha_ok:
                await _log_spam_event(
                    request=request,
                    event_type="google_recaptcha_failed",
                    reason="google_recaptcha_verification_failed",
                    email=email,
                )
                raise HTTPException(
                    status_code=400,
                    detail="Google reCAPTCHA verification failed."
                )

        quality = _compute_message_quality(message)
        quality_score = int(quality.get("score", 0))
        if quality_score <= protection["blockScoreThreshold"]:
            await _log_spam_event(
                request=request,
                event_type="nonsense_blocked",
                reason="quality_below_block_threshold",
                email=email,
                quality=quality
            )
            logger.warning(f"Blocked high-risk contact message from {email}: {quality}")
            raise HTTPException(
                status_code=400,
                detail="Your message appears invalid. Please provide a clear, meaningful message."
            )

        if quality_score <= protection["captchaScoreThreshold"]:
            await _log_spam_event(
                request=request,
                event_type="captcha_suspicious_score",
                reason="quality_below_captcha_threshold",
                email=email,
                quality=quality
            )

        email_sent = await send_contact_form_email(
            name=name,
            email=email,
            phone=form_data.get("phone", "Not provided"),
            organization=form_data.get("organization", "Not provided"),
            service=form_data.get("service", "Not specified"),
            message=message
        )

        if not email_sent:
            logger.error("Failed to send contact form email")
            raise HTTPException(status_code=500, detail="Failed to send contact form email")

        try:
            _ = await send_contact_confirmation_email(
                name=name,
                email=email,
                service=form_data.get("service", "Not specified"),
                message=message
            )
        except Exception as confirmation_error:
            logger.warning(f"Contact confirmation email failed but will not block response: {confirmation_error}")

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
    except Exception as error:
        logger.error(f"Contact form submission error: {str(error)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="Internal server error during contact form submission"
        )
