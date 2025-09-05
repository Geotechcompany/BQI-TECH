#!/usr/bin/env python3
"""
Update Shortlisted Dates for Trainee Applications - Flexible Search
Sets shortlistedDate to September 5, 2025 for any shortlisted applications with "trainee" positions
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
        mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/bqi_database')
        client = MongoClient(mongo_uri)
        return client.get_default_database()

def update_trainee_shortlisted_dates_flexible():
    """Update shortlisted dates for all trainee applications regardless of date"""
    print("🔧 Updating ALL Trainee Shortlisted Dates to September 5, 2025")
    print("=" * 60)
    
    try:
        # Get database
        db = get_database()
        applications_collection = db.applications
        
        # Target date: September 5, 2025
        target_date = datetime(2025, 9, 5, 12, 0, 0, tzinfo=timezone.utc)  # Set to noon UTC
        
        print(f"🎯 Target shortlisted date: {target_date.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print()
        
        # Build flexible query for any trainee applications that are shortlisted
        query = {
            "status": "Shortlisted",
            "$or": [
                {"position": {"$regex": "trainee", "$options": "i"}},  # position field contains trainee
                # Check if any answer contains trainee
                {"answers.answer": {"$regex": "trainee", "$options": "i"}},
                # Check if jobDetails contains trainee
                {"jobDetails.title": {"$regex": "trainee", "$options": "i"}}
            ]
        }
        
        print("🔍 Searching for applications with criteria:")
        print(f"   - Status: Shortlisted")
        print(f"   - Position/Answers/JobDetails contains: 'trainee' (case-insensitive)")
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
            "createdAt": 1,
            "jobDetails": 1,
            "answers": 1
        }))
        
        print(f"📊 Found {len(matching_apps)} trainee applications that are shortlisted")
        
        if not matching_apps:
            print("ℹ️  No matching trainee applications found")
            
            # Let's check what shortlisted applications exist
            all_shortlisted = list(applications_collection.find(
                {"status": "Shortlisted"}, 
                {"name": 1, "email": 1, "position": 1, "jobDetails.title": 1}
            ))
            
            print(f"\n📋 Found {len(all_shortlisted)} total shortlisted applications:")
            for i, app in enumerate(all_shortlisted[:10], 1):  # Show first 10
                name = app.get('name', 'Unknown')
                position = app.get('position', app.get('jobDetails', {}).get('title', 'N/A'))
                print(f"   {i}. {name} - Position: {position}")
            
            if len(all_shortlisted) > 10:
                print(f"   ... and {len(all_shortlisted) - 10} more")
            
            return
        
        print("\n📋 Trainee applications to update:")
        print("-" * 50)
        
        for i, app in enumerate(matching_apps, 1):
            name = app.get('name', 'Unknown')
            email = app.get('email', 'No Email')
            position = app.get('position', app.get('jobDetails', {}).get('title', app.get('jobId', 'N/A')))
            applied_date = app.get('appliedDate', app.get('createdAt', 'Unknown'))
            current_shortlisted_date = app.get('shortlistedDate', 'Not Set')
            
            # Try to identify why this was matched
            match_reason = []
            if app.get('position') and 'trainee' in str(app.get('position', '')).lower():
                match_reason.append("position field")
            if app.get('jobDetails', {}).get('title') and 'trainee' in str(app.get('jobDetails', {}).get('title', '')).lower():
                match_reason.append("job title")
            if app.get('answers'):
                for answer in app.get('answers', []):
                    if 'trainee' in str(answer.get('answer', '')).lower():
                        match_reason.append("application answer")
                        break
            
            print(f"{i}. {name} ({email})")
            print(f"   Position: {position}")
            print(f"   Applied: {applied_date}")
            print(f"   Current Shortlisted Date: {current_shortlisted_date}")
            print(f"   Matched by: {', '.join(match_reason) if match_reason else 'unknown'}")
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
    update_trainee_shortlisted_dates_flexible()
