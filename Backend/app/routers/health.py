import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.database import get_database, is_connected
from app.lib.email import test_smtp_connection
from app.mongo_errors import is_mongo_connection_error
from app.lib.runtime_environment import get_runtime_environment_payload

router = APIRouter(tags=["health"])

@router.get("/environment")
async def runtime_environment():
    """Public runtime environment info derived from the active MongoDB database."""
    return get_runtime_environment_payload()

@router.get("/health")
async def health_check():
    """Check API and database health"""
    try:
        # Check database connection
        db = get_database()
        if not is_connected():
            raise HTTPException(status_code=503, detail="Database not connected")
            
        # Try to ping the database
        if db is None:
            raise HTTPException(status_code=503, detail="Database not connected")
        await db.command("ping")
        
        return {
            "status": "healthy",
            "database": "connected",
            "message": "API and database are running"
        }
    except HTTPException:
        raise
    except Exception as e:
        if is_mongo_connection_error(e):
            raise HTTPException(
                status_code=503,
                detail=f"Database connection failed: {str(e)}"
            )
        error_message = str(e) or e.__class__.__name__
        raise HTTPException(
            status_code=503,
            detail=f"Health check failed: {error_message}"
        )


@router.get("/health/smtp")
async def smtp_health_check():
    """Test SMTP configuration and connectivity without sending email."""
    result = await asyncio.to_thread(test_smtp_connection)
    payload = {
        "status": "healthy" if result.get("connected") else "unhealthy",
        **result,
    }
    status_code = 200 if result.get("connected") else 503
    return JSONResponse(content=payload, status_code=status_code)