"""
Enhanced application router with status history tracking
"""
from fastapi import APIRouter, HTTPException, Query, Body, Depends, Request, status
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from app.database import get_database, is_connected
from app.lib.email import send_application_confirmation_email
from datetime import datetime, timezone
from bson import ObjectId
from app.auth import get_current_user
from app.models.application import Application, ApplicationCreate, ApplicationUpdate, ApplicationStatusChange
from app.utils.status_history import StatusHistoryManager, admin_actor_label
import logging
from fastapi.responses import Response
import json

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/applications",
    tags=["applications"],
    responses={404: {"description": "Not found"}},
)

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

def convert_objectids_to_strings(doc):
    """Convert all ObjectId fields in a document to strings"""
    if isinstance(doc, dict):
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, dict):
                convert_objectids_to_strings(value)
            elif isinstance(value, list):
                doc[key] = convert_objectids_to_strings(value)
    elif isinstance(doc, list):
        for i, item in enumerate(doc):
            if isinstance(item, ObjectId):
                doc[i] = str(item)
            elif isinstance(item, dict):
                convert_objectids_to_strings(item)
            elif isinstance(item, list):
                doc[i] = convert_objectids_to_strings(item)
    return doc

@router.post("/")
async def submit_application(
    application_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Submit a new job application with status history tracking"""
    try:
        logger.info("Received application submission")
        logger.info(f"Current user: {json.dumps(current_user, default=str)}")
        logger.info(f"Application data: {json.dumps(application_data, default=str)}")
        
        # Check database connection
        if not is_connected():
            logger.error("Database not connected")
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        
        # Check for existing application
        user_id = str(current_user["_id"])
        job_id = application_data.get("jobId")
        
        if not job_id:
            raise HTTPException(status_code=400, detail="Job ID is required")
            
        existing_application = await db.applications.find_one({
            "userId": user_id,
            "jobId": job_id
        })
        
        if existing_application:
            raise HTTPException(
                status_code=400,
                detail="You have already applied for this position"
            )
        
        # Set up timestamps and status
        now = datetime.now(timezone.utc)
        application_data["appliedDate"] = now
        application_data["status"] = "New"
        application_data["createdAt"] = now
        application_data["updatedAt"] = now
        application_data["userId"] = user_id
        
        # Initialize status history (store email/name, not raw user ObjectId)
        application_data["statusHistory"] = StatusHistoryManager.initialize_status_history(
            initial_status="New",
            applied_date=now,
            user_id=admin_actor_label(current_user) if isinstance(current_user, dict) else user_id,
        )
        
        # Initialize legacy date fields for backward compatibility
        application_data["shortlistedDate"] = None
        application_data["assessmentDate"] = None
        application_data["interviewDate"] = None
        application_data["hireDate"] = None
        application_data["disqualifiedDate"] = None
        
        logger.info(f"Final application data: {json.dumps(application_data, default=str)}")
        
        try:
            result = await db.applications.insert_one(application_data)
            logger.info(f"Application inserted with ID: {result.inserted_id}")
        except Exception as e:
            logger.error(f"Database insertion error: {str(e)}")
            raise
        
        application_data["_id"] = str(result.inserted_id)
        application_data["id"] = str(result.inserted_id)
        
        # Verify the application was saved
        saved_app = await db.applications.find_one({"_id": result.inserted_id})
        if saved_app:
            logger.info(f"Successfully verified application in database")
        else:
            logger.warning("Could not verify application in database after insertion")
        
        # Try to send confirmation email (non-blocking for response)
        try:
            # Extract applicant email and name from answers if present
            answers = application_data.get("answers", [])
            applicant_email = None
            applicant_name = "Applicant"
            for a in answers:
                q_text = str(a.get("questionText", "")).lower()
                if applicant_email is None and ("email" in q_text):
                    applicant_email = a.get("answer")
                if "name" in q_text and isinstance(a.get("answer"), str) and len(a.get("answer").strip()) > 0:
                    applicant_name = a.get("answer").strip()

            # Fetch job title if possible
            job_title = "the position"
            try:
                job = await db.jobpostings.find_one({"_id": ObjectId(job_id)})
                if job and job.get("title"):
                    job_title = job.get("title")
            except Exception:
                pass

            if applicant_email:
                await send_application_confirmation_email(
                    applicant_email=applicant_email,
                    applicant_name=applicant_name,
                    job_title=job_title
                )
        except Exception as email_err:
            logger.error(f"Failed to send application confirmation email: {str(email_err)}")

        return {
            "message": "Application submitted successfully",
            "application": application_data
        }
    except Exception as e:
        logger.error(f"Error submitting application: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{application_id}/status")
async def update_application_status(
    application_id: str,
    status_change: ApplicationStatusChange,
    current_user: dict = Depends(get_current_user)
):
    """Update application status with proper history tracking"""
    try:
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        
        # Find the application
        try:
            app_object_id = ObjectId(application_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid application ID")
        
        application = await db.applications.find_one({"_id": app_object_id})
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Get current status history
        current_history = application.get("statusHistory", [])
        
        # Add new status change
        try:
            updated_history = StatusHistoryManager.add_status_change(
                current_history=current_history,
                new_status=status_change.newStatus,
                changed_by=status_change.changedBy,
                reason=status_change.reason,
                metadata=status_change.metadata
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Sync legacy date fields for backward compatibility
        legacy_fields = StatusHistoryManager.sync_legacy_fields(updated_history)
        
        # Update the application
        update_data = {
            "status": status_change.newStatus,
            "statusHistory": updated_history,
            "updatedAt": datetime.now(timezone.utc),
            **legacy_fields  # Include legacy date fields
        }
        
        result = await db.applications.update_one(
            {"_id": app_object_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update application")
        
        # Return updated application
        updated_app = await db.applications.find_one({"_id": app_object_id})
        updated_app["id"] = str(updated_app["_id"])
        
        return {
            "message": "Application status updated successfully",
            "application": convert_objectids_to_strings(updated_app)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating application status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{application_id}/history")
async def get_application_history(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed status history for an application"""
    try:
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        
        # Find the application
        try:
            app_object_id = ObjectId(application_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid application ID")
        
        application = await db.applications.find_one({"_id": app_object_id})
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Get status history
        status_history = application.get("statusHistory", [])
        
        # Get status summary
        summary = StatusHistoryManager.get_status_summary(status_history)
        
        return {
            "applicationId": application_id,
            "statusHistory": convert_objectids_to_strings(status_history),
            "summary": convert_objectids_to_strings(summary)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting application history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{application_id}/migrate-legacy")
async def migrate_application_legacy_data(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Migrate legacy date fields to status history for a specific application"""
    try:
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not available")
            
        db = get_database()
        
        # Check if user is admin (you may want to add proper admin role checking)
        user_role = current_user.get("role", "user")
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Find the application
        try:
            app_object_id = ObjectId(application_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid application ID")
        
        application = await db.applications.find_one({"_id": app_object_id})
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Skip if already has status history
        if "statusHistory" in application and application["statusHistory"]:
            return {
                "message": "Application already has status history",
                "statusHistory": convert_objectids_to_strings(application["statusHistory"])
            }
        
        # Migrate legacy data
        status_history = StatusHistoryManager.migrate_legacy_dates(application)
        
        # Update the application
        update_data = {
            "statusHistory": status_history,
            "migratedAt": datetime.now(timezone.utc),
            "statusHistoryVersion": "1.0"
        }
        
        result = await db.applications.update_one(
            {"_id": app_object_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to migrate application")
        
        return {
            "message": "Application legacy data migrated successfully",
            "statusHistory": convert_objectids_to_strings(status_history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error migrating application legacy data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Keep existing endpoints for backward compatibility...
# (You would include the rest of your existing endpoints here)
