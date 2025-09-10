#!/usr/bin/env python3
"""
Fix invalid createdBy values in job postings
Replaces 'system_migration' string with null to prevent ObjectId errors
"""

import os
import sys
from datetime import datetime
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_database
import asyncio
from bson import ObjectId
from bson.errors import InvalidId

async def fix_invalid_created_by():
    """Fix job postings with invalid createdBy values"""
    db = await get_database()
    
    print("🔧 BQI TECH - Fix Invalid CreatedBy Values")
    print("=" * 50)
    
    try:
        # Find job postings with invalid createdBy values
        print("\n🔍 Finding job postings with invalid createdBy values...")
        
        total_jobs = await db.job_postings.count_documents({})
        print(f"📊 Total job postings: {total_jobs}")
        
        # Find jobs with createdBy as string that's not a valid ObjectId
        problematic_jobs = []
        
        async for job in db.job_postings.find({}):
            if "createdBy" in job:
                created_by = job["createdBy"]
                if isinstance(created_by, str):
                    # Check if it's a valid ObjectId
                    try:
                        ObjectId(created_by)
                        # Valid ObjectId, skip
                        continue
                    except InvalidId:
                        # Invalid ObjectId string
                        problematic_jobs.append(job)
                        print(f"❌ Found problematic job: {job['_id']} - createdBy: '{created_by}'")
        
        print(f"\n📋 Found {len(problematic_jobs)} job postings with invalid createdBy values")
        
        if len(problematic_jobs) == 0:
            print("✅ No problematic job postings found!")
            return
        
        # Fix the problematic jobs
        print("\n🔧 Fixing problematic job postings...")
        
        fixed_count = 0
        for job in problematic_jobs:
            try:
                # Set createdBy to null for system-created jobs
                result = await db.job_postings.update_one(
                    {"_id": job["_id"]},
                    {
                        "$set": {
                            "createdBy": None,
                            "updatedAt": datetime.utcnow(),
                            "fixedAt": datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    fixed_count += 1
                    print(f"✅ Fixed job {job['_id']}: {job.get('title', 'Unknown Title')}")
                else:
                    print(f"⚠️  No changes made to job {job['_id']}")
                    
            except Exception as e:
                print(f"❌ Error fixing job {job['_id']}: {str(e)}")
        
        print(f"\n🎉 SUMMARY:")
        print(f"📊 Total job postings checked: {total_jobs}")
        print(f"❌ Problematic job postings found: {len(problematic_jobs)}")
        print(f"✅ Job postings fixed: {fixed_count}")
        
        if fixed_count == len(problematic_jobs):
            print("🎉 All problematic job postings have been fixed!")
        else:
            print("⚠️  Some job postings could not be fixed. Check logs above.")
        
        # Verify the fix
        print("\n🔍 Verifying fix...")
        remaining_problematic = 0
        
        async for job in db.job_postings.find({}):
            if "createdBy" in job and job["createdBy"] is not None:
                created_by = job["createdBy"]
                if isinstance(created_by, str):
                    try:
                        ObjectId(created_by)
                    except InvalidId:
                        remaining_problematic += 1
        
        if remaining_problematic == 0:
            print("✅ Verification passed: No more invalid createdBy values found!")
        else:
            print(f"⚠️  Verification failed: {remaining_problematic} job postings still have invalid createdBy values")
        
    except Exception as e:
        print(f"❌ Error during fix process: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(fix_invalid_created_by())
