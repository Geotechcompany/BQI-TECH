#!/usr/bin/env python3
"""
Update Trainee Shortlisted Dates - Final Version
Specifically targets applications with position "Trainee" and sets shortlistedDate to September 5, 2025
"""

import os
import sys
import json
from typing import List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Load environment variables
env_files = [
    os.path.join(backend_dir, '.env'),
    os.path.join(os.path.dirname(backend_dir), '.env'),
    os.path.join(os.path.dirname(backend_dir), 'language=language=.env')
]

for env_file in env_files:
    if os.path.exists(env_file):
        print(f"📁 Loading environment from: {env_file}")
        load_dotenv(env_file)
        break

def get_database():
    """Get database connection"""
    MONGODB_URI_options = [
        os.getenv('MONGODB_URI'),
        os.getenv('MONGODB_URI'), 
        os.getenv('DATABASE_URL'),
        'mongodb://localhost:27017/bqi_database'
    ]
    
    for uri in MONGODB_URI_options:
        if uri:
            try:
                client = MongoClient(uri)
                client.admin.command('ping')
                db = client.get_default_database()
                print(f"✅ Connected to database: {db.name}")
                return db
            except Exception as e:
                continue
    
    raise Exception("Could not connect to database")

def update_trainee_shortlisted_dates_final():
    """Update shortlisted dates for trainee applications to September 5, 2025"""
    print("🔧 Final Update: Trainee Shortlisted Dates to September 5, 2025")
    print("=" * 65)
    
    try:
        db = get_database()
        applications_collection = db.applications
        
        # Target date: September 5, 2025 noon UTC
        target_date = datetime(2025, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
        
        print(f"🎯 Target shortlisted date: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print()
        
        # Find all shortlisted applications with "Trainee" position
        query = {
            "status": "Shortlisted",
            "position": {"$regex": "^Trainee$", "$options": "i"}  # Exact match for "Trainee"
        }
        
        print("🔍 Searching for shortlisted trainee applications...")
        print("   Criteria: status = 'Shortlisted' AND position = 'Trainee'")
        
        matching_apps = list(applications_collection.find(query, {
            "_id": 1,
            "name": 1,
            "email": 1,
            "position": 1,
            "jobId": 1,
            "status": 1,
            "appliedDate": 1,
            "shortlistedDate": 1,
            "createdAt": 1
        }))
        
        print(f"📊 Found {len(matching_apps)} shortlisted trainee applications")
        
        if not matching_apps:
            print("ℹ️  No shortlisted trainee applications found")
            
            # Debug: Check variations
            debug_queries = [
                {"status": "Shortlisted", "position": {"$regex": "trainee", "$options": "i"}},
                {"position": {"$regex": "^Trainee$", "$options": "i"}},
                {"status": "Shortlisted"}
            ]
            
            print("\n🔍 Debug - Checking variations:")
            for i, debug_query in enumerate(debug_queries, 1):
                count = applications_collection.count_documents(debug_query)
                print(f"   Query {i}: {count} applications")
                if count > 0 and count <= 3:
                    samples = list(applications_collection.find(debug_query, {"name": 1, "position": 1, "status": 1}).limit(3))
                    for sample in samples:
                        print(f"      • {sample.get('name', 'Unknown')} - {sample.get('position', 'No Position')} - {sample.get('status', 'No Status')}")
            
            return
        
        print("\n📋 Trainee applications to update:")
        print("-" * 50)
        
        for i, app in enumerate(matching_apps, 1):
            name = app.get('name', 'Unknown')
            email = app.get('email', 'No Email')
            position = app.get('position', 'N/A')
            job_id = app.get('jobId', 'No JobId')
            applied_date = app.get('appliedDate', app.get('createdAt', 'Unknown'))
            current_shortlisted_date = app.get('shortlistedDate', 'Not Set')
            
            print(f"{i}. {name} ({email})")
            print(f"   Position: {position}")
            print(f"   JobId: {job_id}")
            print(f"   Applied: {applied_date}")
            print(f"   Current Shortlisted Date: {current_shortlisted_date}")
            print()
        
        # Automatic update for trainee applications
        print(f"🔧 Automatically updating {len(matching_apps)} trainee applications...")
        print(f"   Setting shortlistedDate to: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        
        # Update the applications
        updated_count = 0
        failed_count = 0
        
        for app in matching_apps:
            try:
                result = applications_collection.update_one(
                    {"_id": app["_id"]},
                    {
                        "$set": {
                            "shortlistedDate": target_date,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    name = app.get('name', 'Unknown')
                    print(f"✅ Updated: {name}")
                else:
                    name = app.get('name', 'Unknown')
                    print(f"⚠️  No changes for: {name} (may already have this date)")
                
            except Exception as e:
                failed_count += 1
                name = app.get('name', 'Unknown')
                print(f"❌ Failed to update {name}: {e}")
        
        print(f"\n🎉 Update Summary:")
        print(f"   ✅ Successfully updated: {updated_count}")
        print(f"   ⚠️  No changes needed: {len(matching_apps) - updated_count - failed_count}")
        print(f"   ❌ Failed: {failed_count}")
        print(f"   📅 New shortlisted date: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"   📅 Local time: {target_date.astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}")
        
        # Verification
        print(f"\n🔍 Verification - Checking updated applications...")
        verification_count = applications_collection.count_documents({
            "status": "Shortlisted",
            "position": {"$regex": "^Trainee$", "$options": "i"},
            "shortlistedDate": target_date
        })
        
        print(f"✅ Verified: {verification_count} trainee applications now have the correct shortlisted date")
        
    except Exception as e:
        print(f"❌ Error updating shortlisted dates: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_trainee_shortlisted_dates_final()
