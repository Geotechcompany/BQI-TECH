#!/usr/bin/env python3
"""
Explore Job Postings and Applications
Find out what job postings exist and how they relate to trainee applications
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
    MONGODB_URI_options = [
        os.getenv('MONGODB_URI'),
        os.getenv('MONGODB_URI'), 
        os.getenv('DATABASE_URL'),
        'mongodb://localhost:27017/bqi_database'
    ]
    
    for uri in MONGODB_URI_options:
        if uri:
            try:
                print(f"🔌 Attempting connection with URI: {uri[:20]}...")
                client = MongoClient(uri)
                client.admin.command('ping')
                db = client.get_default_database()
                print(f"✅ Connected to database: {db.name}")
                return db
            except Exception as e:
                print(f"❌ Failed with this URI: {e}")
                continue
    
    raise Exception("Could not connect to database with any URI")

def explore_job_postings_and_applications():
    """Explore job postings and their relationship to applications"""
    print("🔍 Exploring Job Postings and Applications")
    print("=" * 45)
    
    try:
        db = get_database()
        applications_collection = db.applications
        job_postings_collection = db.job_postings
        
        # Check collections
        print(f"📊 Database collections:")
        collections = db.list_collection_names()
        for collection in collections:
            count = db[collection].count_documents({})
            print(f"   {collection}: {count} documents")
        
        print()
        
        # Explore job postings
        print("📋 All Job Postings:")
        job_postings = list(job_postings_collection.find({}, {"_id": 1, "title": 1, "description": 1}).limit(20))
        
        if not job_postings:
            print("   No job postings found")
        else:
            for i, job in enumerate(job_postings, 1):
                job_id = str(job.get('_id'))
                title = job.get('title', 'No Title')
                description = job.get('description', '')[:100] + '...' if job.get('description') else 'No Description'
                print(f"   {i}. {title} (ID: {job_id})")
                print(f"      Description: {description}")
                
                # Check if this looks like a trainee position
                if 'trainee' in title.lower() or 'trainee' in description.lower():
                    print(f"      ⭐ TRAINEE POSITION DETECTED")
                print()
        
        print()
        
        # Explore shortlisted applications
        print("📋 Shortlisted Applications:")
        shortlisted_apps = list(applications_collection.find(
            {"status": "Shortlisted"}, 
            {"_id": 1, "name": 1, "email": 1, "jobId": 1, "position": 1, "shortlistedDate": 1}
        ).limit(20))
        
        if not shortlisted_apps:
            print("   No shortlisted applications found")
        else:
            for i, app in enumerate(shortlisted_apps, 1):
                name = app.get('name', 'Unknown')
                email = app.get('email', 'No Email')
                job_id = app.get('jobId', 'No JobId')
                position = app.get('position', 'No Position')
                shortlisted_date = app.get('shortlistedDate', 'Not Set')
                
                print(f"   {i}. {name} ({email})")
                print(f"      JobId: {job_id}")
                print(f"      Position: {position}")
                print(f"      Shortlisted Date: {shortlisted_date}")
                
                # Check if this looks like a trainee
                if 'trainee' in str(position).lower() or 'trainee' in str(job_id).lower():
                    print(f"      ⭐ TRAINEE APPLICATION DETECTED")
                print()
        
        print()
        
        # Try to match jobIds in applications to job postings
        print("🔗 JobId Matching Analysis:")
        
        # Get unique jobIds from applications
        unique_job_ids = applications_collection.distinct("jobId")
        print(f"📊 Found {len(unique_job_ids)} unique jobIds in applications")
        
        # Check which ones exist in job postings
        job_posting_ids = [str(job['_id']) for job in job_postings]
        print(f"📊 Found {len(job_posting_ids)} job posting IDs")
        
        matched_ids = []
        unmatched_ids = []
        
        for job_id in unique_job_ids:
            if job_id and str(job_id) in job_posting_ids:
                matched_ids.append(job_id)
            else:
                unmatched_ids.append(job_id)
        
        print(f"✅ Matched JobIds: {len(matched_ids)}")
        print(f"❌ Unmatched JobIds: {len(unmatched_ids)}")
        
        if unmatched_ids:
            print(f"📋 Unmatched JobIds (first 10):")
            for job_id in unmatched_ids[:10]:
                count = applications_collection.count_documents({"jobId": job_id})
                print(f"   {job_id}: {count} applications")
        
        # Specific search for trainee-related applications
        print("\n🎯 Trainee-specific Search:")
        trainee_search_queries = [
            {"position": {"$regex": "trainee", "$options": "i"}},
            {"jobDetails.title": {"$regex": "trainee", "$options": "i"}},
            {"answers.answer": {"$regex": "trainee", "$options": "i"}}
        ]
        
        for i, query in enumerate(trainee_search_queries, 1):
            count = applications_collection.count_documents(query)
            query_desc = list(query.keys())[0]
            print(f"   Search {i} ({query_desc}): {count} applications")
            
            if count > 0 and count <= 5:
                sample = list(applications_collection.find(query, {"name": 1, "status": 1}).limit(3))
                for app in sample:
                    print(f"      • {app.get('name', 'Unknown')} - {app.get('status', 'No Status')}")
        
    except Exception as e:
        print(f"❌ Error exploring data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    explore_job_postings_and_applications()
