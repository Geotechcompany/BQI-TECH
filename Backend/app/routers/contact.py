from fastapi import APIRouter, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any
import logging
import traceback
from app.lib.email import send_contact_form_email, send_contact_confirmation_email

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to get more detailed logs

router = APIRouter(tags=["contact"])

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
        
        # Send email
        email_sent = await send_contact_form_email(
            name=form_data['name'],
            email=form_data['email'],
            phone=form_data.get('phone', 'Not provided'),
            organization=form_data.get('organization', 'Not provided'),
            service=form_data.get('service', 'Not specified'),
            message=form_data['message']
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
                name=form_data['name'],
                email=form_data['email'],
                service=form_data.get('service', 'Not specified'),
                message=form_data['message']
            )
        except Exception as _e:
            logger.warning(f"Contact confirmation email failed but will not block response: {_e}")

        # Log successful submission
        logger.info(f"Contact form submitted by {form_data['email']}")
        
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