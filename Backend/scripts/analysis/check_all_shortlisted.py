#!/usr/bin/env python3
"""
Check All Shortlisted Applications
Lists all applications with status 'Shortlisted' to understand the current state
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

def check_shortlisted_applications():
    """Check all shortlisted applications in the database"""
    print("🔍 Checking All Shortlisted Applications")
    print("=" * 45)
    
    try:
        # Get database
        db = get_database()
        applications_collection = db.applications
        
        # Check different status variations
        status_checks = [
            "Shortlisted",
            "shortlisted", 
            "SHORTLISTED",
            "Hired",
            "Interview"
        ]
        
        print("📊 Checking applications by status:")
        for status in status_checks:
            count = applications_collection.count_documents({"status": status})
            print(f"   {status}: {count} applications")
        
        # Get all unique statuses
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        status_counts = list(applications_collection.aggregate(pipeline))
        
        print(f"\n📈 All unique statuses in database:")
        for status_info in status_counts:
            status = status_info.get('_id', 'NULL')
            count = status_info.get('count', 0)
            print(f"   {status}: {count} applications")
        
        # Check for any applications that might be considered shortlisted
        potential_shortlisted = list(applications_collection.find({
            "$or": [
                {"status": {"$regex": "short", "$options": "i"}},
                {"status": {"$regex": "hired", "$options": "i"}},
                {"status": {"$regex": "interview", "$options": "i"}},
                {"shortlistedDate": {"$exists": True, "$ne": None}}
            ]
        }, {
            "_id": 1,
            "name": 1,
            "email": 1,
            "position": 1,
            "status": 1,
            "shortlistedDate": 1,
            "appliedDate": 1,
            "jobDetails": 1
        }))
        
        print(f"\n📋 Applications with potential shortlisted status ({len(potential_shortlisted)} found):")
        
        if not potential_shortlisted:
            print("   No applications found with shortlisted-related status")
        else:
            for i, app in enumerate(potential_shortlisted, 1):
                name = app.get('name', 'Unknown')
                email = app.get('email', 'No Email')
                position = app.get('position', app.get('jobDetails', {}).get('title', 'N/A'))
                status = app.get('status', 'N/A')
                shortlisted_date = app.get('shortlistedDate', 'Not Set')
                applied_date = app.get('appliedDate', 'Not Set')
                
                print(f"   {i}. {name} ({email})")
                print(f"      Position: {position}")
                print(f"      Status: {status}")
                print(f"      Shortlisted Date: {shortlisted_date}")
                print(f"      Applied Date: {applied_date}")
                print()
        
        # Sample some general applications to see the data structure
        sample_apps = list(applications_collection.find({}, {
            "_id": 1,
            "name": 1,
            "email": 1,
            "position": 1,
            "status": 1,
            "appliedDate": 1,
            "jobDetails": 1
        }).limit(5))
        
        print(f"\n📝 Sample applications for reference ({len(sample_apps)} shown):")
        for i, app in enumerate(sample_apps, 1):
            name = app.get('name', 'Unknown')
            position = app.get('position', app.get('jobDetails', {}).get('title', 'N/A'))
            status = app.get('status', 'N/A')
            
            print(f"   {i}. {name} - Position: {position} - Status: {status}")
        
        total_apps = applications_collection.count_documents({})
        print(f"\n📊 Total applications in database: {total_apps}")
        
    except Exception as e:
        print(f"❌ Error checking shortlisted applications: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_shortlisted_applications()
