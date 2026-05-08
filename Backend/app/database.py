import os
import asyncio
import logging
from .config import settings
import dns.resolver

# Lazy-import motor/pymongo inside connection helpers so importing this module
# (pulled in by auth and routers) does not block on heavy pymongo startup on Windows.

logger = logging.getLogger(__name__)

# Global variable to store the database connection
_client = None
_database = None
_reconnect_task = None
_reconnect_stop_event = None
_backup_client = None
_backup_database = None
_sync_task = None
_sync_stop_event = None

_DEFAULT_SYNC_COLLECTIONS = [
	"users",
	"applications",
	"jobpostings",
	"jobquestions",
	"verification_codes",
	"pending_registrations",
	"email_campaigns",
	"email_logs",
	"notifications",
	"user_notifications",
	"settings",
]


def _build_mongo_candidates() -> list[str]:
	"""Build ordered MongoDB URI candidates (primary first, backup second)."""
	primary_uri = settings.MONGODB_URI or os.getenv("MONGODB_URI") or settings.DATABASE_URL
	backup_uri = settings.BACKUP_MONGO_URL or os.getenv("BACKUP_MONGO_URL")

	candidates: list[str] = []
	for candidate in [primary_uri, backup_uri]:
		if candidate and candidate not in candidates:
			candidates.append(candidate)
	return candidates


def _mongo_timeout_ms() -> int:
	return int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "10000"))


async def _try_connect(database_url: str, database_name: str) -> bool:
	"""Try connecting to one MongoDB URI candidate."""
	from motor.motor_asyncio import AsyncIOMotorClient
	from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

	global _client, _database
	timeout_ms = _mongo_timeout_ms()
	try:
		_client = AsyncIOMotorClient(
			database_url,
			serverSelectionTimeoutMS=timeout_ms,
			connectTimeoutMS=timeout_ms,
			socketTimeoutMS=timeout_ms,
			waitQueueTimeoutMS=timeout_ms,
			retryWrites=True,
			w="majority"
		)
		_database = _client[database_name]
		await _client.admin.command("ping", serverSelectionTimeoutMS=timeout_ms)
		return True
	except (ConnectionFailure, ServerSelectionTimeoutError) as e:
		logger.error(f"Failed to connect to MongoDB candidate: {e}")
		if _client is not None:
			_client.close()
		_client = None
		_database = None
		return False


async def _get_backup_database():
	"""Get or initialize backup database connection."""
	global _backup_client, _backup_database
	backup_uri = settings.BACKUP_MONGO_URL or os.getenv("BACKUP_MONGO_URL")
	if not backup_uri:
		return None

	if _backup_client is not None and _backup_database is not None:
		try:
			await _backup_client.admin.command("ping", serverSelectionTimeoutMS=5000)
			return _backup_database
		except Exception:
			try:
				_backup_client.close()
			except Exception:
				pass
			_backup_client = None
			_backup_database = None

	database_name = os.getenv("DATABASE_NAME", "BQITECH")
	from motor.motor_asyncio import AsyncIOMotorClient

	timeout_ms = min(_mongo_timeout_ms(), 10000)
	try:
		_backup_client = AsyncIOMotorClient(
			backup_uri,
			serverSelectionTimeoutMS=timeout_ms,
			connectTimeoutMS=timeout_ms,
			socketTimeoutMS=timeout_ms,
			waitQueueTimeoutMS=timeout_ms,
			retryWrites=True,
			w="majority"
		)
		_backup_database = _backup_client[database_name]
		await _backup_client.admin.command("ping", serverSelectionTimeoutMS=timeout_ms)
		return _backup_database
	except Exception as e:
		logger.error(f"Failed to connect to backup MongoDB: {e}")
		if _backup_client is not None:
			_backup_client.close()
		_backup_client = None
		_backup_database = None
		return None


