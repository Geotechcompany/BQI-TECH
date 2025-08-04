import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import logging
from .config import settings
from fastapi import HTTPException
import dns.resolver

logger = logging.getLogger(__name__)

# Global variable to store the database connection
_client = None
_database = None

async def connect_to_database():
    """Connect to MongoDB database"""
    global _client, _database
    
    try:
        # Try MONGODB_URI first, then DATABASE_URL from settings, then fallback
        database_url = settings.MONGODB_URI or os.getenv("MONGODB_URI") or settings.DATABASE_URL
        database_name = os.getenv("DATABASE_NAME", "BQITECH")
        
        logger.info(f"Connecting to MongoDB: {database_url[:30]}...")
        
        # Configure DNS resolver
        dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
        dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']  # Google DNS
        
        # Set a longer server selection timeout and other options
        _client = AsyncIOMotorClient(
            database_url,
            serverSelectionTimeoutMS=30000,  # 30 seconds
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            waitQueueTimeoutMS=30000,
            retryWrites=True,
            w="majority"
        )
        _database = _client[database_name]
        
        # Test the connection with timeout
        await _client.admin.command('ping', serverSelectionTimeoutMS=30000)
        logger.info(f"Connected to MongoDB: {database_name}")
        
        # Initialize database indexes
        await initialize_database_indexes()
        
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        _client = None
        _database = None
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        _client = None
        _database = None
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

async def close_database_connection():
    """Close database connection"""
    global _client, _database
    if _client:
        _client.close()
        _client = None
        _database = None
        logger.info("Disconnected from MongoDB")

async def disconnect_from_database():
    """Alias for close_database_connection for compatibility"""
    await close_database_connection()

def get_database():
    """Get database instance"""
    global _database
    return _database

def is_connected():
    """Check if database is connected"""
    global _database
    return _database is not None


async def initialize_database_indexes():
    """Initialize database indexes for optimal performance"""
    global _database
    
    if not _database:
        logger.warning("Database not connected, skipping index initialization")
        return
    
    try:
        # Create TTL index for pending_registrations collection to auto-expire documents
        await _database.pending_registrations.create_index(
            "expiresAt", 
            expireAfterSeconds=0,  # Use the date in the field
            name="pending_registrations_ttl"
        )
        
        # Create unique index on email for pending_registrations
        await _database.pending_registrations.create_index(
            "email",
            unique=True,
            name="pending_registrations_email_unique"
        )
        
        # Create index on email for verification_codes (if not exists)
        await _database.verification_codes.create_index(
            "email",
            name="verification_codes_email"
        )
        
        # Create TTL index for verification_codes
        await _database.verification_codes.create_index(
            "expiresAt",
            expireAfterSeconds=0,
            name="verification_codes_ttl"
        )
        
        # Ensure unique email index on users collection
        await _database.users.create_index(
            "email",
            unique=True,
            name="users_email_unique"
        )
        
        logger.info("Database indexes initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing database indexes: {e}")
        # Don't raise exception to avoid blocking startup 