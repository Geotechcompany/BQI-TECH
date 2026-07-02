from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File, Request
from typing import List, Optional, Dict, Any
from app.auth import get_current_admin_user, get_current_user
from app.models import User, Application, Job, BlogPost, Question
from app.database import get_database, sync_databases_now
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timedelta
import asyncio
import json
from fastapi.responses import JSONResponse
from ..logger import logger
from fastapi import status
from pathlib import Path
import os
import re
from typing import Dict, Any, List
from app.lib.email import (
    send_bulk_emails_backend,
    send_admin_privilege_upgrade_email,
    send_admin_invite_email,
)
from app.lib.email_transport import is_email_configured
from app.lib.roles import is_admin_role, normalize_role, was_promoted_to_admin
from app.lib.admin_permissions import (
    ADMIN_MODULE_LABELS,
    can_manage_admin_users,
    can_manage_backup,
    get_effective_admin_modules,
    list_admin_modules_catalog,
    normalize_admin_modules,
)
from app.lib.applicant_ranking import rank_application_by_id
from app.lib.admin_audit import (
    log_blog_created,
    log_blog_updated,
    log_blog_deleted,
    log_bulk_operation,
    log_custom_action,
    log_resource_created,
    log_resource_deleted,
    log_resource_updated,
    safe_record_admin_activity,
)
from app.lib.nvidia_ai import test_nvidia_connection
from app.lib.error_utils import format_exception_message
from app.auth import get_password_hash
import secrets

router = APIRouter(tags=["admin"])

# Job Reference System Integration
try:
    import sys
    backend_dir = os.path.join(os.path.dirname(__file__), '..', '..')
    if backend_dir not in sys.path:
        sys.path.append(backend_dir)
    
    from job_reference_system import (
        resolve_job_titles, 
        get_applications_with_job_info,
        extract_data_from_answers_with_job_resolution
    )
    JOB_REFERENCE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Job reference system not available: {e}")
    JOB_REFERENCE_AVAILABLE = False

def convert_objectids_to_strings(doc):
    """Convert ObjectIds to strings in a document"""
    if isinstance(doc, list):
        for item in doc:
            convert_objectids_to_strings(item)
        return doc
    elif isinstance(doc, dict):
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, (dict, list)):
                convert_objectids_to_strings(value)
        return doc
    return doc

def generate_slug(title: str) -> str:
    """Generate a URL-friendly slug from a title"""
    if not title:
        return ""
    slug = title.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug


def _normalize_text_value(value: Any) -> str:
    """Coerce mixed DB values (str, list, None) into a stripped string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        for item in value:
            normalized = _normalize_text_value(item)
            if normalized:
                return normalized
        return ""
    return str(value).strip()

# ---------------------- Admin Email Broadcast ----------------------
@router.post("/emails/broadcast")
async def admin_email_broadcast(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Broadcast an email to all users or a specific list of recipients.

    Body:
      {
        "mode": "all" | "list",
        "recipients": ["a@example.com", ...], // required when mode=list
        "subject": "...",
        "body": "<html>...",
        "dryRun": false,
        "concurrency": 10
      }
    """
    try:
        db = get_database()

        mode = str(payload.get("mode", "list")).lower()
        subject = str(payload.get("subject", "")).strip()
        html = str(payload.get("body", "")).strip()
        dry_run = bool(payload.get("dryRun", False))
        concurrency = int(payload.get("concurrency", 10))

        if not subject or not html:
            raise HTTPException(status_code=400, detail="subject and body are required")

        recipients: List[str] = []
        if mode == "all":
            cursor = db.users.find({"email": {"$exists": True, "$ne": None}}, {"email": 1})
            docs = await cursor.to_list(length=None)
            recipients = [str(doc.get("email")) for doc in docs if doc.get("email")]
        else:
            provided = payload.get("recipients", []) or []
            if not isinstance(provided, list) or len(provided) == 0:
                raise HTTPException(status_code=400, detail="Provide recipients when mode=list")
            recipients = [str(e) for e in provided]

        result = await send_bulk_emails_backend(
            recipients=recipients,
            subject=subject,
            html=html,
            concurrency=concurrency,
            dry_run=dry_run,
            sent_by=str(current_user.get("_id")),
            campaign_name=payload.get("campaign_name"),
        )

        if not dry_run:
            await log_custom_action(
                db,
                current_user,
                action="sent",
                resource_type="email_broadcast",
                detail=f"{result.get('sent', len(recipients))} recipients — subject: {subject[:80]}",
                resource_title=subject,
            )

        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email broadcast failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to send emails")

