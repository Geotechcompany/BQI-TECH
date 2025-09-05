#!/usr/bin/env python3
"""
Fix job reference type mismatches.

This script addresses the issue where some applications have jobId as strings
while the job postings collection uses ObjectId. This causes lookup failures.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone
import logging

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def fix_jobid_type_mismatches():
    """Fix type mismatches between application jobIds and job posting _ids"""
    try:
        await connect_to_database()
        db = get_database()
        
        if db is None:
            logger.error("Failed to connect to database")
            return False
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        logger.info("=== FIXING JOB REFERENCE TYPE MISMATCHES ===")
        logger.info(f"Started at: {datetime.now(timezone.utc)}")
        
        # Get all job posting IDs as ObjectIds
        job_postings = await jobpostings_collection.find({}, {"_id": 1, "title": 1}).to_list(None)
        valid_job_ids = {str(job["_id"]): job["_id"] for job in job_postings}
        
        logger.info(f"Found {len(valid_job_ids)} valid job postings:")
        for job_str_id, job_obj_id in valid_job_ids.items():
            job_title = next(job["title"] for job in job_postings if job["_id"] == job_obj_id)
            logger.info(f"  📄 {job_str_id} → {job_title}")
        
        # Find applications with string jobIds that should be ObjectIds
        string_jobid_apps = await applications_collection.find({
            "jobId": {"$type": "string"}
        }).to_list(None)
        
        logger.info(f"Found {len(string_jobid_apps)} applications with string jobIds")
        
        fixed_count = 0
        error_count = 0
        
        for app in string_jobid_apps:
            try:
                str_job_id = app["jobId"]
                
                # Check if this string ID corresponds to a valid job posting
                if str_job_id in valid_job_ids:
                    correct_object_id = valid_job_ids[str_job_id]
                    
                    # Update the application with the correct ObjectId
                    result = await applications_collection.update_one(
                        {"_id": app["_id"]},
                        {
                            "$set": {
                                "jobId": correct_object_id,
                                "jobIdFixedAt": datetime.now(timezone.utc)
                            }
                        }
                    )
                    
                    if result.modified_count > 0:
                        fixed_count += 1
                        logger.info(f"✅ Fixed app {app['_id']}: '{str_job_id}' → ObjectId({correct_object_id})")
                    else:
                        logger.warning(f"⚠️ Failed to update app {app['_id']}")
                        error_count += 1
                else:
                    logger.warning(f"❌ No matching job posting for jobId: {str_job_id}")
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"Error processing app {app.get('_id', 'unknown')}: {e}")
                error_count += 1
                continue
        
        logger.info(f"Completed: {fixed_count} applications fixed, {error_count} errors")
        
        # Verify the fix
        logger.info("Verifying fixes...")
        remaining_string_ids = await applications_collection.count_documents({
            "jobId": {"$type": "string"}
        })
        
        # Check for orphaned references
        all_app_job_ids = await applications_collection.distinct("jobId")
        existing_job_ids = await jobpostings_collection.distinct("_id")
        
        orphaned_count = 0
        for job_id in all_app_job_ids:
            if job_id not in existing_job_ids:
                orphaned_count += 1
        
        logger.info(f"📊 Verification results:")
        logger.info(f"  • Remaining string jobIds: {remaining_string_ids}")
        logger.info(f"  • Orphaned job references: {orphaned_count}")
        
        if remaining_string_ids == 0 and orphaned_count == 0:
            logger.info("✅ All job reference type issues resolved!")
            return True
        else:
            logger.warning("⚠️ Some issues remain")
            return False
            
    except Exception as e:
        logger.error(f"Fix failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(fix_jobid_type_mismatches())
    
    if success:
        logger.info("Job reference type fix completed successfully")
        sys.exit(0)
    else:
        logger.error("Job reference type fix failed")
        sys.exit(1)
