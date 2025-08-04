import smtplib
import ssl
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional
from app.config import settings
from app.database import get_database
import logging

logger = logging.getLogger(__name__)

def generate_verification_code(length: int = 6) -> str:
    """Generate a random verification code"""
    return ''.join(random.choices(string.digits, k=length))

async def store_verification_code(email: str, code: str, expires_in_minutes: int = 10) -> bool:
    """Store verification code in database with expiration (default 10 minutes)"""
    try:
        db = get_database()
        
        # Calculate expiration time
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        
        # Store or update verification code (using consistent collection name)
        result = await db.verification_codes.update_one(
            {"email": email},
            {
                "$set": {
                    "code": code,
                    "expiresAt": expires_at,  # Changed to match TTL index field name
                    "createdAt": datetime.utcnow(),  # Consistent field naming
                    "used": False,
                    "attempts": 0  # Track verification attempts
                }
            },
            upsert=True
        )
        
        return result.acknowledged
    except Exception as e:
        logger.error(f"Error storing verification code: {str(e)}")
        return False

async def verify_code(email: str, code: str) -> bool:
    """Verify the email verification code"""
    try:
        db = get_database()
        
        # Find the verification record (using consistent collection and field names)
        verification = await db.verification_codes.find_one({
            "email": email,
            "code": code,
            "used": False,
            "expiresAt": {"$gt": datetime.utcnow()}
        })
        
        if not verification:
            # Increment attempts counter for failed verification
            await db.verification_codes.update_one(
                {
                    "email": email,
                    "expiresAt": {"$gt": datetime.utcnow()}
                },
                {
                    "$inc": {"attempts": 1},
                    "$set": {"lastAttempt": datetime.utcnow()}
                }
            )
            return False
        
        # Mark as used and record usage time
        await db.verification_codes.update_one(
            {"_id": verification["_id"]},
            {"$set": {"used": True, "usedAt": datetime.utcnow()}}
        )
        
        return True
    except Exception as e:
        logger.error(f"Error verifying code: {str(e)}")
        return False

def send_verification_email(email: str, verification_code: str) -> bool:
    """Send email verification code to user"""
    try:
        # Create message
        message = MIMEMultipart()
        message["From"] = settings.from_email
        message["To"] = email
        message["Subject"] = "Email Verification Code - BQI Tech"
        
        # Email body
        body = f"""
        <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="{settings.frontend_url}/bqilogo.png" alt="BQI Tech Logo" style="width: 150px; height: auto; margin: 0;">
                </div>
                
                <h2 style="color: #1f2937;">Email Verification</h2>
                
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                    Thank you for signing up with BQI Tech! To complete your registration, please use the verification code below:
                </p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 8px; margin: 0; font-family: monospace;">
                        {verification_code}
                    </h1>
                </div>
                
                <p style="color: #4b5563; font-size: 14px;">
                    This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
                </p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                        This email was sent by BQI Tech. If you have any questions, please contact us at {settings.hr_email}
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        message.attach(MIMEText(body, "html"))
        
        # Create secure connection and send email
        context = ssl.create_default_context()
        
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            text = message.as_string()
            server.sendmail(settings.from_email, email, text)
        
        logger.info(f"Verification email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")
        return False

async def send_verification_code(email: str) -> Optional[str]:
    """Generate and send verification code to email (expires in 10 minutes)"""
    try:
        # Generate verification code
        code = generate_verification_code()
        logger.info(f"Generated verification code for {email}")
        
        # Store in database with 10-minute expiration
        stored = await store_verification_code(email, code, expires_in_minutes=10)
        if not stored:
            logger.error(f"Failed to store verification code for {email}")
            return None
        
        logger.info(f"Verification code stored successfully for {email} (expires in 10 minutes)")
        
        # Send email
        sent = send_verification_email(email, code)
        if not sent:
            logger.error(f"Failed to send verification email to {email}")
            return None
        
        logger.info(f"Verification email sent successfully to {email}")
        return code
        
    except Exception as e:
        logger.error(f"Error in send_verification_code for {email}: {str(e)}")
        return None


async def get_verification_status(email: str) -> dict:
    """Get verification code status for an email"""
    try:
        db = get_database()
        
        # Find the most recent verification record for this email
        verification = await db.verification_codes.find_one(
            {"email": email},
            sort=[("createdAt", -1)]  # Most recent first
        )
        
        if not verification:
            return {
                "exists": False,
                "message": "No verification code found"
            }
        
        current_time = datetime.utcnow()
        is_expired = verification["expiresAt"] <= current_time
        
        return {
            "exists": True,
            "expired": is_expired,
            "used": verification.get("used", False),
            "attempts": verification.get("attempts", 0),
            "createdAt": verification["createdAt"],
            "expiresAt": verification["expiresAt"],
            "timeLeft": max(0, (verification["expiresAt"] - current_time).total_seconds()) if not is_expired else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting verification status for {email}: {str(e)}")
        return {
            "exists": False,
            "error": str(e)
        }


async def cleanup_expired_verification_codes() -> int:
    """Clean up expired verification codes"""
    try:
        db = get_database()
        
        # Delete expired codes
        result = await db.verification_codes.delete_many({
            "expiresAt": {"$lt": datetime.utcnow()}
        })
        
        deleted_count = result.deleted_count
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} expired verification codes")
        
        return deleted_count
        
    except Exception as e:
        logger.error(f"Error cleaning up verification codes: {str(e)}")
        return 0 