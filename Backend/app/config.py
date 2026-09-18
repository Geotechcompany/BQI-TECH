import os
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from Backend/.env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

class Settings(BaseModel):
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = int(os.getenv("PORT", "9000"))
    debug: bool = False
    
    # Database — primary connection string is MONGODB_URI (MONGODB_URL alias supported)
    DATABASE_URL: Optional[str] = Field(
        default=os.getenv("MONGODB_URI")
        or os.getenv("MONGODB_URL")
        or os.getenv("MONGO_URL")
    )
    MONGODB_URI: Optional[str] = Field(
        default=os.getenv("MONGODB_URI") or os.getenv("MONGODB_URL")
    )
    MONGO_URL: Optional[str] = Field(default=os.getenv("MONGO_URL"))
    DB_SYNC_TARGET_URI: Optional[str] = Field(default=os.getenv("DB_SYNC_TARGET_URI"))
    
    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "BQI Tech Backend"
    app_url: str = "https://api.bqitech.com"
    # Prefer FRONTEND_URL. Do not default to production — invite/email links use
    # get_frontend_url() which maps DB env → Netlify/prod hosts.
    frontend_url: str = (
        os.getenv("FRONTEND_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or (
            "https://bqitech.com"
            if os.getenv("NODE_ENV", "development").lower() == "production"
            else "https://bqitech-hr-dev.netlify.app"
        )
    )
    
    # Security
    SECRET_KEY: str = Field(default=os.getenv("SECRET_KEY", "your-secret-key-change-in-production"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    # Refresh tokens must outlive idle session warnings so "Stay Logged In" can renew
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    
    # Production/Development Mode
    is_production: bool = os.getenv("NODE_ENV", "development") == "production"
    api_base_path: str = os.getenv("API_BASE_PATH", "/api")
    
    # Security Headers
    enable_security_headers: bool = True
    
    # Response Obfuscation
    obfuscate_responses: bool = os.getenv("OBFUSCATE_RESPONSES", "false").lower() == "true"
    response_encoding: str = os.getenv("RESPONSE_ENCODING", "none")  # none, base64, gzip
    
    # Response Encryption
    encrypt_responses: bool = os.getenv("ENCRYPT_RESPONSES", "false").lower() == "true"
    encryption_master_key: str = os.getenv("ENCRYPTION_MASTER_KEY", "")
    
    # CORS
    # Include production origins by default; can be overridden via ALLOWED_ORIGINS env
    ALLOWED_ORIGINS_RAW: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,https://bqitech.com,https://www.bqitech.com,"
        "https://bqitech-hr-dev.netlify.app",
    )
    BACKEND_CORS_ORIGINS: List[str] = [
        origin.strip().rstrip("/")
        for origin in ALLOWED_ORIGINS_RAW.split(",")
        if origin.strip()
    ]
    # Optional regex for preview/staging hosts (Netlify, Render, bqitech.com)
    CORS_ORIGIN_REGEX: Optional[str] = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"https?:\/\/(.*\.)?bqitech\.com$|"
        r"https?:\/\/localhost(:\d+)?$|"
        r"https?:\/\/bqitech-[a-z0-9-]+\.onrender\.com$|"
        r"https?:\/\/([a-z0-9-]+\.)*netlify\.app$",
    )
    
    # Email provider (smtp | sendgrid | netlify_relay)
    email_provider: str = os.getenv("EMAIL_PROVIDER", "smtp")
    sendgrid_api_key: str = os.getenv("SENDGRID_API_KEY", "")
    email_relay_url: str = os.getenv("EMAIL_RELAY_URL", "")
    
    # Email Configuration (Office 365 SMTP)
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.office365.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "info@bqitech.com")
    smtp_pass: str = os.getenv("SMTP_PASS", "")
    from_email: str = os.getenv("FROM_EMAIL", "info@bqitech.com")
    hr_email: str = os.getenv("HR_EMAIL", "info@bqitech.com")
    
    # Cloudinary Configuration
    cloudinary_cloud_name: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    cloudinary_api_key: str = os.getenv("CLOUDINARY_API_KEY", "")
    cloudinary_api_secret: str = os.getenv("CLOUDINARY_API_SECRET", "")
    
    # Redis Configuration
    redis_url: str = os.getenv("REDIS_URL", "")
    upstash_redis_rest_url: str = os.getenv("UPSTASH_REDIS_REST_URL", "")
    upstash_redis_rest_token: str = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    
    # File Upload Configuration
    max_file_size: int = 10485760  # 10MB
    allowed_extensions: str = "pdf,doc,docx,jpg,jpeg,png,gif,webp"
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600
    
    # Dropbox Configuration
    dropbox_app_key: str = os.getenv("DROPBOX_APP_KEY", "")
    dropbox_app_secret: str = os.getenv("DROPBOX_APP_SECRET", "")
    dropbox_access_token: str = os.getenv("DROPBOX_ACCESS_TOKEN", "")
    dropbox_refresh_token: str = os.getenv("DROPBOX_REFRESH_TOKEN", "")
    dropbox_redirect_uri: str = os.getenv("DROPBOX_REDIRECT_URI", "")

    # Microsoft Graph (delegated calendar sync — Settings → Integrations)
    microsoft_client_id: str = os.getenv("MICROSOFT_CLIENT_ID", "")
    microsoft_client_secret: str = os.getenv("MICROSOFT_CLIENT_SECRET", "")
    microsoft_tenant_id: str = os.getenv("MICROSOFT_TENANT_ID", "organizations")
    microsoft_redirect_uri: str = os.getenv("MICROSOFT_REDIRECT_URI", "")
    
    # Pusher Configuration
    pusher_app_id: str = os.getenv("PUSHER_APP_ID", "")
    pusher_key: str = os.getenv("PUSHER_KEY", "")
    pusher_secret: str = os.getenv("PUSHER_SECRET", "")
    pusher_cluster: str = os.getenv("PUSHER_CLUSTER", "us2")
    
    # reCAPTCHA Configuration
    recaptcha_site_key: str = os.getenv("RECAPTCHA_SITE_KEY", "")
    recaptcha_secret_key: str = os.getenv("RECAPTCHA_SECRET_KEY", "")
    
    class Config:
        case_sensitive = False

# Initialize settings
settings = Settings() 