# ---------------------- Email History & Analytics ----------------------
@router.get("/emails/campaigns")
async def get_email_campaigns(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get list of email campaigns with pagination"""
    try:
        db = get_database()
        
        # Get campaigns with pagination
        cursor = db.email_campaigns.find().sort("created_at", -1).skip(skip).limit(limit)
        campaigns = []
        
        async for campaign in cursor:
            campaign["_id"] = str(campaign["_id"])
            campaigns.append(campaign)
        
        # Get total count
        total = await db.email_campaigns.count_documents({})
        
        return {
            "campaigns": campaigns,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Failed to get email campaigns: {e}")
        raise HTTPException(status_code=500, detail="Failed to get email campaigns")

@router.get("/emails/campaigns/{campaign_id}")
async def get_email_campaign_details(
    campaign_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get detailed information about a specific email campaign"""
    try:
        db = get_database()
        
        # Get campaign details
        campaign = await db.email_campaigns.find_one({"_id": ObjectId(campaign_id)})
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        campaign["_id"] = str(campaign["_id"])
        
        # Get email logs for this campaign
        cursor = db.email_logs.find({"campaign_id": campaign_id}).sort("sent_at", -1)
        logs = []
        
        async for log in cursor:
            log["_id"] = str(log["_id"])
            logs.append(log)
        
        # Get statistics
        total_sent = await db.email_logs.count_documents({"campaign_id": campaign_id, "status": "sent"})
        total_failed = await db.email_logs.count_documents({"campaign_id": campaign_id, "status": "failed"})
        
        return {
            "campaign": campaign,
            "logs": logs,
            "statistics": {
                "total_sent": total_sent,
                "total_failed": total_failed,
                "total_attempted": total_sent + total_failed
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get campaign details: {e}")
        raise HTTPException(status_code=500, detail="Failed to get campaign details")

@router.get("/emails/logs")
async def get_email_logs(
    skip: int = 0,
    limit: int = 100,
    campaign_id: str = None,
    status: str = None,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get email logs with optional filtering"""
    try:
        db = get_database()
        
        # Build query
        query = {}
        if campaign_id:
            query["campaign_id"] = campaign_id
        if status:
            query["status"] = status
        
        # Get logs with pagination
        cursor = db.email_logs.find(query).sort("sent_at", -1).skip(skip).limit(limit)
        logs = []
        
        async for log in cursor:
            log["_id"] = str(log["_id"])
            logs.append(log)
        
        # Get total count
        total = await db.email_logs.count_documents(query)
        
        return {
            "logs": logs,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Failed to get email logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to get email logs")

async def get_enhanced_applications_data(db, query: Dict[Any, Any] = None, limit: int = None) -> List[Dict[Any, Any]]:
    """Get applications with enhanced job title resolution and data extraction"""
    
    if not JOB_REFERENCE_AVAILABLE:
        # Fallback to original method without enhancement
        cursor = db.applications.find(query or {})
        if limit:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=None)
    
    # Get applications with job info
    applications = await get_applications_with_job_info(db, query, limit)
    
    # Enhance each application with extracted data
    enhanced_applications = []
    for app in applications:
        # Extract data from answers with job resolution
        extracted_data = await extract_data_from_answers_with_job_resolution(db, app)
        
        # Merge extracted data with original application
        enhanced_app = app.copy()
        enhanced_app.update(extracted_data)
        
        # Ensure position uses resolved job title
        enhanced_app['position'] = extracted_data.get('position', app.get('resolvedJobTitle', 'Position Not Available'))
        
        enhanced_applications.append(enhanced_app)
    
    return enhanced_applications

@router.get("/test-auth")
async def test_auth_endpoint(request: Request):
    """Test endpoint to check authentication"""
    session_header = request.headers.get("X-User-Session")
    if not session_header:
        return {"error": "No session header found", "headers": dict(request.headers)}
    
    try:
        import json
        user_data = json.loads(session_header)
        return {
            "message": "Authentication working",
            "user": user_data,
            "is_admin": is_admin_role(user_data.get("role"))
        }
    except Exception as e:
        return {"error": f"Failed to parse session: {str(e)}", "session_header": session_header}

@router.get("/jobs")
async def get_jobs(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get all jobs for admin use"""
    db = get_database()
    
    jobs_cursor = db.jobpostings.find({}, {"_id": 1, "title": 1})
    jobs = await jobs_cursor.to_list(length=None)
    
    # Convert ObjectIds to strings
    for job in jobs:
        convert_objectids_to_strings(job)
        job["id"] = str(job["_id"])
    
    return {"jobs": jobs}

# Job Postings endpoints
@router.get("/job-postings")
async def get_job_postings(
    current_user: dict = Depends(get_current_admin_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search in title and description"),
    status: Optional[bool] = Query(None, description="Filter by isActive status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    location: Optional[str] = Query(None, description="Filter by location"),
    sort_by: Optional[str] = Query("createdAt", description="Field to sort by (createdAt, title, department, location)"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)")
):
    """Get all job postings"""
    try:
        db = get_database()
        
        # Validate sort parameters
        valid_sort_fields = ["createdAt", "title", "department", "location"]
        if sort_by not in valid_sort_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid sort_by field. Must be one of: {', '.join(valid_sort_fields)}"
            )
        
        if sort_order not in ["asc", "desc"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid sort_order. Must be 'asc' or 'desc'"
            )
        
        # Build query
        query = {}
        
        # Add search
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        
        # Add filters
        if status is not None:
            query["isActive"] = status
        if department:
            query["department"] = department
        if location:
            query["location"] = location
        
        # Build sort
        sort_direction = -1 if sort_order == "desc" else 1
        sort_options = [(sort_by, sort_direction)]
        
        # Get job postings
        postings_cursor = db.jobpostings.find(query).skip(skip).limit(limit).sort(sort_options)
        postings = await postings_cursor.to_list(length=limit)
        total = await db.jobpostings.count_documents(query)
        
        # Convert ObjectIds to strings and add required fields
        for posting in postings:
            try:
                convert_objectids_to_strings(posting)
                posting["id"] = str(posting["_id"])
                
                # Ensure required fields exist with defaults
                if "isActive" not in posting:
                    posting["isActive"] = True
                if "department" not in posting:
                    posting["department"] = "N/A"
                if "location" not in posting:
                    posting["location"] = "N/A"
                if "postedDate" not in posting:
                    posting["postedDate"] = posting.get("createdAt", datetime.utcnow()).isoformat()
                
                # Get application count for each job
                try:
                    posting["applicationCount"] = await db.applications.count_documents({"jobId": str(posting["_id"])})
                except Exception as e:
                    logger.error(f"Error getting application count for job {posting['_id']}: {str(e)}")
                    posting["applicationCount"] = 0
                
                # Get creator details
                if "createdBy" in posting:
                    try:
                        # Check if createdBy is a valid ObjectId or a system identifier
                        created_by = posting["createdBy"]
                        if created_by == "system_migration" or created_by == "system":
                            # Handle system-created jobs
                            posting["creatorDetails"] = {
                                "name": "System Migration",
                                "email": "system@bqitech.com",
                                "role": "system"
                            }
                        elif isinstance(created_by, str) and len(created_by) == 24:
                            # Try to convert to ObjectId for valid hex strings
                            creator = await db.users.find_one({"_id": ObjectId(created_by)}, {"password": 0})
                            if creator:
                                convert_objectids_to_strings(creator)
                                posting["creatorDetails"] = creator
                            else:
                                posting["creatorDetails"] = None
                        else:
                            # Invalid createdBy format
                            posting["creatorDetails"] = None
                    except Exception as e:
                        logger.error(f"Error getting creator details for job {posting['_id']}: {str(e)}")
                        posting["creatorDetails"] = None
                
                # Get questions count
                try:
                    posting["questionsCount"] = await db.jobquestions.count_documents(
                        _question_job_filter(str(posting["_id"]))
                    )
                except Exception as e:
                    logger.error(f"Error getting questions count for job {posting['_id']}: {str(e)}")
                    posting["questionsCount"] = 0
            except Exception as e:
                logger.error(f"Error processing job posting {posting.get('_id', 'unknown')}: {str(e)}")
                continue
        
        # Get unique departments and locations for filters
        try:
            departments = await db.jobpostings.distinct("department")
            locations = await db.jobpostings.distinct("location")
        except Exception as e:
            logger.error(f"Error getting distinct values: {str(e)}")
            departments = []
            locations = []
        
        response_data = {
            "jobPostings": postings,
            "total": total,
            "filters": {
                "departments": departments,
                "locations": locations
            },
            "sort": {
                "field": sort_by,
                "order": sort_order
            }
        }
        
        # Return with proper JSON serialization
        return JSONResponse(
            content=json.loads(json.dumps(response_data, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
    except Exception as e:
        logger.error(f"Error in get_job_postings: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail="Failed to get job postings"
        )

@router.post("/job-postings")
async def create_job_posting(
    job_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Create new job posting"""
    db = get_database()
    
    # Clean up HTML entities in description
    if "description" in job_data:
        job_data["description"] = (
            job_data["description"]
            .replace("&nbsp;", " ")  # Replace &nbsp; with regular space
            .replace("\\s+", " ")    # Normalize multiple spaces using proper regex escape
            .strip()                 # Trim extra spaces
        )
    
    job_data["createdAt"] = datetime.utcnow()
    job_data["updatedAt"] = datetime.utcnow()
    job_data["createdBy"] = str(current_user["_id"])
    
    # Normalize and defaults
    if not job_data.get("employmentType"):
        job_data["employmentType"] = "Full-time"
    # Allow postedDate from client, otherwise default to now
    if not job_data.get("postedDate"):
        job_data["postedDate"] = datetime.utcnow()
    
    result = await db.jobpostings.insert_one(job_data)
    job_data["_id"] = str(result.inserted_id)
    job_data["id"] = str(result.inserted_id)

    await log_resource_created(
        db, current_user, resource_type="job_posting", doc=job_data, title_field="title"
    )
    
    return job_data

@router.get("/job-postings/{job_id}")
async def get_job_posting(
    job_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get specific job posting"""
    db = get_database()
    
    try:
        posting = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not posting:
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Convert all ObjectIds to strings
        convert_objectids_to_strings(posting)
        posting["id"] = str(posting["_id"])
        return posting
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid job ID")

@router.put("/job-postings/{job_id}")
async def update_job_posting(
    job_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update job posting"""
    db = get_database()
    
    try:
        existing = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Job posting not found")

        # Remove immutable and server-managed fields if present in payload
        for key in ["_id", "id", "createdAt", "updatedAt"]:
            if key in update_data:
                update_data.pop(key, None)

        # Clean up HTML entities in description
        if "description" in update_data:
            update_data["description"] = (
                update_data["description"]
                .replace("&nbsp;", " ")  # Replace &nbsp; with regular space
                # Simple normalization of multiple spaces (avoid regex injection in replace)
                .replace("  ", " ")
                .strip()                 # Trim extra spaces
            )
        
        update_data["updatedAt"] = datetime.utcnow()
        
        result = await db.jobpostings.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Job posting not found")

        await log_resource_updated(
            db,
            current_user,
            resource_type="job_posting",
            existing=existing,
            updates=update_data,
            resource_id=job_id,
            title_field="title",
        )
        
        # Return the updated document for UI freshness
        updated = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not updated:
            return {"message": "Job posting updated successfully"}
        convert_objectids_to_strings(updated)
        updated["id"] = str(updated["_id"])
        return updated
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/job-postings/{job_id}")
async def delete_job_posting(
    job_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete job posting"""
    db = get_database()
    
    try:
        existing = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Job posting not found")

        result = await db.jobpostings.delete_one({"_id": ObjectId(job_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Job posting not found")

        await log_resource_deleted(
            db,
            current_user,
            resource_type="job_posting",
            doc=existing,
            title_field="title",
            resource_id=job_id,
        )
        
        return {"message": "Job posting deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/job-postings/{job_id}/toggle-status")
async def toggle_job_posting_status(
    job_id: str,
    status_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Toggle job posting active status"""
    db = get_database()
    
    try:
        existing = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Job posting not found")

        is_active = status_data.get("isActive", True)
        update_data = {
            "isActive": is_active,
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.jobpostings.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Job posting not found")

        await log_custom_action(
            db,
            current_user,
            action="activated" if is_active else "deactivated",
            resource_type="job_posting",
            resource_id=job_id,
            resource_title=str(existing.get("title") or ""),
        )
        
        return {"message": f"Job posting {'activated' if is_active else 'deactivated'} successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# User Management endpoints

def _format_admin_user(user: dict) -> dict:
    """Normalize a user document for admin API responses."""
    if isinstance(user.get("_id"), ObjectId):
        user["_id"] = str(user["_id"])
    user["id"] = str(user.get("_id", user.get("id", "")))
    user["role"] = normalize_role(user.get("role"))
    user["adminModules"] = get_effective_admin_modules(user)
    user["invitePending"] = bool(user.get("invitePending", False))
    user["isEmailVerified"] = bool(
        user.get("isEmailVerified") or user.get("emailVerified")
    )
    for field in ["createdAt", "updatedAt", "lastLoginAt"]:
        if field in user and isinstance(user[field], datetime):
            user[field] = user[field].isoformat()
    user.pop("password", None)
    return user


def _generate_invite_token() -> str:
    return secrets.token_urlsafe(48)


async def _revoke_pending_invites(
    db, email: str, *, except_id: ObjectId | None = None
) -> None:
    query: dict[str, Any] = {"email": email, "status": "pending"}
    if except_id is not None:
        query["_id"] = {"$ne": except_id}
    await db.admin_invites.update_many(
        query,
        {"$set": {"status": "revoked", "revokedAt": datetime.utcnow()}},
    )


async def _log_admin_invite_action(
    db, current_user: dict, *, email: str, action: str = "invited"
) -> None:
    await log_custom_action(
        db,
        current_user,
        action=action,
        resource_type="admin_invite",
        resource_title=email,
        detail=email,
    )


async def _upsert_password_reset_token(
    db, email: str, user_id: str
) -> tuple[str, datetime]:
    token = _generate_invite_token()
    expires_at = datetime.utcnow() + timedelta(days=7)
    now = datetime.utcnow()
    await db.password_resets.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "userId": user_id,
                "token": token,
                "expiresAt": expires_at,
                "createdAt": now,
            }
        },
        upsert=True,
    )
    return token, expires_at


async def _deliver_admin_invite_email(
    *,
    email: str,
    recipient_name: str,
    role: str,
    module_labels: list[str],
    action_link: str,
    invited_by: str,
    frontend_url: str | None = None,
) -> None:
    if not is_email_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Email service is not configured. Open Admin → Settings → Email delivery "
                "and configure the Netlify relay (or another provider)."
            ),
        )

    sent = await send_admin_invite_email(
        email=email,
        recipient_name=recipient_name,
        role=role,
        module_labels=module_labels,
        action_link=action_link,
        invited_by=invited_by,
        frontend_url=frontend_url,
    )
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not send the invitation email. "
                "Verify SMTP credentials on Render and try again."
            ),
        )


@router.get("/permissions/modules")
async def get_admin_permission_modules(
    current_user: dict = Depends(get_current_admin_user),
):
    """List assignable admin modules for the permissions UI."""
    if not can_manage_admin_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage users",
        )
    return {"modules": list_admin_modules_catalog()}


@router.get("/users/invites")
async def list_admin_invites(
    current_user: dict = Depends(get_current_admin_user),
):
    """List pending admin invitations."""
    if not can_manage_admin_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage users",
        )
    db = get_database()
    cursor = db.admin_invites.find({"status": "pending"}).sort("createdAt", -1).limit(100)
    invites = []
    async for invite in cursor:
        invite["_id"] = str(invite["_id"])
        invite["id"] = str(invite["_id"])
        if isinstance(invite.get("createdAt"), datetime):
            invite["createdAt"] = invite["createdAt"].isoformat()
        if isinstance(invite.get("expiresAt"), datetime):
            invite["expiresAt"] = invite["expiresAt"].isoformat()
        invites.append(invite)
    return {"invites": invites}


@router.delete("/users/invites/{invite_id}")
async def revoke_admin_invite(
    invite_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    if not can_manage_admin_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage users",
        )
    db = get_database()
    result = await db.admin_invites.update_one(
        {"_id": ObjectId(invite_id), "status": "pending"},
        {"$set": {"status": "revoked", "revokedAt": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")

    invite = await db.admin_invites.find_one({"_id": ObjectId(invite_id)})
    await log_custom_action(
        db,
        current_user,
        action="revoked",
        resource_type="admin_invite",
        resource_id=invite_id,
        resource_title=str((invite or {}).get("email") or ""),
    )
    return {"message": "Invitation revoked"}


async def _resend_pending_admin_invite(
    db,
    invite: dict,
    current_user: dict,
    origin: str | None = None,
) -> dict[str, Any]:
    from app.lib.cors import resolve_frontend_url

    frontend_url = resolve_frontend_url(origin)

    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending invitations can be resent")

    email = str(invite.get("email", "")).strip().lower()
    name = str(invite.get("name", "")).strip() or email
    role = normalize_role(invite.get("role", "ADMIN"))
    admin_modules = normalize_admin_modules(invite.get("adminModules"), role)
    module_labels = [ADMIN_MODULE_LABELS.get(key, key) for key in admin_modules]
    inviter_name = current_user.get("name") or current_user.get("email") or "Admin"

    user = None
    user_id = invite.get("userId")
    if user_id:
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = None
    if not user and email:
        user = await db.users.find_one(
            {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
        )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Invited user account not found. Revoke and send a new invitation.",
        )

    now = datetime.utcnow()
    token, expires_at = await _upsert_password_reset_token(db, email, str(user["_id"]))
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"invitePending": True, "updatedAt": now}},
    )
    await db.admin_invites.update_one(
        {"_id": invite["_id"]},
        {
            "$set": {
                "expiresAt": expires_at,
                "updatedAt": now,
                "invitedBy": str(current_user["_id"]),
                "invitedByName": inviter_name,
            }
        },
    )

    action_link = f"{frontend_url}/reset-password?token={token}&invite=1"
    await _deliver_admin_invite_email(
        email=email,
        recipient_name=name,
        role=role,
        module_labels=module_labels,
        action_link=action_link,
        invited_by=inviter_name,
        frontend_url=frontend_url,
    )

    return {
        "message": "Invitation email resent",
        "email": email,
        "emailSent": True,
        "resent": True,
        "userId": str(user["_id"]),
        "inviteId": str(invite["_id"]),
    }


@router.post("/users/invites/{invite_id}/resend")
async def resend_admin_invite(
    invite_id: str,
    request: Request,
    current_user: dict = Depends(get_current_admin_user),
):
    """Resend the invitation email for a pending admin invite."""
    if not can_manage_admin_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage users",
        )

    db = get_database()
    invite = await db.admin_invites.find_one(
        {"_id": ObjectId(invite_id), "status": "pending"}
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Pending invitation not found")

    result = await _resend_pending_admin_invite(
        db, invite, current_user, request.headers.get("origin")
    )
    await _log_admin_invite_action(
        db, current_user, email=str(invite.get("email") or ""), action="resent"
    )
    return result


@router.post("/users/{user_id}/resend-invite")
async def resend_admin_invite_for_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_admin_user),
):
    """Resend the invitation email for a user with a pending invite."""
    if not can_manage_admin_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage users",
        )

    db = get_database()
    invite = await db.admin_invites.find_one(
        {"userId": user_id, "status": "pending"}
    )
    if not invite:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
        if user and user.get("email"):
            email = str(user["email"]).strip().lower()
            invite = await db.admin_invites.find_one(
                {"email": email, "status": "pending"}
            )

    if not invite:
        raise HTTPException(
            status_code=404,
            detail="No pending invitation found for this user",
        )

    result = await _resend_pending_admin_invite(
        db, invite, current_user, request.headers.get("origin")
    )
    await _log_admin_invite_action(
        db, current_user, email=str(invite.get("email") or ""), action="resent"
    )
    return result


@router.post("/users/invite")
async def invite_admin_user(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_admin_user),
):
    """Invite a user to the admin workspace with scoped module permissions."""
    if not can_manage_admin_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to invite users",
        )

    email = str(payload.get("email", "")).strip().lower()
    name = str(payload.get("name", "")).strip()
    role = normalize_role(payload.get("role", "ADMIN"))
    admin_modules = normalize_admin_modules(payload.get("adminModules"), role)

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not is_admin_role(role):
        raise HTTPException(
            status_code=400,
            detail="Invited users must have ADMIN or SUPER_ADMIN role",
        )

    from app.lib.cors import resolve_frontend_url

    frontend_url = resolve_frontend_url(request.headers.get("origin"))
    db = get_database()
    inviter_name = current_user.get("name") or current_user.get("email") or "Admin"
    module_labels = [
        ADMIN_MODULE_LABELS.get(key, key) for key in admin_modules
    ]

    existing = await db.users.find_one(
        {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
    )
    pending_invite = await db.admin_invites.find_one(
        {"email": email, "status": "pending"}
    )

    if pending_invite:
        user = existing
        user_id = pending_invite.get("userId")
        if not user and user_id:
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
            except Exception:
                user = None

        if not user:
            await _revoke_pending_invites(db, email)
        else:
            if str(user["_id"]) == str(current_user["_id"]) and role != normalize_role(
                user.get("role")
            ):
                raise HTTPException(
                    status_code=400,
                    detail="You cannot change your own role via invite",
                )

            now = datetime.utcnow()
            token, expires_at = await _upsert_password_reset_token(
                db, email, str(user["_id"])
            )
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "name": name,
                        "role": role,
                        "adminModules": admin_modules,
                        "invitePending": True,
                        "updatedAt": now,
                    }
                },
            )
            await db.admin_invites.update_one(
                {"_id": pending_invite["_id"]},
                {
                    "$set": {
                        "name": name,
                        "role": role,
                        "adminModules": admin_modules,
                        "invitedBy": str(current_user["_id"]),
                        "invitedByName": inviter_name,
                        "userId": str(user["_id"]),
                        "expiresAt": expires_at,
                        "updatedAt": now,
                    }
                },
            )
            action_link = f"{frontend_url}/reset-password?token={token}&invite=1"
            await _deliver_admin_invite_email(
                email=email,
                recipient_name=name,
                role=role,
                module_labels=module_labels,
                action_link=action_link,
                invited_by=inviter_name,
                frontend_url=frontend_url,
            )
            await _log_admin_invite_action(db, current_user, email=email, action="invited")
            return {
                "message": "Pending invitation updated and resent",
                "userId": str(user["_id"]),
                "existingUser": True,
                "resent": True,
                "email": email,
                "emailSent": True,
            }

    if existing:
        if str(existing["_id"]) == str(current_user["_id"]) and role != normalize_role(
            existing.get("role")
        ):
            raise HTTPException(
                status_code=400, detail="You cannot change your own role via invite"
            )

        update_fields = {
            "name": name,
            "role": role,
            "adminModules": admin_modules,
            "updatedAt": datetime.utcnow(),
        }
        await db.users.update_one({"_id": existing["_id"]}, {"$set": update_fields})

        previous_role = existing.get("role")
        promoted = was_promoted_to_admin(previous_role, role)
        login_url = f"{frontend_url}/admin/login"
        needs_password_setup = promoted or bool(
            existing.get("invitePending")
        ) or not existing.get("password")

        if needs_password_setup:
            token, expires_at = await _upsert_password_reset_token(
                db, email, str(existing["_id"])
            )
            action_link = f"{frontend_url}/reset-password?token={token}&invite=1"
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"invitePending": True}},
            )
            now = datetime.utcnow()
            await _revoke_pending_invites(db, email)
            await db.admin_invites.insert_one(
                {
                    "email": email,
                    "name": name,
                    "role": role,
                    "adminModules": admin_modules,
                    "invitedBy": str(current_user["_id"]),
                    "invitedByName": inviter_name,
                    "userId": str(existing["_id"]),
                    "status": "pending",
                    "createdAt": now,
                    "expiresAt": expires_at,
                }
            )
        else:
            action_link = login_url

        await _deliver_admin_invite_email(
            email=email,
            recipient_name=name,
            role=role,
            module_labels=module_labels,
            action_link=action_link,
            invited_by=inviter_name,
            frontend_url=frontend_url,
        )
        await _log_admin_invite_action(db, current_user, email=email, action="invited")

        return {
            "message": "Existing user updated and notified",
            "userId": str(existing["_id"]),
            "existingUser": True,
            "email": email,
            "emailSent": True,
        }

    # New user — create account and send set-password invite
    temp_password = secrets.token_urlsafe(24)
    now = datetime.utcnow()
    hashed_password = await asyncio.to_thread(get_password_hash, temp_password)
    user_doc = {
        "email": email,
        "name": name,
        "password": hashed_password,
        "role": role,
        "adminModules": admin_modules,
        "isEmailVerified": True,
        "invitePending": True,
        "createdAt": now,
        "updatedAt": now,
    }
    insert_result = await db.users.insert_one(user_doc)
    user_id = str(insert_result.inserted_id)

    token, expires_at = await _upsert_password_reset_token(db, email, user_id)

    await _revoke_pending_invites(db, email)
    await db.admin_invites.insert_one(
        {
            "email": email,
            "name": name,
            "role": role,
            "adminModules": admin_modules,
            "invitedBy": str(current_user["_id"]),
            "invitedByName": inviter_name,
            "userId": user_id,
            "status": "pending",
            "createdAt": now,
            "expiresAt": expires_at,
        }
    )

    action_link = f"{frontend_url}/reset-password?token={token}&invite=1"
    try:
        await _deliver_admin_invite_email(
            email=email,
            recipient_name=name,
            role=role,
            module_labels=module_labels,
            action_link=action_link,
            invited_by=inviter_name,
            frontend_url=frontend_url,
        )
    except HTTPException:
        await db.admin_invites.delete_many(
            {"email": email, "status": "pending", "userId": user_id}
        )
        await db.users.delete_one({"_id": ObjectId(user_id)})
        await db.password_resets.delete_one({"email": email})
        raise

    await _log_admin_invite_action(db, current_user, email=email, action="invited")
    return {
        "message": "Invitation sent successfully",
        "userId": user_id,
        "existingUser": False,
        "email": email,
        "emailSent": True,
    }


@router.get("/users")
async def get_users(
    current_user: dict = Depends(get_current_admin_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get all users"""
    db = get_database()
    
    users_cursor = db.users.find({}, {"password": 0}).skip(skip).limit(limit).sort("createdAt", -1)
    users = await users_cursor.to_list(length=limit)
    total = await db.users.count_documents({})

    formatted = [_format_admin_user(user) for user in users]

    return {"users": formatted, "total": total}

@router.get("/users/count")
async def get_users_count(
    current_admin: dict = Depends(get_current_admin_user),
):
    """Get total user count"""
    db = get_database()
    total = await db.users.count_documents({})
    return {"count": total}

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update user details"""
    db = get_database()
    
    try:
        existing_user = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"email": 1, "name": 1, "role": 1},
        )
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")

        previous_role = existing_user.get("role")
        # Remove sensitive fields that shouldn't be updated this way
        update_data.pop("password", None)
        if "role" in update_data and update_data["role"] is not None:
            update_data["role"] = normalize_role(str(update_data["role"]))
        if "adminModules" in update_data:
            update_data["adminModules"] = normalize_admin_modules(
                update_data.get("adminModules"), update_data.get("role", previous_role)
            )
        new_role = update_data.get("role", previous_role)
        update_data["updatedAt"] = datetime.utcnow()
        
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        if was_promoted_to_admin(previous_role, new_role):
            recipient_email = existing_user.get("email")
            if recipient_email:
                asyncio.create_task(
                    send_admin_privilege_upgrade_email(
                        email=recipient_email,
                        recipient_name=existing_user.get("name", ""),
                        role=new_role,
                    )
                )

        await log_resource_updated(
            db,
            current_user,
            resource_type="user",
            existing=existing_user,
            updates=update_data,
            resource_id=user_id,
            title_field="email",
        )
        
        return {"message": "User updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete user"""
    db = get_database()
    
    try:
        # Don't allow deleting self
        if str(current_user["_id"]) == user_id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")

        target = await db.users.find_one({"_id": ObjectId(user_id)})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        normalized_email = str(target.get("email", "")).strip().lower()
        await db.admin_invites.update_many(
            {
                "status": "pending",
                "$or": [{"userId": user_id}, {"email": normalized_email}],
            },
            {"$set": {"status": "revoked", "revokedAt": datetime.utcnow()}},
        )

        result = await db.users.delete_one({"_id": ObjectId(user_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        await log_resource_deleted(
            db,
            current_user,
            resource_type="user",
            doc=target,
            title_field="email",
            resource_id=user_id,
        )
        
        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Blog Posts endpoints
@router.get("/blog-posts")
async def get_blog_posts(
    current_user: dict = Depends(get_current_admin_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get all blog posts"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        posts_cursor = db.blogposts.find({}).skip(skip).limit(limit).sort("createdAt", -1)
        posts = await posts_cursor.to_list(length=limit)
        total = await db.blogposts.count_documents({})
        
        # Convert ObjectIds to strings and format dates
        for post in posts:
            convert_objectids_to_strings(post)
            post["id"] = str(post["_id"])
            
            # Format dates
            if "createdAt" in post and hasattr(post["createdAt"], "isoformat"):
                post["createdAt"] = post["createdAt"].isoformat()
            if "updatedAt" in post and hasattr(post["updatedAt"], "isoformat"):
                post["updatedAt"] = post["updatedAt"].isoformat()
            if "publishedAt" in post and hasattr(post["publishedAt"], "isoformat"):
                post["publishedAt"] = post["publishedAt"].isoformat()
                
            # Ensure required fields are present
            post.setdefault("title", "")
            post.setdefault("content", "")
            post.setdefault("excerpt", "")
            post.setdefault("category", "Uncategorized")
            post.setdefault("tags", [])
            post.setdefault("imageUrl", "")
            post.setdefault("readTime", "")
            post.setdefault("published", False)
            post.setdefault("isPublished", False)
        
        # Return with the expected structure
        return JSONResponse(
            content={"blogPosts": posts, "total": total},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
            }
        )
    except Exception as e:
        logger.error(f"Error in get_blog_posts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.options("/blog-posts", include_in_schema=False)
async def options_blog_posts(request: Request):
    """Handle CORS preflight requests"""
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

@router.post("/blog-posts")
async def create_blog_post(
    post_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Create new blog post"""
    db = get_database()
    
    # Handle author profile data
    author_profile = None
    if all(key in post_data for key in ['authorName', 'authorBio', 'authorTitle', 'authorProfileImage']):
        social_links = {}
        if post_data.get('authorTwitter'):
            social_links['twitter'] = post_data.pop('authorTwitter')
        if post_data.get('authorLinkedin'):
            social_links['linkedin'] = post_data.pop('authorLinkedin')
        if post_data.get('authorGithub'):
            social_links['github'] = post_data.pop('authorGithub')
        if post_data.get('authorWebsite'):
            social_links['website'] = post_data.pop('authorWebsite')
        
        author_profile = {
            "name": post_data.pop('authorName'),
            "bio": post_data.pop('authorBio'),
            "title": post_data.pop('authorTitle'),
            "profile_image": post_data.pop('authorProfileImage'),
            "social_links": social_links if social_links else None
        }
        post_data["authorProfile"] = author_profile
    
    post_data["createdAt"] = datetime.utcnow()
    post_data["updatedAt"] = datetime.utcnow()
    post_data["authorId"] = str(current_user["_id"])
    
    # Set default author name if no profile provided
    if not author_profile:
        post_data["author"] = current_user.get("name", "Admin")
    else:
        post_data["author"] = author_profile["name"]
    
    # Ensure slug exists (from title if not provided)
    if not post_data.get("slug") and post_data.get("title"):
        post_data["slug"] = generate_slug(post_data["title"])

    result = await db.blogposts.insert_one(post_data)
    post_data["_id"] = str(result.inserted_id)
    post_data["id"] = str(result.inserted_id)

    try:
        from app.lib.admin_audit import log_blog_created

        await log_blog_created(db, current_user, post_data)
    except Exception as audit_err:
        logger.warning("Failed to record blog create activity: %s", audit_err)
    
    return post_data

@router.get("/blog-posts/{post_id}")
async def get_blog_post(
    post_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get specific blog post"""
    db = get_database()
    
    try:
        post = await db.blogposts.find_one({"_id": ObjectId(post_id)})
        if not post:
            raise HTTPException(status_code=404, detail="Blog post not found")
        
        post["_id"] = str(post["_id"])
        post["id"] = str(post["_id"])
        
        # Ensure authorProfile is properly formatted for the frontend form
        if "authorProfile" in post and post["authorProfile"]:
            # Convert profile_image to profileImage for frontend compatibility
            if "profile_image" in post["authorProfile"]:
                post["authorProfile"]["profileImage"] = post["authorProfile"].pop("profile_image")
            
            # Ensure social_links is properly formatted
            if "social_links" in post["authorProfile"] and post["authorProfile"]["social_links"]:
                post["authorProfile"]["socialLinks"] = post["authorProfile"].pop("social_links")
            else:
                post["authorProfile"]["socialLinks"] = {}
        
        return post
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid post ID")

@router.put("/blog-posts/{post_id}")
async def update_blog_post(
    post_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update blog post"""
    db = get_database()
    
    try:
        existing = await db.blogposts.find_one({"_id": ObjectId(post_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Blog post not found")

        # Handle author profile data
        if all(key in update_data for key in ['authorName', 'authorBio', 'authorTitle', 'authorProfileImage']):
            social_links = {}
            if update_data.get('authorTwitter'):
                social_links['twitter'] = update_data.pop('authorTwitter')
            if update_data.get('authorLinkedin'):
                social_links['linkedin'] = update_data.pop('authorLinkedin')
            if update_data.get('authorGithub'):
                social_links['github'] = update_data.pop('authorGithub')
            if update_data.get('authorWebsite'):
                social_links['website'] = update_data.pop('authorWebsite')
            
            author_profile = {
                "name": update_data.pop('authorName'),
                "bio": update_data.pop('authorBio'),
                "title": update_data.pop('authorTitle'),
                "profile_image": update_data.pop('authorProfileImage'),
                "social_links": social_links if social_links else None
            }
            update_data["authorProfile"] = author_profile
            update_data["author"] = author_profile["name"]
        
        # Ensure slug is consistent with title when title is updated
        if "title" in update_data and update_data["title"]:
            update_data["slug"] = generate_slug(update_data["title"])

        update_data["updatedAt"] = datetime.utcnow()
        
        result = await db.blogposts.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Blog post not found")

        try:
            from app.lib.admin_audit import log_blog_updated

            await log_blog_updated(db, current_user, existing, update_data)
        except Exception as audit_err:
            logger.warning("Failed to record blog update activity: %s", audit_err)
        
        return {"message": "Blog post updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/blog-posts/{post_id}")
async def patch_blog_post(
    post_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Patch blog post (for partial updates like status changes)"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Handle author profile data if present
        if all(key in update_data for key in ['authorName', 'authorBio', 'authorTitle', 'authorProfileImage']):
            social_links = {}
            if update_data.get('authorTwitter'):
                social_links['twitter'] = update_data.pop('authorTwitter')
            if update_data.get('authorLinkedin'):
                social_links['linkedin'] = update_data.pop('authorLinkedin')
            if update_data.get('authorGithub'):
                social_links['github'] = update_data.pop('authorGithub')
            if update_data.get('authorWebsite'):
                social_links['website'] = update_data.pop('authorWebsite')
            
            author_profile = {
                "name": update_data.pop('authorName'),
                "bio": update_data.pop('authorBio'),
                "title": update_data.pop('authorTitle'),
                "profile_image": update_data.pop('authorProfileImage'),
                "social_links": social_links if social_links else {}
            }
            update_data["authorProfile"] = author_profile
            update_data["author"] = author_profile["name"]
        
        # If title provided, keep slug in sync
        if "title" in update_data and update_data["title"]:
            update_data["slug"] = generate_slug(update_data["title"])

        # If slug missing and title not included, ensure the post has a slug by backfilling
        if "slug" not in update_data or not update_data["slug"]:
            try:
                existing = await db.blogposts.find_one({"_id": ObjectId(post_id)}, {"title": 1, "slug": 1})
                if existing and not existing.get("slug") and existing.get("title"):
                    update_data["slug"] = generate_slug(existing["title"])
            except Exception:
                pass

        update_data["updatedAt"] = datetime.utcnow()

        existing = await db.blogposts.find_one({"_id": ObjectId(post_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Blog post not found")
        
        result = await db.blogposts.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Blog post not found")

        try:
            from app.lib.admin_audit import log_blog_updated

            await log_blog_updated(db, current_user, existing, update_data)
        except Exception as audit_err:
            logger.warning("Failed to record blog patch activity: %s", audit_err)
        
        return JSONResponse(
            content={"message": "Blog post updated successfully"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in patch_blog_post: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/blog-posts/{post_id}")
async def delete_blog_post(
    post_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete blog post"""
    db = get_database()
    
    try:
        existing = await db.blogposts.find_one({"_id": ObjectId(post_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Blog post not found")

        result = await db.blogposts.delete_one({"_id": ObjectId(post_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Blog post not found")

        try:
            from app.lib.admin_audit import log_blog_deleted

            await log_blog_deleted(db, current_user, existing)
        except Exception as audit_err:
            logger.warning("Failed to record blog delete activity: %s", audit_err)
        
        return {"message": "Blog post deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.options("/blog-posts/{post_id}", include_in_schema=False)
async def options_blog_post_by_id(request: Request, post_id: str):
    """Handle CORS preflight requests for specific blog post"""
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

# Analytics and Overview endpoints
@router.get("/overview")
async def get_admin_overview(
    current_user: dict = Depends(get_current_admin_user),
    job_id: Optional[str] = Query(None, description="Filter by specific job ID")
):
    """Get admin overview"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        # Build job filter for applications
        job_filter = {}
        if job_id:
            try:
                job_filter["jobId"] = ObjectId(job_id)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid job ID format")
        
        # Get base counts
        total_users = await db.users.count_documents({})
        total_jobs = await db.jobpostings.count_documents({})
        active_jobs = await db.jobpostings.count_documents({"isActive": True})
        job_filter = {**job_filter, **_active_application_filter()}
        total_applications = await db.applications.count_documents(job_filter)
        
        # Get application counts by status
        new_applications = await db.applications.count_documents({**job_filter, "status": "New"})
        shortlisted = await db.applications.count_documents({**job_filter, "status": "Shortlisted"})
        technical_assessment = await db.applications.count_documents({**job_filter, "status": "Technical Assessment"})
        interviewing = await db.applications.count_documents({**job_filter, "status": "Interviewing"})
        hired = await db.applications.count_documents({**job_filter, "status": "Hired"})
        rejected = await db.applications.count_documents({**job_filter, "status": "Rejected"})
        disqualified = await db.applications.count_documents({**job_filter, "status": "Disqualified"})
        
        # Get recent applications (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_count = await db.applications.count_documents({
            **job_filter,
            "createdAt": {"$gte": seven_days_ago}
        })
        
        # Get status breakdown for chart
        status_breakdown = []
        statuses = ["New", "Shortlisted", "Technical Assessment", "Interviewing", "Hired", "Rejected", "Disqualified"]
        for status in statuses:
            count = await db.applications.count_documents({**job_filter, "status": status})
            status_breakdown.append({"status": status, "count": count})
        
        response_data = {
            "applications": {
                "total": total_applications,
                "new": new_applications,
                "shortlisted": shortlisted,
                "interviewing": interviewing,
                "hired": hired,
                "rejected": rejected,
                "technical_assessment": technical_assessment,
                "disqualified": disqualified,
                "recent": recent_count
            },
            "jobs": {
                "total": total_jobs,
                "active": active_jobs
            },
            "users": {
                "total": total_users
            },
            "status_breakdown": status_breakdown
        }
        
        return JSONResponse(
            content=json.loads(json.dumps(response_data, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_admin_overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.options("/overview")
async def options_overview(request: Request):
    """Handle CORS preflight requests for overview endpoint"""
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (ObjectId, datetime)):
            return str(obj)
        return super().default(obj)


def _active_application_filter() -> Dict[str, Any]:
    """Exclude archived applications from active pipeline views."""
    return {"isArchived": {"$ne": True}}


def _archived_application_filter() -> Dict[str, Any]:
    return {"isArchived": True}


def _append_ai_score_filter(pipeline: list, ai_score_filter: Optional[str]) -> None:
    """Append a $match stage for AI score bucket filters."""
    if not ai_score_filter or ai_score_filter == "all":
        return

    if ai_score_filter == "not_ranked":
        pipeline.append({
            "$match": {
                "$or": [
                    {"aiRankScore": {"$exists": False}},
                    {"aiRankScore": None},
                ]
            }
        })
        return

    if ai_score_filter == "ranked":
        pipeline.append({
            "$match": {
                "aiRankScore": {"$exists": True, "$ne": None, "$type": "number"}
            }
        })
        return

    score_ranges = {
        "strong": {"aiRankScore": {"$gte": 85}},
        "good": {"aiRankScore": {"$gte": 70, "$lt": 85}},
        "moderate": {"aiRankScore": {"$gte": 50, "$lt": 70}},
        "weak": {"aiRankScore": {"$lt": 50, "$gte": 0}},
    }
    match_query = score_ranges.get(ai_score_filter)
    if match_query:
        pipeline.append({"$match": match_query})


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    """Parse a YYYY-MM-DD (or ISO) date string into a datetime, ignoring invalid input."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _build_applied_date_range(
    date_from: Optional[str], date_to: Optional[str]
) -> Optional[Dict[str, Any]]:
    """Build a Mongo range filter for appliedDate from inclusive from/to date strings."""
    from_dt = _parse_iso_date(date_from)
    to_dt = _parse_iso_date(date_to)
    range_filter: Dict[str, Any] = {}
    if from_dt:
        range_filter["$gte"] = from_dt
    if to_dt:
        range_filter["$lt"] = to_dt + timedelta(days=1)
    return range_filter or None


def _job_posting_lookup_stage() -> Dict[str, Any]:
    """Join jobpostings when application.jobId is stored as a string or ObjectId."""
    return {
        "$lookup": {
            "from": "jobpostings",
            "let": {"jobId": "$jobId"},
            "pipeline": [
                {
                    "$match": {
                        "$expr": {
                            "$eq": [
                                "$_id",
                                {
                                    "$cond": {
                                        "if": {"$eq": [{"$type": "$$jobId"}, "objectId"]},
                                        "then": "$$jobId",
                                        "else": {
                                            "$convert": {
                                                "input": "$$jobId",
                                                "to": "objectId",
                                                "onError": None,
                                                "onNull": None,
                                            }
                                        },
                                    }
                                },
                            ]
                        }
                    }
                },
                {"$project": {"password": 0}},
            ],
            "as": "jobDetails",
        }
    }


def _active_job_posting_filter() -> Dict[str, Any]:
    """Currently posted jobs (active or legacy records without isActive set)."""
    return {"$or": [{"isActive": True}, {"isActive": {"$exists": False}}]}


@router.get("/applications")
async def get_admin_applications(
    current_user: dict = Depends(get_current_admin_user),
    limit: int = Query(50, ge=1, le=100),  # Reduced default limit
    skip: int = Query(0, ge=0),
    status: Optional[str] = Query(None, description="Filter by application status"),
    archived: bool = Query(False, description="Return archived applications only"),
    sort_by: Optional[str] = Query("appliedDate", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    search: Optional[str] = Query(None, description="Search term for name, email, or position"),
    position: Optional[str] = Query(None, description="Filter by position/job title"),
    jobId: Optional[str] = Query(None, description="Filter by specific job ID"),
    ai_score_filter: Optional[str] = Query(
        None,
        description="Filter by AI rank score bucket (not_ranked, strong, good, moderate, weak)",
    ),
    date_from: Optional[str] = Query(
        None, description="Filter applications applied on/after this date (YYYY-MM-DD)"
    ),
    date_to: Optional[str] = Query(
        None, description="Filter applications applied on/before this date (YYYY-MM-DD)"
    ),
):
    """Get all applications for admin with optimized aggregation and filtering"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Base query - include all applications or filter by status
        match_query = _archived_application_filter() if archived else _active_application_filter()
        if status and status != "all":
            match_query["status"] = status
        
        # Add job filtering
        if jobId:
            try:
                match_query["jobId"] = ObjectId(jobId)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid job ID format")

        # Add applied-date range filtering
        applied_date_range = _build_applied_date_range(date_from, date_to)
        if applied_date_range:
            match_query["appliedDate"] = applied_date_range
        
        # Build aggregation pipeline for efficient data loading
        sort_direction = -1 if sort_order == "desc" else 1
        # Map FE-facing sort fields to sortable document fields. "name"/"position"
        # resolve to computed keys added later in the pipeline.
        sort_field_map = {
            "appliedDate": "appliedDate",
            "name": "_sortName",
            "position": "_sortPosition",
            "status": "status",
            "aiRankScore": "aiRankScore",
            "createdAt": "createdAt",
            "updatedAt": "updatedAt",
            "archivedAt": "archivedAt",
        }
        default_sort = "archivedAt" if archived else "appliedDate"
        requested_sort = sort_by if sort_by in sort_field_map else default_sort
        sort_field = sort_field_map[requested_sort]
        
        pipeline = [
            {"$match": match_query},
            _job_posting_lookup_stage(),
            {
                "$lookup": {
                    "from": "users",
                    "localField": "userId",
                    "foreignField": "_id",
                    "as": "userDetails",
                    "pipeline": [
                        {"$project": {"password": 0}}  # Exclude password
                    ]
                }
            },
            {
                "$addFields": {
                    "jobDetails": {"$arrayElemAt": ["$jobDetails", 0]},
                    "userDetails": {"$arrayElemAt": ["$userDetails", 0]},
                    "jobTitle": {"$arrayElemAt": ["$jobDetails.title", 0]}
                }
            }
        ]
        
        # Add search filter to pipeline if provided
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append({
                "$match": {
                    "$or": [
                        {"name": search_regex},
                        {"email": search_regex},
                        {"userDetails.name": search_regex},
                        {"userDetails.email": search_regex},
                        {"jobDetails.title": search_regex},
                        {"position": search_regex}
                    ]
                }
            })
        
        # Add position filter to pipeline if provided (ALL APPLICATIONS)
        if position and position != "all":
            pipeline.append({
                "$match": {
                    "$expr": {
                        "$eq": [
                            {
                                "$cond": {
                                    "if": {"$and": [{"$ne": ["$jobDetails", None]}, {"$ne": ["$jobDetails.title", None]}]},
                                    "then": "$jobDetails.title",
                                    "else": "$position"
                                }
                            },
                            position
                        ]
                    }
                }
            })

        # Computed keys so name/position sort by their resolved display values
        pipeline.append({
            "$addFields": {
                "_sortName": {
                    "$toLower": {"$ifNull": ["$name", {"$ifNull": ["$userDetails.name", ""]}]}
                },
                "_sortPosition": {
                    "$toLower": {"$ifNull": ["$jobTitle", {"$ifNull": ["$position", ""]}]}
                }
            }
        })

        _append_ai_score_filter(pipeline, ai_score_filter)
        
        # Add sorting and pagination
        pipeline.extend([
            {"$sort": {sort_field: sort_direction}},
            {"$skip": skip},
            {"$limit": limit}
        ])
        
        # Get total count with same filters (without skip/limit)
        count_pipeline = [stage for stage in pipeline if "$skip" not in stage and "$limit" not in stage]
        count_pipeline.append({"$count": "total"})
        
        # Execute both queries
        applications_cursor = db.applications.aggregate(pipeline)
        applications = await applications_cursor.to_list(length=limit)
        
        count_cursor = db.applications.aggregate(count_pipeline)
        count_result = await count_cursor.to_list(length=1)
        total = count_result[0]["total"] if count_result else 0
        
        # Process results efficiently
        for app in applications:
            app["id"] = str(app.pop("_id"))
            app.pop("_sortName", None)
            app.pop("_sortPosition", None)
            
            # Convert datetime fields
            for field in ["createdAt", "updatedAt", "appliedDate", "shortlistedDate", "disqualifiedDate", "archivedAt"]:
                if field in app and isinstance(app[field], datetime):
                    app[field] = app[field].isoformat()
            
            # Process job details
            if app.get("jobDetails"):
                job = app["jobDetails"]
                job["id"] = str(job.pop("_id", ""))
                # Convert datetime fields in job
                for field in ["createdAt", "updatedAt", "postedDate"]:
                    if field in job and isinstance(job[field], datetime):
                        job[field] = job[field].isoformat()
                app["position"] = _normalize_text_value(
                    job.get("title", "Position Not Available")
                ) or "Position Not Available"
            else:
                app["jobDetails"] = None
                app["position"] = _normalize_text_value(
                    app.get("position", "Position Not Available")
                ) or "Position Not Available"
            
            # Process user details
            if app.get("userDetails"):
                user = app["userDetails"]
                user["id"] = str(user.pop("_id", ""))
                # Convert datetime fields in user
                for field in ["createdAt", "updatedAt", "lastLoginAt"]:
                    if field in user and isinstance(user[field], datetime):
                        user[field] = user[field].isoformat()
                
                # Set name/email from user if not set
                if not app.get("name") or app.get("name") in [None, "NOT SET", ""]:
                    app["name"] = user.get("name", "")
                if not app.get("email") or app.get("email") in [None, "NOT SET", ""]:
                    app["email"] = user.get("email", "")
            else:
                app["userDetails"] = None
        
        # Return with proper JSON encoding for ObjectId compatibility
        response_data = {
            "applications": applications,
            "total": total,
            "sort": {
                "field": requested_sort,
                "order": sort_order
            }
        }
        
        # Use custom JSON encoder to handle any remaining ObjectId objects
        return JSONResponse(
            content=json.loads(json.dumps(response_data, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_admin_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications/archived")
async def get_archived_applications(
    current_user: dict = Depends(get_current_admin_user),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    sort_by: Optional[str] = Query("archivedAt", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    search: Optional[str] = Query(None, description="Search term for name, email, or position"),
    position: Optional[str] = Query(None, description="Filter by position/job title"),
    ai_score_filter: Optional[str] = Query(
        None,
        description="Filter by AI rank score bucket (not_ranked, strong, good, moderate, weak)",
    ),
):
    """Get archived applications for admin."""
    return await get_admin_applications(
        current_user=current_user,
        limit=limit,
        skip=skip,
        status=None,
        archived=True,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search,
        position=position,
        jobId=None,
        ai_score_filter=ai_score_filter,
    )


@router.get("/applications/positions")
async def get_application_positions(
    current_user: dict = Depends(get_current_admin_user),
    status: Optional[str] = Query(None, description="Filter positions by application status"),
    archived: bool = Query(False, description="Filter positions for archived applications only"),
):
    """Get unique position titles for filtering applications"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Build match query
        match_query = _archived_application_filter() if archived else _active_application_filter()
        if status and status != "all":
            match_query["status"] = status
        
        # Aggregation pipeline to get unique positions from applications
        pipeline = [
            {"$match": match_query},
            _job_posting_lookup_stage(),
            {
                "$addFields": {
                    "jobDetails": {"$arrayElemAt": ["$jobDetails", 0]},
                    "jobTitle": {"$arrayElemAt": ["$jobDetails.title", 0]},
                    "effectivePosition": {
                        "$cond": {
                            "if": {
                                "$and": [
                                    {"$ne": ["$jobDetails", None]},
                                    {"$ne": ["$jobDetails.title", None]},
                                    {"$ne": ["$jobDetails.title", ""]},
                                ]
                            },
                            "then": "$jobDetails.title",
                            "else": "$position",
                        }
                    },
                }
            },
            {
                "$group": {
                    "_id": "$effectivePosition",
                    "count": {"$sum": 1}
                }
            },
            {
                "$match": {
                    "_id": {"$nin": [None, "", "Position Not Available"]}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        cursor = db.applications.aggregate(pipeline)
        positions_from_apps = await cursor.to_list(length=None)

        # Include all currently posted (active) job titles
        job_titles: list[str] = []
        try:
            async for job in db.jobpostings.find(_active_job_posting_filter(), {"title": 1}):
                title = _normalize_text_value(job.get("title"))
                if title:
                    job_titles.append(title)
        except Exception as e:
            logger.error(f"Failed to load job titles for positions list: {e}")

        # Merge: active job titles + application-derived titles with counts
        title_to_count: dict[str, int] = {t: 0 for t in job_titles}
        for pos in positions_from_apps:
            title = _normalize_text_value(pos.get("_id"))
            if title:
                title_to_count[title] = title_to_count.get(title, 0) + int(pos.get("count", 0))

        # Build sorted list (include all active postings, even with 0 applications)
        position_options = [
            {"value": title, "label": title, "count": count}
            for title, count in sorted(title_to_count.items(), key=lambda x: x[0].lower())
            if title not in (None, "", "Position Not Available")
        ]
        
        return JSONResponse(
            content={"positions": position_options},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_application_positions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications/shortlisted")
async def get_shortlisted_applications(
    current_user: dict = Depends(get_current_admin_user),
    limit: int = Query(50, ge=1, le=100),  # Reduced default limit
    skip: int = Query(0, ge=0),
    sort_by: Optional[str] = Query("appliedDate", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    search: Optional[str] = Query(None, description="Search term for name, email, or position"),
    position: Optional[str] = Query(None, description="Filter by position/job title"),
    ai_score_filter: Optional[str] = Query(
        None,
        description="Filter by AI rank score bucket (not_ranked, strong, good, moderate, weak)",
    ),
):
    """Get shortlisted applications for admin with optimized aggregation and filtering"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Base query for shortlisted applications
        match_query = {"status": "Shortlisted", **_active_application_filter()}
        
        # Build aggregation pipeline for efficient data loading
        sort_direction = -1 if sort_order == "desc" else 1
        sort_field = sort_by if sort_by in ["appliedDate", "status", "createdAt", "updatedAt"] else "appliedDate"
        
        pipeline = [
            {"$match": match_query},
            _job_posting_lookup_stage(),
            {
                "$lookup": {
                    "from": "users",
                    "localField": "userId",
                    "foreignField": "_id",
                    "as": "userDetails",
                    "pipeline": [
                        {"$project": {"password": 0}}  # Exclude password
                    ]
                }
            },
            {
                "$addFields": {
                    "jobDetails": {"$arrayElemAt": ["$jobDetails", 0]},
                    "userDetails": {"$arrayElemAt": ["$userDetails", 0]},
                    "jobTitle": {"$arrayElemAt": ["$jobDetails.title", 0]}
                }
            }
        ]
        
        # Add search filter to pipeline if provided
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append({
                "$match": {
                    "$or": [
                        {"name": search_regex},
                        {"email": search_regex},
                        {"userDetails.name": search_regex},
                        {"userDetails.email": search_regex},
                        {"jobDetails.title": search_regex},
                        {"position": search_regex}
                    ]
                }
            })
        
        # Add position filter to pipeline if provided (SHORTLISTED)
        if position and position != "all":
            pipeline.append({
                "$match": {
                    "$expr": {
                        "$eq": [
                            {
                                "$cond": {
                                    "if": {"$and": [{"$ne": ["$jobDetails", None]}, {"$ne": ["$jobDetails.title", None]}]},
                                    "then": "$jobDetails.title",
                                    "else": "$position"
                                }
                            },
                            position
                        ]
                    }
                }
            })

        _append_ai_score_filter(pipeline, ai_score_filter)
        
        # Add sorting and pagination
        pipeline.extend([
            {"$sort": {sort_field: sort_direction}},
            {"$skip": skip},
            {"$limit": limit}
        ])
        
        # Get total count with same filters (without skip/limit)
        count_pipeline = [stage for stage in pipeline if "$skip" not in stage and "$limit" not in stage]
        count_pipeline.append({"$count": "total"})
        
        # Execute both queries
        applications_cursor = db.applications.aggregate(pipeline)
        applications = await applications_cursor.to_list(length=limit)
        
        count_cursor = db.applications.aggregate(count_pipeline)
        count_result = await count_cursor.to_list(length=1)
        total = count_result[0]["total"] if count_result else 0
        
        # Process results efficiently
        for app in applications:
            app["id"] = str(app.pop("_id"))
            
            # Convert datetime fields
            for field in ["createdAt", "updatedAt", "appliedDate", "shortlistedDate"]:
                if field in app and isinstance(app[field], datetime):
                    app[field] = app[field].isoformat()
            
            # Process job details
            if app.get("jobDetails"):
                job = app["jobDetails"]
                job["id"] = str(job.pop("_id", ""))
                # Convert datetime fields in job
                for field in ["createdAt", "updatedAt", "postedDate"]:
                    if field in job and isinstance(job[field], datetime):
                        job[field] = job[field].isoformat()
                app["position"] = _normalize_text_value(
                    job.get("title", "Position Not Available")
                ) or "Position Not Available"
            else:
                app["jobDetails"] = None
                app["position"] = _normalize_text_value(
                    app.get("position", "Position Not Available")
                ) or "Position Not Available"
            
            # Process user details
            if app.get("userDetails"):
                user = app["userDetails"]
                user["id"] = str(user.pop("_id", ""))
                # Convert datetime fields in user
                for field in ["createdAt", "updatedAt", "lastLoginAt"]:
                    if field in user and isinstance(user[field], datetime):
                        user[field] = user[field].isoformat()
                
                # Set name/email from user if not set
                if not app.get("name") or app.get("name") in [None, "NOT SET", ""]:
                    app["name"] = user.get("name", "")
                if not app.get("email") or app.get("email") in [None, "NOT SET", ""]:
                    app["email"] = user.get("email", "")
            else:
                app["userDetails"] = None
        
        # Return with proper JSON encoding for ObjectId compatibility
        response_data = {
            "applications": applications,
            "total": total,
            "sort": {
                "field": sort_field,
                "order": sort_order
            }
        }
        
        # Use custom JSON encoder to handle any remaining ObjectId objects
        return JSONResponse(
            content=json.loads(json.dumps(response_data, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_shortlisted_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications/disqualified")
async def get_disqualified_applications(
    current_user: dict = Depends(get_current_admin_user),
    limit: int = Query(50, ge=1, le=100),  # Reduced default limit
    skip: int = Query(0, ge=0),
    sort_by: Optional[str] = Query("appliedDate", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    search: Optional[str] = Query(None, description="Search term for name, email, or position"),
    position: Optional[str] = Query(None, description="Filter by position/job title"),
    ai_score_filter: Optional[str] = Query(
        None,
        description="Filter by AI rank score bucket (not_ranked, strong, good, moderate, weak)",
    ),
):
    """Get disqualified applications for admin with optimized aggregation and filtering"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Base query for disqualified applications
        match_query = {"status": "Disqualified", **_active_application_filter()}
        
        # Build aggregation pipeline for efficient data loading
        sort_direction = -1 if sort_order == "desc" else 1
        sort_field = sort_by if sort_by in ["appliedDate", "status", "createdAt", "updatedAt"] else "appliedDate"
        
        pipeline = [
            {"$match": match_query},
            _job_posting_lookup_stage(),
            {
                "$lookup": {
                    "from": "users",
                    "localField": "userId",
                    "foreignField": "_id",
                    "as": "userDetails",
                    "pipeline": [
                        {"$project": {"password": 0}}  # Exclude password
                    ]
                }
            },
            {
                "$addFields": {
                    "jobDetails": {"$arrayElemAt": ["$jobDetails", 0]},
                    "userDetails": {"$arrayElemAt": ["$userDetails", 0]},
                    "jobTitle": {"$arrayElemAt": ["$jobDetails.title", 0]}
                }
            }
        ]
        
        # Add search filter to pipeline if provided
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append({
                "$match": {
                    "$or": [
                        {"name": search_regex},
                        {"email": search_regex},
                        {"userDetails.name": search_regex},
                        {"userDetails.email": search_regex},
                        {"jobDetails.title": search_regex},
                        {"position": search_regex}
                    ]
                }
            })
        
        # Add position filter to pipeline if provided (DISQUALIFIED)
        if position and position != "all":
            pipeline.append({
                "$match": {
                    "$expr": {
                        "$eq": [
                            {
                                "$cond": {
                                    "if": {"$and": [{"$ne": ["$jobDetails", None]}, {"$ne": ["$jobDetails.title", None]}]},
                                    "then": "$jobDetails.title",
                                    "else": "$position"
                                }
                            },
                            position
                        ]
                    }
                }
            })

        _append_ai_score_filter(pipeline, ai_score_filter)
        
        # Add sorting and pagination
        pipeline.extend([
            {"$sort": {sort_field: sort_direction}},
            {"$skip": skip},
            {"$limit": limit}
        ])
        
        # Get total count with same filters (without skip/limit)
        count_pipeline = [stage for stage in pipeline if "$skip" not in stage and "$limit" not in stage]
        count_pipeline.append({"$count": "total"})
        
        # Execute both queries
        applications_cursor = db.applications.aggregate(pipeline)
        applications = await applications_cursor.to_list(length=limit)
        
        count_cursor = db.applications.aggregate(count_pipeline)
        count_result = await count_cursor.to_list(length=1)
        total = count_result[0]["total"] if count_result else 0
        
        # Process results efficiently
        for app in applications:
            app["id"] = str(app.pop("_id"))
            
            # Convert datetime fields
            for field in ["createdAt", "updatedAt", "appliedDate", "disqualifiedDate"]:
                if field in app and isinstance(app[field], datetime):
                    app[field] = app[field].isoformat()
            
            # Process job details
            if app.get("jobDetails"):
                job = app["jobDetails"]
                job["id"] = str(job.pop("_id", ""))
                # Convert datetime fields in job
                for field in ["createdAt", "updatedAt", "postedDate"]:
                    if field in job and isinstance(job[field], datetime):
                        job[field] = job[field].isoformat()
                app["position"] = _normalize_text_value(
                    job.get("title", "Position Not Available")
                ) or "Position Not Available"
            else:
                app["jobDetails"] = None
                app["position"] = _normalize_text_value(
                    app.get("position", "Position Not Available")
                ) or "Position Not Available"
            
            # Process user details
            if app.get("userDetails"):
                user = app["userDetails"]
                user["id"] = str(user.pop("_id", ""))
                # Convert datetime fields in user
                for field in ["createdAt", "updatedAt", "lastLoginAt"]:
                    if field in user and isinstance(user[field], datetime):
                        user[field] = user[field].isoformat()
                
                # Set name/email from user if not set
                if not app.get("name") or app.get("name") in [None, "NOT SET", ""]:
                    app["name"] = user.get("name", "")
                if not app.get("email") or app.get("email") in [None, "NOT SET", ""]:
                    app["email"] = user.get("email", "")
            else:
                app["userDetails"] = None
        
        # Return with proper JSON encoding for ObjectId compatibility
        response_data = {
            "applications": applications,
            "total": total,
            "sort": {
                "field": sort_field,
                "order": sort_order
            }
        }
        
        # Use custom JSON encoder to handle any remaining ObjectId objects
        return JSONResponse(
            content=json.loads(json.dumps(response_data, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_disqualified_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/applications/archive-all")
async def archive_all_applications(
    current_user: dict = Depends(get_current_admin_user)
):
    """Archive all non-archived applications."""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")

        now = datetime.utcnow()
        admin_id = str(current_user.get("_id") or current_user.get("id", ""))

        result = await db.applications.update_many(
            _active_application_filter(),
            {
                "$set": {
                    "isArchived": True,
                    "archivedAt": now,
                    "archivedBy": admin_id,
                    "updatedAt": now,
                }
            },
        )

        await log_bulk_operation(
            db,
            current_user,
            action="archived",
            resource_type="application",
            count=result.modified_count,
            detail=f"{result.modified_count} applications",
        )

        return {
            "message": f"Successfully archived {result.modified_count} application(s)",
            "archived_count": result.modified_count,
            "matched_count": result.matched_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in archive_all_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/applications/bulk-archive")
async def bulk_archive_applications(
    data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Archive selected applications (remove from active pipeline)."""
    try:
        if not isinstance(data, dict) or "ids" not in data:
            raise HTTPException(status_code=400, detail="Missing 'ids' field")

        ids = data["ids"]
        if not isinstance(ids, list) or len(ids) == 0:
            raise HTTPException(status_code=400, detail="At least one application ID must be provided")

        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")

        object_ids = []
        for i, id_str in enumerate(ids):
            try:
                object_ids.append(ObjectId(id_str))
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid ObjectId at index {i}: '{id_str}'")

        now = datetime.utcnow()
        admin_id = str(current_user.get("_id") or current_user.get("id", ""))

        result = await db.applications.update_many(
            {"_id": {"$in": object_ids}, "isArchived": {"$ne": True}},
            {
                "$set": {
                    "isArchived": True,
                    "archivedAt": now,
                    "archivedBy": admin_id,
                    "updatedAt": now,
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="No active applications found to archive")

        await log_bulk_operation(
            db,
            current_user,
            action="archived",
            resource_type="application",
            count=result.modified_count,
            detail=f"{result.modified_count} applications",
        )

        return {
            "message": f"Successfully archived {result.modified_count} application(s)",
            "archived_count": result.modified_count,
            "matched_count": result.matched_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk_archive_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/applications/bulk-unarchive")
async def bulk_unarchive_applications(
    data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Restore archived applications to the active pipeline."""
    try:
        if not isinstance(data, dict) or "ids" not in data:
            raise HTTPException(status_code=400, detail="Missing 'ids' field")

        ids = data["ids"]
        if not isinstance(ids, list) or len(ids) == 0:
            raise HTTPException(status_code=400, detail="At least one application ID must be provided")

        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")

        object_ids = []
        for i, id_str in enumerate(ids):
            try:
                object_ids.append(ObjectId(id_str))
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid ObjectId at index {i}: '{id_str}'")

        now = datetime.utcnow()
        result = await db.applications.update_many(
            {"_id": {"$in": object_ids}, "isArchived": True},
            {
                "$set": {"isArchived": False, "updatedAt": now},
                "$unset": {"archivedAt": "", "archivedBy": ""},
            },
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="No archived applications found to restore")

        await log_bulk_operation(
            db,
            current_user,
            action="restored",
            resource_type="application",
            count=result.modified_count,
            detail=f"{result.modified_count} applications",
        )

        return {
            "message": f"Successfully restored {result.modified_count} application(s)",
            "restored_count": result.modified_count,
            "matched_count": result.matched_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk_unarchive_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications/{application_id}")
async def get_admin_application(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get a single application by ID (admin access)."""
    try:
        db = get_database()
        try:
            application = await db.applications.find_one({"_id": ObjectId(application_id)})
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid application ID format")

        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Convert ObjectIds
        application["id"] = str(application.pop("_id"))
        if "userId" in application:
            application["userId"] = str(application["userId"]) if not isinstance(application["userId"], str) else application["userId"]
        if "jobId" in application and not isinstance(application["jobId"], str):
            try:
                application["jobId"] = str(application["jobId"])
            except Exception:
                pass

        return application
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_admin_application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Move bulk-status endpoint before parameterized route to fix route conflict
@router.put("/applications/bulk-status")
async def bulk_update_application_status(
    data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Bulk update application status"""
    logger.info(f"=== BULK STATUS UPDATE REQUEST ===")
    logger.info(f"Received data: {data}")
    logger.info(f"Current user: {current_user.get('email', 'Unknown')}")
    
    try:
        # Validate request data
        if not isinstance(data, dict):
            logger.error(f"Request body is not a dict: {data}")
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
        
        if "ids" not in data:
            logger.error("Missing 'ids' field in request body")
            raise HTTPException(status_code=400, detail="Missing 'ids' field")
        
        if "status" not in data:
            logger.error("Missing 'status' field in request body")
            raise HTTPException(status_code=400, detail="Missing 'status' field")
        
        ids = data["ids"]
        status = data["status"]
        logger.info(f"IDs: {ids}, Status: {status}")
        
        # Validate IDs array
        if not isinstance(ids, list):
            logger.error(f"IDs is not a list: {type(ids)}")
            raise HTTPException(status_code=400, detail="'ids' must be an array")
        if len(ids) == 0:
            logger.error("Empty IDs array provided")
            raise HTTPException(status_code=400, detail="At least one application ID must be provided")
            
        # Validate status
        if not isinstance(status, str) or not status.strip():
            raise HTTPException(status_code=400, detail="Status must be a non-empty string")
            
        # Validate status against allowed values
        valid_statuses = ["New", "Shortlisted", "Technical Assessment", "Interviewing", "Hired", "Rejected", "Disqualified"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status '{status}'. Must be one of: {', '.join(valid_statuses)}")
            
        # Get database connection
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
            
        # Validate and convert string IDs to ObjectIds
        object_ids = []
        for i, id_str in enumerate(ids):
            try:
                logger.info(f"Converting ID {i}: '{id_str}' (type: {type(id_str)}, length: {len(str(id_str))})")
                if not id_str or not isinstance(id_str, str):
                    raise ValueError(f"ID at index {i} is not a valid string: {id_str}")
                if len(id_str) != 24:
                    raise ValueError(f"ID at index {i} is not 24 characters long: {len(id_str)}")
                object_id = ObjectId(id_str)
                object_ids.append(object_id)
                logger.info(f"✅ Successfully converted ID {i}: {object_id}")
            except Exception as e:
                logger.error(f"❌ Failed to convert ID at index {i}: '{id_str}' - {str(e)}")
                raise HTTPException(status_code=400, detail=f"Invalid ObjectId at index {i}: '{id_str}' - {str(e)}")
        
        # Update application status in database
        update_data = {
            "status": status,
            "updatedAt": datetime.utcnow()
        }
        
        # Set specific date fields based on status
        current_time = datetime.utcnow()
        if status == "Shortlisted":
            update_data["shortlistedDate"] = current_time
        elif status == "Interviewing":
            update_data["interviewDate"] = current_time
        elif status == "Hired":
            update_data["hiredDate"] = current_time
        elif status == "Rejected":
            update_data["rejectedDate"] = current_time
        elif status == "Disqualified":
            update_data["disqualifiedDate"] = current_time
        
        logger.info(f"Updating {len(object_ids)} applications with status '{status}'")
        result = await db.applications.update_many(
            {"_id": {"$in": object_ids}}, 
            {"$set": update_data}
        )
        
        logger.info(f"Database update result: matched={result.matched_count}, modified={result.modified_count}")
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="No applications found to update")

        await log_bulk_operation(
            db,
            current_user,
            action="updated",
            resource_type="application",
            count=result.modified_count,
            detail=f"{result.modified_count} applications set to status '{status}'",
        )
            
        return {
            "message": f"Successfully updated {result.modified_count} applications to status '{status}'",
            "updated_count": result.modified_count,
            "matched_count": result.matched_count,
            "status": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk update application status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/ai/test")
async def test_admin_ai_connection(
    current_user: dict = Depends(get_current_admin_user),
):
    """Verify NVIDIA API key and model access (admin only)."""
    result = await test_nvidia_connection()
    if not result.get("ok"):
        raise HTTPException(
            status_code=503 if result.get("status") == "not_configured" else 502,
            detail=result,
        )
    return result


@router.post("/applications/ai-rank")
async def ai_rank_applications(
    payload: Dict[str, Any] = Body(default={}),
    current_user: dict = Depends(get_current_admin_user),
):
    """Rank one or more applications using AI based on CV and application data."""
    try:
        db = get_database()
        ids = payload.get("ids") or []
        limit = int(payload.get("limit") or 25)
        limit = max(1, min(limit, 50))

        if not isinstance(ids, list):
            raise HTTPException(status_code=400, detail="ids must be an array")

        if not ids:
            query: Dict[str, Any] = {"isArchived": {"$ne": True}}
            if payload.get("position"):
                query["position"] = payload["position"]
            if payload.get("status"):
                query["status"] = payload["status"]
            if payload.get("jobId"):
                try:
                    query["jobId"] = ObjectId(str(payload["jobId"]))
                except Exception:
                    query["jobId"] = str(payload["jobId"])

            cursor = db.applications.find(query).sort("createdAt", -1).limit(limit)
            applications = await cursor.to_list(length=limit)
            ids = [str(app["_id"]) for app in applications]

        if not ids:
            return {"ranked": 0, "results": [], "errors": []}

        results = []
        errors = []
        for application_id in ids[:limit]:
            try:
                result = await rank_application_by_id(db, str(application_id))
                results.append(result)
            except Exception as error:
                error_message = format_exception_message(error)
                logger.exception("AI rank failed for %s: %s", application_id, error_message)
                errors.append({"id": str(application_id), "error": error_message})

        results.sort(key=lambda item: item.get("aiRankScore", 0), reverse=True)

        if results:
            await log_custom_action(
                db,
                current_user,
                action="ranked",
                resource_type="application",
                detail=f"AI-ranked {len(results)} application(s)",
            )

        return {
            "ranked": len(results),
            "results": results,
            "errors": errors,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ai_rank_applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/applications/{application_id}")
async def update_admin_application(
    application_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update an application by ID (admin access)."""
    try:
        db = get_database()
        try:
            obj_id = ObjectId(application_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid application ID format")

        existing = await db.applications.find_one({"_id": obj_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Application not found")

        update_data = dict(update_data or {})
        update_data["updatedAt"] = datetime.utcnow()

        result = await db.applications.update_one({"_id": obj_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")

        applicant = (
            existing.get("fullName")
            or existing.get("name")
            or existing.get("email")
            or existing.get("position")
            or application_id
        )
        await log_resource_updated(
            db,
            current_user,
            resource_type="application",
            existing=existing,
            updates=update_data,
            resource_id=application_id,
            title_field="fullName",
            detail=str(applicant),
        )

        application = await db.applications.find_one({"_id": obj_id})
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        application["id"] = str(application.pop("_id"))
        if "userId" in application and not isinstance(application["userId"], str):
            application["userId"] = str(application["userId"])  
        if "jobId" in application and not isinstance(application["jobId"], str):
            try:
                application["jobId"] = str(application["jobId"]) 
            except Exception:
                pass
        return application
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_admin_application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/applications/{application_id}")
async def delete_admin_application(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete an application by ID (admin access)."""
    try:
        db = get_database()
        try:
            obj_id = ObjectId(application_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid application ID format")

        existing = await db.applications.find_one({"_id": obj_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Application not found")

        result = await db.applications.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")

        await log_resource_deleted(
            db,
            current_user,
            resource_type="application",
            doc=existing,
            title_field="fullName",
            resource_id=application_id,
        )
        return {"message": "Application deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_admin_application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/trends")
async def get_application_trends(
    current_user: dict = Depends(get_current_admin_user),
    days: int = Query(30, ge=1, le=365),
    job_id: Optional[str] = Query(None, description="Filter by specific job ID")
):
    """Get application trends"""
    db = get_database()
    
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Build job filter
    job_filter = {}
    if job_id:
        try:
            job_filter["jobId"] = ObjectId(job_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid job ID format")
    
    # Get daily application counts
    pipeline = [
        {
            "$match": {
                **job_filter,
                "createdAt": {
                    "$gte": start_date,
                    "$lte": end_date
                }
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$createdAt"
                    }
                },
                "count": {"$sum": 1}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]
    
    daily_counts = await db.applications.aggregate(pipeline).to_list(length=None)
    
    # Format response
    trends = []
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        count = next((item["count"] for item in daily_counts if item["_id"] == date_str), 0)
        trends.append({
            "date": date_str,
            "count": count
        })
        current_date += timedelta(days=1)
    
    return {"trends": trends}

@router.get("/applications-by-job")
async def get_applications_by_job(
    current_user: dict = Depends(get_current_admin_user),
    job_id: Optional[str] = Query(None, description="Filter by specific job ID")
):
    """Get applications grouped by job"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Build job filter for applications (exclude archived applications)
        match_filter = _active_application_filter()
        if job_id:
            try:
                match_filter["jobId"] = ObjectId(job_id)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid job ID format")

        active_job_ids: set[str] = set()
        async for active_job in db.jobpostings.find(_active_job_posting_filter(), {"_id": 1}):
            active_job_ids.add(str(active_job["_id"]))

        # Get applications grouped by job
        pipeline = [
            {"$match": match_filter},
            {
                "$addFields": {
                    "jobIdStr": { "$toString": "$jobId" }
                }
            },
            {
                "$group": {
                    "_id": "$jobIdStr",
                    "count": { "$sum": 1 },
                    "statuses": {
                        "$push": "$status"
                    }
                }
            }
        ]
        
        job_stats = await db.applications.aggregate(pipeline).to_list(length=None)
        
        # Get job details and format response
        result = []
        for stat in job_stats:
            try:
                job_id_str = str(stat["_id"])
                if job_id_str not in active_job_ids:
                    continue

                job = await db.jobpostings.find_one({"_id": ObjectId(job_id_str)})
                if job:
                    # Count status breakdown
                    status_breakdown = {}
                    for status in stat["statuses"]:
                        status_breakdown[status] = status_breakdown.get(status, 0) + 1
                    
                    job_data = {
                        "jobId": str(stat["_id"]),
                        "position": job.get("title", "Unknown Job"),  # Frontend expects 'position' not 'title'
                        "title": job.get("title", "Unknown Job"),
                        "department": job.get("department", "N/A"),
                        "totalApplications": stat["count"],  # Frontend expects 'totalApplications' not 'count'
                        "count": stat["count"],
                        "statuses": stat["statuses"],
                        "statusBreakdown": status_breakdown
                    }
                    # Convert any datetime fields
                    for field in ["createdAt", "updatedAt", "postedDate"]:
                        if field in job and isinstance(job[field], datetime):
                            job_data[field] = job[field].isoformat()
                    result.append(job_data)
            except Exception as e:
                logger.error(f"Error processing job stats: {str(e)}")
                continue
        
        response_data = {"applicationsByJob": result}  # Frontend expects 'applicationsByJob' not 'jobs'
        return JSONResponse(
            content=json.loads(json.dumps(response_data, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_applications_by_job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def _normalize_question_job_ids(raw_ids: Any) -> List[str]:
    """Normalize jobIds to a list of valid MongoDB ObjectId strings."""
    if not raw_ids:
        return []
    if not isinstance(raw_ids, list):
        raw_ids = [raw_ids]

    normalized: List[str] = []
    for item in raw_ids:
        if isinstance(item, dict):
            item = item.get("_id") or item.get("id") or item.get("value")
        if item is None:
            continue
        try:
            normalized.append(str(ObjectId(str(item))))
        except (InvalidId, TypeError, ValueError):
            continue
    return normalized


def _question_job_filter(job_id: str) -> Dict[str, Any]:
    """Match questions linked via jobIds array or legacy jobId field."""
    try:
        oid = ObjectId(job_id)
        return {
            "$or": [
                {"jobIds": job_id},
                {"jobIds": oid},
                {"jobId": job_id},
                {"jobId": oid},
            ]
        }
    except InvalidId:
        return {"$or": [{"jobIds": job_id}, {"jobId": job_id}]}


def _build_question_document(payload: Dict[str, Any], *, is_create: bool = False) -> Dict[str, Any]:
    """Whitelist and normalize question fields for create/update."""
    doc: Dict[str, Any] = {"updatedAt": datetime.utcnow()}

    for field in ("question", "type", "required", "options", "order", "description"):
        if field in payload:
            doc[field] = payload[field]

    if "jobIds" in payload:
        doc["jobIds"] = _normalize_question_job_ids(payload.get("jobIds"))

    if is_create:
        doc.setdefault("required", False)
        doc.setdefault("options", [])
        doc.setdefault("order", 0)
        doc.setdefault("jobIds", [])
        doc["createdAt"] = datetime.utcnow()

    return doc


# Questions Management
@router.get("/questions")
async def get_questions(
    current_user: dict = Depends(get_current_admin_user),
    job_id: Optional[str] = Query(None)
):
    """Get all questions, optionally filtered by job"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        filter_query = {}
        if job_id:
            filter_query = _question_job_filter(job_id)
        
        questions_cursor = db.jobquestions.find(filter_query).sort("order", 1)
        questions = await questions_cursor.to_list(length=None)
        
        # Convert ObjectIds to strings and add id field
        for question in questions:
            convert_objectids_to_strings(question)
            question["id"] = str(question.pop("_id"))
            
            # Ensure order field exists
            if "order" not in question or question["order"] is None:
                question["order"] = 0
            
            # Get associated job titles
            if "jobIds" in question and question["jobIds"]:
                job_titles = []
                for job_id in question["jobIds"]:
                    try:
                        job = await db.jobpostings.find_one({"_id": ObjectId(job_id)}, {"title": 1})
                        if job:
                            job_titles.append(job["title"])
                    except:
                        continue
                question["jobTitles"] = job_titles
            else:
                question["jobTitles"] = []
        
        # Return with proper JSON serialization and CORS headers
        return JSONResponse(
            content=json.loads(json.dumps({"questions": questions}, cls=CustomJSONEncoder)),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
    except Exception as e:
        logger.error(f"Error in get_questions: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/questions")
async def create_question(
    question_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Create new question"""
    db = get_database()

    if not question_data.get("question"):
        raise HTTPException(status_code=400, detail="Question text is required")
    if not question_data.get("type"):
        raise HTTPException(status_code=400, detail="Question type is required")

    doc = _build_question_document(question_data, is_create=True)
    result = await db.jobquestions.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["id"] = str(result.inserted_id)
    convert_objectids_to_strings(doc)

    await log_resource_created(
        db,
        current_user,
        resource_type="question",
        doc=doc,
        title_field="question",
    )

    return doc

@router.get("/questions/{question_id}")
async def get_question(
    question_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get specific question"""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        try:
            question = await db.jobquestions.find_one({"_id": ObjectId(question_id)})
            if not question:
                raise HTTPException(status_code=404, detail="Question not found")
            
            # Convert ObjectIds to strings
            convert_objectids_to_strings(question)
            question["id"] = str(question.pop("_id"))

            if "jobIds" in question and question["jobIds"]:
                job_titles = []
                for jid in question["jobIds"]:
                    try:
                        job = await db.jobpostings.find_one({"_id": ObjectId(jid)}, {"title": 1})
                        if job:
                            job_titles.append(job["title"])
                    except Exception:
                        continue
                question["jobTitles"] = job_titles
            else:
                question["jobTitles"] = []
            
            # Return with proper JSON serialization
            return JSONResponse(
                content=json.loads(json.dumps(question, cls=CustomJSONEncoder)),
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            )
        except InvalidId:
            logger.error(f"Invalid question ID format: {question_id}")
            raise HTTPException(status_code=400, detail="Invalid question ID")
    except Exception as e:
        logger.error(f"Error in get_question: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update question"""
    db = get_database()
    
    try:
        existing = await db.jobquestions.find_one({"_id": ObjectId(question_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Question not found")

        doc = _build_question_document(update_data, is_create=False)
        if len(doc) <= 1:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        result = await db.jobquestions.update_one(
            {"_id": ObjectId(question_id)},
            {"$set": doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Question not found")

        await log_resource_updated(
            db,
            current_user,
            resource_type="question",
            existing=existing,
            updates=doc,
            resource_id=question_id,
            title_field="question",
        )
        
        return {"message": "Question updated successfully"}
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid question ID")

@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete question"""
    db = get_database()
    
    try:
        existing = await db.jobquestions.find_one({"_id": ObjectId(question_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Question not found")

        result = await db.jobquestions.delete_one({"_id": ObjectId(question_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Question not found")

        await log_resource_deleted(
            db,
            current_user,
            resource_type="question",
            doc=existing,
            title_field="question",
            resource_id=question_id,
        )
        
        return {"message": "Question deleted successfully"}
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid question ID")

@router.put("/questions/reorder-questions")
async def reorder_questions(
    reorder_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_admin_user)
):
    """Reorder questions"""
    try:
        db = get_database()
        if db is None:
            logger.error("Database connection not available")
            raise HTTPException(status_code=503, detail="Database not available")
        
        updates = reorder_data.get("updates", [])
        if not updates:
            logger.error("No updates provided in request")
            raise HTTPException(status_code=400, detail="No updates provided")
        
        logger.info(f"Processing {len(updates)} updates")
        
        # First validate all IDs before making any changes
        for update in updates:
            if not update.get("id") or not isinstance(update.get("order"), int):
                logger.error(f"Invalid update format: {update}")
                raise HTTPException(
                    status_code=400,
                    detail="Each update must have an 'id' and 'order' field"
                )
            
            try:
                # Validate ObjectId format
                ObjectId(update["id"])
            except InvalidId:
                logger.error(f"Invalid ObjectId format: {update['id']}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid question ID format: {update['id']}"
                )
        
        # Then verify all questions exist
        question_ids = [ObjectId(update["id"]) for update in updates]
        questions = await db.jobquestions.find({"_id": {"$in": question_ids}}).to_list(None)
        found_ids = {str(q["_id"]) for q in questions}
        
        # Check for missing questions
        missing_ids = [update["id"] for update in updates if update["id"] not in found_ids]
        if missing_ids:
            logger.error(f"Questions not found: {missing_ids}")
            raise HTTPException(
                status_code=404,
                detail=f"Questions not found: {', '.join(missing_ids)}"
            )
        
        # Finally, update all questions
        updated_questions = []
        for update in updates:
            try:
                result = await db.jobquestions.find_one_and_update(
                    {"_id": ObjectId(update["id"])},
                    {"$set": {
                        "order": update["order"],
                        "updatedAt": datetime.utcnow()
                    }},
                    return_document=True,
                    projection={"_id": 1, "question": 1, "type": 1, "required": 1, "options": 1, "order": 1, "jobIds": 1, "createdAt": 1, "updatedAt": 1}
                )
                
                if not result:
                    logger.error(f"Failed to update question {update['id']}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to update question: {update['id']}"
                    )
                
                # Convert ObjectIds to strings
                result_dict = dict(result)  # Convert SON to dict
                convert_objectids_to_strings(result_dict)
                result_dict["id"] = str(result_dict.pop("_id"))
                updated_questions.append(result_dict)
                
                logger.info(f"Successfully updated question {update['id']} order to {update['order']}")
            except Exception as e:
                logger.error(f"Error updating question {update['id']}: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to update question {update['id']}: {str(e)}"
                )
        
        # Return with proper JSON serialization
        response_data = {
            "message": "Questions reordered successfully",
            "questions": updated_questions
        }
        
        # Convert any remaining ObjectIds to strings
        convert_objectids_to_strings(response_data)

        await log_custom_action(
            db,
            current_user,
            action="reordered",
            resource_type="question",
            detail=f"{len(updates)} screening questions",
        )
        
        return JSONResponse(
            content=response_data,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in reorder_questions: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Internal server error")

# Settings endpoints
@router.get("/settings")
async def get_admin_settings(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get admin settings"""
    try:
        db = get_database()
        
        settings = await db.settings.find_one({"type": "admin"})
        
        if not settings:
            # Create default settings
            settings = {
                "type": "admin",
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                # Flat fields expected by the admin UI
                "emailNotifications": True,
                "pushNotifications": True,
                "autoLogout": 30,
                "tableRowsPerPage": 25,
                "sidebarCollapsed": False,
                "theme": "light",
                "language": "en",
                "contactFormEnabled": True,
                "contactProtection": {
                    "minMessageChars": 25,
                    "maxMessageChars": 2000,
                    "maxSubmissionsPerIp": 5,
                    "ipWindowMinutes": 15,
                    "blockWindowMinutes": 60,
                    "captchaEnabled": True,
                    "captchaScoreThreshold": 55,
                    "blockScoreThreshold": 35
                },
                "jobSettings": {
                    "autoClose": True,
                    "autoCloseAfterDays": 30,
                    "requireApproval": True,
                    "notifyOnNewApplications": True
                },
                "emailSettings": {
                    "sendWelcomeEmail": True,
                    "sendApplicationConfirmation": True,
                    "sendStatusUpdates": True
                },
                "applicationSettings": {
                    "allowReapply": True,
                    "reapplyWaitDays": 90,
                    "maxActiveApplications": 5
                }
            }
            try:
                result = await db.settings.insert_one(settings)
                # Normalize id for response
                settings["id"] = str(result.inserted_id)
            except Exception as e:
                logger.error(f"Error creating default settings: {str(e)}")
                logger.exception("Full traceback:")
                raise HTTPException(status_code=500, detail="Failed to create default settings")
        else:
            # Convert ObjectIds to strings
            convert_objectids_to_strings(settings)
            # Normalize id for response and avoid exposing _id for clients
            settings["id"] = str(settings.get("_id")) if settings.get("_id") else settings.get("id")
        
        # Do not expose immutable _id in the response payload
        if "_id" in settings:
            try:
                del settings["_id"]
            except Exception:
                pass
        
        return {"settings": settings}
    except Exception as e:
        logger.error(f"Error in get_admin_settings: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/settings/test")
async def test_settings_endpoint():
    """Test endpoint to verify admin settings routing"""
    return {
        "message": "Admin settings endpoint is working",
        "timestamp": datetime.utcnow().isoformat(),
        "status": "success"
    }

@router.put("/settings")
async def update_admin_settings(
    settings_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update admin settings"""
    try:
        db = get_database()
        
        existing_settings = await db.settings.find_one({"type": "admin"}) or {}

        # Sanitize incoming payload to avoid immutable fields updates
        settings_data = dict(settings_data or {})
        settings_data.pop("_id", None)
        settings_data.pop("id", None)
        settings_data["updatedAt"] = datetime.utcnow()
        settings_data["type"] = "admin"
        
        result = await db.settings.update_one(
            {"type": "admin"},
            {"$set": settings_data},
            upsert=True
        )
        
        # Get updated settings
        updated_settings = await db.settings.find_one({"type": "admin"})
        if not updated_settings:
            raise HTTPException(status_code=500, detail="Failed to retrieve updated settings")
        
        # Convert ObjectIds to strings
        convert_objectids_to_strings(updated_settings)
        updated_settings["id"] = str(updated_settings.get("_id")) if updated_settings.get("_id") else updated_settings.get("id")
        if "_id" in updated_settings:
            try:
                del updated_settings["_id"]
            except Exception:
                pass

        await log_resource_updated(
            db,
            current_user,
            resource_type="settings",
            existing=existing_settings,
            updates=settings_data,
            title_field="siteName",
        )
        
        return {"settings": updated_settings, "message": "Settings updated successfully"}
    except Exception as e:
        logger.error(f"Error in update_admin_settings: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/settings/sync-databases")
async def sync_databases_manual(
    payload: Dict[str, Any] = Body(default={}),
    current_user: dict = Depends(get_current_admin_user)
):
    """Manual trigger: copy operational DB (MONGO_URL) to DB_SYNC_TARGET_URI when set."""
    try:
        collections = payload.get("collections")
        if collections is not None and not isinstance(collections, list):
            raise HTTPException(status_code=400, detail="collections must be an array of collection names")

        result = await sync_databases_now(collections=collections)
        if not result.get("success"):
            message = result.get("message", "Database sync failed")
            status_code = 503 if "not" in message.lower() else 500
            raise HTTPException(status_code=status_code, detail=message)

        await log_custom_action(
            get_database(),
            current_user,
            action="synced",
            resource_type="database_sync",
            detail="Manual database sync completed",
        )

        return {"message": "Database sync completed", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in sync_databases_manual: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Failed to sync databases")


@router.get("/settings/backup")
async def get_backup_settings(current_user: dict = Depends(get_current_admin_user)):
    """Get off-site backup configuration and environment readiness."""
    if not can_manage_backup(current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to manage backups")
    try:
        from app.lib.backup_service import get_backup_config, SCHEDULE_PRESETS

        config = await get_backup_config()
        return {
            "config": config,
            "schedulePresets": [
                {"key": key, **value} for key, value in SCHEDULE_PRESETS.items()
            ],
        }
    except Exception as e:
        logger.error(f"Error in get_backup_settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to load backup settings")


@router.put("/settings/backup")
async def update_backup_settings(
    payload: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_admin_user),
):
    """Update off-site backup schedule and destinations."""
    if not can_manage_backup(current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to manage backups")
    try:
        from app.lib.backup_service import update_backup_config

        config = await update_backup_config(payload)

        await log_resource_updated(
            get_database(),
            current_user,
            resource_type="backup",
            existing={},
            updates=payload,
            title_field="schedule",
        )

        return {"message": "Backup settings saved", "config": config}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_backup_settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to save backup settings")


@router.post("/settings/backup/run")
async def run_backup_now(
    current_user: dict = Depends(get_current_admin_user),
):
    """Manually trigger an off-site backup run."""
    if not can_manage_backup(current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to manage backups")
    try:
        from app.lib.backup_service import execute_backup_run

        result = await execute_backup_run(
            trigger="manual",
            triggered_by=str(current_user.get("_id") or current_user.get("id") or ""),
        )

        await log_custom_action(
            get_database(),
            current_user,
            action="executed",
            resource_type="backup",
            detail=result.get("message") or "Manual backup run",
        )

        return {"message": result.get("message"), "result": result}
    except Exception as e:
        logger.error(f"Error in run_backup_now: {e}")
        raise HTTPException(status_code=500, detail="Failed to run backup")


@router.get("/settings/backup/runs")
async def list_backup_runs(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_admin_user),
):
    """List recent backup run history."""
    if not can_manage_backup(current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to manage backups")
    try:
        from app.lib.backup_service import list_backup_runs as fetch_runs

        runs = await fetch_runs(limit=limit)
        return {"runs": runs}
    except Exception as e:
        logger.error(f"Error in list_backup_runs: {e}")
        raise HTTPException(status_code=500, detail="Failed to load backup history")


@router.get("/settings/backup/credentials")
async def get_backup_credentials_settings(
    current_user: dict = Depends(get_current_admin_user),
):
    """Get admin-managed backup integration credentials (secrets are never returned)."""
    if not can_manage_backup(current_user):
        raise HTTPException(
            status_code=403, detail="You do not have permission to manage backups"
        )
    try:
        from app.lib.integration_credentials import get_backup_credentials_public

        credentials = await get_backup_credentials_public()
        return {"credentials": credentials}
    except Exception as e:
        logger.error(f"Error in get_backup_credentials_settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to load backup credentials")


@router.put("/settings/backup/credentials")
async def update_backup_credentials_settings(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user),
):
    """Save backup integration credentials from the admin panel."""
    if not can_manage_backup(current_user):
        raise HTTPException(
            status_code=403, detail="You do not have permission to manage backups"
        )
    try:
        from app.lib.integration_credentials import update_backup_credentials

        credentials = await update_backup_credentials(payload)

        await log_custom_action(
            get_database(),
            current_user,
            action="updated",
            resource_type="backup",
            detail="Backup integration credentials updated",
        )

        return {
            "message": "Backup credentials updated",
            "credentials": credentials,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_backup_credentials_settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to save backup credentials")


@router.get("/settings/email-transport")
async def get_email_transport_settings(
    current_user: dict = Depends(get_current_admin_user),
):
    """Get admin-managed email delivery settings (secrets are never returned)."""
    try:
        from app.lib.email_transport_settings import get_email_transport_public

        transport = await get_email_transport_public()
        return {"transport": transport}
    except Exception as e:
        logger.error(f"Error in get_email_transport_settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to load email transport settings")


@router.put("/settings/email-transport")
async def update_email_transport_settings_endpoint(
    payload: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_admin_user),
):
    """Save email delivery settings (Netlify relay, SendGrid, or SMTP)."""
    try:
        from app.lib.email_transport_settings import update_email_transport_settings

        transport = await update_email_transport_settings(payload)

        await log_resource_updated(
            get_database(),
            current_user,
            resource_type="email_transport",
            existing={},
            updates=payload,
            title_field="provider",
        )

        return {"message": "Email transport settings updated", "transport": transport}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_email_transport_settings_endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to save email transport settings")


@router.post("/settings/email-transport/test")
async def test_email_transport_settings(
    request: Request,
    payload: Dict[str, Any] = Body(default={}),
    current_user: dict = Depends(get_current_admin_user),
):
    """Send a test email using the configured transport."""
    from app.lib.cors import resolve_frontend_url
    from app.lib.email_transport import deliver_html_email_with_detail, is_email_configured
    from app.lib.email_transport_settings import get_email_transport_config

    if not is_email_configured():
        raise HTTPException(
            status_code=503,
            detail="Email transport is not fully configured",
        )

    recipient = str(payload.get("to") or current_user.get("email") or "").strip()
    if not recipient:
        raise HTTPException(status_code=400, detail="No recipient email available")

    await get_email_transport_config(force_reload=True)
    creds = await get_email_transport_config()
    provider = (creds.get("provider") or "smtp").strip()

    html = f"""
        <p>Hi,</p>
        <p>This is a test email from the BQI Tech admin panel.</p>
        <p>Transport: <strong>{provider}</strong></p>
        <p>If you received this message, outbound email is working.</p>
    """
    sent, error = deliver_html_email_with_detail(
        recipient,
        "BQI Tech — test email",
        html,
        frontend_url=resolve_frontend_url(request.headers.get("origin")),
    )
    if not sent:
        detail = error or "Unknown email delivery error"
        raise HTTPException(
            status_code=502,
            detail=f"Test email could not be sent: {detail}",
        )

    return {
        "message": f"Test email sent to {recipient}",
        "emailSent": True,
        "email": recipient,
        "provider": provider,
    }


@router.get("/settings/ai-providers")
async def get_ai_provider_settings(
    current_user: dict = Depends(get_current_admin_user),
):
    """Get admin-managed AI providers (API keys are never returned)."""
    try:
        from app.lib.ai_provider_settings import get_ai_providers_public

        config = await get_ai_providers_public()
        return {"aiProviders": config}
    except Exception as e:
        logger.error(f"Error in get_ai_provider_settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to load AI provider settings")


@router.get("/ai/status")
async def get_ai_status(
    current_user: dict = Depends(get_current_admin_user),
):
    """Lightweight AI configuration check (no live provider network call)."""
    try:
        from app.lib.ai_provider_settings import get_ai_providers_public

        config = await get_ai_providers_public()
        active = next(
            (p for p in config.get("providers", []) if p.get("isActive")),
            None,
        )
        configured = (
            bool(active.get("hasApiKey"))
            if active
            else bool(config.get("configured"))
        )
        return {
            "configured": configured,
            "source": config.get("source"),
            "activeProviderLabel": active.get("label") if active else None,
            "model": active.get("model") if active else None,
        }
    except Exception as e:
        logger.error(f"Error in get_ai_status: {e}")
        return {
            "configured": False,
            "source": None,
            "activeProviderLabel": None,
            "model": None,
        }


@router.put("/settings/ai-providers")
async def update_ai_provider_settings_endpoint(
    payload: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_admin_user),
):
    """Add, update, or remove AI providers and set the active provider."""
    try:
        from app.lib.ai_provider_settings import update_ai_providers_settings

        config = await update_ai_providers_settings(payload)

        active = next(
            (p for p in config.get("providers", []) if p.get("isActive")),
            None,
        )
        await log_custom_action(
            get_database(),
            current_user,
            action="updated",
            resource_type="settings",
            resource_title="AI providers",
            resource_path="/admin/settings",
            detail=(
                f"active provider: {active.get('label')}"
                if active
                else "AI providers updated"
            ),
        )

        return {"message": "AI provider settings updated", "aiProviders": config}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_ai_provider_settings_endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to save AI provider settings")


@router.post("/settings/ai-providers/test")
async def test_ai_provider_settings(
    payload: Dict[str, Any] = Body(default={}),
    current_user: dict = Depends(get_current_admin_user),
):
    """Test an AI provider by id, or by inline {baseUrl, apiKey, model}."""
    from app.lib.ai_provider_settings import (
        _resolve_provider_api_key,
        get_active_ai_config,
        get_provider_by_id,
    )
    from app.lib.nvidia_ai import test_ai_provider_connection

    provider_id = str(payload.get("id") or payload.get("providerId") or "").strip()
    base_url = str(payload.get("baseUrl") or "").strip()
    model = str(payload.get("model") or "").strip()

    if provider_id:
        stored = await get_provider_by_id(provider_id)
        if stored is None:
            raise HTTPException(status_code=404, detail="Provider not found")
        api_key = _resolve_provider_api_key(payload, stored, provider_id)
        base_url = base_url or stored.get("baseUrl") or ""
        model = model or stored.get("model") or ""
    elif not (base_url and model):
        base_url, api_key, model = await get_active_ai_config()
    else:
        api_key = str(payload.get("apiKey") or "").strip()

    result = await test_ai_provider_connection(
        {"baseUrl": base_url, "apiKey": api_key, "model": model}
    )
    if not result.get("ok"):
        raise HTTPException(
            status_code=503 if result.get("status") == "not_configured" else 502,
            detail=result,
        )
    return result


@router.get("/settings/recaptcha")
async def get_recaptcha_settings(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get admin-managed reCAPTCHA settings (secret is never returned)."""
    try:
        db = get_database()
        settings_doc = await db.settings.find_one({"type": "admin"}, {"contactRecaptcha": 1})
        recaptcha = (settings_doc or {}).get("contactRecaptcha", {}) if settings_doc else {}
        site_key = str(recaptcha.get("siteKey", "") or "")
        secret_key = str(recaptcha.get("secretKey", "") or "")

        return {
            "siteKey": site_key,
            "hasSecretKey": bool(secret_key),
        }
    except Exception as e:
        logger.error(f"Error in get_recaptcha_settings: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Failed to load reCAPTCHA settings")


@router.put("/settings/recaptcha")
async def update_recaptcha_settings(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Update admin-managed reCAPTCHA keys."""
    try:
        db = get_database()
        site_key = str(payload.get("siteKey", "") or "").strip()
        secret_key = str(payload.get("secretKey", "") or "").strip()

        update_fields: Dict[str, Any] = {
            "updatedAt": datetime.utcnow(),
            "type": "admin",
        }
        if site_key:
            update_fields["contactRecaptcha.siteKey"] = site_key
        if secret_key:
            update_fields["contactRecaptcha.secretKey"] = secret_key

        if not site_key and not secret_key:
            raise HTTPException(status_code=400, detail="Provide siteKey and/or secretKey")

        await db.settings.update_one(
            {"type": "admin"},
            {"$set": update_fields},
            upsert=True
        )

        updated = await db.settings.find_one({"type": "admin"}, {"contactRecaptcha": 1})
        recaptcha = (updated or {}).get("contactRecaptcha", {}) if updated else {}

        changed: list[str] = []
        if site_key:
            changed.append("site key")
        if secret_key:
            changed.append("secret key")
        await log_custom_action(
            db,
            current_user,
            action="updated",
            resource_type="recaptcha",
            changes=changed,
            detail="reCAPTCHA keys updated" if changed else None,
        )

        return {
            "message": "reCAPTCHA settings updated",
            "siteKey": str(recaptcha.get("siteKey", "") or ""),
            "hasSecretKey": bool(str(recaptcha.get("secretKey", "") or "")),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_recaptcha_settings: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Failed to update reCAPTCHA settings")


@router.get("/contact-protection/analytics")
async def get_contact_protection_analytics(
    current_user: dict = Depends(get_current_admin_user),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=500),
):
    """Get contact protection analytics (blocked events by IP/reason/time)."""
    try:
        db = get_database()
        since = datetime.utcnow() - timedelta(days=days)

        events_cursor = db.contact_spam_events.find(
            {"createdAt": {"$gte": since}}
        ).sort("createdAt", -1).limit(limit)
        events = await events_cursor.to_list(length=limit)
        for event in events:
            convert_objectids_to_strings(event)
            event["id"] = str(event.get("_id")) if event.get("_id") else event.get("id")
            if "_id" in event:
                del event["_id"]

        by_reason_pipeline = [
            {"$match": {"createdAt": {"$gte": since}}},
            {"$group": {"_id": "$reason", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20},
        ]
        by_ip_pipeline = [
            {"$match": {"createdAt": {"$gte": since}}},
            {"$group": {"_id": "$ip", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20},
        ]

        by_reason = await db.contact_spam_events.aggregate(by_reason_pipeline).to_list(length=20)
        by_ip = await db.contact_spam_events.aggregate(by_ip_pipeline).to_list(length=20)
        total_events = await db.contact_spam_events.count_documents({"createdAt": {"$gte": since}})

        return {
            "summary": {
                "days": days,
                "totalEvents": total_events,
                "topReasons": [{"reason": item.get("_id") or "unknown", "count": item.get("count", 0)} for item in by_reason],
                "topIps": [{"ip": item.get("_id") or "unknown", "count": item.get("count", 0)} for item in by_ip],
            },
            "events": events,
        }
    except Exception as e:
        logger.error(f"Error in get_contact_protection_analytics: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Failed to load contact protection analytics")

@router.get("/notifications")
async def get_admin_notifications(
    current_user: dict = Depends(get_current_admin_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get admin notifications"""
    db = get_database()
    
    # Get notifications for this admin user OR system-wide admin notifications (userId is null)
    notifications_cursor = db.notifications.find({
        "$or": [
            {"userId": str(current_user["_id"])},  # User-specific notifications
            {"userId": {"$in": [None, ""]}},       # System-wide admin notifications
            {"userId": {"$exists": False}}         # Notifications without userId field
        ]
    }).skip(skip).limit(limit).sort("createdAt", -1)
    
    notifications = await notifications_cursor.to_list(length=limit)
    total = await db.notifications.count_documents({
        "$or": [
            {"userId": str(current_user["_id"])},
            {"userId": {"$in": [None, ""]}},
            {"userId": {"$exists": False}}
        ]
    })
    
    # Convert ObjectIds to strings
    for notification in notifications:
        convert_objectids_to_strings(notification)
        notification["id"] = str(notification["_id"])
    
    return {"notifications": notifications, "total": total}

@router.post("/notifications")
async def create_admin_notification(
    notification_data: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user)
):
    """Create admin notification"""
    db = get_database()
    
    notification_data["createdAt"] = datetime.utcnow()
    notification_data["userId"] = str(current_user["_id"])
    notification_data["isRead"] = False
    
    result = await db.notifications.insert_one(notification_data)
    notification_data["_id"] = str(result.inserted_id)
    notification_data["id"] = str(result.inserted_id)

    await log_resource_created(
        db,
        current_user,
        resource_type="notification",
        doc=notification_data,
        title_field="title",
    )
    
    return notification_data

@router.put("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Mark notification as read"""
    db = get_database()
    
    # Allow marking as read for user-specific notifications OR system-wide notifications
    result = await db.notifications.update_one(
        {
            "_id": ObjectId(notification_id),
            "$or": [
                {"userId": str(current_user["_id"])},  # User-specific notifications
                {"userId": {"$in": [None, ""]}},       # System-wide admin notifications
                {"userId": {"$exists": False}}         # Notifications without userId field
            ]
        },
        {"$set": {"isRead": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@router.put("/notifications/mark-all-read")
async def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_admin_user)
):
    """Mark all notifications as read"""
    db = get_database()
    
    # Mark all notifications as read for this admin (user-specific + system-wide)
    result = await db.notifications.update_many(
        {
            "$or": [
                {"userId": str(current_user["_id"])},  # User-specific notifications
                {"userId": {"$in": [None, ""]}},       # System-wide admin notifications
                {"userId": {"$exists": False}}         # Notifications without userId field
            ]
        },
        {"$set": {"isRead": True}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}

@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Delete notification"""
    db = get_database()
    
    existing = await db.notifications.find_one({
        "_id": ObjectId(notification_id),
        "$or": [
            {"userId": str(current_user["_id"])},
            {"userId": {"$in": [None, ""]}},
            {"userId": {"$exists": False}}
        ]
    })

    # Allow deleting user-specific notifications OR system-wide notifications
    result = await db.notifications.delete_one({
        "_id": ObjectId(notification_id),
        "$or": [
            {"userId": str(current_user["_id"])},  # User-specific notifications
            {"userId": {"$in": [None, ""]}},       # System-wide admin notifications
            {"userId": {"$exists": False}}         # Notifications without userId field
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    if existing:
        await log_resource_deleted(
            db,
            current_user,
            resource_type="notification",
            doc=existing,
            title_field="title",
            resource_id=notification_id,
        )
    
    return {"message": "Notification deleted successfully"}

@router.post("/notifications/seed")
async def seed_notifications(
    current_user: dict = Depends(get_current_admin_user)
):
    """Seed the database with sample notifications for testing"""
    db = get_database()
    
    sample_notifications = [
        {
            "title": "New Application Received",
            "message": "John Doe has applied for Software Engineer position",
            "type": "info",
            "userId": str(current_user["_id"]),
            "isRead": False,
            "createdAt": datetime.utcnow() - timedelta(minutes=30),
            "priority": "normal"
        },
        {
            "title": "Interview Scheduled",
            "message": "Interview scheduled for Jane Smith tomorrow at 2 PM",
            "type": "success",
            "userId": str(current_user["_id"]),
            "isRead": False,
            "createdAt": datetime.utcnow() - timedelta(hours=2),
            "priority": "high"
        },
        {
            "title": "System Maintenance",
            "message": "Scheduled maintenance will occur this weekend",
            "type": "warning",
            "userId": str(current_user["_id"]),
            "isRead": True,
            "createdAt": datetime.utcnow() - timedelta(days=1),
            "priority": "normal"
        },
        {
            "title": "New Blog Post Published",
            "message": "Your blog post 'Company Culture Update' has been published",
            "type": "success",
            "userId": str(current_user["_id"]),
            "isRead": False,
            "createdAt": datetime.utcnow() - timedelta(hours=4),
            "priority": "low"
        },
        {
            "title": "Low Disk Space Alert",
            "message": "Server disk space is running low (85% full)",
            "type": "error",
            "userId": str(current_user["_id"]),
            "isRead": False,
            "createdAt": datetime.utcnow() - timedelta(hours=6),
            "priority": "high"
        }
    ]
    
    result = await db.notifications.insert_many(sample_notifications)
    
    return {
        "message": f"Created {len(result.inserted_ids)} sample notifications",
        "ids": [str(id) for id in result.inserted_ids]
    }

# Admin Activity endpoints
@router.get("/audit-logs")
async def get_audit_logs(
    current_user: dict = Depends(get_current_admin_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None, description="Filter by action (created, updated, deleted, published, unpublished)"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type (blog_post, etc.)"),
    search: Optional[str] = Query(None, description="Search admin email, summary, or resource title"),
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD or YYYYMMDD"),
):
    """Return human-readable admin activity entries from MongoDB."""
    try:
        from app.lib.admin_audit import COLLECTION

        db = get_database()
        query: dict[str, Any] = {}

        if action and action.lower() != "all":
            query["action"] = action.lower()

        if resource_type and resource_type.lower() != "all":
            query["resourceType"] = resource_type.lower()

        if date:
            raw = date.strip().replace("-", "")
            if len(raw) == 8:
                try:
                    day = datetime.strptime(raw, "%Y%m%d")
                    next_day = day + timedelta(days=1)
                    query["createdAt"] = {"$gte": day, "$lt": next_day}
                except ValueError:
                    pass

        if search and search.strip():
            term = search.strip()
            query["$or"] = [
                {"summary": {"$regex": term, "$options": "i"}},
                {"actorEmail": {"$regex": term, "$options": "i"}},
                {"actorName": {"$regex": term, "$options": "i"}},
                {"resourceTitle": {"$regex": term, "$options": "i"}},
            ]

        total = await db[COLLECTION].count_documents(query)
        cursor = (
            db[COLLECTION]
            .find(query)
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )
        rows = await cursor.to_list(length=limit)

        activities: list[dict[str, Any]] = []
        for row in rows:
            created = row.get("createdAt")
            ts = created.isoformat() if hasattr(created, "isoformat") else str(created or "")
            activities.append(
                {
                    "id": str(row.get("_id", "")),
                    "timestamp": ts,
                    "actorEmail": row.get("actorEmail") or "",
                    "actorName": row.get("actorName") or "",
                    "action": row.get("action") or "",
                    "resourceType": row.get("resourceType") or "",
                    "resourceId": row.get("resourceId") or "",
                    "resourceTitle": row.get("resourceTitle") or "",
                    "resourcePath": row.get("resourcePath") or "",
                    "changes": row.get("changes") or [],
                    "summary": row.get("summary") or "",
                }
            )

        return JSONResponse(
            content={"activities": activities, "total": total},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
            },
        )
    except Exception as e:
        logger.error(f"Error in get_audit_logs: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail="Failed to read admin activity")

@router.get("/user/application-stats")
async def get_user_application_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get application statistics for a user"""
    db = get_database()
    
    # Get user's applications
    pipeline = [
        {
            "$match": {
                "userId": str(current_user["_id"])
            }
        },
        {
            "$facet": {
                "total": [{"$count": "count"}],
                "pending": [{"$match": {"status": "Applied"}}, {"$count": "count"}],
                "shortlisted": [{"$match": {"status": "Shortlisted"}}, {"$count": "count"}],
                "interviewing": [{"$match": {"status": "Interviewing"}}, {"$count": "count"}],
                "hired": [{"$match": {"status": "Hired"}}, {"$count": "count"}],
                "rejected": [{"$match": {"status": "Rejected"}}, {"$count": "count"}],
                "recent": [
                    {
                        "$match": {
                            "appliedDate": {
                                "$gte": datetime.utcnow() - timedelta(days=30)
                            }
                        }
                    },
                    {"$count": "count"}
                ]
            }
        }
    ]
    
    stats = await db.applications.aggregate(pipeline).to_list(length=1)
    stats = stats[0] if stats else {}
    
    # Helper function to safely get counts
    def get_count(key):
        result = stats.get(key, [])
        return result[0].get("count", 0) if result else 0
    
    return {
        "total": get_count("total"),
        "pending": get_count("pending"),
        "shortlisted": get_count("shortlisted"),
        "interviewing": get_count("interviewing"),
        "hired": get_count("hired"),
        "rejected": get_count("rejected"),
        "recent": get_count("recent")
    }

@router.options("/user/application-stats", include_in_schema=False)
async def options_user_application_stats(request: Request):
    """Handle CORS preflight requests"""
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

@router.delete("/applications/bulk")
async def bulk_delete_applications(
    request: Request,
    data: dict = Body(...),
    current_user: dict = Depends(get_current_admin_user)
):
    """Bulk delete applications"""
    try:
        if not data.get("ids"):
            raise HTTPException(status_code=400, detail="No application IDs provided")
            
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
            
        # Convert string IDs to ObjectIds
        object_ids = [ObjectId(id) for id in data["ids"]]
        
        # Delete applications
        result = await db.applications.delete_many({"_id": {"$in": object_ids}})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="No applications found to delete")

        await log_bulk_operation(
            db,
            current_user,
            action="deleted",
            resource_type="application",
            count=result.deleted_count,
            detail=f"{result.deleted_count} applications",
        )
            
        return {
            "message": f"Successfully deleted {result.deleted_count} applications",
            "deleted_count": result.deleted_count
        }
        
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid application ID format")
    except Exception as e:
        logger.error(f"Error in bulk delete applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.options("/applications/bulk-status", include_in_schema=False)
async def options_bulk_status(request: Request):
    """Handle CORS preflight requests for bulk status update"""
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    ) 

@router.get("/users/search")
async def search_users(
    request: Request,
    q: str = "",
    current_user: dict = Depends(get_current_admin_user)
):
    """Search users by name, email, or username"""
    try:
        if not q.strip():
            return {"users": []}
            
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Create case-insensitive regex for search
        search_regex = {"$regex": q.strip(), "$options": "i"}
        
        # Search in multiple fields
        query = {
            "$or": [
                {"name": search_regex},
                {"email": search_regex},
                {"firstName": search_regex},
                {"lastName": search_regex},
                {"username": search_regex}
            ]
        }
        
        # Find users (limit to 50 results)
        users_cursor = db.users.find(
            query,
            {"password": 0, "resetToken": 0, "verificationToken": 0}  # Exclude sensitive fields
        ).limit(50)
        
        users = []
        async for user in users_cursor:
            users.append(_format_admin_user(user))

        return {"users": users}
        
    except Exception as e:
        logger.error(f"Error searching users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/emails/ai/generate")
async def ai_generate_email(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Generate email content using AI based on a prompt"""
    try:
        import os
        import httpx
        import json
        import re

        prompt = (payload.get("prompt") or "").strip()
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        from app.lib.ai_provider_settings import get_active_ai_config

        base_url, api_key, model = await get_active_ai_config()

        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="AI service not configured — add a provider in Admin → Settings → AI providers",
            )

        # Create the system prompt for email generation
        system_prompt = """You are an expert email marketing specialist. Generate professional email content based on the user's prompt.

CRITICAL: You MUST return ONLY valid JSON in this exact format. Do not include any text before or after the JSON.

Requirements:
1. Return ONLY valid JSON with "subject" and "body" fields
2. The subject should be compelling and concise (under 60 characters)
3. The body should be well-formatted HTML with proper styling
4. Use professional tone appropriate for business communications
5. Include BQI Tech branding colors: #272055 (dark blue) and #31CDFF (light blue)
6. Make the email engaging and actionable
7. Include a clear call-to-action when appropriate
8. Use proper HTML structure with headings, paragraphs, and styling
9. ALWAYS use the provided header and footer components
10. Center-align the main heading after the header

IMPORTANT: Return ONLY this JSON format, nothing else:
{
  "subject": "Your Email Subject Here",
  "body": "[HEADER_COMPONENT]<div style=\"max-width: 600px; margin: 0 auto; padding: 0 20px;\"><h1 style=\"color: #272055; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: 600;\">Your Heading</h1><p style=\"font-size: 16px; line-height: 1.7; color: #333; margin-bottom: 25px; text-align: center;\">Your content here...</p></div>[FOOTER_COMPONENT]"
}

Where:
- [HEADER_COMPONENT] = <div style="background: linear-gradient(135deg, #272055 0%, #31CDFF 100%); padding: 30px 20px; text-align: center; margin-bottom: 30px;"><img src="http://localhost:3000/bqilogo-light.png" alt="BQI Tech Logo" style="max-width: 180px; height: auto; margin-bottom: 15px;"><div style="color: white; font-size: 14px; opacity: 0.9;">bqitech.com</div></div>

- [FOOTER_COMPONENT] = <div style="background-color: #f8f9fa; padding: 30px 20px; text-align: center; margin-top: 40px; border-top: 3px solid #31CDFF;"><div style="margin-bottom: 20px;"><img src="http://localhost:3000/bqilogo-light.png" alt="BQI Tech Logo" style="max-width: 120px; height: auto; opacity: 0.8;"></div><div style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 15px;"><strong>BQI Technologies</strong><br>Empowering businesses through innovative technology solutions</div><div style="color: #999; font-size: 12px; margin-bottom: 20px;">Visit us at <a href="https://bqitech.com" style="color: #31CDFF; text-decoration: none;">bqitech.com</a></div><div style="color: #999; font-size: 12px;">Best regards,<br><strong>The BQI Tech Team</strong></div></div>

Generate an email based on this prompt:"""

        user_prompt = f"{system_prompt}\n\n{prompt}"

        # Make request to NVIDIA API
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000,
                },
                timeout=30.0,
            )

        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"AI service error: {resp.status_code}")

        data = resp.json()
        content = (
            data.get("choices", [{}])[0].get("message", {}).get("content", "")
        )

        # Log the AI response for debugging
        logger.info(f"AI Response: {content[:500]}...")

        # Parse JSON response from AI
        json_patterns = [
            r'```json\s*(\{[\s\S]*?\})\s*```',  # JSON in code blocks
            r'```\s*(\{[\s\S]*?\})\s*```',      # JSON in generic code blocks
            r'(\{[\s\S]*?\})',                   # Any JSON object
        ]

        for pattern in json_patterns:
            match = re.search(pattern, content.strip(), re.DOTALL)
            if match:
                try:
                    json_str = match.group(1)
                    logger.info(f"Found JSON pattern: {json_str[:200]}...")
                    parsed = json.loads(json_str)
                    # Validate the structure
                    if isinstance(parsed, dict) and "subject" in parsed and "body" in parsed:
                        logger.info("Successfully parsed AI response")
                        return parsed
                    else:
                        logger.warning(f"Invalid JSON structure: {parsed}")
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"JSON parsing error: {e}")
                    continue

        # Try to parse the entire response as JSON (in case AI returned clean JSON)
        try:
            logger.info("Attempting to parse entire response as JSON")
            parsed = json.loads(content.strip())
            if isinstance(parsed, dict) and "subject" in parsed and "body" in parsed:
                logger.info("Successfully parsed entire response as JSON")
                return parsed
        except json.JSONDecodeError:
            logger.warning("Entire response is not valid JSON")

        logger.warning("No valid JSON found in AI response, using fallback")

        # Fallback: create a basic email structure
        return {
            "subject": f"Email: {prompt[:50]}...",
            "body": f"<div style=\"text-align: center; margin-bottom: 30px;\"><img src=\"http://localhost:3000/bqilogo-light.png\" alt=\"BQI Tech Logo\" style=\"max-width: 200px; height: auto;\"></div><h1 style=\"color: #272055; text-align: center;\">Generated Email</h1><p>Based on your prompt: {prompt}</p><p>Please customize this content as needed.</p>"
        }

    except Exception as e:
        logger.error(f"Error in AI email generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cv-vault/filters")
async def cv_vault_filter_options(
    current_admin: dict = Depends(get_current_admin_user),
):
    from app.lib.cv_vault import get_cv_vault_filter_options

    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cv_vault_filter_options(db)


@router.get("/cv-vault")
async def list_cv_vault(
    current_admin: dict = Depends(get_current_admin_user),
    search: str = Query("", description="Filter by name, email, or filename"),
    sort: str = Query("complete_first"),
    has_email: Optional[bool] = Query(None),
    has_name: Optional[bool] = Query(None),
    linked_application: Optional[bool] = Query(None),
    source: str = Query("all"),
    contact_filter: str = Query("all"),
    application_status: str = Query("all"),
    sync: bool = Query(False, description="Force sync from Dropbox before returning"),
):
    """CV Vault — read from MongoDB cache with sort/filter; syncs Dropbox when empty or sync=true."""
    from app.lib.dropbox import get_dropbox_access_token
    from app.lib.cv_vault import (
        CV_VAULT_COLLECTION,
        VALID_SORTS,
        list_cv_vault_from_db,
        sync_cv_vault_from_dropbox,
    )
    import dropbox

    if sort not in VALID_SORTS:
        raise HTTPException(status_code=400, detail="Invalid sort parameter")

    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    list_kwargs = {
        "search": search,
        "sort": sort,
        "has_email": has_email,
        "has_name": has_name,
        "linked_application": linked_application,
        "source": source if source != "all" else None,
        "contact_filter": contact_filter,
        "application_status": application_status
        if application_status != "all"
        else None,
    }

    count = await db[CV_VAULT_COLLECTION].count_documents({})
    if sync or count == 0:
        try:
            token = await get_dropbox_access_token()
            dbx = dropbox.Dropbox(token)
        except Exception as e:
            logger.error("Dropbox client init failed: %s", e)
            raise HTTPException(status_code=500, detail="Failed to connect to Dropbox storage")
        return await sync_cv_vault_from_dropbox(db, dbx, extract_pdf=False, **list_kwargs)

    return await list_cv_vault_from_db(db, **list_kwargs)


@router.post("/cv-vault/sync")
async def sync_cv_vault(
    current_admin: dict = Depends(get_current_admin_user),
    extract_pdf: bool = Query(False, description="Extract name/email from PDFs when missing"),
    sort: str = Query("complete_first"),
    search: str = Query(""),
    has_email: Optional[bool] = Query(None),
    has_name: Optional[bool] = Query(None),
    linked_application: Optional[bool] = Query(None),
    source: str = Query("all"),
    contact_filter: str = Query("all"),
    application_status: str = Query("all"),
):
    """Sync CV vault from Dropbox into MongoDB."""
    from app.lib.dropbox import get_dropbox_access_token
    from app.lib.cv_vault import sync_cv_vault_from_dropbox
    import dropbox

    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        token = await get_dropbox_access_token()
        dbx = dropbox.Dropbox(token)
    except Exception as e:
        logger.error("Dropbox client init failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to connect to Dropbox storage")

    result = await sync_cv_vault_from_dropbox(
        db,
        dbx,
        extract_pdf=extract_pdf,
        search=search,
        sort=sort,
        has_email=has_email,
        has_name=has_name,
        linked_application=linked_application,
        source=source if source != "all" else None,
        contact_filter=contact_filter,
        application_status=application_status
        if application_status != "all"
        else None,
    )

    synced_count = (
        result.get("synced")
        or result.get("total")
        or result.get("count")
        or 0
    )
    await log_custom_action(
        db,
        current_admin,
        action="synced",
        resource_type="cv_vault",
        detail=f"CV vault synced from Dropbox ({synced_count} files)" if synced_count else "CV vault synced from Dropbox",
    )

    return result
