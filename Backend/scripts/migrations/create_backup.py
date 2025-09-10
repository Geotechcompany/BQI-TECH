#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
import json
from bson import ObjectId

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for MongoDB datetime objects"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

async def create_database_backup():
    """Create a backup of the applications collection before migration"""
    
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("❌ Failed to connect to database")
            return
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        print("=== DATABASE BACKUP CREATION ===")
        print(f"🕒 Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Create timestamp for backup files
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Backup applications collection
        print(f"\n💾 Backing up applications collection...")
        applications = await applications_collection.find({}).to_list(length=None)
        
        backup_filename = f"applications_backup_{timestamp}.json"
        backup_path = os.path.join(os.path.dirname(__file__), backup_filename)
        
        with open(backup_path, 'w') as f:
            json.dump(applications, f, cls=DateTimeEncoder, indent=2)
        
        print(f"✅ Applications backup saved: {backup_path}")
        print(f"   📊 Total applications backed up: {len(applications)}")
        
        # Backup job postings collection
        print(f"\n💾 Backing up jobpostings collection...")
        jobpostings = await jobpostings_collection.find({}).to_list(length=None)
        
        jobpostings_filename = f"jobpostings_backup_{timestamp}.json"
        jobpostings_path = os.path.join(os.path.dirname(__file__), jobpostings_filename)
        
        with open(jobpostings_path, 'w') as f:
            json.dump(jobpostings, f, cls=DateTimeEncoder, indent=2)
        
        print(f"✅ Job postings backup saved: {jobpostings_path}")
        print(f"   📊 Total job postings backed up: {len(jobpostings)}")
        
        # Create backup metadata
        metadata = {
            "backup_timestamp": datetime.now().isoformat(),
            "applications_count": len(applications),
            "jobpostings_count": len(jobpostings),
            "backup_type": "pre_migration",
            "migration_purpose": "job_reference_system_and_status_history",
            "files": {
                "applications": backup_filename,
                "jobpostings": jobpostings_filename
            }
        }
        
        metadata_filename = f"backup_metadata_{timestamp}.json"
        metadata_path = os.path.join(os.path.dirname(__file__), metadata_filename)
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✅ Backup metadata saved: {metadata_path}")
        
        # Summary
        print(f"\n📋 BACKUP SUMMARY:")
        print("=" * 80)
        print(f"   📁 Backup timestamp: {timestamp}")
        print(f"   📄 Applications backup: {backup_filename}")
        print(f"   📄 Job postings backup: {jobpostings_filename}")
        print(f"   📄 Metadata file: {metadata_filename}")
        print(f"   📊 Total records backed up: {len(applications) + len(jobpostings)}")
        
        # Verification
        print(f"\n🔍 Verifying backup integrity...")
        
        # Verify applications backup
        try:
            with open(backup_path, 'r') as f:
                verified_apps = json.load(f)
            print(f"✅ Applications backup verified: {len(verified_apps)} records")
        except Exception as e:
            print(f"❌ Applications backup verification failed: {e}")
            return False
        
        # Verify job postings backup
        try:
            with open(jobpostings_path, 'r') as f:
                verified_jobs = json.load(f)
            print(f"✅ Job postings backup verified: {len(verified_jobs)} records")
        except Exception as e:
            print(f"❌ Job postings backup verification failed: {e}")
            return False
        
        print(f"\n🎉 BACKUP COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print("✅ All data backed up and verified")
        print("✅ Ready to proceed with migrations")
        
        # Return backup info for use in migrations
        return {
            "timestamp": timestamp,
            "applications_backup": backup_path,
            "jobpostings_backup": jobpostings_path,
            "metadata": metadata_path
        }
        
    except Exception as e:
        print(f"💥 Error during backup creation: {e}")
        import traceback
        traceback.print_exc()
        return False

async def restore_from_backup(backup_timestamp):
    """Restore database from backup if needed"""
    
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("❌ Failed to connect to database")
            return False
            
        print(f"=== RESTORING FROM BACKUP ===")
        print(f"🕒 Restore timestamp: {backup_timestamp}")
        print("=" * 80)
        
        # Load backup files
        backup_filename = f"applications_backup_{backup_timestamp}.json"
        backup_path = os.path.join(os.path.dirname(__file__), backup_filename)
        
        if not os.path.exists(backup_path):
            print(f"❌ Backup file not found: {backup_path}")
            return False
        
        print(f"📁 Loading backup from: {backup_path}")
        
        with open(backup_path, 'r') as f:
            applications = json.load(f)
        
        # Convert ObjectId strings back to ObjectIds
        for app in applications:
            if '_id' in app:
                app['_id'] = ObjectId(app['_id'])
            if 'appliedDate' in app and isinstance(app['appliedDate'], str):
                app['appliedDate'] = datetime.fromisoformat(app['appliedDate'].replace('Z', '+00:00'))
        
        # Drop existing collection and restore
        print(f"🗑️  Dropping existing applications collection...")
        await db.applications.drop()
        
        print(f"📥 Restoring {len(applications)} applications...")
        await db.applications.insert_many(applications)
        
        print(f"✅ RESTORE COMPLETED SUCCESSFULLY!")
        print(f"   📊 Restored {len(applications)} applications")
        
        return True
        
    except Exception as e:
        print(f"💥 Error during restore: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("💾 Creating database backup before migrations...")
    backup_info = asyncio.run(create_database_backup())
    
    if backup_info:
        print(f"\n📋 Backup completed successfully!")
        print(f"Use timestamp '{backup_info['timestamp']}' to restore if needed")
    else:
        print(f"\n❌ Backup failed! Do not proceed with migrations.")
