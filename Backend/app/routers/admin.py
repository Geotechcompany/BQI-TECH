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
    send_generic_email,
)
from app.lib.application_emails import (
    format_email_document,
    is_valid_email_address,
    plain_text_to_email_html,
    resolve_application_email,
)
from app.lib.email_transport import is_email_configured
from app.lib.roles import (
    is_admin_role,
    normalize_role,
    roles_matching_search_query,
    was_promoted_to_admin,
)
from app.lib.admin_permissions import (
    ADMIN_MODULE_LABELS,
    can_manage_admin_users,
    can_manage_backup,
    get_effective_admin_modules,
    has_admin_module,
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
from app.lib.admin_notifications import (
    admin_notification_scope_filter,
    admin_notification_unread_filter,
    applicant_display_name,
    application_admin_link,
    create_system_admin_notification,
    is_system_wide_notification,
    normalize_notification,
)
from app.lib.application_comments import (
    author_display_name,
    format_comment_document,
    notify_mentioned_users,
    parse_object_id,
    serialize_mentions,
)
from app.lib.hiring_team_emails import notify_newly_assigned_hiring_team
from app.models.application_comment import (
    ApplicationCommentCreate,
    ApplicationCommentUpdate,
)
from app.models.application_email import ApplicationEmailCreate
from app.models.application_task import (
    ApplicationAssigneesUpdate,
    ApplicationBulkTagsUpdate,
    ApplicationFollowUpdate,
    ApplicationMergeRequest,
    ApplicationPrivacyUpdate,
    ApplicationReminderCreate,
    ApplicationSendQuestionnaireRequest,
    ApplicationTaskCreate,
    ApplicationTaskUpdate,
)
from app.models.admin_task import AdminTaskCreate, AdminTaskUpdate
from app.models.company_document import CompanyDocumentCreate, CompanyDocumentUpdate
from app.lib.application_tasks import (
    candidate_profile_href,
    format_task_document,
    interviewer_matches_user,
    serialize_assignees,
    user_on_hiring_team,
)
from app.lib.admin_tasks import (
    build_admin_tasks_filter,
    format_admin_task_document,
    resolve_assignee_name,
)
from app.lib.company_documents import (
    build_documents_query,
    detect_document_format,
    format_company_document,
    parse_document_object_id,
)
from app.lib.nvidia_ai import test_nvidia_connection
from app.lib.runtime_environment import get_frontend_url
from app.lib.error_utils import format_exception_message
from app.utils.status_history import (
    build_admin_status_update,
    application_status_match,
    normalize_application_status,
    CANONICAL_APPLICATION_STATUSES,
    admin_actor_label,
    resolve_applications_changed_by,
    resolve_status_history_changed_by,
)
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


def _normalize_pipeline_settings(raw: Any) -> Optional[Dict[str, Any]]:
    """Normalize optional per-job pipeline settings stored on job postings."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return None

    template_id = str(raw.get("templateId") or "default").strip() or "default"
    email_sender_name = str(raw.get("emailSenderName") or "").strip()

    stage_actions: Dict[str, List[Dict[str, Any]]] = {}
    raw_actions = raw.get("stageActions")
    if isinstance(raw_actions, dict):
        for stage_id, actions in raw_actions.items():
            if not isinstance(stage_id, str) or not isinstance(actions, list):
                continue
            normalized_actions: List[Dict[str, Any]] = []
            for index, action in enumerate(actions):
                if not isinstance(action, dict):
                    continue
                action_type = action.get("type")
                if action_type not in ("send_email", "notify_team"):
                    action_type = "send_email"
                normalized_actions.append(
                    {
                        "id": str(action.get("id") or f"{stage_id}-action-{index}").strip(),
                        "type": action_type,
                        "templateName": str(action.get("templateName") or "").strip() or None,
                        "label": str(action.get("label") or "").strip() or None,
                    }
                )
            stage_actions[stage_id] = normalized_actions

    return {
        "templateId": template_id,
        "emailSenderName": email_sender_name,
        "stageActions": stage_actions,
    }


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

# Pipeline email templates live in app.routers.email_templates
# (mounted at /api/admin/emails/templates).

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


@router.get("/communications/emails")
async def list_communication_emails_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None, description="sent | failed | pending | all"),
    type: Optional[str] = Query(
        None,
        description="candidate | request_application | broadcast | mention | hiring_team | generic",
    ),
    q: Optional[str] = Query(None, description="Search subject, recipient, candidate"),
    starred: Optional[bool] = Query(None, description="Filter starred emails"),
    current_user: dict = Depends(get_current_admin_user),
):
    """Unified outbound email history across application threads and email logs."""
    if not (
        has_admin_module(current_user, "email_broadcast")
        or has_admin_module(current_user, "candidates")
    ):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        from app.lib.communication_emails import list_communication_emails

        return await list_communication_emails(
            status=status,
            email_type=type,
            q=q,
            starred=starred,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        logger.error(f"Failed to list communication emails: {e}")
        raise HTTPException(status_code=500, detail="Failed to list communication emails")


@router.get("/communications/emails/counts")
async def communication_email_counts(
    current_user: dict = Depends(get_current_admin_user),
):
    """Folder badge counts for the Communications Manager."""
    if not (
        has_admin_module(current_user, "email_broadcast")
        or has_admin_module(current_user, "candidates")
    ):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        from app.lib.communication_emails import count_communication_emails

        return await count_communication_emails()
    except Exception as e:
        logger.error(f"Failed to count communication emails: {e}")
        raise HTTPException(status_code=500, detail="Failed to count communication emails")


@router.patch("/communications/emails/{email_id}/star")
async def star_communication_email(
    email_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_admin_user),
):
    """Toggle starred flag on an application email or email log."""
    if not (
        has_admin_module(current_user, "email_broadcast")
        or has_admin_module(current_user, "candidates")
    ):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    starred = payload.get("starred")
    if not isinstance(starred, bool):
        raise HTTPException(status_code=400, detail="starred must be a boolean")

    try:
        from app.lib.communication_emails import set_communication_email_starred

        item = await set_communication_email_starred(email_id, starred)
        if not item:
            raise HTTPException(status_code=404, detail="Email record not found")
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update email star: {e}")
        raise HTTPException(status_code=500, detail="Failed to update email star")


@router.post("/communications/emails/{email_id}/resend")
async def resend_communication_email(
    email_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Resend a previously failed outbound email when content is still available."""
    if not (
        has_admin_module(current_user, "email_broadcast")
        or has_admin_module(current_user, "candidates")
    ):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if not is_email_configured():
        raise HTTPException(
            status_code=400,
            detail="Email delivery is not configured. Set it up in Admin → Settings → Email delivery.",
        )

    from app.lib.communication_emails import (
        build_email_log_document,
        get_communication_email,
        insert_email_log,
        normalize_application_email,
        normalize_email_log,
        resolve_resend_payload,
    )

    found = await get_communication_email(email_id)
    if not found:
        raise HTTPException(status_code=404, detail="Email record not found")

    source, doc = found
    if str(doc.get("status") or "").lower() != "failed":
        raise HTTPException(status_code=400, detail="Only failed emails can be resent")

    payload = await resolve_resend_payload(source, doc)
    if not payload:
        raise HTTPException(
            status_code=400,
            detail="This email cannot be resent — original content is unavailable",
        )

    to, subject, html = payload
    email_type = (
        "candidate"
        if source == "application_email"
        else str(doc.get("email_type") or doc.get("kind") or "generic")
    )
    ok = await asyncio.to_thread(
        send_generic_email,
        to,
        subject,
        html,
        skip_log=True,
    )

    db = get_database()
    now = datetime.utcnow()
    status_value = "sent" if ok else "failed"
    error_message = None if ok else "Email delivery failed"

    if source == "application_email":
        await db.application_emails.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "status": status_value,
                    "error": error_message,
                    "sentAt": now,
                    "resentAt": now,
                    "resentById": str(
                        current_user.get("_id", current_user.get("id", ""))
                    ),
                }
            },
        )
        updated = await db.application_emails.find_one({"_id": doc["_id"]})
        item = normalize_application_email(updated or doc)
    else:
        await db.email_logs.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "status": status_value,
                    "error": error_message,
                    "sent_at": now,
                    "resent_at": now,
                }
            },
        )
        # Also append a fresh log entry for the resend attempt
        await insert_email_log(
            build_email_log_document(
                to=to,
                subject=subject,
                status=status_value,
                email_type=email_type,
                error=error_message,
                html=html,
                campaign_id=str(doc.get("campaign_id") or "") or None,
                application_id=str(doc.get("application_id") or "") or None,
                job_id=str(doc.get("job_id") or "") or None,
                sent_by_name=str(current_user.get("email") or ""),
                metadata={"resent_from": email_id},
            )
        )
        updated = await db.email_logs.find_one({"_id": doc["_id"]})
        item = normalize_email_log(updated or doc)

    if not ok:
        raise HTTPException(
            status_code=502,
            detail="Resend failed. Check email delivery settings and try again.",
        )

    await log_custom_action(
        db,
        current_user,
        action="resent",
        resource_type="communication_email",
        detail=f"to {to} — {subject[:80]}",
        resource_title=subject,
        resource_id=email_id,
    )
    return item


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
                    # Prefer draft over active when the field is missing (wizard drafts).
                    posting["isActive"] = (
                        str(posting.get("status") or "").lower() == "active"
                    )
                if "status" not in posting:
                    if posting.get("isActive"):
                        # Incomplete rows wrongly stored as active → surface as draft
                        title = str(posting.get("title") or "").strip()
                        posting["status"] = "active" if title else "draft"
                    else:
                        posting["status"] = "inactive"
                elif (
                    posting.get("isActive")
                    and str(posting.get("status")).lower() == "active"
                    and not str(posting.get("title") or "").strip()
                ):
                    posting["status"] = "draft"
                if "department" not in posting:
                    posting["department"] = "N/A"
                if "location" not in posting:
                    posting["location"] = "N/A"
                if "postedDate" not in posting:
                    posting["postedDate"] = posting.get("createdAt", datetime.utcnow()).isoformat()
                
                # Get application count for each job
                try:
                    posting["applicationCount"] = await db.applications.count_documents(
                        _apply_application_job_filter(
                            _active_application_filter(),
                            str(posting["_id"]),
                            posting.get("title"),
                        )
                    )
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
    from app.lib.job_activation import ensure_can_activate, will_be_active
    from app.lib.job_auto_status import normalize_auto_schedule_fields

    db = get_database()
    
    # Clean up HTML entities in description
    if "description" in job_data:
        job_data["description"] = (
            job_data["description"]
            .replace("&nbsp;", " ")  # Replace &nbsp; with regular space
            .replace("\\s+", " ")    # Normalize multiple spaces using proper regex escape
            .strip()                 # Trim extra spaces
        )

    job_data = normalize_auto_schedule_fields(job_data)
    
    job_data["createdAt"] = datetime.utcnow()
    job_data["updatedAt"] = datetime.utcnow()
    job_data["createdBy"] = str(current_user["_id"])
    
    # Normalize and defaults
    if not job_data.get("employmentType"):
        job_data["employmentType"] = "Full-time"
    # Allow postedDate from client, otherwise default to now
    if not job_data.get("postedDate"):
        job_data["postedDate"] = datetime.utcnow()

    # New wizard saves default to draft unless explicitly published
    if "isActive" not in job_data:
        job_data["isActive"] = False
    job_data["isActive"] = bool(job_data.get("isActive"))
    status = str(job_data.get("status") or "").strip().lower()
    if job_data["isActive"]:
        job_data["status"] = "active"
    elif status in ("inactive", "closed"):
        job_data["status"] = "inactive"
    else:
        job_data["status"] = "draft"

    if will_be_active(create_data=job_data):
        ensure_can_activate(job_data)
    
    result = await db.jobpostings.insert_one(job_data)
    job_id = str(result.inserted_id)
    job_data["_id"] = job_id
    job_data["id"] = job_id

    await log_resource_created(
        db, current_user, resource_type="job_posting", doc=job_data, title_field="title"
    )

    if "hiringTeam" in job_data:
        await notify_newly_assigned_hiring_team(
            db,
            previous_team=[],
            next_team=job_data.get("hiringTeam"),
            assigner=current_user,
            job_id=job_id,
            job_title=str(job_data.get("title") or ""),
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
    from app.lib.job_activation import ensure_can_activate, will_be_active
    from app.lib.job_auto_status import normalize_auto_schedule_fields

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

        if "pipelineSettings" in update_data:
            normalized_settings = _normalize_pipeline_settings(update_data.get("pipelineSettings"))
            if normalized_settings is None:
                update_data.pop("pipelineSettings", None)
            else:
                update_data["pipelineSettings"] = normalized_settings

        update_data = normalize_auto_schedule_fields(update_data)
        
        update_data["updatedAt"] = datetime.utcnow()

        # Keep isActive and status aligned
        if "isActive" in update_data:
            update_data["isActive"] = bool(update_data.get("isActive"))
            if update_data["isActive"]:
                update_data["status"] = "active"
            else:
                incoming = str(update_data.get("status") or "").strip().lower()
                if incoming == "draft":
                    update_data["status"] = "draft"
                elif incoming in ("inactive", "closed"):
                    update_data["status"] = "inactive"
                else:
                    prior = str(existing.get("status") or "").strip().lower()
                    update_data["status"] = (
                        "inactive"
                        if prior in ("active", "inactive", "closed")
                        else "draft"
                    )
        elif "status" in update_data:
            status = str(update_data.get("status") or "").strip().lower()
            if status == "active":
                update_data["isActive"] = True
                update_data["status"] = "active"
            elif status in ("inactive", "closed"):
                update_data["isActive"] = False
                update_data["status"] = "inactive"
            else:
                update_data["isActive"] = False
                update_data["status"] = "draft"

        if will_be_active(existing=existing, update_data=update_data):
            ensure_can_activate({**existing, **update_data})
        
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

        if "hiringTeam" in update_data:
            job_title = str(
                update_data.get("title") or existing.get("title") or ""
            )
            await notify_newly_assigned_hiring_team(
                db,
                previous_team=existing.get("hiringTeam"),
                next_team=update_data.get("hiringTeam"),
                assigner=current_user,
                job_id=job_id,
                job_title=job_title,
            )

        # Return the updated document for UI freshness
        updated = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not updated:
            return {"message": "Job posting updated successfully"}
        convert_objectids_to_strings(updated)
        updated["id"] = str(updated["_id"])
        return updated
    except HTTPException:
        raise
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
    from app.lib.job_activation import ensure_can_activate

    db = get_database()
    
    try:
        existing = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Job posting not found")

        is_active = bool(status_data.get("isActive", True))
        if is_active:
            ensure_can_activate(existing)

        update_data = {
            "isActive": is_active,
            "status": "active" if is_active else "inactive",
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
    except HTTPException:
        raise
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
        job_filter: Dict[str, Any] = _active_application_filter()
        if job_id:
            try:
                ObjectId(job_id)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid job ID format")
            job_title = await _resolve_job_posting_title(db, job_id)
            job_filter = _apply_application_job_filter(job_filter, job_id, job_title)
        
        # Get base counts
        total_users = await db.users.count_documents({})
        total_jobs = await db.jobpostings.count_documents({})
        active_jobs = await db.jobpostings.count_documents({"isActive": True})
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


def _private_visibility_filter(user_id: Optional[str]) -> Dict[str, Any]:
    """Hide private applications from everyone except the owner."""
    uid = str(user_id or "").strip()
    return {
        "$or": [
            {"isPrivate": {"$ne": True}},
            {"privateOwnerId": uid},
        ]
    }


def _with_private_visibility(
    match_query: Dict[str, Any], user_id: Optional[str]
) -> Dict[str, Any]:
    return {"$and": [match_query, _private_visibility_filter(user_id)]}


def _current_user_id(current_user: dict) -> str:
    return str(current_user.get("_id") or current_user.get("id") or "")


def _assert_application_visible(application: dict, current_user: dict) -> None:
    if not application.get("isPrivate"):
        return
    owner_id = str(application.get("privateOwnerId") or "")
    if owner_id and owner_id == _current_user_id(current_user):
        return
    raise HTTPException(status_code=404, detail="Application not found")


# Fields returned by aggregation/list endpoints — never persist on PUT.
_APPLICATION_UPDATE_BLOCKLIST = frozenset({
    "id",
    "_id",
    "jobDetails",
    "userDetails",
    "jobTitle",
    "user",
    "job",
    "isFollowed",
})


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
        "strong": {"aiRankScore": {"$gte": 88}},
        "good": {"aiRankScore": {"$gte": 72, "$lt": 88}},
        "moderate": {"aiRankScore": {"$gte": 52, "$lt": 72}},
        "weak": {"aiRankScore": {"$lt": 52, "$gte": 0}},
    }
    match_query = score_ranges.get(ai_score_filter)
    if match_query:
        pipeline.append({"$match": match_query})


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    """Parse a YYYY-MM-DD (or ISO) date string into a datetime, ignoring invalid input."""
    if not value or not isinstance(value, str):
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


def _effective_position_expr(
    job_title_field: str = "$jobDetails.title",
    position_field: str = "$position",
) -> Dict[str, Any]:
    """Resolve display position: trimmed job title when non-empty, else trimmed app position."""
    return {
        "$let": {
            "vars": {
                "jobTitle": {
                    "$trim": {"input": {"$ifNull": [job_title_field, ""]}}
                },
                "appPosition": {
                    "$trim": {"input": {"$ifNull": [position_field, ""]}}
                },
            },
            "in": {
                "$cond": {
                    "if": {"$gt": [{"$strLenCP": "$$jobTitle"}, 0]},
                    "then": "$$jobTitle",
                    "else": "$$appPosition",
                }
            },
        }
    }


def _append_position_filter(pipeline: list, position: Optional[str]) -> None:
    """Append a $match stage that filters by resolved position title."""
    if not position or position == "all":
        return
    normalized = _normalize_text_value(position)
    if not normalized:
        return
    pipeline.append({
        "$match": {
            "$expr": {
                "$eq": [_effective_position_expr(), normalized]
            }
        }
    })


def _missing_job_id_clause() -> Dict[str, Any]:
    """Applications with no job reference (legacy position-only records)."""
    return {
        "$or": [
            {"jobId": {"$exists": False}},
            {"jobId": None},
            {"jobId": ""},
        ]
    }


def _application_job_filter(
    job_id: str,
    job_title: Optional[str] = None,
) -> Dict[str, Any]:
    """Match applications by jobId (ObjectId or string) or legacy position title."""
    clauses: List[Dict[str, Any]] = []
    try:
        oid = ObjectId(job_id)
        clauses.append({"jobId": oid})
        clauses.append({"jobId": job_id})
    except InvalidId:
        clauses.append({"jobId": job_id})

    normalized_title = _normalize_text_value(job_title) if job_title else ""
    if normalized_title:
        clauses.append({
            "$and": [
                _missing_job_id_clause(),
                {
                    "position": {
                        "$regex": f"^{re.escape(normalized_title)}$",
                        "$options": "i",
                    }
                },
            ]
        })

    if len(clauses) == 1:
        return clauses[0]
    return {"$or": clauses}


def _apply_application_job_filter(
    match_query: Dict[str, Any],
    job_id: str,
    job_title: Optional[str] = None,
) -> Dict[str, Any]:
    job_filter = _application_job_filter(job_id, job_title)
    if not match_query:
        return job_filter
    return {"$and": [match_query, job_filter]}


async def _resolve_job_posting_title(db, job_id: str) -> Optional[str]:
    try:
        job_doc = await db.jobpostings.find_one({"_id": ObjectId(job_id)}, {"title": 1})
    except InvalidId:
        return None
    if not job_doc:
        return None
    return job_doc.get("title")


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
            match_query.update(application_status_match(status))
        
        # Add job filtering (ObjectId, string jobId, or legacy position title)
        if jobId:
            try:
                ObjectId(jobId)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid job ID format")
            job_title = await _resolve_job_posting_title(db, jobId)
            match_query = _apply_application_job_filter(match_query, jobId, job_title)

        # Add applied-date range filtering
        applied_date_range = _build_applied_date_range(date_from, date_to)
        if applied_date_range:
            match_query["appliedDate"] = applied_date_range

        match_query = _with_private_visibility(
            match_query, _current_user_id(current_user)
        )
        
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
        _append_position_filter(pipeline, position)

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

        await resolve_applications_changed_by(db, applications)
        
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
        date_from=None,
        date_to=None,
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
            match_query.update(application_status_match(status))
        
        # Aggregation pipeline to get unique positions from applications
        pipeline = [
            {"$match": match_query},
            _job_posting_lookup_stage(),
            {
                "$addFields": {
                    "jobDetails": {"$arrayElemAt": ["$jobDetails", 0]},
                }
            },
            {
                "$addFields": {
                    "effectivePosition": _effective_position_expr(),
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
                    "_id": {"$nin": [None, "", "Position Not Available", "Unknown Position"]}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        cursor = db.applications.aggregate(pipeline)
        positions_from_apps = await cursor.to_list(length=None)

        title_to_count: dict[str, int] = {}

        if archived:
            # Archived views: only positions that actually have archived applications
            for pos in positions_from_apps:
                title = _normalize_text_value(pos.get("_id"))
                if title:
                    title_to_count[title] = title_to_count.get(title, 0) + int(pos.get("count", 0))
        else:
            # Active pipeline: include all job postings (active and inactive)
            job_titles: list[str] = []
            try:
                async for job in db.jobpostings.find({}, {"title": 1}):
                    title = _normalize_text_value(job.get("title"))
                    if title:
                        job_titles.append(title)
            except Exception as e:
                logger.error(f"Failed to load job titles for positions list: {e}")

            title_to_count = {t: 0 for t in job_titles}
            for pos in positions_from_apps:
                title = _normalize_text_value(pos.get("_id"))
                if title:
                    title_to_count[title] = title_to_count.get(title, 0) + int(pos.get("count", 0))

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
        match_query = _with_private_visibility(
            {**application_status_match("Shortlisted"), **_active_application_filter()},
            _current_user_id(current_user),
        )
        
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
        _append_position_filter(pipeline, position)

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

        await resolve_applications_changed_by(db, applications)
        
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
        match_query = _with_private_visibility(
            {**application_status_match("Disqualified"), **_active_application_filter()},
            _current_user_id(current_user),
        )
        
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
        _append_position_filter(pipeline, position)

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

        await resolve_applications_changed_by(db, applications)
        
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


def _normalize_tag_list(raw_tags: Any) -> list[str]:
    if not isinstance(raw_tags, list):
        return []
    seen: set[str] = set()
    tags: list[str] = []
    for item in raw_tags:
        tag = str(item or "").strip()
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(tag)
    return tags


def _parse_application_object_ids(ids: list[str]) -> list[ObjectId]:
    object_ids: list[ObjectId] = []
    for i, id_str in enumerate(ids):
        try:
            if not id_str or not isinstance(id_str, str) or len(id_str) != 24:
                raise ValueError("invalid id")
            object_ids.append(ObjectId(id_str))
        except Exception:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid application ID at index {i}: '{id_str}'",
            )
    return object_ids


def _fill_questionnaire_template(
    template: str,
    *,
    candidate_name: str,
    position_title: str,
    questionnaire_link: str,
    sender_first_name: str,
) -> str:
    parts = (candidate_name or "there").strip().split()
    first_name = parts[0] if parts else "there"
    full_name = candidate_name.strip() or first_name
    replacements = {
        "[[candidate_first_name]]": first_name,
        "[[candidate_full_name]]": full_name,
        "[[questionnaire_link]]": questionnaire_link,
        "[[company_user_first_name]]": sender_first_name or "Recruiting",
        "[[position_title]]": position_title or "the role",
    }
    result = template
    for key, value in replacements.items():
        result = result.replace(key, value)
    return result


@router.put("/applications/bulk-tags")
async def bulk_update_application_tags(
    payload: ApplicationBulkTagsUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Add and/or remove tags on selected applications."""
    add_tags = _normalize_tag_list(payload.add)
    remove_tags = {tag.lower() for tag in _normalize_tag_list(payload.remove)}
    if not add_tags and not remove_tags:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one tag to add or remove",
        )

    db = get_database()
    object_ids = _parse_application_object_ids(payload.ids)
    applications = await db.applications.find({"_id": {"$in": object_ids}}).to_list(
        length=len(object_ids)
    )
    if not applications:
        raise HTTPException(status_code=404, detail="No applications found")

    now = datetime.utcnow()
    updated = 0
    for application in applications:
        _assert_application_visible(application, current_user)
        current = _normalize_tag_list(application.get("tags"))
        next_tags = [tag for tag in current if tag.lower() not in remove_tags]
        existing_keys = {tag.lower() for tag in next_tags}
        for tag in add_tags:
            if tag.lower() not in existing_keys:
                next_tags.append(tag)
                existing_keys.add(tag.lower())
        if next_tags == current:
            continue
        await db.applications.update_one(
            {"_id": application["_id"]},
            {"$set": {"tags": next_tags, "updatedAt": now}},
        )
        updated += 1

    await log_bulk_operation(
        db,
        current_user,
        action="updated",
        resource_type="application_tags",
        count=updated,
        detail=f"add={len(add_tags)} remove={len(remove_tags)}",
    )
    return {
        "message": f"Updated tags on {updated} candidate(s)",
        "updated_count": updated,
        "matched_count": len(applications),
    }


@router.post("/applications/merge")
async def merge_applications(
    payload: ApplicationMergeRequest,
    current_user: dict = Depends(get_current_admin_user),
):
    """Merge source applications into a primary application, then delete sources."""
    primary_id = payload.primaryId.strip()
    source_ids = [sid.strip() for sid in payload.sourceIds if sid and sid.strip()]
    source_ids = [sid for sid in source_ids if sid != primary_id]
    if not source_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one other candidate to merge into the primary",
        )

    db = get_database()
    primary = await _get_application_or_404(db, primary_id)
    _assert_application_visible(primary, current_user)

    source_oids = _parse_application_object_ids(source_ids)
    sources = await db.applications.find({"_id": {"$in": source_oids}}).to_list(
        length=len(source_oids)
    )
    if len(sources) != len(source_oids):
        raise HTTPException(status_code=404, detail="One or more source candidates were not found")

    for source in sources:
        _assert_application_visible(source, current_user)

    fill_fields = (
        "phoneNumber",
        "location",
        "salary",
        "cvUrl",
        "resumeUrl",
        "experience",
        "hearAbout",
        "otherSource",
        "email",
        "name",
        "fullName",
    )
    updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
    for field in fill_fields:
        current = primary.get(field)
        if current not in (None, "", []):
            continue
        for source in sources:
            value = source.get(field)
            if value not in (None, "", []):
                updates[field] = value
                break

    tags = _normalize_tag_list(primary.get("tags"))
    for source in sources:
        tags = _normalize_tag_list([*tags, *(_normalize_tag_list(source.get("tags")))])
    updates["tags"] = tags

    assignee_map: Dict[str, Dict[str, Any]] = {}
    for member in serialize_assignees(primary.get("assignedHiringTeam") or []):
        assignee_map[str(member.get("id"))] = member
    for source in sources:
        for member in serialize_assignees(source.get("assignedHiringTeam") or []):
            assignee_map[str(member.get("id"))] = member
    if assignee_map:
        updates["assignedHiringTeam"] = list(assignee_map.values())

    followed: set[str] = {
        str(uid) for uid in (primary.get("followedBy") or []) if uid is not None
    }
    for source in sources:
        for uid in source.get("followedBy") or []:
            if uid is not None:
                followed.add(str(uid))
    updates["followedBy"] = list(followed)

    history = list(primary.get("statusHistory") or [])
    for source in sources:
        for entry in source.get("statusHistory") or []:
            history.append(entry)
    if history:
        updates["statusHistory"] = history

    await db.applications.update_one({"_id": primary["_id"]}, {"$set": updates})

    for source_id in source_ids:
        await db.application_comments.update_many(
            {"applicationId": source_id},
            {"$set": {"applicationId": primary_id}},
        )
        await db.application_emails.update_many(
            {"applicationId": source_id},
            {"$set": {"applicationId": primary_id}},
        )
        await db.application_tasks.update_many(
            {"applicationId": source_id},
            {"$set": {"applicationId": primary_id}},
        )

    delete_result = await db.applications.delete_many({"_id": {"$in": source_oids}})

    await log_custom_action(
        db,
        current_user,
        action="merged",
        resource_type="application",
        detail=f"merged {delete_result.deleted_count} into {primary_id}",
        resource_title=applicant_display_name(primary),
        resource_id=primary_id,
    )

    return {
        "message": f"Merged {delete_result.deleted_count} candidate(s) into primary",
        "primaryId": primary_id,
        "merged_count": delete_result.deleted_count,
        "deleted_ids": source_ids,
    }


@router.post("/applications/send-questionnaire")
async def send_application_questionnaire(
    payload: ApplicationSendQuestionnaireRequest,
    current_user: dict = Depends(get_current_admin_user),
):
    """Email a position questionnaire to selected candidates."""
    if not is_email_configured():
        raise HTTPException(
            status_code=503,
            detail="Email delivery is not configured. Set it up in Admin → Settings → Email delivery.",
        )

    db = get_database()
    try:
        job = await db.jobpostings.find_one({"_id": ObjectId(payload.jobId)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")

    questionnaires = job.get("questionnaires") or []
    if not isinstance(questionnaires, list):
        questionnaires = []
    questionnaire = next(
        (
            item
            for item in questionnaires
            if isinstance(item, dict)
            and str(item.get("id") or "") == payload.questionnaireId
        ),
        None,
    )
    if not questionnaire:
        raise HTTPException(
            status_code=404,
            detail="Questionnaire not found on this position",
        )

    title = str(questionnaire.get("title") or "Questionnaire").strip() or "Questionnaire"
    template = str(
        questionnaire.get("emailTemplate")
        or (
            "Hi [[candidate_first_name]],\n\n"
            "Please complete this questionnaire for [[position_title]]:\n\n"
            "[[questionnaire_link]]\n\n"
            "Thank you,\n[[company_user_first_name]]"
        )
    )
    position_title = str(job.get("title") or "the role")
    frontend = get_frontend_url().rstrip("/")
    questionnaire_link = (
        f"{frontend}/dashboard/apply/{payload.jobId}"
        f"?questionnaire={payload.questionnaireId}"
    )
    sender_name = author_display_name(current_user)
    sender_first = (sender_name or "Recruiting").split()[0]
    author_id = _current_user_id(current_user)
    now = datetime.utcnow()

    object_ids = _parse_application_object_ids(payload.ids)
    applications = await db.applications.find({"_id": {"$in": object_ids}}).to_list(
        length=len(object_ids)
    )
    if not applications:
        raise HTTPException(status_code=404, detail="No applications found")

    sent = 0
    failed: list[str] = []
    skipped: list[str] = []

    for application in applications:
        _assert_application_visible(application, current_user)
        application_id = str(application["_id"])
        recipient = resolve_application_email(application)
        if not recipient or not is_valid_email_address(recipient):
            skipped.append(application_id)
            continue

        body = _fill_questionnaire_template(
            template,
            candidate_name=applicant_display_name(application),
            position_title=position_title,
            questionnaire_link=questionnaire_link,
            sender_first_name=sender_first,
        )
        subject = f"Please complete: {title} — {position_title}"
        html_body = plain_text_to_email_html(body, subject=subject)
        ok = await asyncio.to_thread(
            send_generic_email,
            recipient,
            subject,
            html_body,
            skip_log=True,
        )
        doc = {
            "applicationId": application_id,
            "jobId": payload.jobId,
            "channel": "email",
            "to": recipient.lower(),
            "subject": subject,
            "body": body,
            "status": "sent" if ok else "failed",
            "error": None if ok else "Email delivery failed",
            "sentById": author_id,
            "sentByName": sender_name,
            "sentByEmail": str(current_user.get("email") or ""),
            "sentAt": now,
            "kind": "questionnaire",
            "questionnaireId": payload.questionnaireId,
        }
        await db.application_emails.insert_one(doc)
        if ok:
            sent += 1
        else:
            failed.append(application_id)

    await log_custom_action(
        db,
        current_user,
        action="sent",
        resource_type="application_questionnaire",
        detail=f"sent={sent} failed={len(failed)} skipped={len(skipped)}",
        resource_title=title,
        resource_id=payload.jobId,
    )

    if sent == 0 and failed:
        raise HTTPException(
            status_code=502,
            detail="Failed to send questionnaire emails. Check email delivery settings.",
        )
    if sent == 0 and skipped and not failed:
        raise HTTPException(
            status_code=400,
            detail="Selected candidates have no valid email addresses",
        )

    return {
        "message": f"Sent questionnaire to {sent} candidate(s)",
        "sent_count": sent,
        "failed_ids": failed,
        "skipped_ids": skipped,
        "questionnaireId": payload.questionnaireId,
        "jobId": payload.jobId,
    }


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

        _assert_application_visible(application, current_user)

        # Convert ObjectIds
        application["id"] = str(application.pop("_id"))
        if "userId" in application:
            application["userId"] = str(application["userId"]) if not isinstance(application["userId"], str) else application["userId"]
        if "jobId" in application and not isinstance(application["jobId"], str):
            try:
                application["jobId"] = str(application["jobId"])
            except Exception:
                pass
        if "assignedHiringTeam" in application:
            application["assignedHiringTeam"] = serialize_assignees(
                application.get("assignedHiringTeam")
            )
        if application.get("privateOwnerId") is not None:
            application["privateOwnerId"] = str(application["privateOwnerId"])

        followed_by = [
            str(uid)
            for uid in (application.get("followedBy") or [])
            if uid is not None
        ]
        application["followedBy"] = followed_by
        application["isFollowed"] = _current_user_id(current_user) in followed_by

        application["statusHistory"] = await resolve_status_history_changed_by(
            db, application.get("statusHistory")
        )

        return application
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_admin_application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/applications/{application_id}/extract-contact")
async def extract_application_contact_from_cv(
    application_id: str,
    payload: Optional[Dict[str, Any]] = Body(default=None),
    current_user: dict = Depends(get_current_admin_user),
):
    """Extract contact + experience from the CV and fill empty application fields."""
    from app.lib.cv_contact_extract import sync_application_contact_from_cv

    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    force = bool((payload or {}).get("force"))
    try:
        sync_result = await sync_application_contact_from_cv(
            db, application, force=force
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("CV contact extract failed for %s: %s", application_id, exc)
        raise HTTPException(
            status_code=500, detail="Failed to extract contact from CV"
        ) from exc

    updated = await db.applications.find_one({"_id": application["_id"]})
    if not updated:
        raise HTTPException(status_code=404, detail="Application not found")

    updated["id"] = str(updated.pop("_id"))
    if "userId" in updated and not isinstance(updated["userId"], str):
        updated["userId"] = str(updated["userId"])
    if "jobId" in updated and not isinstance(updated["jobId"], str):
        try:
            updated["jobId"] = str(updated["jobId"])
        except Exception:
            pass
    if "assignedHiringTeam" in updated:
        updated["assignedHiringTeam"] = serialize_assignees(
            updated.get("assignedHiringTeam")
        )

    return {
        "updated": sync_result.get("updated", False),
        "skipped": sync_result.get("skipped"),
        "filled": sync_result.get("filled") or {},
        "extracted": sync_result.get("extracted") or {},
        "experience": sync_result.get("experience") or {},
        "application": updated,
    }

async def _get_application_or_404(db, application_id: str) -> dict:
    try:
        application = await db.applications.find_one({"_id": ObjectId(application_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID format")
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.get("/applications/{application_id}/comments")
async def list_application_comments(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """List team discussion comments for an application."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    cursor = db.application_comments.find({"applicationId": application_id}).sort(
        "createdAt", 1
    )
    comments = [format_comment_document(doc) async for doc in cursor]
    return {"comments": comments}


@router.post("/applications/{application_id}/comments")
async def create_application_comment(
    application_id: str,
    payload: ApplicationCommentCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Post a team discussion comment on an application."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    parent_id: str | None = None
    if payload.parentId:
        try:
            parent_oid = parse_object_id(payload.parentId, field_name="parentId")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid parent comment ID")
        parent = await db.application_comments.find_one(
            {"_id": parent_oid, "applicationId": application_id}
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        parent_id = str(parent_oid)

    job_id = str(application.get("jobId") or "")
    author_id = str(current_user.get("_id", current_user.get("id", "")))
    now = datetime.utcnow()
    mentions = serialize_mentions(payload.mentions)

    doc = {
        "applicationId": application_id,
        "jobId": job_id or None,
        "body": body,
        "parentId": parent_id,
        "authorId": author_id,
        "authorName": author_display_name(current_user),
        "authorEmail": str(current_user.get("email") or ""),
        "mentions": mentions,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.application_comments.insert_one(doc)
    doc["_id"] = result.inserted_id

    if mentions:
        job_title = str(application.get("jobTitle") or application.get("position") or "")
        if not job_title and job_id:
            try:
                job = await db.jobs.find_one({"_id": ObjectId(job_id)})
                if job:
                    job_title = str(job.get("title") or "")
            except Exception:
                job_title = ""

        await notify_mentioned_users(
            db,
            mentions=mentions,
            author=current_user,
            application=application,
            job_id=job_id,
            application_id=application_id,
            comment_body=body,
            job_title=job_title,
        )

    return format_comment_document(doc)


@router.post("/applications/{application_id}/comments/summarize")
async def summarize_application_comments(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """AI-summarize the team discussion thread for an application."""
    from app.lib.nvidia_ai import nvidia_chat_completion

    db = get_database()
    application = await _get_application_or_404(db, application_id)

    cursor = db.application_comments.find({"applicationId": application_id}).sort(
        "createdAt", 1
    )
    comments = [format_comment_document(doc) async for doc in cursor]
    if not comments:
        return {
            "summary": "There are no discussion messages to summarize yet.",
            "commentCount": 0,
        }

    candidate_name = (
        application.get("fullName")
        or application.get("name")
        or application.get("email")
        or "the candidate"
    )
    job_title = str(
        application.get("jobTitle") or application.get("position") or ""
    ).strip()

    thread_lines: list[str] = []
    for comment in comments:
        author = str(comment.get("authorName") or "Team member")
        created = str(comment.get("createdAt") or "")
        body = str(comment.get("body") or "").strip()
        thread_lines.append(f"[{created}] {author}: {body}")

    thread_text = "\n".join(thread_lines)
    if len(thread_text) > 12000:
        thread_text = thread_text[-12000:]

    role_context = f" for the role '{job_title}'" if job_title else ""
    system_prompt = (
        "You are an assistant helping a hiring team. Summarize the team discussion "
        "about a candidate in 3–6 concise bullet points. Capture decisions, concerns, "
        "follow-ups, and overall sentiment. Do not invent facts. Keep names when useful."
    )
    user_prompt = (
        f"Candidate: {candidate_name}{role_context}.\n\n"
        f"Discussion thread:\n{thread_text}"
    )

    try:
        summary = await nvidia_chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=500,
        )
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("Discussion summarize failed for %s", application_id)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to summarize discussion: {error}",
        ) from error

    return {"summary": summary, "commentCount": len(comments)}


@router.patch("/applications/{application_id}/comments/{comment_id}")
async def update_application_comment(
    application_id: str,
    comment_id: str,
    payload: ApplicationCommentUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Edit your own team discussion comment."""
    db = get_database()
    await _get_application_or_404(db, application_id)

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    try:
        comment_oid = parse_object_id(comment_id, field_name="commentId")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    existing = await db.application_comments.find_one(
        {"_id": comment_oid, "applicationId": application_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found")

    author_id = str(current_user.get("_id", current_user.get("id", "")))
    if str(existing.get("authorId")) != author_id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    mentions = serialize_mentions(payload.mentions)
    now = datetime.utcnow()

    await db.application_comments.update_one(
        {"_id": comment_oid},
        {"$set": {"body": body, "mentions": mentions, "updatedAt": now}},
    )

    updated = await db.application_comments.find_one({"_id": comment_oid})
    return format_comment_document(updated)


@router.delete("/applications/{application_id}/comments/{comment_id}")
async def delete_application_comment(
    application_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Delete your own team discussion comment and its replies."""
    db = get_database()
    await _get_application_or_404(db, application_id)

    try:
        comment_oid = parse_object_id(comment_id, field_name="commentId")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    existing = await db.application_comments.find_one(
        {"_id": comment_oid, "applicationId": application_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found")

    author_id = str(current_user.get("_id", current_user.get("id", "")))
    if str(existing.get("authorId")) != author_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    comment_id_str = str(comment_oid)
    ids_to_delete = {comment_id_str}
    queue = [comment_id_str]
    while queue:
        parent_id = queue.pop()
        child_cursor = db.application_comments.find(
            {"applicationId": application_id, "parentId": parent_id},
            {"_id": 1},
        )
        async for child in child_cursor:
            child_id = str(child["_id"])
            if child_id not in ids_to_delete:
                ids_to_delete.add(child_id)
                queue.append(child_id)

    object_ids = [ObjectId(value) for value in ids_to_delete]
    await db.application_comments.delete_many(
        {"applicationId": application_id, "_id": {"$in": object_ids}}
    )

    return {"message": "Comment deleted"}


@router.get("/applications/{application_id}/emails")
async def list_application_emails(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """List emails (and future SMS) sent to a candidate from their profile."""
    db = get_database()
    await _get_application_or_404(db, application_id)

    cursor = db.application_emails.find({"applicationId": application_id}).sort(
        "sentAt", -1
    )
    messages = [format_email_document(doc) async for doc in cursor]
    return {"messages": messages}


@router.post("/applications/{application_id}/emails")
async def send_application_email(
    application_id: str,
    payload: ApplicationEmailCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Send an email to the candidate and store it on their Email / SMS thread."""
    if not is_email_configured():
        raise HTTPException(
            status_code=503,
            detail="Email delivery is not configured. Set it up in Admin → Settings → Email delivery.",
        )

    db = get_database()
    application = await _get_application_or_404(db, application_id)

    subject = payload.subject.strip()
    body = payload.body.strip()
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Subject and body are required")

    recipient = (payload.to or "").strip() or resolve_application_email(application)
    if not recipient:
        raise HTTPException(
            status_code=400,
            detail="This candidate has no email address on file",
        )
    if not is_valid_email_address(recipient):
        raise HTTPException(status_code=400, detail="Invalid recipient email address")

    html_body = plain_text_to_email_html(body, subject=subject)
    ok = await asyncio.to_thread(
        send_generic_email,
        recipient,
        subject,
        html_body,
        skip_log=True,
    )

    job_id = str(application.get("jobId") or "")
    author_id = str(current_user.get("_id", current_user.get("id", "")))
    now = datetime.utcnow()
    status_value = "sent" if ok else "failed"
    error_message = None if ok else "Email delivery failed"

    doc = {
        "applicationId": application_id,
        "jobId": job_id or None,
        "channel": "email",
        "to": recipient.lower(),
        "subject": subject,
        "body": body,
        "status": status_value,
        "error": error_message,
        "sentById": author_id,
        "sentByName": author_display_name(current_user),
        "sentByEmail": str(current_user.get("email") or ""),
        "sentAt": now,
    }

    result = await db.application_emails.insert_one(doc)
    doc["_id"] = result.inserted_id
    formatted = format_email_document(doc)

    if ok:
        await log_custom_action(
            db,
            current_user,
            action="sent",
            resource_type="application_email",
            detail=f"to {recipient} — {subject[:80]}",
            resource_title=subject,
            resource_id=application_id,
        )
        return formatted

    raise HTTPException(
        status_code=502,
        detail="Failed to send email. Check email delivery settings and try again.",
    )


@router.get("/inbox/conversations")
async def list_inbox_conversations(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_admin_user),
):
    """Aggregate application emails into inbox conversations by candidate."""
    db = get_database()
    user_id = _current_user_id(current_user)

    pipeline: List[Dict[str, Any]] = [
        {"$sort": {"sentAt": -1}},
        {
            "$group": {
                "_id": "$applicationId",
                "lastMessage": {"$first": "$$ROOT"},
                "messageCount": {"$sum": 1},
            }
        },
        {"$sort": {"lastMessage.sentAt": -1}},
        {"$limit": limit},
    ]

    groups = await db.application_emails.aggregate(pipeline).to_list(length=limit)
    if not groups:
        return {"conversations": []}

    application_oids: List[ObjectId] = []
    for group in groups:
        app_id = str(group.get("_id") or "")
        if app_id and ObjectId.is_valid(app_id):
            application_oids.append(ObjectId(app_id))

    apps_by_id: Dict[str, dict] = {}
    if application_oids:
        async for app in db.applications.find(
            {
                "$and": [
                    {"_id": {"$in": application_oids}},
                    _private_visibility_filter(user_id),
                ]
            },
            {
                "fullName": 1,
                "name": 1,
                "email": 1,
                "Email": 1,
                "applicantEmail": 1,
                "answers": 1,
                "jobId": 1,
                "position": 1,
                "status": 1,
            },
        ):
            apps_by_id[str(app["_id"])] = app

    job_oids: List[ObjectId] = []
    for app in apps_by_id.values():
        raw_job = app.get("jobId")
        job_id = str(raw_job) if raw_job else ""
        if job_id and ObjectId.is_valid(job_id):
            job_oids.append(ObjectId(job_id))

    job_titles: Dict[str, str] = {}
    if job_oids:
        async for job in db.jobs.find(
            {"_id": {"$in": list(set(job_oids))}},
            {"title": 1},
        ):
            title = str(job.get("title") or "").strip()
            if title:
                job_titles[str(job["_id"])] = title

    conversations: List[Dict[str, Any]] = []
    for group in groups:
        application_id = str(group.get("_id") or "")
        application = apps_by_id.get(application_id)
        if not application:
            continue

        last_doc = group.get("lastMessage") or {}
        last_message = format_email_document(last_doc)
        job_id = str(application.get("jobId") or last_message.get("jobId") or "") or None
        position = (
            job_titles.get(job_id or "")
            or str(application.get("position") or "").strip()
            or None
        )
        candidate_email = (
            resolve_application_email(application)
            or str(last_message.get("to") or "")
        )

        conversations.append(
            {
                "applicationId": application_id,
                "jobId": job_id,
                "candidateName": applicant_display_name(application),
                "candidateEmail": candidate_email,
                "position": position,
                "status": str(application.get("status") or ""),
                "messageCount": int(group.get("messageCount") or 0),
                "lastMessage": last_message,
            }
        )

    return {"conversations": conversations}


@router.get("/applications/{application_id}/tasks")
async def list_application_tasks(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """List tasks tied to an application."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    cursor = db.application_tasks.find({"applicationId": application_id}).sort(
        "createdAt", -1
    )
    tasks = [format_task_document(doc) async for doc in cursor]
    return {"tasks": tasks}


@router.post("/applications/{application_id}/tasks")
async def create_application_task(
    application_id: str,
    payload: ApplicationTaskCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Create a task tied to an application."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title is required")

    now = datetime.utcnow()
    doc = {
        "applicationId": application_id,
        "jobId": str(application.get("jobId") or "") or None,
        "title": title,
        "dueAt": payload.dueAt,
        "completed": False,
        "createdById": _current_user_id(current_user),
        "createdByName": author_display_name(current_user),
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.application_tasks.insert_one(doc)
    doc["_id"] = result.inserted_id

    await log_custom_action(
        db,
        current_user,
        action="created",
        resource_type="application_task",
        detail=title[:120],
        resource_title=title,
        resource_id=application_id,
    )
    return format_task_document(doc)


@router.patch("/applications/{application_id}/tasks/{task_id}")
async def update_application_task(
    application_id: str,
    task_id: str,
    payload: ApplicationTaskUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Update a task tied to an application."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    try:
        task_oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format")

    updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Task title is required")
        updates["title"] = title
    if payload.dueAt is not None:
        updates["dueAt"] = payload.dueAt
    if payload.completed is not None:
        updates["completed"] = payload.completed

    result = await db.application_tasks.find_one_and_update(
        {"_id": task_oid, "applicationId": application_id},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return format_task_document(result)


@router.get("/my-tasks")
async def list_my_incomplete_tasks(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_admin_user),
):
    """List incomplete application tasks created by the current admin."""
    db = get_database()
    user_id = _current_user_id(current_user)
    if not user_id:
        return {"tasks": []}

    cursor = (
        db.application_tasks.find(
            {"createdById": user_id, "completed": {"$ne": True}}
        )
        .sort([("dueAt", 1), ("createdAt", -1)])
        .limit(limit)
    )
    docs = [doc async for doc in cursor]
    application_ids: list[ObjectId] = []
    for doc in docs:
        app_id = str(doc.get("applicationId") or "")
        if app_id and ObjectId.is_valid(app_id):
            application_ids.append(ObjectId(app_id))

    apps_by_id: Dict[str, dict] = {}
    if application_ids:
        async for app in db.applications.find(
            {"_id": {"$in": application_ids}},
            {"fullName": 1, "name": 1, "email": 1, "jobId": 1},
        ):
            apps_by_id[str(app["_id"])] = app

    tasks = []
    for doc in docs:
        app_id = str(doc.get("applicationId") or "")
        application = apps_by_id.get(app_id)
        job_id = None
        candidate_name = None
        if application:
            candidate_name = applicant_display_name(application)
            raw_job = application.get("jobId")
            job_id = str(raw_job) if raw_job else None
        elif doc.get("jobId"):
            job_id = str(doc.get("jobId"))
        tasks.append(
            format_task_document(
                doc, candidate_name=candidate_name, job_id=job_id
            )
        )
    return {"tasks": tasks}


@router.get("/tasks")
async def list_admin_tasks(
    filter: str = Query("mine", regex="^(mine|team|completed)$"),
    limit: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(get_current_admin_user),
):
    """List workspace admin tasks filtered by mine / team / completed."""
    db = get_database()
    user_id = _current_user_id(current_user)
    query = build_admin_tasks_filter(filter_key=filter, user_id=user_id)
    cursor = (
        db.admin_tasks.find(query)
        .sort([("dueDate", 1), ("createdAt", -1)])
        .limit(limit)
    )
    tasks = [format_admin_task_document(doc) async for doc in cursor]
    return {"tasks": tasks, "filter": filter}


@router.post("/tasks")
async def create_admin_task(
    payload: AdminTaskCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Create a workspace admin task."""
    db = get_database()
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title is required")

    description = (payload.description or "").strip()
    if len(description) > 2000:
        raise HTTPException(
            status_code=400, detail="Description must be 2000 characters or fewer"
        )

    assignee_id, assignee_name = resolve_assignee_name(
        assignee_id=payload.assigneeId,
        assignee_name=payload.assigneeName,
        current_user=current_user,
    )

    if assignee_id and not assignee_name:
        try:
            user_doc = await db.users.find_one(
                {"_id": ObjectId(assignee_id)},
                {"name": 1, "firstName": 1, "lastName": 1, "email": 1},
            )
        except Exception:
            user_doc = None
        if user_doc:
            assignee_name = author_display_name(user_doc)

    now = datetime.utcnow()
    doc = {
        "title": title,
        "description": description,
        "assigneeId": assignee_id,
        "assigneeName": assignee_name,
        "dueDate": payload.dueDate,
        "status": "open",
        "positionId": (payload.positionId or "").strip() or None,
        "createdById": _current_user_id(current_user),
        "createdByName": author_display_name(current_user),
        "createdAt": now,
        "updatedAt": now,
        "completedAt": None,
    }
    result = await db.admin_tasks.insert_one(doc)
    doc["_id"] = result.inserted_id

    await log_custom_action(
        db,
        current_user,
        action="created",
        resource_type="admin_task",
        detail=title[:120],
        resource_title=title,
        resource_id=str(result.inserted_id),
    )
    return format_admin_task_document(doc)


@router.patch("/tasks/{task_id}")
async def update_admin_task(
    task_id: str,
    payload: AdminTaskUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Update a workspace admin task (complete, reassign, edit)."""
    db = get_database()
    try:
        task_oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format")

    updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Task title is required")
        updates["title"] = title
    if payload.description is not None:
        description = payload.description.strip()
        if len(description) > 2000:
            raise HTTPException(
                status_code=400,
                detail="Description must be 2000 characters or fewer",
            )
        updates["description"] = description
    if payload.assigneeId is not None or payload.assigneeName is not None:
        assignee_id, assignee_name = resolve_assignee_name(
            assignee_id=payload.assigneeId,
            assignee_name=payload.assigneeName,
            current_user=current_user,
        )
        if assignee_id and not assignee_name:
            try:
                user_doc = await db.users.find_one(
                    {"_id": ObjectId(assignee_id)},
                    {"name": 1, "firstName": 1, "lastName": 1, "email": 1},
                )
            except Exception:
                user_doc = None
            if user_doc:
                assignee_name = author_display_name(user_doc)
        updates["assigneeId"] = assignee_id
        updates["assigneeName"] = assignee_name
    if payload.dueDate is not None:
        updates["dueDate"] = payload.dueDate
    if payload.positionId is not None:
        updates["positionId"] = payload.positionId.strip() or None
    if payload.status is not None:
        updates["status"] = payload.status
        if payload.status == "completed":
            updates["completedAt"] = datetime.utcnow()
        else:
            updates["completedAt"] = None

    result = await db.admin_tasks.find_one_and_update(
        {"_id": task_oid},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return format_admin_task_document(result)


@router.delete("/tasks/{task_id}")
async def delete_admin_task(
    task_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Delete a workspace admin task."""
    db = get_database()
    try:
        task_oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format")

    existing = await db.admin_tasks.find_one({"_id": task_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.admin_tasks.delete_one({"_id": task_oid})
    await log_custom_action(
        db,
        current_user,
        action="deleted",
        resource_type="admin_task",
        detail=str(existing.get("title") or "")[:120],
        resource_title=str(existing.get("title") or "Task"),
        resource_id=task_id,
    )
    return {"success": True, "id": task_id}


def _require_content_module(current_user: dict) -> None:
    if not has_admin_module(current_user, "content"):
        raise HTTPException(
            status_code=403,
            detail="Content module access required",
        )


@router.get("/documents")
async def list_company_documents(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(get_current_admin_user),
):
    """List company documents with optional category and search filters."""
    _require_content_module(current_user)
    db = get_database()
    query = build_documents_query(category=category, search=search)
    cursor = (
        db.company_documents.find(query)
        .sort([("updatedAt", -1), ("createdAt", -1)])
        .limit(limit)
    )
    documents = [format_company_document(doc) async for doc in cursor]
    return {"documents": documents}


@router.post("/documents")
async def create_company_document(
    payload: CompanyDocumentCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Persist metadata for a document already uploaded to storage."""
    _require_content_module(current_user)
    db = get_database()
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Document title is required")

    description = (payload.description or "").strip()
    file_url = payload.fileUrl.strip()
    file_name = payload.fileName.strip()
    if not file_url or not file_name:
        raise HTTPException(status_code=400, detail="File URL and name are required")

    detected = detect_document_format(file_name)
    fmt = payload.format.upper()
    if detected and detected != fmt:
        fmt = detected
    if fmt not in ("PDF", "DOC", "XLS"):
        raise HTTPException(
            status_code=400,
            detail="Format must be PDF, DOC, or XLS",
        )

    now = datetime.utcnow()
    doc = {
        "title": title,
        "description": description,
        "category": payload.category,
        "format": fmt,
        "fileUrl": file_url,
        "fileName": file_name,
        "fileSize": int(payload.fileSize or 0),
        "authorId": _current_user_id(current_user),
        "authorName": author_display_name(current_user),
        "createdAt": now,
        "updatedAt": now,
        "lastAccessedAt": None,
    }
    result = await db.company_documents.insert_one(doc)
    doc["_id"] = result.inserted_id

    await log_custom_action(
        db,
        current_user,
        action="created",
        resource_type="company_document",
        detail=title[:120],
        resource_title=title,
        resource_id=str(result.inserted_id),
    )
    return format_company_document(doc)


@router.patch("/documents/{document_id}")
async def update_company_document(
    document_id: str,
    payload: CompanyDocumentUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Update document metadata."""
    _require_content_module(current_user)
    db = get_database()
    try:
        doc_oid = parse_document_object_id(document_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    updates: Dict[str, Any] = {"updatedAt": datetime.utcnow()}
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Document title is required")
        updates["title"] = title
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.category is not None:
        updates["category"] = payload.category

    if len(updates) == 1:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.company_documents.find_one_and_update(
        {"_id": doc_oid},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    return format_company_document(result)


@router.post("/documents/{document_id}/access")
async def mark_company_document_accessed(
    document_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Record that an admin opened a document (Recently Accessed)."""
    _require_content_module(current_user)
    db = get_database()
    try:
        doc_oid = parse_document_object_id(document_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    now = datetime.utcnow()
    result = await db.company_documents.find_one_and_update(
        {"_id": doc_oid},
        {"$set": {"lastAccessedAt": now}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    return format_company_document(result)


@router.delete("/documents/{document_id}")
async def delete_company_document(
    document_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Delete a company document record."""
    _require_content_module(current_user)
    db = get_database()
    try:
        doc_oid = parse_document_object_id(document_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    existing = await db.company_documents.find_one({"_id": doc_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.company_documents.delete_one({"_id": doc_oid})
    await log_custom_action(
        db,
        current_user,
        action="deleted",
        resource_type="company_document",
        detail=str(existing.get("title") or "")[:120],
        resource_title=str(existing.get("title") or "Document"),
        resource_id=document_id,
    )
    return {"success": True, "id": document_id}


@router.get("/my-agenda")
async def list_my_agenda(
    limit: int = Query(15, ge=1, le=50),
    current_user: dict = Depends(get_current_admin_user),
):
    """Upcoming interviews, assessments, and reminders for the current admin."""
    db = get_database()
    user_id = _current_user_id(current_user)
    now = datetime.utcnow()
    visibility = _private_visibility_filter(user_id)

    def parse_agenda_date(value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value.replace(tzinfo=None) if value.tzinfo else value
        if isinstance(value, str) and value.strip():
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
            except ValueError:
                return None
        return None

    query = {
        "$and": [
            visibility,
            {"isArchived": {"$ne": True}},
            {
                "$or": [
                    {"interviewDate": {"$exists": True, "$ne": None}},
                    {"assessmentDate": {"$exists": True, "$ne": None}},
                    {
                        "reminderAt": {"$exists": True, "$ne": None},
                        "reminderCreatedById": user_id,
                    },
                ]
            },
        ]
    }

    projection = {
        "fullName": 1,
        "name": 1,
        "email": 1,
        "jobId": 1,
        "jobTitle": 1,
        "position": 1,
        "interviewer": 1,
        "interviewDate": 1,
        "assessmentDate": 1,
        "reminderAt": 1,
        "reminderNote": 1,
        "reminderCreatedById": 1,
        "assignedHiringTeam": 1,
        "status": 1,
    }

    items: list[dict[str, Any]] = []
    async for application in db.applications.find(query, projection).limit(300):
        application_id = str(application["_id"])
        job_id = str(application.get("jobId") or "") or None
        candidate = applicant_display_name(application)
        position = (
            str(application.get("jobTitle") or application.get("position") or "").strip()
            or "Position"
        )
        href = candidate_profile_href(application_id, job_id)
        on_team = user_on_hiring_team(application, user_id)
        is_interviewer = interviewer_matches_user(
            application.get("interviewer"), current_user
        )
        owns_reminder = str(application.get("reminderCreatedById") or "") == user_id

        interview_date = parse_agenda_date(application.get("interviewDate"))
        if interview_date and interview_date >= now and (is_interviewer or on_team):
            items.append(
                {
                    "id": f"{application_id}-interview",
                    "type": "interview",
                    "title": f"Interview · {candidate}",
                    "subtitle": position,
                    "startsAt": interview_date.isoformat(),
                    "applicationId": application_id,
                    "jobId": job_id,
                    "href": href,
                }
            )

        assessment_date = parse_agenda_date(application.get("assessmentDate"))
        if assessment_date and assessment_date >= now and (is_interviewer or on_team):
            items.append(
                {
                    "id": f"{application_id}-assessment",
                    "type": "assessment",
                    "title": f"Assessment · {candidate}",
                    "subtitle": position,
                    "startsAt": assessment_date.isoformat(),
                    "applicationId": application_id,
                    "jobId": job_id,
                    "href": href,
                }
            )

        reminder_at = parse_agenda_date(application.get("reminderAt"))
        if reminder_at and reminder_at >= now and owns_reminder:
            note = str(application.get("reminderNote") or "").strip()
            items.append(
                {
                    "id": f"{application_id}-reminder",
                    "type": "reminder",
                    "title": f"Reminder · {candidate}",
                    "subtitle": note or position,
                    "startsAt": reminder_at.isoformat(),
                    "applicationId": application_id,
                    "jobId": job_id,
                    "href": href,
                }
            )

    items.sort(key=lambda item: item.get("startsAt") or "")
    trimmed = items[:limit]

    job_ids = [
        ObjectId(item["jobId"])
        for item in trimmed
        if item.get("jobId") and ObjectId.is_valid(str(item["jobId"]))
    ]
    titles_by_job: Dict[str, str] = {}
    if job_ids:
        async for job in db.jobs.find(
            {"_id": {"$in": job_ids}}, {"title": 1}
        ):
            title = str(job.get("title") or "").strip()
            if title:
                titles_by_job[str(job["_id"])] = title

    for item in trimmed:
        job_id = item.get("jobId")
        if job_id and item.get("subtitle") in ("Position", "", None):
            looked_up = titles_by_job.get(str(job_id))
            if looked_up:
                item["subtitle"] = looked_up

    return {"items": trimmed}


@router.post("/applications/{application_id}/request-application")
async def request_application_update(
    application_id: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Email the candidate asking them to complete or update their application."""
    if not is_email_configured():
        raise HTTPException(
            status_code=503,
            detail="Email delivery is not configured. Set it up in Admin → Settings → Email delivery.",
        )

    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    recipient = resolve_application_email(application)
    if not recipient or not is_valid_email_address(recipient):
        raise HTTPException(
            status_code=400,
            detail="This candidate has no email address on file",
        )

    applicant = applicant_display_name(application)
    position = application.get("position") or "the role"
    job_id = str(application.get("jobId") or "")
    frontend = get_frontend_url().rstrip("/")
    apply_url = (
        f"{frontend}/dashboard/apply/{job_id}"
        if job_id
        else f"{frontend}/careers/jobs"
    )

    subject = f"Please complete your application for {position}"
    body = (
        f"Hi {applicant},\n\n"
        f"Our recruiting team needs you to complete or update your application "
        f"for {position}.\n\n"
        f"Please use this link to continue:\n{apply_url}\n\n"
        f"Thank you,\nBQI Tech Recruiting"
    )
    html_body = plain_text_to_email_html(body, subject=subject)
    ok = await asyncio.to_thread(
        send_generic_email,
        recipient,
        subject,
        html_body,
        skip_log=True,
    )

    now = datetime.utcnow()
    author_id = _current_user_id(current_user)
    doc = {
        "applicationId": application_id,
        "jobId": job_id or None,
        "channel": "email",
        "to": recipient.lower(),
        "subject": subject,
        "body": body,
        "status": "sent" if ok else "failed",
        "error": None if ok else "Email delivery failed",
        "sentById": author_id,
        "sentByName": author_display_name(current_user),
        "sentByEmail": str(current_user.get("email") or ""),
        "sentAt": now,
        "kind": "request_application",
    }
    result = await db.application_emails.insert_one(doc)
    doc["_id"] = result.inserted_id
    formatted = format_email_document(doc)

    if not ok:
        raise HTTPException(
            status_code=502,
            detail="Failed to send email. Check email delivery settings and try again.",
        )

    await log_custom_action(
        db,
        current_user,
        action="sent",
        resource_type="application_request",
        detail=f"to {recipient}",
        resource_title=subject,
        resource_id=application_id,
    )
    return formatted


@router.post("/applications/{application_id}/reminders")
async def create_application_reminder(
    application_id: str,
    payload: ApplicationReminderCreate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Set a follow-up reminder on an application and notify the current admin."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    due_at = payload.dueAt
    if due_at.tzinfo is not None:
        due_at = due_at.replace(tzinfo=None)

    note = (payload.note or "").strip()
    applicant = applicant_display_name(application)
    user_id = _current_user_id(current_user)
    now = datetime.utcnow()

    await db.applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "reminderAt": due_at,
                "reminderNote": note or None,
                "reminderCreatedById": user_id,
                "reminderCreatedAt": now,
                "updatedAt": now,
            }
        },
    )

    due_label = due_at.strftime("%b %d, %Y %H:%M")
    message = f"Follow up on {applicant} by {due_label}"
    if note:
        message = f"{message}. {note}"

    notification_doc = {
        "title": f"Reminder: {applicant}",
        "message": message,
        "type": "info",
        "userId": user_id,
        "isRead": False,
        "read": False,
        "readBy": [],
        "createdAt": now,
        "updatedAt": now,
        "priority": "normal",
        "category": "reminder",
        "link": application_admin_link(application_id),
        "metadata": {
            "applicationId": application_id,
            "reminderAt": due_at.isoformat(),
            "category": "reminder",
        },
    }
    await db.notifications.insert_one(notification_doc)

    await log_custom_action(
        db,
        current_user,
        action="created",
        resource_type="application_reminder",
        detail=due_label,
        resource_title=applicant,
        resource_id=application_id,
    )

    return {
        "reminderAt": due_at.isoformat(),
        "reminderNote": note or None,
        "message": "Reminder set",
    }


@router.put("/applications/{application_id}/privacy")
async def update_application_privacy(
    application_id: str,
    payload: ApplicationPrivacyUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Mark an application private (owner-only) or make it visible again."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    user_id = _current_user_id(current_user)
    now = datetime.utcnow()
    if payload.isPrivate:
        updates = {
            "isPrivate": True,
            "privateOwnerId": user_id,
            "privateAt": now,
            "updatedAt": now,
        }
    else:
        updates = {
            "isPrivate": False,
            "privateOwnerId": None,
            "privateAt": None,
            "updatedAt": now,
        }

    await db.applications.update_one({"_id": application["_id"]}, {"$set": updates})

    await log_custom_action(
        db,
        current_user,
        action="updated",
        resource_type="application_privacy",
        detail="private" if payload.isPrivate else "public",
        resource_title=applicant_display_name(application),
        resource_id=application_id,
    )

    return {
        "isPrivate": payload.isPrivate,
        "privateOwnerId": user_id if payload.isPrivate else None,
    }


@router.put("/applications/{application_id}/assignees")
async def update_application_assignees(
    application_id: str,
    payload: ApplicationAssigneesUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Assign hiring-team reviewers to an application."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    assignees = serialize_assignees([item.model_dump() for item in payload.assignees])
    now = datetime.utcnow()
    await db.applications.update_one(
        {"_id": application["_id"]},
        {"$set": {"assignedHiringTeam": assignees, "updatedAt": now}},
    )

    await log_custom_action(
        db,
        current_user,
        action="updated",
        resource_type="application_assignees",
        detail=f"{len(assignees)} assignee(s)",
        resource_title=applicant_display_name(application),
        resource_id=application_id,
    )

    return {"assignedHiringTeam": assignees}


@router.put("/applications/{application_id}/follow")
async def update_application_follow(
    application_id: str,
    payload: ApplicationFollowUpdate,
    current_user: dict = Depends(get_current_admin_user),
):
    """Follow or unfollow a candidate application for the current admin."""
    db = get_database()
    application = await _get_application_or_404(db, application_id)
    _assert_application_visible(application, current_user)

    user_id = _current_user_id(current_user)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unable to resolve admin user")

    now = datetime.utcnow()
    if payload.followed:
        await db.applications.update_one(
            {"_id": application["_id"]},
            {
                "$addToSet": {"followedBy": user_id},
                "$set": {"updatedAt": now},
            },
        )
    else:
        await db.applications.update_one(
            {"_id": application["_id"]},
            {
                "$pull": {"followedBy": user_id},
                "$set": {"updatedAt": now},
            },
        )

    refreshed = await db.applications.find_one(
        {"_id": application["_id"]},
        {"followedBy": 1},
    )
    followed_by = [
        str(uid)
        for uid in ((refreshed or {}).get("followedBy") or [])
        if uid is not None
    ]

    await log_custom_action(
        db,
        current_user,
        action="updated",
        resource_type="application_follow",
        detail="followed" if payload.followed else "unfollowed",
        resource_title=applicant_display_name(application),
        resource_id=application_id,
    )

    return {
        "isFollowed": user_id in followed_by,
        "followedBy": followed_by,
    }


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
        status = normalize_application_status(data["status"])
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
        if status not in CANONICAL_APPLICATION_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status '{status}'. Must be one of: {', '.join(CANONICAL_APPLICATION_STATUSES)}")
            
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
        
        # Update application status in database (per-document for status history)
        current_time = datetime.utcnow()
        changed_by = current_user.get("email") or current_user.get("name") or "Admin"
        updated_apps = await db.applications.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))

        if not updated_apps:
            raise HTTPException(status_code=404, detail="No applications found to update")

        modified_count = 0
        for app in updated_apps:
            update_data = build_admin_status_update(
                app,
                status,
                changed_by=changed_by,
                reason=f"Bulk status update to {status}",
            )
            result = await db.applications.update_one({"_id": app["_id"]}, {"$set": update_data})
            modified_count += result.modified_count

        logger.info(f"Updated {modified_count} applications with status '{status}'")

        id_strings = [str(oid) for oid in object_ids]
        await db.cv_vault.update_many(
            {"applicationId": {"$in": id_strings}},
            {"$set": {"applicationStatus": status, "updatedAt": current_time}},
        )

        for app in updated_apps:
            applicant = applicant_display_name(app)
            position = app.get("position") or "a role"
            app_id = str(app["_id"])
            await create_system_admin_notification(
                db,
                title="Application status updated",
                message=f"{applicant} moved to {status} for {position}",
                notification_type="info",
                category="status_update",
                link=application_admin_link(app_id),
                metadata={
                    "applicationId": app_id,
                    "status": status,
                    "changedBy": changed_by,
                    "category": "status_update",
                },
            )

        await log_bulk_operation(
            db,
            current_user,
            action="updated",
            resource_type="application",
            count=modified_count,
            detail=f"{modified_count} applications set to status '{status}'",
        )
            
        return {
            "message": f"Successfully updated {modified_count} applications to status '{status}'",
            "updated_count": modified_count,
            "matched_count": len(updated_apps),
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
                if "timed out" in error_message.lower():
                    error_message = (
                        "AI analysis took too long and was stopped. "
                        "Try again in a moment — ranking one candidate at a time often works better."
                    )
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

            if len(results) == 1:
                app = await db.applications.find_one({"_id": ObjectId(str(results[0]["id"]))})
                applicant = applicant_display_name(app) if app else "Candidate"
                await create_system_admin_notification(
                    db,
                    title="AI ranking complete",
                    message=f"AI ranking complete for {applicant}",
                    notification_type="success",
                    category="ai_rank",
                    link=application_admin_link(str(results[0]["id"])),
                    metadata={
                        "applicationId": str(results[0]["id"]),
                        "aiRankScore": results[0].get("aiRankScore"),
                        "category": "ai_rank",
                    },
                )
            elif len(results) > 1:
                await create_system_admin_notification(
                    db,
                    title="AI ranking complete",
                    message=f"AI ranking complete for {len(results)} candidates",
                    notification_type="success",
                    category="ai_rank",
                    link="/admin/applications",
                    metadata={"rankedCount": len(results), "category": "ai_rank"},
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


@router.post("/applications/extract-contact-preview")
async def extract_contact_preview_from_cv(
    request: Request,
    current_user: dict = Depends(get_current_admin_user),
):
    """Extract name/email/phone/location from a CV without creating an application.

    Accepts JSON ``{ "cvUrl": "..." }`` or multipart ``file`` (optional ``cvUrl`` form field).
    """
    from app.lib.cv_contact_extract import preview_contact_from_cv

    content_type = (request.headers.get("content-type") or "").lower()
    cv_url = ""
    cv_bytes: Optional[bytes] = None
    filename = ""

    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            cv_url = str(form.get("cvUrl") or "").strip()
            upload = form.get("file")
            if upload is not None and hasattr(upload, "read"):
                cv_bytes = await upload.read()
                filename = str(getattr(upload, "filename", "") or "")
        else:
            body = await request.json()
            if not isinstance(body, dict):
                raise HTTPException(status_code=400, detail="Invalid request body")
            cv_url = str(body.get("cvUrl") or "").strip()
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("extract-contact-preview parse failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid request body") from exc

    if not cv_bytes and not cv_url:
        raise HTTPException(
            status_code=400,
            detail="Provide a resume file or cvUrl to extract contact fields",
        )

    try:
        preview = await preview_contact_from_cv(
            cv_url=cv_url or None,
            cv_bytes=cv_bytes,
            filename=filename,
        )
    except Exception as exc:
        logger.error("extract-contact-preview failed: %s", exc)
        raise HTTPException(
            status_code=500, detail="Failed to extract contact from resume"
        ) from exc

    return {
        "cvUrl": cv_url or None,
        **preview,
    }


@router.post("/applications/manual")
async def create_manual_application(
    request: Request,
    body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_admin_user),
):
    """Create an application manually from the admin pipeline."""
    from app.lib.cors import resolve_frontend_url
    from app.lib.cv_vault import create_manual_application_for_job

    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    job_id = str(body.get("jobId") or "").strip()
    email = str(body.get("email") or "").strip()
    name = str(body.get("name") or "").strip()
    status = str(body.get("status") or "New").strip()
    cv_url = str(body.get("cvUrl") or "").strip() or None
    phone_number = str(body.get("phoneNumber") or "").strip() or None
    location = str(body.get("location") or "").strip() or None

    if not job_id:
        raise HTTPException(status_code=400, detail="jobId is required")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    try:
        result = await create_manual_application_for_job(
            db,
            job_id,
            email=email,
            name=name,
            status=status,
            cv_url=cv_url,
            phone_number=phone_number,
            location=location,
            created_by=admin_actor_label(current_user),
            frontend_url=resolve_frontend_url(request.headers.get("origin")),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Manual application create failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create application")

    try:
        application = result.get("application") or {}
        applicant = applicant_display_name(application)
        position = application.get("position") or "a role"
        app_id = result.get("applicationId") or application.get("id")
        await create_system_admin_notification(
            db,
            title="Candidate added manually",
            message=f"{applicant} was added to {position}",
            notification_type="application",
            category="new_application",
            link=application_admin_link(str(app_id)) if app_id else "/admin/applications",
            priority="high",
            metadata={
                "applicationId": app_id,
                "jobId": job_id,
                "status": status,
                "category": "new_application",
                "source": "admin_manual",
            },
        )
    except Exception as notify_err:
        logger.error("Failed to create admin notification for manual application: %s", notify_err)

    return result


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
        for blocked_key in _APPLICATION_UPDATE_BLOCKLIST:
            update_data.pop(blocked_key, None)

        previous_status = normalize_application_status(existing.get("status"), "New")
        current_time = datetime.utcnow()
        changed_by = current_user.get("email") or current_user.get("name") or "Admin"

        raw_new_status = update_data.get("status")
        if raw_new_status is not None:
            new_status = normalize_application_status(raw_new_status)
            update_data["status"] = new_status
            status_fields = build_admin_status_update(
                existing,
                new_status,
                changed_by=changed_by,
                reason="Application updated from admin",
            )
            update_data.update(status_fields)
        else:
            new_status = None
            update_data["updatedAt"] = current_time

        result = await db.applications.update_one({"_id": obj_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")

        # When CV URL changes (or is set), re-extract contact into empty fields
        new_cv = update_data.get("cvUrl") or update_data.get("resumeUrl")
        old_cv = existing.get("cvUrl") or existing.get("resumeUrl") or ""
        if isinstance(new_cv, str) and new_cv.strip() and new_cv.strip() != (old_cv or "").strip():
            try:
                from app.lib.cv_contact_extract import sync_application_contact_from_cv

                refreshed = await db.applications.find_one({"_id": obj_id})
                if refreshed:
                    await sync_application_contact_from_cv(
                        db, refreshed, force=True
                    )
            except Exception as sync_err:
                logger.debug(
                    "CV contact sync after resume update failed for %s: %s",
                    application_id,
                    sync_err,
                )

        if new_status and new_status != previous_status:
            applicant = applicant_display_name(existing)
            position = existing.get("position") or update_data.get("position") or "a role"
            changed_by = current_user.get("email") or current_user.get("name") or "Admin"
            await create_system_admin_notification(
                db,
                title="Application status updated",
                message=f"{applicant} moved to {new_status} for {position}",
                notification_type="info",
                category="status_update",
                link=application_admin_link(application_id),
                metadata={
                    "applicationId": application_id,
                    "status": new_status,
                    "previousStatus": previous_status,
                    "changedBy": changed_by,
                    "category": "status_update",
                },
            )

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
    job_filter: Dict[str, Any] = {}
    if job_id:
        try:
            ObjectId(job_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid job ID format")
        job_title = await _resolve_job_posting_title(db, job_id)
        job_filter = _application_job_filter(job_id, job_title)
    
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
    job_id: Optional[str] = Query(None, description="Filter by specific job ID"),
    archived: bool = Query(
        False,
        description="When true, count archived applications only; otherwise active pipeline only",
    ),
):
    """Get applications grouped by job (active and inactive postings)."""
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")

        match_query = _archived_application_filter() if archived else _active_application_filter()
        if job_id:
            try:
                ObjectId(job_id)
            except InvalidId:
                raise HTTPException(status_code=400, detail="Invalid job ID format")
            job_title = await _resolve_job_posting_title(db, job_id)
            match_query = _apply_application_job_filter(match_query, job_id, job_title)

        match_query = _with_private_visibility(
            match_query, _current_user_id(current_user)
        )

        pipeline = [
            {"$match": match_query},
            _job_posting_lookup_stage(),
            {
                "$addFields": {
                    "jobDetails": {"$arrayElemAt": ["$jobDetails", 0]},
                }
            },
            {
                "$addFields": {
                    "effectivePosition": _effective_position_expr(),
                    "groupKey": {
                        "$cond": {
                            "if": {"$ne": ["$jobId", None]},
                            "then": {"$toString": "$jobId"},
                            "else": {
                                "$ifNull": ["$position", "unknown-position"]
                            },
                        }
                    },
                }
            },
            {
                "$group": {
                    "_id": "$groupKey",
                    "position": {"$first": "$effectivePosition"},
                    "jobId": {"$first": "$jobId"},
                    "department": {"$first": "$jobDetails.department"},
                    "isActive": {"$first": "$jobDetails.isActive"},
                    "count": {"$sum": 1},
                    "statuses": {"$push": "$status"},
                }
            },
            {"$sort": {"count": -1}},
        ]

        job_stats = await db.applications.aggregate(pipeline).to_list(length=None)

        result = []
        for stat in job_stats:
            try:
                position = _normalize_text_value(stat.get("position")) or "Unknown Position"
                if position in ("", "Position Not Available", "Unknown Position"):
                    continue

                status_breakdown: Dict[str, int] = {}
                for status in stat.get("statuses", []):
                    status_breakdown[status] = status_breakdown.get(status, 0) + 1

                job_id_value = stat.get("jobId")
                is_active = stat.get("isActive")
                if is_active is None and job_id_value is not None:
                    is_active = True

                job_data = {
                    "jobId": str(job_id_value) if job_id_value else None,
                    "position": position,
                    "title": position,
                    "department": stat.get("department") or "N/A",
                    "isActive": bool(is_active) if is_active is not None else None,
                    "totalApplications": stat["count"],
                    "count": stat["count"],
                    "statuses": stat.get("statuses", []),
                    "statusBreakdown": status_breakdown,
                }
                result.append(job_data)
            except Exception as e:
                logger.error(f"Error processing job stats: {str(e)}")
                continue

        response_data = {"applicationsByJob": result}
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
                },
                "bqiIntelligence": {
                    "applicantInsights": True,
                    "activitySummary": True,
                    "resumeAudit": True,
                    "helpMeWrite": False,
                    "candidateSourcing": False,
                },
                "admin_2fa_policy": "require_one",
                "admin_path_hidden": False,
                "admin_path_slug": None,
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
        try:
            from app.lib.admin_path import sanitize_admin_path_fields
            settings_data = sanitize_admin_path_fields(settings_data)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
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
    limit: int = Query(50, ge=1, le=100)
):
    """Get admin notifications"""
    db = get_database()

    user_id = str(current_user["_id"])
    scope_filter = admin_notification_scope_filter(user_id)

    notifications_cursor = db.notifications.find(scope_filter).skip(skip).limit(limit).sort("createdAt", -1)

    notifications = await notifications_cursor.to_list(length=limit)
    total = await db.notifications.count_documents(scope_filter)
    unread_count = await db.notifications.count_documents(
        admin_notification_unread_filter(user_id)
    )

    serialized: list[dict[str, Any]] = []
    for notification in notifications:
        convert_objectids_to_strings(notification)
        notification["id"] = str(notification.pop("_id", notification.get("id", "")))
        serialized.append(normalize_notification(notification, user_id))

    unread_in_page = sum(1 for item in serialized if not item["isRead"])
    unread_count = max(unread_count, unread_in_page)

    return JSONResponse(
        content=json.loads(
            json.dumps(
                {"notifications": serialized, "total": total, "unreadCount": unread_count},
                cls=CustomJSONEncoder,
            )
        )
    )

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
    user_id = str(current_user["_id"])

    scope = {
        "_id": ObjectId(notification_id),
        "$or": [
            {"userId": user_id},
            {"userId": {"$in": [None, ""]}},
            {"userId": {"$exists": False}},
        ],
    }
    existing = await db.notifications.find_one(scope)
    if not existing:
        raise HTTPException(status_code=404, detail="Notification not found")

    if is_system_wide_notification(existing):
        result = await db.notifications.update_one(
            scope,
            {"$addToSet": {"readBy": user_id}, "$set": {"updatedAt": datetime.utcnow()}},
        )
    else:
        result = await db.notifications.update_one(
            scope,
            {"$set": {"isRead": True, "read": True, "updatedAt": datetime.utcnow()}},
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
    user_id = str(current_user["_id"])
    scope_filter = admin_notification_scope_filter(user_id)
    now = datetime.utcnow()

    system_result = await db.notifications.update_many(
        {
            "$and": [
                scope_filter,
                {
                    "$or": [
                        {"userId": {"$in": [None, ""]}},
                        {"userId": {"$exists": False}},
                    ]
                },
            ]
        },
        {"$addToSet": {"readBy": user_id}, "$set": {"updatedAt": now}},
    )
    user_result = await db.notifications.update_many(
        {
            "$and": [
                scope_filter,
                {"userId": user_id},
            ]
        },
        {"$set": {"isRead": True, "read": True, "updatedAt": now}},
    )

    modified_count = system_result.modified_count + user_result.modified_count

    return {"message": f"Marked {modified_count} notifications as read"}

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
    """Search users by name, email, username, or role"""
    try:
        if not q.strip():
            return {"users": []}
            
        db = get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        search_term = q.strip()
        # Create case-insensitive regex for search
        search_regex = {"$regex": search_term, "$options": "i"}
        
        # Search in multiple fields (including role for partial matches like "adm")
        or_clauses = [
            {"name": search_regex},
            {"email": search_regex},
            {"firstName": search_regex},
            {"lastName": search_regex},
            {"username": search_regex},
            {"role": search_regex},
        ]

        # Map UI labels (e.g. "Administrator", "Super Admin") to stored roles
        role_matches = roles_matching_search_query(search_term)
        if role_matches:
            role_pattern = "|".join(re.escape(role) for role in role_matches)
            or_clauses.append(
                {"role": {"$regex": f"^({role_pattern})$", "$options": "i"}}
            )

        query = {"$or": or_clauses}
        
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


@router.post("/job-postings/ai/generate-description")
async def ai_generate_job_description(
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user),
):
    """Generate or refine an HTML job description from hiring notes.

    Request: {
      prompt: str (20–500 chars),
      title?: str,
      department?: str,
      location?: str,
      employmentType?: str,
      existingDescription?: str,
      mode?: "generate" | "adjust"
    }
    Response: { description: str }  # HTML suitable for the TipTap editor
    """
    import re

    from app.lib.nvidia_ai import nvidia_chat_completion

    prompt = (payload.get("prompt") or "").strip()
    if len(prompt) < 20:
        raise HTTPException(
            status_code=400, detail="Prompt must be at least 20 characters"
        )
    if len(prompt) > 500:
        raise HTTPException(
            status_code=400, detail="Prompt must be at most 500 characters"
        )

    title = (payload.get("title") or "").strip() or "this role"
    department = (payload.get("department") or "").strip()
    location = (payload.get("location") or "").strip()
    employment_type = (payload.get("employmentType") or "").strip()
    existing = (payload.get("existingDescription") or "").strip()
    mode = (payload.get("mode") or "generate").strip().lower()
    if mode not in {"generate", "adjust"}:
        mode = "generate"

    context_bits = [
        f"Position title: {title}",
        f"Department: {department}" if department else None,
        f"Location: {location}" if location else None,
        f"Employment type: {employment_type}" if employment_type else None,
    ]
    context = "\n".join(bit for bit in context_bits if bit)

    if mode == "adjust" and existing:
        system = (
            "You revise job descriptions for a professional careers site. "
            "Return ONLY HTML using <h2>, <p>, and <ul>/<li>. "
            "No markdown fences, no commentary, no <html> or <body> wrappers."
        )
        user_msg = (
            f"Revise the job description below using these notes.\n\n"
            f"{context}\n\n"
            f"Notes:\n{prompt}\n\n"
            f"Current HTML:\n{existing}"
        )
    else:
        system = (
            "You write clear, candidate-facing job descriptions. "
            "Return ONLY HTML with sections: About the role, Responsibilities, Requirements. "
            "Use <h2>, <p>, and <ul>/<li>. No markdown fences, no commentary."
        )
        user_msg = (
            f"Write a job description for this position.\n\n"
            f"{context}\n\n"
            f"Hiring notes:\n{prompt}"
        )

    try:
        content = await nvidia_chat_completion(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.55,
            max_tokens=2200,
            timeout=60.0,
        )
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.error(f"Error generating job description: {error}")
        raise HTTPException(
            status_code=502, detail=f"AI generation failed: {error}"
        ) from error

    cleaned = content.strip()
    fence = re.search(r"```(?:html)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence:
        cleaned = fence.group(1).strip()

    if not cleaned:
        raise HTTPException(status_code=502, detail="AI returned an empty description")

    return {"description": cleaned}


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
        return await sync_cv_vault_from_dropbox(db, dbx, extract_pdf=True, **list_kwargs)

    return await list_cv_vault_from_db(db, **list_kwargs)


@router.post("/cv-vault/sync")
async def sync_cv_vault(
    current_admin: dict = Depends(get_current_admin_user),
    extract_pdf: bool = Query(True, description="Extract name/email from PDFs when missing"),
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
