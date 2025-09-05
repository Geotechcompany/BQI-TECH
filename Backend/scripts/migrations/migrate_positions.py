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

async def migrate_application_positions():
    """
    Migration script to normalize position data across all applications.
    
    This script will:
    1. Find applications with jobId but missing position
    2. Look up job titles from jobpostings collection
    3. Set the position field with the corresponding job title
    4. Report all changes made
    
    IMPORTANT: This script will MODIFY the database!
    """
    
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("❌ Failed to connect to database")
            return
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        print("=== APPLICATION POSITION MIGRATION SCRIPT ===")
        print(f"🕒 Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Step 1: Get all job postings for mapping
        print("\n📋 Step 1: Loading job postings for reference...")
        job_postings = await jobpostings_collection.find({}).to_list(length=None)
        
        # Create jobId to title mapping
        # Applications store jobId as strings, but database stores _id as ObjectId
        job_mapping = {}
        for job in job_postings:
            job_id_str = str(job['_id'])
            job_title = job.get('title', 'Unknown Position').strip()  # Clean any whitespace
            job_mapping[job_id_str] = job_title
            print(f"   📄 {job_id_str} → {job_title}")
        
        print(f"✅ Loaded {len(job_mapping)} job postings")
        
        # Step 2: Find migration candidates
        print("\n🔍 Step 2: Finding applications that need position migration...")
        
        candidates = await applications_collection.find({
            "$and": [
                {"jobId": {"$exists": True, "$ne": None, "$ne": ""}},
                {"$or": [
                    {"position": {"$exists": False}},
                    {"position": None},
                    {"position": ""},
                    {"position": "NOT SET"}
                ]}
            ]
        }).to_list(length=None)
        
        print(f"🎯 Found {len(candidates)} applications requiring position migration")
        
        if not candidates:
            print("✅ No applications need migration. All positions are already set!")
            return
        
        # Step 3: Preview changes
        print("\n📋 Step 3: Previewing planned changes...")
        print("-" * 60)
        
        migration_plan = []
        missing_jobs = set()
        
        for app in candidates:
            app_id = str(app['_id'])
            job_id = app['jobId']
            current_position = app.get('position', 'NOT SET')
            
            if job_id in job_mapping:
                new_position = job_mapping[job_id]
                migration_plan.append({
                    'app_id': app_id,
                    'job_id': job_id,
                    'current_position': current_position,
                    'new_position': new_position,
                    'applied_date': app.get('appliedDate', 'Unknown')
                })
                print(f"📝 {app_id}: '{current_position}' → '{new_position}' (JobID: {job_id})")
            else:
                missing_jobs.add(job_id)
                print(f"⚠️  {app_id}: JobID {job_id} not found in job postings!")
        
        if missing_jobs:
            print(f"\n⚠️  WARNING: {len(missing_jobs)} applications reference missing job postings:")
            for missing_job in missing_jobs:
                print(f"   🚫 JobID: {missing_job}")
        
        print(f"\n📊 MIGRATION SUMMARY:")
        print(f"   ✅ Applications to update: {len(migration_plan)}")
        print(f"   ⚠️  Applications with missing job references: {len(missing_jobs)}")
        
        # Show date range if we have valid dates
        valid_dates = []
        for plan in migration_plan:
            if plan['applied_date'] != 'Unknown' and isinstance(plan['applied_date'], datetime):
                valid_dates.append(plan['applied_date'])
        
        if valid_dates:
            print(f"   📅 Date range: {min(valid_dates)} to {max(valid_dates)}")
        else:
            print(f"   📅 Date range: Unable to determine (no valid dates found)")
        
        # Step 4: Confirm execution
        print(f"\n🚨 IMPORTANT: This will modify {len(migration_plan)} application records in the database!")
        print("This action cannot be easily undone.")
        
        # In a real scenario, you'd want user confirmation here
        # For now, we'll proceed with a dry run flag
        DRY_RUN = True  # Set to False to actually execute
        
        if DRY_RUN:
            print("\n🧪 DRY RUN MODE: No changes will be made to the database")
            print("Set DRY_RUN = False in the script to execute actual migration")
            return
        
        # Step 5: Execute migration
        print(f"\n🚀 Step 4: Executing migration...")
        
        successful_updates = 0
        failed_updates = []
        
        for plan in migration_plan:
            try:
                result = await applications_collection.update_one(
                    {"_id": ObjectId(plan['app_id'])},
                    {"$set": {"position": plan['new_position']}}
                )
                
                if result.modified_count > 0:
                    successful_updates += 1
                    print(f"✅ Updated {plan['app_id']}: position = '{plan['new_position']}'")
                else:
                    failed_updates.append(plan['app_id'])
                    print(f"❌ Failed to update {plan['app_id']}")
                    
            except Exception as e:
                failed_updates.append(plan['app_id'])
                print(f"❌ Error updating {plan['app_id']}: {e}")
        
        # Step 6: Final report
        print(f"\n📋 MIGRATION COMPLETE!")
        print("=" * 80)
        print(f"✅ Successfully updated: {successful_updates} applications")
        print(f"❌ Failed updates: {len(failed_updates)} applications")
        
        if failed_updates:
            print(f"\nFailed application IDs:")
            for failed_id in failed_updates:
                print(f"   🚫 {failed_id}")
        
        # Verification step
        print(f"\n🔍 Verification: Checking remaining candidates...")
        remaining_candidates = await applications_collection.find({
            "$and": [
                {"jobId": {"$exists": True, "$ne": None, "$ne": ""}},
                {"$or": [
                    {"position": {"$exists": False}},
                    {"position": None},
                    {"position": ""},
                    {"position": "NOT SET"}
                ]}
            ]
        }).count_documents({})
        
        print(f"📊 Applications still needing position migration: {remaining_candidates}")
        
        if remaining_candidates == 0:
            print("🎉 SUCCESS: All applications with jobId now have position set!")
        
    except Exception as e:
        print(f"💥 Error during migration: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚨 WARNING: This script will modify your database!")
    print("Please review the code and set DRY_RUN = False to execute actual migration")
    print("\nStarting migration analysis...")
    asyncio.run(migrate_application_positions())
