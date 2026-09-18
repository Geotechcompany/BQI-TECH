import asyncio
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
from app.lib.runtime_environment import get_frontend_url
from app.lib.email_brand import (
    BQI_BRAND,
    environment_email_styles,
    environment_notice_html,
    escape_email_text,
    module_chips_html,
    primary_button_html,
    wrap_admin_email,
    wrap_public_email,
)
import logging

from app.lib.email_transport import deliver_html_email

logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    """Return True when SMTP credentials are present."""
    from app.lib.email_transport import get_email_provider, is_email_configured

    if get_email_provider() != "smtp":
        return is_email_configured()
    return bool((settings.smtp_user or "").strip() and (settings.smtp_pass or "").strip())


def test_smtp_connection() -> dict[str, Any]:
    """Verify SMTP settings by connecting and logging in. Does not send mail."""
    if not is_smtp_configured():
        return {
            "configured": False,
            "connected": False,
            "host": settings.smtp_host,
            "port": int(settings.smtp_port),
            "fromEmail": settings.from_email,
            "message": "SMTP_USER or SMTP_PASS is not set",
        }

    try:
        with get_smtp_connection():
            pass
        return {
            "configured": True,
            "connected": True,
            "host": settings.smtp_host,
            "port": int(settings.smtp_port),
            "user": settings.smtp_user,
            "fromEmail": settings.from_email,
            "message": "SMTP login successful",
        }
    except Exception as e:
        logger.warning("SMTP connection test failed: %s", e)
        return {
            "configured": True,
            "connected": False,
            "host": settings.smtp_host,
            "port": int(settings.smtp_port),
            "user": settings.smtp_user,
            "fromEmail": settings.from_email,
            "message": str(e),
        }


def get_smtp_connection():
    """
    Get the appropriate SMTP connection based on port configuration.
    Office 365 uses port 587 with STARTTLS.
    Gmail uses port 465 with SSL.
    """
    context = ssl.create_default_context()
    
    if int(settings.smtp_port) == 587:
        # STARTTLS (Office 365, most modern SMTP)
        server = smtplib.SMTP(settings.smtp_host, int(settings.smtp_port))
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(settings.smtp_user, settings.smtp_pass)
        return server
    else:
        # SSL/TLS (Gmail on 465)
        server = smtplib.SMTP_SSL(settings.smtp_host, int(settings.smtp_port), context=context)
        server.login(settings.smtp_user, settings.smtp_pass)
        return server

def generate_verification_code(length: int = 6) -> str:
    """Generate a random verification code"""
    return ''.join(random.choices(string.digits, k=length))

