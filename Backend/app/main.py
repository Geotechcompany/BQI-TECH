from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
import os
from contextlib import asynccontextmanager
import datetime
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.utils.ip_utils import get_real_client_ip

from .database import (
    connect_to_database,
    close_database_connection,
    get_database,
    is_connected,
    start_reconnect_task,
    stop_reconnect_task,
)
from .config import settings
from .lib.runtime_environment import get_runtime_environment_payload
from .lib.backup_scheduler import start_backup_scheduler, stop_backup_scheduler
from .lib.cors import apply_cors_headers, build_allowed_origins, is_origin_allowed
from .lib.email_transport_settings import get_email_transport_config

# Import routers directly from modules
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.admin_2fa import router as admin_2fa_router
from .routers.applications import router as applications_router
from .routers.blog import router as blog_router
from .routers.jobs import router as jobs_router
from .routers.user import router as user_router
from .routers.contact import router as contact_router
from .routers.health import router as health_router
from .routers.notifications import router as notifications_router
from .routers.user_notifications import router as user_notifications_router
from .routers.surveys import router as surveys_router
from .routers.upload import router as upload_router
from .routers.broadcast_lists import router as broadcast_lists_router
from .routers.cv_vault import router as cv_vault_router
from .routers.internal_email import router as internal_email_router

# Try to import misc router if it exists
try:
    from .routers import misc
    HAS_MISC_ROUTER = True
except ImportError:
    HAS_MISC_ROUTER = False

# Configure logging — default INFO; pymongo DEBUG dumps full query results (incl. password hashes)
def configure_logging() -> None:
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,
    )

    for noisy_logger in (
        "pymongo",
        "pymongo.command",
        "pymongo.connection",
        "pymongo.topology",
        "pymongo.serverSelection",
        "motor",
        "httpx",
        "httpcore",
        "urllib3",
    ):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    if log_level <= logging.DEBUG:
        logging.getLogger("app.routers.contact").setLevel(logging.DEBUG)
        logging.getLogger("app.lib.email").setLevel(logging.DEBUG)


configure_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    await connect_to_database()
    await get_email_transport_config(force_reload=True)
    start_reconnect_task()
    start_backup_scheduler()
    yield
    # Shutdown
    logger.info("Shutting down...")
    await stop_backup_scheduler()
    await stop_reconnect_task()
    await close_database_connection()

# Create rate limiter with accurate IP detection
def get_client_ip_for_rate_limit(request: Request) -> str:
    """Custom IP extraction function for rate limiting"""
    real_ip = get_real_client_ip(request)
    return real_ip or (request.client.host if request.client else "unknown")

limiter = Limiter(key_func=get_client_ip_for_rate_limit)

# Create FastAPI app with lifespan
app = FastAPI(
    title="BQI Tech HR API",
    description="HR Management System API",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Force HTTPS in production - must be first middleware
@app.middleware("http")
async def force_https_redirect(request: Request, call_next):
    """Force HTTPS redirects to use HTTPS scheme"""
    # Check if we're behind a proxy that forwarded HTTPS
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    forwarded_host = request.headers.get("x-forwarded-host", "")
    
    # If request came via HTTPS proxy, ensure redirects use HTTPS
    if forwarded_proto == "https":
        # Override the request URL scheme
        request.scope["scheme"] = "https"
        request.scope["server"] = (forwarded_host or request.scope["server"][0], 443)
    
    response = await call_next(request)
    return response

# Add security headers middleware
@app.middleware("http")
async def debug_requests(request: Request, call_next):
    if os.getenv("LOG_LEVEL", "INFO").upper() == "DEBUG" and "bulk-status" in str(request.url):
        logger.debug("bulk-status request: %s %s", request.method, request.url)

    response = await call_next(request)
    return response

@app.middleware("http")
async def log_client_ips(request: Request, call_next):
    """Log client IP only when LOG_LEVEL=DEBUG."""
    if os.getenv("LOG_LEVEL", "INFO").upper() == "DEBUG":
        real_ip = get_real_client_ip(request)
        direct_ip = request.client.host if request.client else None
        logger.debug(
            "IP Debug - Real IP: %s, Direct IP: %s, X-Forwarded-For: %s, X-Real-IP: %s",
            real_ip,
            direct_ip,
            request.headers.get("x-forwarded-for"),
            request.headers.get("x-real-ip"),
        )

    return await call_next(request)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    if settings.enable_security_headers:
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (adjust as needed)
        if settings.is_production:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; "
                "style-src 'self' 'unsafe-inline'; "
                "frame-src 'self' https://www.google.com/ https://www.google.com/recaptcha/ https://app.thinkstack.ai; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://api.bqitech.com https://www.google.com https://www.google.com/recaptcha/ https://www.gstatic.com https://www.gstatic.com/recaptcha/;"
            )
    
    return response