async def sync_databases_now(collections: list[str] | None = None) -> dict:
	"""Sync primary database collections to backup database."""
	if not is_connected():
		return {"success": False, "message": "Primary database not connected"}

	backup_db = await _get_backup_database()
	if backup_db is None:
		return {"success": False, "message": "Backup database not available"}

	source_db = get_database()
	collection_names = collections or _DEFAULT_SYNC_COLLECTIONS
	result = {
		"success": True,
		"collections": {},
		"syncedAt": asyncio.get_event_loop().time(),
	}

	for collection_name in collection_names:
		try:
			source_collection = source_db[collection_name]
			target_collection = backup_db[collection_name]
			synced_count = 0

			async for document in source_collection.find({}):
				document_id = document.get("_id")
				if document_id is None:
					continue
				await target_collection.replace_one({"_id": document_id}, document, upsert=True)
				synced_count += 1

			result["collections"][collection_name] = {
				"success": True,
				"syncedCount": synced_count,
			}
		except Exception as e:
			result["success"] = False
			result["collections"][collection_name] = {
				"success": False,
				"error": str(e),
			}

	return result

async def connect_to_database():
	"""Connect to MongoDB database"""
	global _client, _database
	
	try:
		# Try primary URI first, then backup URI
		candidates = _build_mongo_candidates()
		database_name = os.getenv("DATABASE_NAME", "BQITECH")

		if not candidates:
			logger.error("No MongoDB URI configured (MONGODB_URI/BACKUP_MONGO_URL)")
			_client = None
			_database = None
			return
		
		# Configure DNS resolver
		dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
		dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']  # Google DNS

		connected = False
		for index, candidate in enumerate(candidates):
			label = "primary" if index == 0 else f"backup-{index}"
			logger.info(f"Connecting to MongoDB using {label} URI...")
			connected = await _try_connect(candidate, database_name)
			if connected:
				logger.info(f"Connected to MongoDB ({label}): {database_name}")
				await initialize_database_indexes()
				break

		if not connected:
			logger.warning("Continuing startup without database connection")
	except Exception as e:
		logger.error(f"Unexpected error connecting to MongoDB: {e}")
		_client = None
		_database = None
		logger.warning("Continuing startup without database connection")

async def close_database_connection():
	"""Close database connection"""
	global _client, _database, _backup_client, _backup_database
	if _client is not None:
		_client.close()
		_client = None
		_database = None
		logger.info("Disconnected from MongoDB")
	if _backup_client is not None:
		_backup_client.close()
		_backup_client = None
		_backup_database = None
		logger.info("Disconnected from backup MongoDB")


async def _reconnect_loop():
	"""Background reconnect loop for transient Mongo outages."""
	global _reconnect_stop_event
	backoff_seconds = 5
	max_backoff_seconds = 60

	while _reconnect_stop_event and not _reconnect_stop_event.is_set():
		if is_connected():
			backoff_seconds = 5
			await asyncio.sleep(5)
			continue

		logger.warning(f"Database disconnected; retrying MongoDB connection in {backoff_seconds}s")
		try:
			await asyncio.wait_for(_reconnect_stop_event.wait(), timeout=backoff_seconds)
			break
		except asyncio.TimeoutError:
			pass

		await connect_to_database()
		backoff_seconds = min(backoff_seconds * 2, max_backoff_seconds)


async def _sync_loop():
	"""Background loop that keeps backup database in sync."""
	global _sync_stop_event
	interval_seconds = int(os.getenv("DB_SYNC_INTERVAL_SECONDS", "300"))

	while _sync_stop_event and not _sync_stop_event.is_set():
		if is_connected():
			try:
				sync_result = await sync_databases_now()
				if sync_result.get("success"):
					logger.info("Database sync completed successfully")
				else:
					logger.warning(f"Database sync completed with warnings: {sync_result.get('message', 'partial failures')}")
			except Exception as e:
				logger.error(f"Automatic database sync failed: {e}")

		try:
			await asyncio.wait_for(_sync_stop_event.wait(), timeout=interval_seconds)
			break
		except asyncio.TimeoutError:
			pass