async def store_verification_code(email: str, code: str, expires_in_minutes: int = 15) -> bool:
    """Store verification code in database with expiration"""
    try:
        db = get_database()
        if db is None:
            logger.error("Database not connected while storing verification code")
            return False
        
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
        
        content = f"""
            <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.3; font-weight: 700; color: {BQI_BRAND['dark_blue']};">
                Email Verification
            </h1>
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['body_text']};">
                Thank you for signing up with BQI Tech! To complete your registration, please use the verification code below:
            </p>
            <div style="background: linear-gradient(135deg, rgba(39,32,85,0.06) 0%, rgba(49,205,255,0.1) 100%); padding: 24px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid rgba(49,205,255,0.25);">
                <span style="color: {BQI_BRAND['dark_blue']}; font-size: 36px; letter-spacing: 10px; font-weight: 700; font-family: monospace;">
                    {escape_email_text(verification_code)}
                </span>
            </div>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: {BQI_BRAND['muted_text']};">
                This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
            </p>
        """
        body = wrap_public_email(content=content, preheader="Your BQI Tech verification code")
        
        message.attach(MIMEText(body, "html"))
        
        # Create secure connection and send email
        with get_smtp_connection() as server:
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
            if not settings.is_production:
                logger.warning(
                    f"[DEV] SMTP unavailable — verification code for {email}: {code} "
                    "(code saved in DB; use this to verify locally)"
                )
                return code
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
        
        safe_name = escape_email_text(name)
        safe_email = escape_email_text(email)
        safe_phone = escape_email_text(phone)
        safe_org = escape_email_text(organization)
        safe_service = escape_email_text(service)
        safe_message = escape_email_text(message)

        content = f"""
            <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: {BQI_BRAND['dark_blue']};">
                New Contact Form Submission
            </h1>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['muted_text']}; width: 38%;"><strong>Name</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['body_text']};">{safe_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['muted_text']};"><strong>Email</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['body_text']};">{safe_email}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['muted_text']};"><strong>Phone</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['body_text']};">{safe_phone}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['muted_text']};"><strong>Organization</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['body_text']};">{safe_org}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['muted_text']};"><strong>Service Interest</strong></td>
                    <td style="padding: 10px 0; border-bottom: 1px solid {BQI_BRAND['border']}; color: {BQI_BRAND['body_text']};">{safe_service}</td>
                </tr>
            </table>
            <h3 style="margin: 20px 0 10px; color: {BQI_BRAND['dark_blue']}; font-size: 16px;">Message</h3>
            <p style="margin: 0; background: {BQI_BRAND['light_bg']}; padding: 16px; border-radius: 10px; border-left: 4px solid {BQI_BRAND['cyan']}; color: {BQI_BRAND['body_text']}; white-space: pre-wrap;">
                {safe_message}
            </p>
        """
        body = wrap_public_email(content=content, preheader=f"New contact form submission from {safe_name}")
        
        message_obj.attach(MIMEText(body, "html"))
        
        # Create secure connection and send email
        with get_smtp_connection() as server:
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

        safe_name = escape_email_text(name)
        safe_service = escape_email_text(service)
        safe_message = escape_email_text(message)

        content = f"""
            <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: {BQI_BRAND['dark_blue']};">
                Thanks, {safe_name} — we've got your message
            </h1>
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['body_text']};">
                This is a quick confirmation that we received your inquiry.
                Our team will review it and get back to you shortly.
            </p>
            <div style="background: {BQI_BRAND['light_bg']}; padding: 16px; border-radius: 10px; margin: 16px 0; border-left: 4px solid {BQI_BRAND['cyan']};">
                <p style="margin: 0; color: {BQI_BRAND['body_text']};">Service interest: <strong>{safe_service}</strong></p>
                <p style="white-space: pre-wrap; margin: 10px 0 0; color: {BQI_BRAND['body_text']};">{safe_message}</p>
            </div>
            <p style="margin: 0; font-size: 14px; color: {BQI_BRAND['muted_text']};">
                If you didn't submit this request, please ignore this email.
            </p>
        """
        body = wrap_public_email(content=content, preheader="We received your message")

        message_obj.attach(MIMEText(body, "html"))

        with get_smtp_connection() as server:
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

        safe_name = escape_email_text(applicant_name)
        safe_job = escape_email_text(job_title)

        content = f"""
            <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: {BQI_BRAND['dark_blue']};">
                Thanks, {safe_name} — your application is in!
            </h1>
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['body_text']};">
                We've received your application for <strong>{safe_job}</strong>.
                Our hiring team will review your information and get back to you soon.
            </p>
            <p style="margin: 0; font-size: 14px; color: {BQI_BRAND['muted_text']};">
                You can track your application status anytime from your dashboard.
            </p>
        """
        body = wrap_public_email(content=content, preheader=f"Application received for {safe_job}")

        message_obj.attach(MIMEText(body, "html"))

        with get_smtp_connection() as server:
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

    safe_link = escape_email_text(reset_link)

    content = f"""
        <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: {BQI_BRAND['dark_blue']};">
            Reset your password
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['body_text']};">
            We received a request to reset your password. Click the button below to set a new password. This link will expire in 60 minutes.
        </p>
        {primary_button_html("Reset Password", reset_link)}
        <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: {BQI_BRAND['muted_text']}; word-break: break-all;">
            If the button doesn't work, copy and paste this URL into your browser:<br/>
            <a href="{safe_link}" style="color: {BQI_BRAND['cyan']}; text-decoration: underline;">{safe_link}</a>
        </p>
        <p style="margin: 16px 0 0; font-size: 14px; color: {BQI_BRAND['muted_text']};">
            If you didn't request this, you can safely ignore this email.
        </p>
    """
    body = wrap_public_email(content=content, preheader="Reset your BQI Tech password")
    message.attach(MIMEText(body, "html"))
    return message


