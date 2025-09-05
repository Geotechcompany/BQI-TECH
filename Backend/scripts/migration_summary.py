#!/usr/bin/env python3
"""
Migration Summary Report
========================

This script provides a comprehensive summary of all completed migrations
for the BQI Tech website backend system.
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

async def generate_migration_summary():
    """Generate comprehensive migration summary"""
    try:
        await connect_to_database()
        db = get_database()
        
        if db is None:
            logger.error("Failed to connect to database")
            return False
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        print("=" * 60)
        print("🚀 BQI TECH WEBSITE MIGRATION SUMMARY")
        print("=" * 60)
        print(f"📅 Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        
        # Basic Statistics
        total_apps = await applications_collection.count_documents({})
        total_jobs = await jobpostings_collection.count_documents({})
        
        print("📊 DATABASE OVERVIEW:")
        print(f"  • Total Applications: {total_apps:,}")
        print(f"  • Total Job Postings: {total_jobs:,}")
        print()
        
        # Job Reference Migration Status
        print("🔗 JOB REFERENCE SYSTEM:")
        apps_with_jobid = await applications_collection.count_documents({"jobId": {"$exists": True, "$ne": None}})
        jobid_coverage = (apps_with_jobid / total_apps * 100) if total_apps > 0 else 0
        
        print(f"  • Applications with jobId: {apps_with_jobid:,}/{total_apps:,}")
        print(f"  • Coverage: {jobid_coverage:.1f}%")
        
        if jobid_coverage == 100.0:
            print("  ✅ Job reference system: COMPLETE")
        else:
            print("  ⚠️ Job reference system: INCOMPLETE")
        print()
        
        # Status History Migration Status
        print("📈 STATUS HISTORY SYSTEM:")
        apps_with_history = await applications_collection.count_documents({"statusHistory": {"$exists": True}})
        history_coverage = (apps_with_history / total_apps * 100) if total_apps > 0 else 0
        
        print(f"  • Applications with status history: {apps_with_history:,}/{total_apps:,}")
        print(f"  • Coverage: {history_coverage:.1f}%")
        
        if history_coverage == 100.0:
            print("  ✅ Status history system: COMPLETE")
        else:
            print("  ⚠️ Status history system: INCOMPLETE")
        print()
        
        # Migration Metadata
        print("🔧 MIGRATION METADATA:")
        migrated_apps = await applications_collection.count_documents({"migratedAt": {"$exists": True}})
        print(f"  • Applications with migration metadata: {migrated_apps:,}")
        
        # Get latest migration timestamp
        latest_migration = await applications_collection.find(
            {"migratedAt": {"$exists": True}},
            {"migratedAt": 1}
        ).sort("migratedAt", -1).limit(1).to_list(1)
        
        if latest_migration:
            latest_time = latest_migration[0]["migratedAt"]
            print(f"  • Latest migration: {latest_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        
        # Status Distribution
        print("📋 CURRENT STATUS DISTRIBUTION:")
        status_pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        status_dist = await applications_collection.aggregate(status_pipeline).to_list(None)
        
        for status_info in status_dist[:10]:  # Top 10 statuses
            status = status_info["_id"] or "UNDEFINED"
            count = status_info["count"]
            print(f"  • {status}: {count:,}")
        print()
        
        # Job Posting Analysis
        print("💼 JOB POSTING ANALYSIS:")
        job_pipeline = [
            {"$group": {"_id": "$jobId", "count": {"$sum": 1}}},
            {"$lookup": {
                "from": "jobpostings",
                "localField": "_id",
                "foreignField": "_id", 
                "as": "job_info"
            }},
            {"$sort": {"count": -1}}
        ]
        
        job_apps = await applications_collection.aggregate(job_pipeline).to_list(None)
        
        for job_info in job_apps[:5]:  # Top 5 job postings
            job_id = job_info["_id"]
            count = job_info["count"]
            job_details = job_info.get("job_info", [])
            
            if job_details:
                title = job_details[0].get("title", "Unknown Title")
            else:
                title = "MISSING JOB POSTING"
                
            print(f"  • {title}: {count:,} applications")
        print()
        
        # Data Integrity Checks
        print("🔍 DATA INTEGRITY CHECKS:")
        
        # Check for orphaned applications (jobId but no corresponding job posting)
        orphaned_count = 0
        job_ids = await applications_collection.distinct("jobId", {"jobId": {"$exists": True, "$ne": None}})
        existing_jobs = await jobpostings_collection.distinct("_id")
        
        for job_id in job_ids:
            if job_id not in existing_jobs:
                orphaned_count += 1
        
        if orphaned_count == 0:
            print("  ✅ No orphaned job references")
        else:
            print(f"  ⚠️ {orphaned_count} orphaned job references found")
        
        # Check for applications without jobId
        missing_jobid = total_apps - apps_with_jobid
        if missing_jobid == 0:
            print("  ✅ All applications have job references")
        else:
            print(f"  ⚠️ {missing_jobid} applications missing job references")
        
        # Check for applications without status history
        missing_history = total_apps - apps_with_history
        if missing_history == 0:
            print("  ✅ All applications have status history")
        else:
            print(f"  ⚠️ {missing_history} applications missing status history")
        print()
        
        # System Readiness
        print("🎯 SYSTEM READINESS:")
        
        readiness_score = 0
        total_checks = 4
        
        if jobid_coverage == 100.0:
            print("  ✅ Job reference system ready")
            readiness_score += 1
        else:
            print("  ❌ Job reference system needs attention")
            
        if history_coverage == 100.0:
            print("  ✅ Status history system ready")
            readiness_score += 1
        else:
            print("  ❌ Status history system needs attention")
            
        if orphaned_count == 0:
            print("  ✅ Data integrity verified")
            readiness_score += 1
        else:
            print("  ❌ Data integrity issues detected")
            
        if missing_jobid == 0 and missing_history == 0:
            print("  ✅ Migration completeness verified")
            readiness_score += 1
        else:
            print("  ❌ Migration incomplete")
        
        print()
        print(f"🏆 OVERALL READINESS: {readiness_score}/{total_checks} ({readiness_score/total_checks*100:.1f}%)")
        
        if readiness_score == total_checks:
            print("🎉 SYSTEM READY FOR PRODUCTION!")
        else:
            print("⚠️ System needs additional work before production")
        
        print("=" * 60)
        
        return readiness_score == total_checks
        
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(generate_migration_summary())
    
    if success:
        logger.info("Summary completed successfully")
        sys.exit(0)
    else:
        logger.error("Summary generation failed")
        sys.exit(1)