def start_reconnect_task():
	"""Start database reconnect background task if not running."""
	global _reconnect_task, _reconnect_stop_event, _sync_task, _sync_stop_event
	if _reconnect_task and not _reconnect_task.done():
		pass
	else:
		_reconnect_stop_event = asyncio.Event()
		_reconnect_task = asyncio.create_task(_reconnect_loop())

	backup_uri = settings.BACKUP_MONGO_URL or os.getenv("BACKUP_MONGO_URL")
	if backup_uri and (_sync_task is None or _sync_task.done()):
		_sync_stop_event = asyncio.Event()
		_sync_task = asyncio.create_task(_sync_loop())


async def stop_reconnect_task():
	"""Stop database reconnect background task."""
	global _reconnect_task, _reconnect_stop_event, _sync_task, _sync_stop_event
	if _reconnect_stop_event:
		_reconnect_stop_event.set()
	if _sync_stop_event:
		_sync_stop_event.set()

	if _reconnect_task:
		try:
			await _reconnect_task
		except Exception as e:
			logger.warning(f"Reconnect task stopped with error: {e}")
	if _sync_task:
		try:
			await _sync_task
		except Exception as e:
			logger.warning(f"Sync task stopped with error: {e}")

	_reconnect_task = None
	_reconnect_stop_event = None
	_sync_task = None
	_sync_stop_event = None

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

		# Applications collection indexes for performance
		await ensure_index(
			_database.applications,
			["status"],
			name="applications_status"
		)
		
		await ensure_index(
			_database.applications,
			["status", "appliedDate"],
			name="applications_status_appliedDate"
		)
		
		await ensure_index(
			_database.applications,
			["status", "createdAt"],
			name="applications_status_createdAt"
		)
		
		await ensure_index(
			_database.applications,
			["userId"],
			name="applications_userId"
		)
		
		await ensure_index(
			_database.applications,
			["jobId"],
			name="applications_jobId"
		)
		
		await ensure_index(
			_database.applications,
			["appliedDate"],
			name="applications_appliedDate"
		)

		# Email campaigns collection indexes
		await ensure_index(
			_database.email_campaigns,
			["sent_by"],
			name="email_campaigns_sent_by"
		)
		
		await ensure_index(
			_database.email_campaigns,
			["created_at"],
			name="email_campaigns_created_at"
		)
		
		await ensure_index(
			_database.email_campaigns,
			["status"],
			name="email_campaigns_status"
		)
		
		# Email logs collection indexes
		await ensure_index(
			_database.email_logs,
			["campaign_id"],
			name="email_logs_campaign_id"
		)
		
		await ensure_index(
			_database.email_logs,
			["recipient_email"],
			name="email_logs_recipient_email"
		)
		
		await ensure_index(
			_database.email_logs,
			["sent_at"],
			name="email_logs_sent_at"
		)
		
		await ensure_index(
			_database.email_logs,
			["status"],
			name="email_logs_status"
		)

		# Text search index for applications
		try:
			# Create text index for search functionality
			await _database.applications.create_index([
				("name", "text"),
				("email", "text"),
				("position", "text")
			], name="applications_text_search")
		except Exception as e:
			# Text indexes are special and might conflict, so handle separately
			logger.warning(f"Could not create text search index for applications: {e}")

		# Job postings indexes
		await ensure_index(
			_database.jobpostings,
			["title"],
			name="jobpostings_title"
		)
		
		await ensure_index(
			_database.jobpostings,
			["status"],
			name="jobpostings_status"
		)

		# Text search index for job postings
		try:
			await _database.jobpostings.create_index([
				("title", "text"),
				("description", "text"),
				("requirements", "text")
			], name="jobpostings_text_search")
		except Exception as e:
			logger.warning(f"Could not create text search index for job postings: {e}")

		# Password reset tokens: TTL and unique token index
		await ensure_index(
			_database.password_resets,
			["expiresAt"],
			name="password_resets_ttl",
			expireAfterSeconds=0
		)
		await ensure_index(
			_database.password_resets,
			["token"],
			name="password_resets_token_unique",
			unique=True
		)
		
		logger.info("Database indexes initialized successfully")
		
	except Exception as e:
		logger.error(f"Error initializing database indexes: {e}")
		# Don't raise exception to avoid blocking startup 