async def send_password_reset_email(
    email: str,
    reset_link: str,
    frontend_url: str | None = None,
) -> bool:
    """Send a password reset email with a secure link."""
    try:
        message = build_reset_password_email(reset_link)
        message["To"] = email
        html = ""
        for part in message.walk():
            if part.get_content_type() == "text/html":
                html = part.get_payload(decode=True).decode(
                    part.get_content_charset() or "utf-8"
                )
                break
        ok = deliver_html_email(
            email, message["Subject"], html, frontend_url=frontend_url
        )
        if ok:
            logger.info(f"Password reset email sent to {email}")
        return ok
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return False


def _admin_role_display(role: str) -> str:
    upper = (role or "").strip().upper()
    if upper == "SUPER_ADMIN":
        return "Super Administrator"
    return "Administrator"


def build_admin_privilege_upgrade_email(
    recipient_name: str, role: str, admin_login_url: str
) -> MIMEMultipart:
    """Create an email notifying the user that admin access was granted."""
    role_label = _admin_role_display(role)
    display_name = escape_email_text((recipient_name or "").strip() or "there")
    safe_role = escape_email_text(role_label)
    safe_url = escape_email_text(admin_login_url)

    message = MIMEMultipart()
    message["From"] = settings.from_email
    message["Subject"] = "Your BQI Tech admin access is ready"

    content = f"""
        <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: {BQI_BRAND['admin_text']};">
            Admin access granted
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['admin_muted']};">
            Hi {display_name},
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['admin_muted']};">
            Your account has been upgraded to <strong style="color: {BQI_BRAND['admin_text']};">{safe_role}</strong> on the BQI Tech platform.
            You can now sign in to the admin portal to manage jobs, applications, and other workspace tools.
        </p>
        {primary_button_html("Open Admin Portal", admin_login_url, BQI_BRAND['admin_accent'])}
        <p style="margin: 24px 0 0; font-size: 14px; color: {BQI_BRAND['admin_muted']};">
            If you are already signed in, log out and sign back in with this email so your session picks up the new permissions.
        </p>
        <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.6; color: #9CA3AF; word-break: break-all;">
            If the button doesn't work, copy and paste this URL into your browser:<br/>
            <a href="{safe_url}" style="color: {BQI_BRAND['admin_accent']}; text-decoration: underline;">{safe_url}</a>
        </p>
    """
    body = wrap_admin_email(content=content, preheader="Your BQI Tech admin access is ready")
    message.attach(MIMEText(body, "html"))
    return message


async def send_admin_privilege_upgrade_email(
    email: str,
    recipient_name: str = "",
    role: str = "ADMIN",
) -> bool:
    """Notify a user that admin privileges were granted on their account."""
    try:
        admin_login_url = f"{get_frontend_url()}/admin/login"
        message = build_admin_privilege_upgrade_email(
            recipient_name=recipient_name,
            role=role,
            admin_login_url=admin_login_url,
        )
        message["To"] = email

        with get_smtp_connection() as server:
            server.sendmail(settings.from_email, email, message.as_string())
        logger.info(f"Admin privilege upgrade email sent to {email}")
        return True
    except Exception as e:
        logger.error(
            f"Failed to send admin privilege upgrade email to {email}: {str(e)}"
        )
        return False


