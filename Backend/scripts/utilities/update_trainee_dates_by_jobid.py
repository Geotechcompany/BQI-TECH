#!/usr/bin/env python3
"""
Update Trainee Shortlisted Dates - Using JobId References
Sets shortlistedDate to September 5, 2025 for trainee applications using proper jobId lookup
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
    """Get database connection with multiple fallback options"""
    # Try different environment variable names
    mongo_uri_options = [
        os.getenv('MONGODB_URI'),
        os.getenv('MONGO_URI'), 
        os.getenv('DATABASE_URL'),
        'mongodb://localhost:27017/bqi_database'  # fallback
    ]
    
    for uri in mongo_uri_options:
        if uri:
            try:
                print(f"🔌 Attempting connection with URI: {uri[:20]}...")
                client = MongoClient(uri)
                # Test the connection
                client.admin.command('ping')
                db = client.get_default_database()
                print(f"✅ Connected to database: {db.name}")
                return db
            except Exception as e:
                print(f"❌ Failed with this URI: {e}")
                continue
    
    raise Exception("Could not connect to database with any URI")

def update_trainee_shortlisted_dates_by_jobid():
    """Update shortlisted dates for trainee applications using jobId references"""
    print("🔧 Updating Trainee Shortlisted Dates using JobId References")
    print("=" * 65)
    
    try:
        # Get database
        db = get_database()
        applications_collection = db.applications
        job_postings_collection = db.job_postings
        
        # Target date: September 5, 2025
        target_date = datetime(2025, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
        
        print(f"🎯 Target shortlisted date: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print()
        
        # Step 1: Find all job postings with "trainee" in the title
        print("🔍 Step 1: Finding trainee job postings...")
        trainee_jobs = list(job_postings_collection.find({
            "title": {"$regex": "trainee", "$options": "i"}
        }, {"_id": 1, "title": 1}))
        
        trainee_job_ids = []
        print(f"📋 Found {len(trainee_jobs)} trainee job postings:")
        for job in trainee_jobs:
            job_id = str(job.get('_id'))
            title = job.get('title', 'Unknown')
            trainee_job_ids.append(job_id)
            print(f"   • {title} (ID: {job_id})")
        
        if not trainee_job_ids:
            print("❌ No trainee job postings found!")
            return
        
        print()
        
        # Step 2: Find shortlisted applications with these jobIds
        print("🔍 Step 2: Finding shortlisted applications with trainee jobIds...")
        query = {
            "status": "Shortlisted",
            "jobId": {"$in": trainee_job_ids}
        }
        
        matching_apps = list(applications_collection.find(query, {
            "_id": 1,
            "name": 1,
            "email": 1,
            "jobId": 1,
            "status": 1,
            "appliedDate": 1,
            "shortlistedDate": 1,
            "createdAt": 1
        }))
        
        print(f"📊 Found {len(matching_apps)} shortlisted trainee applications")
        
        if not matching_apps:
            print("ℹ️  No shortlisted trainee applications found")
            
            # Debug: Check if there are any shortlisted applications at all
            all_shortlisted = applications_collection.count_documents({"status": "Shortlisted"})
            print(f"📊 Total shortlisted applications: {all_shortlisted}")
            
            # Check if there are applications with these jobIds (any status)
            any_status_trainee = applications_collection.count_documents({"jobId": {"$in": trainee_job_ids}})
            print(f"📊 Trainee applications (any status): {any_status_trainee}")
            
            return
        
        print("\n📋 Trainee applications to update:")
        print("-" * 50)
        
        # Create job title lookup
        job_title_map = {str(job['_id']): job['title'] for job in trainee_jobs}
        
        for i, app in enumerate(matching_apps, 1):
            name = app.get('name', 'Unknown')
            email = app.get('email', 'No Email')
            job_id = app.get('jobId', 'N/A')
            job_title = job_title_map.get(job_id, 'Unknown Position')
            applied_date = app.get('appliedDate', app.get('createdAt', 'Unknown'))
            current_shortlisted_date = app.get('shortlistedDate', 'Not Set')
            
            print(f"{i}. {name} ({email})")
            print(f"   Job: {job_title} (ID: {job_id})")
            print(f"   Applied: {applied_date}")
            print(f"   Current Shortlisted Date: {current_shortlisted_date}")
            print()
        
        # Ask for confirmation
        print(f"❓ Update shortlisted date to {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC for {len(matching_apps)} trainee applications?")
        response = input("   Continue? (y/N): ").strip().lower()
        
        if response != 'y':
            print("❌ Operation cancelled")
            return
        
        # Step 3: Update the applications
        print("\n🔧 Updating applications...")
        updated_count = 0
        
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
                    print(f"⚠️  No changes for: {name}")
                
            except Exception as e:
                name = app.get('name', 'Unknown')
                print(f"❌ Failed to update {name}: {e}")
        
        print(f"\n🎉 Successfully updated {updated_count}/{len(matching_apps)} trainee applications")
        print(f"📅 Shortlisted date set to: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"📅 Local time: {target_date.astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}")
        
    except Exception as e:
        print(f"❌ Error updating shortlisted dates: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_trainee_shortlisted_dates_by_jobid()
