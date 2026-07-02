#!/usr/bin/env python3
"""
Fix Missing Shortlisted Dates
Sets shortlistedDate for applications with status 'Shortlisted' but missing date
"""

import os
import sys
import json
from typing import List, Dict, Any
from datetime import datetime
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

def fix_shortlisted_dates():
    """Fix missing shortlisted dates"""
    print("🔧 Fixing Missing Shortlisted Dates")
    print("=" * 40)
    
    try:
        # Get database
        db = get_database()
        applications_collection = db.applications
        
        # Find shortlisted applications without shortlistedDate
        missing_date_apps = list(applications_collection.find({
            "status": "Shortlisted",
            "$or": [
                {"shortlistedDate": {"$exists": False}},
                {"shortlistedDate": None},
                {"shortlistedDate": ""}
            ]
        }, {
            "_id": 1,
            "name": 1,
            "email": 1,
            "position": 1,
            "status": 1,
            "appliedDate": 1,
            "createdAt": 1,
            "updatedAt": 1
        }))
        
        print(f"📊 Found {len(missing_date_apps)} shortlisted applications missing shortlistedDate")
        
        if not missing_date_apps:
            print("✅ All shortlisted applications already have shortlistedDate set!")
            return
        
        print("\n🔧 Applications to fix:")
        for i, app in enumerate(missing_date_apps, 1):
            name = app.get('name', 'Unknown')
            email = app.get('email', 'No Email')
            print(f"{i}. {name} ({email})")
        
        # Ask for confirmation
        print(f"\n❓ Set shortlistedDate for {len(missing_date_apps)} applications?")
        print("   This will use the current timestamp as shortlistedDate")
        response = input("   Continue? (y/N): ").strip().lower()
        
        if response != 'y':
            print("❌ Operation cancelled")
            return
        
        # Set current timestamp as shortlisted date
        current_time = datetime.utcnow()
        
        updated_count = 0
        for app in missing_date_apps:
            try:
                result = applications_collection.update_one(
                    {"_id": app["_id"]},
                    {
                        "$set": {
                            "shortlistedDate": current_time,
                            "updatedAt": current_time
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    name = app.get('name', 'Unknown')
                    print(f"✅ Updated: {name}")
                
            except Exception as e:
                name = app.get('name', 'Unknown')
                print(f"❌ Failed to update {name}: {e}")
        
        print(f"\n🎉 Successfully updated {updated_count}/{len(missing_date_apps)} applications")
        print(f"📅 Shortlisted date set to: {current_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        
    except Exception as e:
        print(f"❌ Error fixing shortlisted dates: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fix_shortlisted_dates()