def build_admin_invite_email(
    recipient_name: str,
    role: str,
    module_labels: list[str],
    action_link: str,
    invited_by: str = "",
    environment_label: str = "Development",
    database_name: str = "BQITECH-DEV",
    environment: str = "development",
) -> MIMEMultipart:
    """Email inviting a user to join the admin workspace."""
    role_label = _admin_role_display(role)
    display_name = escape_email_text((recipient_name or "").strip() or "there")
    safe_role = escape_email_text(role_label)
    safe_link = escape_email_text(action_link)
    env_styles = environment_email_styles(environment)
    env_key = (environment or "development").lower()

    inviter_html = ""
    if invited_by:
        inviter_html = f"""
        <p style="margin: 16px 0 0; font-size: 14px; color: {BQI_BRAND['admin_muted']};">
            Invited by <strong style="color: {BQI_BRAND['admin_text']};">{escape_email_text(invited_by)}</strong>
        </p>
        """

    subject_suffix = ""
    if env_key != "production":
        subject_suffix = f" - {environment_label}"

    message = MIMEMultipart()
    message["From"] = settings.from_email
    message["Subject"] = f"You're invited to BQI Tech Admin{subject_suffix}"

    content = f"""
        {environment_notice_html(environment_label, database_name, environment)}
        <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.3; font-weight: 700; color: {BQI_BRAND['admin_text']};">
            Admin workspace invitation
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['admin_muted']};">
            Hi {display_name},
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: {BQI_BRAND['admin_muted']};">
            You have been invited to join the BQI Tech admin portal as
            <strong style="color: {BQI_BRAND['admin_text']};">{safe_role}</strong>.
            Accept below to set your password and access your assigned modules.
        </p>
        {module_chips_html(module_labels)}
        {inviter_html}
        {primary_button_html("Accept invitation", action_link, env_styles["accent"])}
        <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: {BQI_BRAND['admin_muted']}; text-align: center;">
            This secure link expires in <strong style="color: {BQI_BRAND['admin_text']};">7 days</strong>.
        </p>
        <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.6; color: #9CA3AF; word-break: break-all;">
            If the button does not work, copy and paste this URL into your browser:<br/>
            <a href="{safe_link}" style="color: {BQI_BRAND['admin_accent']}; text-decoration: underline;">{safe_link}</a>
        </p>
    """

    body = wrap_admin_email(
        content=content,
        accent_color=env_styles["accent"],
        preheader=f"Join BQI Tech Admin ({environment_label}) as {role_label}.",
    )
    message.attach(MIMEText(body, "html"))
    return message


def _send_admin_invite_email_sync(
    email: str,
    recipient_name: str,
    role: str,
    module_labels: list[str],
    action_link: str,
    invited_by: str,
    resolved_label: str,
    resolved_database: str,
    resolved_environment: str,
    frontend_url: str | None = None,
) -> bool:
    """Blocking SMTP send — run via asyncio.to_thread from async callers."""
    message = build_admin_invite_email(
        recipient_name=recipient_name,
        role=role,
        module_labels=module_labels,
        action_link=action_link,
        invited_by=invited_by,
        environment_label=resolved_label,
        database_name=resolved_database,
        environment=resolved_environment,
    )
    message["To"] = email

    html_body = message.as_string()
    # Extract HTML part for HTTP transports (invite emails are HTML-only multipart)
    for part in message.walk():
        if part.get_content_type() == "text/html":
            html_body = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8")
            break

    subject = message["Subject"]
    return deliver_html_email(email, subject, html_body, frontend_url=frontend_url)


async def send_admin_invite_email(
    email: str,
    recipient_name: str,
    role: str,
    module_labels: list[str],
    action_link: str,
    invited_by: str = "",
    environment_label: str | None = None,
    database_name: str | None = None,
    environment: str | None = None,
    frontend_url: str | None = None,
) -> bool:
    """Send admin workspace invitation email."""
    resolved_label = environment_label or "Development"
    resolved_database = database_name or "BQITECH-DEV"
    resolved_environment = environment or "development"

    try:
        if not environment_label or not database_name or not environment:
            from app.lib.runtime_environment import get_runtime_environment_payload

            runtime = get_runtime_environment_payload()
            resolved_label = environment_label or runtime.get("label", "Development")
            resolved_database = database_name or runtime.get("databaseName", "BQITECH-DEV")
            resolved_environment = environment or runtime.get("environment", "development")

        return await asyncio.to_thread(
            _send_admin_invite_email_sync,
            email,
            recipient_name,
            role,
            module_labels,
            action_link,
            invited_by,
            resolved_label,
            resolved_database,
            resolved_environment,
            frontend_url,
        )
    except Exception as e:
        logger.error(f"Failed to send admin invite email to {email}: {str(e)}")
        if not settings.is_production:
            logger.info(
                "DEV invite link for %s (%s): %s",
                email,
                resolved_label,
                action_link,
            )
        return False

