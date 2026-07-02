#!/usr/bin/env python3
"""
Update Shortlisted Dates for August/September 2025 Trainee Applications
Sets shortlistedDate to September 5, 2025 for trainee applications from Aug/Sep 2025
"""

import os
import sys
import json
from typing import List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from app.database import get_database
except ImportError:
    print("❌ Could not import database module. Trying alternative approach...")
    # Alternative approach using direct MongoDB connection
    from pymongo import MongoClient
    import os
    from dotenv import load_dotenv
    
    # Load environment variables
    env_path = os.path.join(backend_dir, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
    
    def get_database():
        MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/bqi_database')
        client = MongoClient(MONGODB_URI)
        return client.get_default_database()

def update_trainee_shortlisted_dates():
    """Update shortlisted dates for trainee applications from August/September 2025"""
    print("🔧 Updating Trainee Shortlisted Dates to September 5, 2025")
    print("=" * 60)
    
    try:
        # Get database
        db = get_database()
        applications_collection = db.applications
        
        # Target date: September 5, 2025
        target_date = datetime(2025, 9, 5, 12, 0, 0, tzinfo=timezone.utc)  # Set to noon UTC
        
        print(f"🎯 Target shortlisted date: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print()
        
        # Date range for applications: August 1, 2025 to September 30, 2025
        start_date = datetime(2025, 8, 1, tzinfo=timezone.utc)
        end_date = datetime(2025, 9, 30, 23, 59, 59, tzinfo=timezone.utc)
        
        # Build query for trainee applications from August/September 2025
        query = {
            "status": "Shortlisted",
            "$or": [
                # Check if appliedDate is in the range
                {
                    "appliedDate": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                },
                # Check if createdAt is in the range (fallback)
                {
                    "appliedDate": {"$exists": False},
                    "createdAt": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            ]
        }
        
        # First, let's get job postings to identify trainee positions
        job_postings_collection = db.job_postings
        job_postings = list(job_postings_collection.find({}, {"_id": 1, "title": 1}))
        
        trainee_job_ids = []
        for job in job_postings:
            if job.get('title') and 'trainee' in job.get('title', '').lower():
                job_id = str(job.get('_id'))
                trainee_job_ids.append(job_id)
                print(f"📋 Found trainee job posting: {job.get('title')} (ID: {job_id})")
        
        print(f"📊 Found {len(trainee_job_ids)} trainee job postings")
        print()
        
        # Add trainee job filtering to query
        if trainee_job_ids:
            query["$and"] = [
                query.get("$or", []),  # Keep the date filter
                {
                    "$or": [
                        {"jobId": {"$in": trainee_job_ids}},  # jobId references
                        {"position": {"$regex": "trainee", "$options": "i"}},  # position field contains trainee
                        {"position": {"$in": trainee_job_ids}}  # position field has job ID
                    ]
                }
            ]
            # Remove the direct $or since it's now nested in $and
            del query["$or"]
        else:
            # Fallback to position field only if no job postings found
            query["position"] = {"$regex": "trainee", "$options": "i"}
        
        print("🔍 Searching for applications with criteria:")
        print(f"   - Status: Shortlisted")
        print(f"   - Applied between: {start_date.strftime('%Y-%m-%d')} and {end_date.strftime('%Y-%m-%d')}")
        print(f"   - Position: Trainee (or related job IDs)")
        print()
        
        # Find matching applications
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
        
        print(f"📊 Found {len(matching_apps)} trainee applications from Aug/Sep 2025 that are shortlisted")
        
        if not matching_apps:
            print("ℹ️  No matching applications found")
            return
        
        print("\n📋 Applications to update:")
        print("-" * 50)
        
        for i, app in enumerate(matching_apps, 1):
            name = app.get('name', 'Unknown')
            email = app.get('email', 'No Email')
            position = app.get('position', app.get('jobId', 'N/A'))
            applied_date = app.get('appliedDate', app.get('createdAt', 'Unknown'))
            current_shortlisted_date = app.get('shortlistedDate', 'Not Set')
            
            print(f"{i}. {name} ({email})")
            print(f"   Position: {position}")
            print(f"   Applied: {applied_date}")
            print(f"   Current Shortlisted Date: {current_shortlisted_date}")
            print()
        
        # Ask for confirmation
        print(f"❓ Update shortlisted date to {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC for {len(matching_apps)} applications?")
        response = input("   Continue? (y/N): ").strip().lower()
        
        if response != 'y':
            print("❌ Operation cancelled")
            return
        
        # Update the applications
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
        
        print(f"\n🎉 Successfully updated {updated_count}/{len(matching_apps)} applications")
        print(f"📅 Shortlisted date set to: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"📅 Local time: {target_date.astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}")
        
    except Exception as e:
        print(f"❌ Error updating shortlisted dates: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_trainee_shortlisted_dates()
