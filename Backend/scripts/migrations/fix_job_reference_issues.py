#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
from bson import ObjectId

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database

async def fix_job_reference_issues():
    """Fix job reference issues and create missing job postings"""
    
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("❌ Failed to connect to database")
            return
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        print("=== FIXING JOB REFERENCE ISSUES ===")
        print(f"🕒 Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Step 1: Investigate invalid jobId references
        print(f"\n🔍 Step 1: Investigating invalid jobId references...")
        
        # Get all job postings
        job_postings = await jobpostings_collection.find({}).to_list(length=None)
        valid_job_ids = [str(job['_id']) for job in job_postings]
        
        print(f"Valid job IDs: {valid_job_ids}")
        
        # Find applications with invalid jobIds
        invalid_apps = await applications_collection.find({
            "jobId": {"$nin": valid_job_ids, "$ne": None, "$ne": ""}
        }).to_list(length=5)  # Get first 5 for analysis
        
        print(f"\nSample invalid jobId references:")
        for app in invalid_apps:
            job_id = app.get('jobId')
            applied_date = app.get('appliedDate', 'Unknown')
            print(f"   🚫 App: {app['_id']} | JobID: {job_id} | Date: {applied_date}")
            
            # Check if this jobId exists as ObjectId in job postings
            try:
                obj_id = ObjectId(job_id)
                job_exists = await jobpostings_collection.find_one({"_id": obj_id})
                if job_exists:
                    print(f"      ✅ Job posting exists as ObjectId: {job_exists.get('title')}")
                else:
                    print(f"      ❌ Job posting does NOT exist")
            except Exception as e:
                print(f"      ❌ Invalid ObjectId format: {e}")
        
        # Step 2: Create missing job posting for "Junior Configuration Analyst"
        print(f"\n🔧 Step 2: Creating missing job posting...")
        
        # Check if "Junior Configuration Analyst" job posting already exists
        existing_job = await jobpostings_collection.find_one({
            "title": {"$regex": "Junior Configuration Analyst", "$options": "i"}
        })
        
        if existing_job:
            print(f"✅ Job posting already exists: {existing_job['title']} (ID: {existing_job['_id']})")
            new_job_id = str(existing_job['_id'])
        else:
            # Create new job posting
            new_job_posting = {
                "title": "Junior Configuration Analyst",
                "description": "Entry-level position for configuration analysis and system setup",
                "requirements": [
                    "Bachelor's degree in IT, Computer Science, or related field",
                    "Basic understanding of system configuration",
                    "Strong analytical skills",
                    "Excellent communication skills"
                ],
                "location": "Nairobi, Kenya",
                "type": "Full-time",
                "department": "Technology",
                "createdAt": datetime.now(),
                "status": "active",
                "createdBy": "system_migration"
            }
            
            # DRY_RUN mode
            DRY_RUN = True  # Set to False to actually create
            
            if DRY_RUN:
                print(f"🧪 DRY RUN: Would create job posting 'Junior Configuration Analyst'")
                # Use a placeholder ID for planning
                new_job_id = "NEW_JOB_ID_PLACEHOLDER"
            else:
                result = await jobpostings_collection.insert_one(new_job_posting)
                new_job_id = str(result.inserted_id)
                print(f"✅ Created job posting: Junior Configuration Analyst (ID: {new_job_id})")
        
        # Step 3: Plan updates
        print(f"\n📋 Step 3: Planning updates...")
        
        # Find applications that need "Junior Configuration Analyst" jobId
        config_analyst_apps = await applications_collection.find({
            "position": "Junior Configuration Analyst",
            "$or": [
                {"jobId": {"$exists": False}},
                {"jobId": None},
                {"jobId": ""}
            ]
        }).to_list(length=None)
        
        print(f"Applications needing 'Junior Configuration Analyst' jobId: {len(config_analyst_apps)}")
        
        for app in config_analyst_apps[:5]:  # Show first 5
            print(f"   📝 App: {app['_id']} | Position: {app.get('position')} | Current JobID: {app.get('jobId', 'None')}")
        
        # Step 4: Check if the "invalid" jobIds are actually string vs ObjectId issues
        print(f"\n🔍 Step 4: Checking ObjectId vs String issues...")
        
        # Get one of the "invalid" jobIds and check both string and ObjectId forms
        if invalid_apps:
            test_job_id = invalid_apps[0].get('jobId')
            print(f"Testing jobId: {test_job_id}")
            
            # Check as string
            string_match = await jobpostings_collection.find_one({"_id": test_job_id})
            print(f"   String lookup: {'Found' if string_match else 'Not found'}")
            
            # Check as ObjectId
            try:
                obj_id = ObjectId(test_job_id)
                object_match = await jobpostings_collection.find_one({"_id": obj_id})
                print(f"   ObjectId lookup: {'Found' if object_match else 'Not found'}")
                if object_match:
                    print(f"   Job title: {object_match.get('title')}")
            except Exception as e:
                print(f"   ObjectId conversion failed: {e}")
        
        # Step 5: Summary of what needs to be fixed
        print(f"\n📊 ISSUES SUMMARY:")
        print("=" * 80)
        print(f"1. Invalid jobId references: Likely string vs ObjectId mismatch")
        print(f"2. Missing job posting: 'Junior Configuration Analyst' needs to be created")
        print(f"3. Legacy applications: {len(config_analyst_apps)} need jobId assignment")
        
        print(f"\n🔧 RECOMMENDED FIXES:")
        print("1. Ensure jobId validation uses proper ObjectId conversion")
        print("2. Create 'Junior Configuration Analyst' job posting")
        print("3. Update legacy applications with appropriate jobIds")
        print("4. Update job reference validation logic in backend")
        
    except Exception as e:
        print(f"💥 Error during analysis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(fix_job_reference_issues())
