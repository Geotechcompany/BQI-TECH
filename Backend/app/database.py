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
		logger.warning("Continuing startup without database connection")
	except Exception as e:
		logger.error(f"Unexpected error connecting to MongoDB: {e}")
		_client = None
		_database = None
		logger.warning("Continuing startup without database connection")

async def close_database_connection():
	"""Close database connection"""
	global _client, _database
	if _client is not None:
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
	
	if _database is None:
		logger.warning("Database not connected, skipping index initialization")
		return
	
	async def ensure_index(collection, keys, name: str | None = None, **options):
		"""Create an index idempotently, resolving name/options conflicts.

		If an index on the same key pattern already exists but with different
		options or a different name, we drop the conflicting index and recreate
		it with the desired options. This avoids IndexOptionsConflict errors
		during application startup across environments.
		"""
		try:
			info = await collection.index_information()
			# Normalize keys to tuple of tuples like (("field", 1), ...)
			if isinstance(keys, str):
				desired_keys = ((keys, 1),)
			elif isinstance(keys, list):
				# list of tuples or single string wrapped in list
				desired_keys = tuple(tuple(k) if isinstance(k, (list, tuple)) else (k, 1) for k in keys)
			else:
				desired_keys = tuple(keys)

			conflicting_name = None
			for idx_name, spec in info.items():
				existing_keys = tuple(tuple(k) for k in spec.get("key", ()))
				if existing_keys == desired_keys:
					# Compare only relevant options we set
					unique_ok = (options.get("unique") or False) == spec.get("unique", False)
					ttl_desired = options.get("expireAfterSeconds")
					ttl_ok = True if ttl_desired is None else ttl_desired == spec.get("expireAfterSeconds")
					if unique_ok and ttl_ok:
						# Index already satisfies our requirements; nothing to do
						return
					conflicting_name = idx_name
					break

			if conflicting_name:
				logger.warning(f"Dropping conflicting index '{conflicting_name}' on '{collection.name}' to recreate with desired options")
				await collection.drop_index(conflicting_name)

			if name:
				await collection.create_index(keys, name=name, **options)
			else:
				await collection.create_index(keys, **options)
		except Exception as e:
			logger.error(f"Failed ensuring index on {collection.name}: {e}")

	try:
		# Create TTL index for pending_registrations collection to auto-expire documents
		await ensure_index(
			_database.pending_registrations,
			["expiresAt"],
			name="pending_registrations_ttl",
			expireAfterSeconds=0
		)
		
		# Create unique index on email for pending_registrations
		await ensure_index(
			_database.pending_registrations,
			["email"],
			name="pending_registrations_email_unique",
			unique=True
		)
		
		# Create index on email for verification_codes (if not exists)
		await ensure_index(
			_database.verification_codes,
			["email"],
			name="verification_codes_email"
		)
		
		# Create TTL index for verification_codes
		await ensure_index(
			_database.verification_codes,
			["expiresAt"],
			name="verification_codes_ttl",
			expireAfterSeconds=0
		)
		
		# Ensure unique email index on users collection
		await ensure_index(
			_database.users,
			["email"],
			name="users_email_unique",
			unique=True
		)
		
		logger.info("Database indexes initialized successfully")
		
	except Exception as e:
		logger.error(f"Error initializing database indexes: {e}")
		# Don't raise exception to avoid blocking startup 