# Response obfuscation middleware
@app.middleware("http")
async def obfuscate_responses(request: Request, call_next):
    response = await call_next(request)
    
    # Only obfuscate API responses in production
    if settings.is_production and request.url.path.startswith("/api/"):
        # Add random headers to make responses look like regular web traffic
        response.headers["X-Cache-Status"] = "MISS" if hash(str(request.url)) % 2 else "HIT"
        response.headers["X-Response-Time"] = f"{hash(str(request.url)) % 100 + 50}ms"
        response.headers["X-Server-ID"] = f"srv-{hash(str(request.url)) % 10 + 1:02d}"
        
        # Remove server identification
        response.headers.pop("server", None)
        
        # Add generic content type variations
        if "application/json" in response.headers.get("content-type", ""):
            response.headers["content-type"] = "application/json; charset=utf-8"
    
    return response

# Configure CORS (Starlette middleware)
_cors_origins = build_allowed_origins()
_cors_regex = (settings.CORS_ORIGIN_REGEX or "").strip() or None
logger.info("CORS allowed origins: %s", _cors_origins)
if _cors_regex:
    logger.info("CORS origin regex enabled")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)


@app.exception_handler(HTTPException)
async def http_exception_with_cors(request: Request, exc: HTTPException):
    origin = request.headers.get("origin")
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=dict(exc.headers or {}),
    )
    if origin and is_origin_allowed(origin):
        apply_cors_headers(response, origin)
    return response


@app.exception_handler(Exception)
async def unhandled_exception_with_cors(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    origin = request.headers.get("origin")
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
    if origin and is_origin_allowed(origin):
        apply_cors_headers(response, origin)
    return response


# Outermost CORS safety net — registered last so it runs first
@app.middleware("http")
async def cors_safety_net(request: Request, call_next):
    origin = request.headers.get("origin")

    if request.method == "OPTIONS" and origin and is_origin_allowed(origin):
        from starlette.responses import Response

        return apply_cors_headers(Response(status_code=204), origin)

    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request error")
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    if origin and is_origin_allowed(origin):
        apply_cors_headers(response, origin)

    return response

# Include routers with consistent prefixes
logger.info("Registering routers...")
logger.info("Registering auth router at /api")
app.include_router(auth_router, prefix="/api")
logger.info("Registering admin router at /api/admin")
app.include_router(admin_router, prefix="/api/admin")
logger.info("Registering applications router at /api/applications")
app.include_router(applications_router, prefix="/api/applications")
logger.info("Registering blog router at /api/blog")
app.include_router(blog_router, prefix="/api/blog")
logger.info("Registering jobs router at /api/jobs")
app.include_router(jobs_router, prefix="/api/jobs")
logger.info("Registering user router at /api/users")  # Updated prefix
app.include_router(user_router, prefix="/api/users")  # Changed from /api/user to /api/users
logger.info("Registering contact router at /api/contact")
app.include_router(contact_router, prefix="/api/contact")
logger.info("Registering health router at /api")
app.include_router(health_router, prefix="/api")
logger.info("Registering notifications router at /api/notifications")
app.include_router(notifications_router, prefix="/api/notifications")
logger.info("Registering user notifications router at /api/user-notifications")
app.include_router(user_notifications_router, prefix="/api/user-notifications")
logger.info("Registering upload router at /api/upload")
app.include_router(upload_router, prefix="/api/upload")
logger.info("Registering surveys router at /api")
app.include_router(surveys_router, prefix="/api")
logger.info("Registering broadcast lists router at /api/admin")
app.include_router(broadcast_lists_router)
logger.info("Registering cv vault router")
app.include_router(cv_vault_router)
logger.info("Registering internal email relay router at /api")
app.include_router(internal_email_router, prefix="/api")

# Include misc router if available
if HAS_MISC_ROUTER:
    logger.info("Registering misc router at /api")
    app.include_router(misc.router, prefix="/api")

# Root endpoints
@app.get("/")
async def root():
    return {"message": "BQI Tech HR API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    try:
        env_info = get_runtime_environment_payload()
        # Check database connection
        if not is_connected():
            return {
                "status": "unhealthy",
                "message": "API is running but database is not connected",
                "database": "disconnected",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                **env_info,
            }
        
        db = get_database()
        await db.command('ping')
        return {
            "status": "healthy",
            "message": "API is running",
            "database": "connected",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            **env_info,
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        env_info = get_runtime_environment_payload()
        return {
            "status": "unhealthy",
            "message": "API is running but database check failed",
            "error": str(e),
            "timestamp": datetime.datetime.utcnow().isoformat(),
            **env_info,
        }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=10000,  # Match NEXT_PUBLIC_PYTHON_API_URL
        reload=True,
        log_level="info",
        access_log=False,
        timeout_keep_alive=0
    ) 