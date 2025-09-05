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

async def investigate_missing_jobids():
    """Investigate why some jobIds are not found in job postings"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("❌ Failed to connect to database")
            return
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        print("=== INVESTIGATION: MISSING JOB IDS ===")
        print(f"🕒 Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Get all job postings
        print("\n📋 All job postings in database:")
        job_postings = await jobpostings_collection.find({}).to_list(length=None)
        
        for job in job_postings:
            print(f"   📄 ID: {job['_id']} ({type(job['_id'])}) | Title: {job.get('title', 'NO TITLE')}")
        
        # Get all unique jobIds from applications
        print(f"\n🔍 All unique jobIds referenced in applications:")
        
        pipeline = [
            {"$match": {"jobId": {"$exists": True, "$ne": None, "$ne": ""}}},
            {"$group": {"_id": "$jobId", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        unique_job_ids = await applications_collection.aggregate(pipeline).to_list(length=None)
        
        job_posting_ids = [str(job['_id']) for job in job_postings]
        
        for job_ref in unique_job_ids:
            job_id = job_ref['_id']
            count = job_ref['count']
            status = "✅ FOUND" if job_id in job_posting_ids else "❌ MISSING"
            print(f"   📋 JobID: {job_id} | Count: {count} applications | Status: {status}")
        
        # Check if the missing jobId is an ObjectId that needs conversion
        missing_job_id = "682b28e027eefc80eae4f513"
        print(f"\n🔬 Detailed analysis of missing jobId: {missing_job_id}")
        
        # Try to find it as ObjectId
        try:
            obj_id = ObjectId(missing_job_id)
            job_by_objectid = await jobpostings_collection.find_one({"_id": obj_id})
            if job_by_objectid:
                print(f"   ✅ Found as ObjectId: {job_by_objectid.get('title', 'NO TITLE')}")
            else:
                print(f"   ❌ Not found even as ObjectId")
        except Exception as e:
            print(f"   ❌ Invalid ObjectId format: {e}")
        
        # Check if there are any job postings with that ID as string
        job_by_string = await jobpostings_collection.find_one({"_id": missing_job_id})
        if job_by_string:
            print(f"   ✅ Found as string ID: {job_by_string.get('title', 'NO TITLE')}")
        else:
            print(f"   ❌ Not found as string ID")
        
        # Show sample applications using this missing jobId
        print(f"\n📋 Sample applications using missing jobId {missing_job_id}:")
        sample_apps = await applications_collection.find({"jobId": missing_job_id}).limit(3).to_list(length=None)
        
        for app in sample_apps:
            print(f"   📝 App ID: {app['_id']} | Date: {app.get('appliedDate')} | JobId type: {type(app.get('jobId'))}")
            # Check if we can extract position from answers
            answers = app.get('answers', [])
            for answer in answers:
                if 'position' in answer.get('questionText', '').lower() or 'job' in answer.get('questionText', '').lower():
                    print(f"      Q: {answer.get('questionText')} | A: {answer.get('answer')}")
                    break
    
    except Exception as e:
        print(f"💥 Error during investigation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(investigate_missing_jobids())