# ---------------------- Generic & Bulk Email Utilities ----------------------
def send_generic_email(
    to: str,
    subject: str,
    html: str,
    *,
    email_type: str = "generic",
    application_id: Optional[str] = None,
    job_id: Optional[str] = None,
    sent_by_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    skip_log: bool = False,
) -> bool:
    """Send a generic HTML email and optionally persist a delivery log.

    Logging only runs when called on the main event-loop thread (Motor-safe).
    Prefer ``send_generic_email_logged`` from async code, or pass
    ``skip_log=True`` when the caller writes its own audit trail.
    """
    ok = False
    error_message: Optional[str] = None
    try:
        ok = bool(deliver_html_email(to, subject, html))
        if not ok:
            error_message = "Email delivery failed"
    except Exception as exc:
        error_message = str(exc)
        logger.error("send_generic_email failed for %s: %s", to, exc)
        ok = False

    if not skip_log:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop is not None:
            try:
                from app.lib.communication_emails import (
                    build_email_log_document,
                    insert_email_log,
                )

                loop.create_task(
                    insert_email_log(
                        build_email_log_document(
                            to=to,
                            subject=subject,
                            status="sent" if ok else "failed",
                            email_type=email_type,
                            error=error_message,
                            html=html,
                            application_id=application_id,
                            job_id=job_id,
                            sent_by_name=sent_by_name,
                            metadata=metadata,
                        )
                    )
                )
            except Exception as log_exc:
                logger.error("Failed to log outbound email to %s: %s", to, log_exc)
        else:
            logger.debug(
                "Skipping email log for %s — no running event loop (use send_generic_email_logged)",
                to,
            )

    return ok


async def send_generic_email_logged(
    to: str,
    subject: str,
    html: str,
    *,
    email_type: str = "generic",
    application_id: Optional[str] = None,
    job_id: Optional[str] = None,
    sent_by_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Send email on a worker thread, then write email_logs on the main loop."""
    ok = await asyncio.to_thread(
        send_generic_email,
        to,
        subject,
        html,
        skip_log=True,
    )
    try:
        from app.lib.communication_emails import (
            build_email_log_document,
            insert_email_log,
        )

        await insert_email_log(
            build_email_log_document(
                to=to,
                subject=subject,
                status="sent" if ok else "failed",
                email_type=email_type,
                error=None if ok else "Email delivery failed",
                html=html,
                application_id=application_id,
                job_id=job_id,
                sent_by_name=sent_by_name,
                metadata=metadata,
            )
        )
    except Exception as log_exc:
        logger.error("Failed to log outbound email to %s: %s", to, log_exc)
    return ok


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
                ok = await loop.run_in_executor(
                    None,
                    lambda: send_generic_email(to, subject, html, skip_log=True),
                )

                # Store individual email log
                if db is not None:
                    try:
                        from app.lib.communication_emails import (
                            build_email_log_document,
                            insert_email_log,
                        )

                        await insert_email_log(
                            build_email_log_document(
                                to=to,
                                subject=subject,
                                status="sent" if ok else "failed",
                                email_type="broadcast",
                                error=None if ok else "send failed",
                                campaign_id=campaign_id,
                            )
                        )
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
                        from app.lib.communication_emails import (
                            build_email_log_document,
                            insert_email_log,
                        )

                        await insert_email_log(
                            build_email_log_document(
                                to=to,
                                subject=subject,
                                status="failed",
                                email_type="broadcast",
                                error=str(e),
                                campaign_id=campaign_id,
                            )
                        )
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