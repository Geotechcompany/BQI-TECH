import smtplib
import ssl
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from app.config import settings
from app.database import get_database
import logging

logger = logging.getLogger(__name__)

def generate_verification_code(length: int = 6) -> str:
    """Generate a random verification code"""
    return ''.join(random.choices(string.digits, k=length))

async def store_verification_code(email: str, code: str, expires_in_minutes: int = 15) -> bool:
    """Store verification code in database with expiration"""
    try:
        db = get_database()
        
        # Calculate expiration time
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        
        # Store or update verification code
        result = await db.email_verifications.update_one(
            {"email": email},
            {
                "$set": {
                    "code": code,
                    "expires_at": expires_at,
                    "created_at": datetime.utcnow(),
                    "used": False
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
        
        # Find the verification record
        verification = await db.email_verifications.find_one({
            "email": email,
            "code": code,
            "used": False,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not verification:
            return False
        
        # Mark as used
        await db.email_verifications.update_one(
            {"_id": verification["_id"]},
            {"$set": {"used": True, "used_at": datetime.utcnow()}}
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
                    <img src="https://bqitech.com/bqilogo.png" alt="BQI Tech Logo" style="width: 150px; height: auto; margin: 0;">
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
    """Generate and send verification code to email"""
    try:
        # Generate verification code
        code = generate_verification_code()
        
        # Store in database
        stored = await store_verification_code(email, code)
        if not stored:
            logger.error("Failed to store verification code")
            return None
        
        # Send email
        sent = send_verification_email(email, code)
        if not sent:
            logger.error("Failed to send verification email")
            return None
        
        return code
        
    except Exception as e:
        logger.error(f"Error in send_verification_code: {str(e)}")
        return None 

async def send_contact_form_email(
    name: str, 
    email: str, 
    phone: str = 'Not provided', 
    organization: str = 'Not provided', 
    service: str = 'Not specified', 
    message: str = ''
) -> bool:
    """Send contact form submission email"""
    try:
        # Create message
        message_obj = MIMEMultipart()
        message_obj["From"] = settings.from_email
        message_obj["To"] = settings.hr_email  # Send to HR or contact email
        message_obj["Subject"] = f"New Contact Form Submission from {name}"
        
        # Email body
        body = f"""
        <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="{settings.frontend_url}/bqilogo.png" alt="BQI Tech Logo" style="width: 150px; height: auto; margin: 0;">
                </div>
                
                <h2 style="color: #1f2937;">New Contact Form Submission</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Name:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Email:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Phone:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{phone}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Organization:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{organization}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Service Interest:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{service}</td>
                    </tr>
                </table>
                
                <h3 style="color: #1f2937; margin-top: 20px;">Message:</h3>
                <p style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
                    {message}
                </p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                        This is an automated email from the BQI Tech contact form.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        message_obj.attach(MIMEText(body, "html"))
        
        # Create secure connection and send email
        context = ssl.create_default_context()
        
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            text = message_obj.as_string()
            server.sendmail(settings.from_email, settings.hr_email, text)
        
        logger.info(f"Contact form email sent successfully for {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send contact form email: {str(e)}")
        return False 

async def send_contact_confirmation_email(
    name: str,
    email: str,
    service: str = 'Not specified',
    message: str = ''
) -> bool:
    """Send an acknowledgement email to the user who submitted the contact form."""
    try:
        message_obj = MIMEMultipart()
        message_obj["From"] = settings.from_email
        message_obj["To"] = email
        message_obj["Subject"] = "We received your message – BQI Tech"

        body = f"""
        <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="{settings.frontend_url}/bqilogo.png" alt="BQI Tech Logo" style="width: 150px; height: auto; margin: 0;">
                </div>
                <h2 style="color: #1f2937;">Thanks, {name} — we’ve got your message</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                    This is a quick confirmation that we received your inquiry.
                    Our team will review it and get back to you shortly.
                </p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; color: #111827;">Service interest: <strong>{service}</strong></p>
                    <p style="white-space: pre-wrap; margin-top: 8px; color: #374151;">{message}</p>
                </div>
                <p style="color: #4b5563; font-size: 14px;">
                    If you didn’t submit this request, please ignore this email.
                </p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                        You can also reach us at {settings.hr_email}
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message_obj.attach(MIMEText(body, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            text = message_obj.as_string()
            server.sendmail(settings.from_email, email, text)

        logger.info(f"Contact confirmation email sent successfully to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send contact confirmation email to {email}: {str(e)}")
        return False

async def send_application_confirmation_email(
    applicant_email: str,
    applicant_name: str = "Applicant",
    job_title: str = "the position"
) -> bool:
    """Send a confirmation email to the applicant after successful application submission."""
    try:
        message_obj = MIMEMultipart()
        message_obj["From"] = settings.from_email
        message_obj["To"] = applicant_email
        message_obj["Subject"] = "We received your application – BQI Tech"

        body = f"""
        <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="{settings.frontend_url}/bqilogo.png" alt="BQI Tech Logo" style="width: 150px; height: auto; margin: 0;">
                </div>
                <h2 style="color: #1f2937;">Thanks, {applicant_name} — your application is in!</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                    We’ve received your application for <strong>{job_title}</strong>.
                    Our hiring team will review your information and get back to you soon.
                </p>
                <p style="color: #4b5563; font-size: 14px;">
                    You can track your application status anytime from your dashboard.
                </p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                        If you have questions, contact us at {settings.hr_email}
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message_obj.attach(MIMEText(body, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            text = message_obj.as_string()
            server.sendmail(settings.from_email, applicant_email, text)

        logger.info(f"Application confirmation email sent successfully to {applicant_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send application confirmation email to {applicant_email}: {str(e)}")

        return False


def build_reset_password_email(reset_link: str) -> MIMEMultipart:
    """Create a password reset email message object."""
    message = MIMEMultipart()
    message["From"] = settings.from_email
    # "To" is set by the caller
    message["Subject"] = "Reset your password – BQI Tech"

    body = f"""
    <html>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="{settings.frontend_url}/bqilogo.png" alt="BQI Tech Logo" style="width: 150px; height: auto; margin: 0;">
            </div>
            <h2 style="color: #1f2937;">Reset your password</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                We received a request to reset your password. Click the button below to set a new password. This link will expire in 60 minutes.
            </p>
            <p style="text-align: center; margin: 24px 0;">
                <a href="{reset_link}" style="background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">
                If the button doesn't work, copy and paste this URL into your browser:<br/>
                <a href="{reset_link}">{reset_link}</a>
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                    If you didn't request this, you can safely ignore this email.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    message.attach(MIMEText(body, "html"))
    return message


async def send_password_reset_email(email: str, reset_link: str) -> bool:
    """Send a password reset email with a secure link."""
    try:
        message = build_reset_password_email(reset_link)
        message["To"] = email

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            server.sendmail(settings.from_email, email, message.as_string())
        logger.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return False

# ---------------------- Generic & Bulk Email Utilities ----------------------
def send_generic_email(to: str, subject: str, html: str) -> bool:
    """Send a generic HTML email via configured SMTP settings.

    This is a synchronous helper designed to be used from async wrappers when needed.
    """
    try:
        message = MIMEMultipart()
        message["From"] = settings.from_email
        message["To"] = to
        message["Subject"] = subject
        message.attach(MIMEText(html, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            server.sendmail(settings.from_email, to, message.as_string())

        logger.info(f"Email sent to {to}")
        return True
    except Exception as e:
        logger.error(f"Failed sending email to {to}: {e}")
        return False


async def send_bulk_emails_backend(
    recipients: List[str],
    subject: str,
    html: str,
    concurrency: int = 10,
    dry_run: bool = False,
    sent_by: str = None,
    campaign_name: str = None,
) -> Dict[str, Any]:
    """Send emails to many recipients with simple concurrency and aggregation.

    - De-duplicates recipient list
    - Respects a small concurrency window to avoid SMTP throttling
    - Stores email logs in database for tracking
    - Returns summary with failures
    """
    import asyncio
    from app.database import get_database
    from datetime import datetime

    # Normalize and deduplicate
    normalized = list({(e or "").strip().lower() for e in recipients if (e or "").strip()})
    if not normalized:
        return {"requested": 0, "attempted": 0, "succeeded": 0, "failed": 0, "failures": []}

    if dry_run:
        return {"requested": len(normalized), "attempted": 0, "succeeded": 0, "failed": 0, "failures": []}

    # Create email campaign record
    db = get_database()
    campaign_id = None
    if db is not None:
        try:
            campaign_doc = {
                "subject": subject,
                "html_content": html,
                "recipient_count": len(normalized),
                "sent_by": sent_by,
                "campaign_name": campaign_name or f"Email Campaign - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                "created_at": datetime.utcnow(),
                "status": "sending"
            }
            result = await db.email_campaigns.insert_one(campaign_doc)
            campaign_id = str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create email campaign record: {e}")

    # Simple semaphore to cap concurrent SMTP connections
    sem = asyncio.Semaphore(max(1, int(concurrency)))
    succeeded = 0
    failures: List[Dict[str, str]] = []

    async def _send(to: str):
        nonlocal succeeded
        async with sem:
            try:
                loop = asyncio.get_running_loop()
                ok = await loop.run_in_executor(None, send_generic_email, to, subject, html)
                
                # Store individual email log
                if db is not None:
                    try:
                        email_log = {
                            "campaign_id": campaign_id,
                            "recipient_email": to,
                            "subject": subject,
                            "sent_at": datetime.utcnow(),
                            "status": "sent" if ok else "failed",
                            "error": None if ok else "send failed"
                        }
                        await db.email_logs.insert_one(email_log)
                    except Exception as e:
                        logger.error(f"Failed to store email log for {to}: {e}")
                
                if ok:
                    succeeded += 1
                else:
                    failures.append({"to": to, "error": "send failed"})
            except Exception as e:
                # Store failed email log
                if db is not None:
                    try:
                        email_log = {
                            "campaign_id": campaign_id,
                            "recipient_email": to,
                            "subject": subject,
                            "sent_at": datetime.utcnow(),
                            "status": "failed",
                            "error": str(e)
                        }
                        await db.email_logs.insert_one(email_log)
                    except Exception as log_error:
                        logger.error(f"Failed to store email log for {to}: {log_error}")
                
                failures.append({"to": to, "error": str(e)})

    await asyncio.gather(*[_send(to) for to in normalized])

    # Update campaign status
    if db is not None and campaign_id:
        try:
            from bson import ObjectId
            result = await db.email_campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {
                    "$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "succeeded": succeeded,
                        "failed": len(normalized) - succeeded
                    }
                }
            )
            logger.info(f"Updated campaign {campaign_id}: {result.modified_count} documents modified")
        except Exception as e:
            logger.error(f"Failed to update campaign status: {e}")

    return {
        "requested": len(normalized),
        "attempted": len(normalized),
        "succeeded": succeeded,
        "failed": len(normalized) - succeeded,
        "failures": failures,
        "campaign_id": campaign_id,
    }