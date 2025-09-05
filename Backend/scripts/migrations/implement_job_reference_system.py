#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
from bson import ObjectId

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database

async def implement_job_reference_system():
    """
    Implement job reference system by ensuring all applications have proper jobId references
    instead of duplicating position data. This is the long-term normalization approach.
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
        
        print("=== JOB REFERENCE SYSTEM IMPLEMENTATION ===")
        print(f"🕒 Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Step 1: Create job title to jobId mapping for legacy applications
        print("\n📋 Step 1: Creating job title to jobId mapping...")
        
        job_postings = await jobpostings_collection.find({}).to_list(length=None)
        
        # Create title mappings (case-insensitive)
        title_to_id_map = {}
        id_to_title_map = {}
        
        for job in job_postings:
            job_id = str(job['_id'])
            job_title = job.get('title', '').strip()
            
            id_to_title_map[job_id] = job_title
            title_to_id_map[job_title.lower()] = job_id
            
            print(f"   📄 {job_title} → {job_id}")
        
        print(f"✅ Loaded {len(job_postings)} job postings for reference")
        
        # Step 2: Find applications that need jobId assignment
        print(f"\n🔍 Step 2: Finding applications that need jobId assignment...")
        
        # Find applications with position but no jobId (old format)
        legacy_apps = await applications_collection.find({
            "$and": [
                {"position": {"$exists": True, "$ne": None, "$ne": "", "$ne": "NOT SET"}},
                {"$or": [
                    {"jobId": {"$exists": False}},
                    {"jobId": None},
                    {"jobId": ""}
                ]}
            ]
        }).to_list(length=None)
        
        print(f"🎯 Found {len(legacy_apps)} legacy applications needing jobId assignment")
        
        # Step 3: Create assignment plan
        print(f"\n📋 Step 3: Creating jobId assignment plan...")
        
        assignment_plan = []
        unmatched_positions = set()
        
        for app in legacy_apps:
            app_id = str(app['_id'])
            position = app.get('position', '').strip()
            current_job_id = app.get('jobId', 'NOT SET')
            
            # Try to match position to existing job posting
            matched_job_id = None
            
            # Direct match
            if position.lower() in title_to_id_map:
                matched_job_id = title_to_id_map[position.lower()]
            else:
                # Partial match for common variations
                for title, job_id in title_to_id_map.items():
                    if position.lower() in title.lower() or title.lower() in position.lower():
                        matched_job_id = job_id
                        break
            
            if matched_job_id:
                assignment_plan.append({
                    'app_id': app_id,
                    'position': position,
                    'matched_job_id': matched_job_id,
                    'matched_title': id_to_title_map[matched_job_id],
                    'applied_date': app.get('appliedDate', 'Unknown')
                })
                print(f"📝 {app_id}: '{position}' → JobID: {matched_job_id} ({id_to_title_map[matched_job_id]})")
            else:
                unmatched_positions.add(position)
                print(f"⚠️  {app_id}: '{position}' → NO MATCH FOUND")
        
        if unmatched_positions:
            print(f"\n⚠️  WARNING: {len(unmatched_positions)} unique positions couldn't be matched:")
            for pos in unmatched_positions:
                print(f"   🚫 '{pos}'")
        
        # Step 4: Validate current data
        print(f"\n🔍 Step 4: Validating current job reference data...")
        
        # Check applications with jobId but verify the job posting exists
        apps_with_jobid = await applications_collection.find({
            "jobId": {"$exists": True, "$ne": None, "$ne": ""}
        }).to_list(length=None)
        
        print(f"📊 Found {len(apps_with_jobid)} applications with existing jobId")
        
        # Validate job references
        valid_refs = 0
        invalid_refs = []
        
        for app in apps_with_jobid:
            job_id = app.get('jobId')
            if job_id in id_to_title_map:
                valid_refs += 1
            else:
                invalid_refs.append({
                    'app_id': str(app['_id']),
                    'job_id': job_id,
                    'applied_date': app.get('appliedDate', 'Unknown')
                })
        
        print(f"✅ Valid job references: {valid_refs}")
        print(f"❌ Invalid job references: {len(invalid_refs)}")
        
        if invalid_refs:
            print("Invalid references:")
            for invalid in invalid_refs[:5]:  # Show first 5
                print(f"   🚫 App: {invalid['app_id']} | JobID: {invalid['job_id']}")
        
        # Step 5: Summary and execution plan
        print(f"\n📊 IMPLEMENTATION SUMMARY:")
        print(f"   🔄 Applications to assign jobId: {len(assignment_plan)}")
        print(f"   ✅ Applications with valid jobId: {valid_refs}")
        print(f"   ❌ Applications with invalid jobId: {len(invalid_refs)}")
        print(f"   🚫 Unmatched positions: {len(unmatched_positions)}")
        
        # Check dry run mode
        DRY_RUN = True  # Set to False to execute
        
        if DRY_RUN:
            print(f"\n🧪 DRY RUN MODE: No changes will be made")
            print("Set DRY_RUN = False to execute actual updates")
            return
        
        # Step 6: Execute jobId assignments
        print(f"\n🚀 Step 6: Executing jobId assignments...")
        
        successful_assignments = 0
        failed_assignments = []
        
        for plan in assignment_plan:
            try:
                result = await applications_collection.update_one(
                    {"_id": ObjectId(plan['app_id'])},
                    {"$set": {"jobId": plan['matched_job_id']}}
                )
                
                if result.modified_count > 0:
                    successful_assignments += 1
                    print(f"✅ Assigned {plan['app_id']}: jobId = {plan['matched_job_id']}")
                else:
                    failed_assignments.append(plan['app_id'])
                    print(f"❌ Failed to assign {plan['app_id']}")
                    
            except Exception as e:
                failed_assignments.append(plan['app_id'])
                print(f"❌ Error assigning {plan['app_id']}: {e}")
        
        # Step 7: Final report
        print(f"\n📋 IMPLEMENTATION COMPLETE!")
        print("=" * 80)
        print(f"✅ Successfully assigned jobId: {successful_assignments} applications")
        print(f"❌ Failed assignments: {len(failed_assignments)} applications")
        
        if failed_assignments:
            print(f"\nFailed application IDs:")
            for failed_id in failed_assignments:
                print(f"   🚫 {failed_id}")
        
        # Verification
        print(f"\n🔍 Verification: Checking final state...")
        
        # Count applications without jobId
        apps_without_jobid = await applications_collection.count_documents({
            "$or": [
                {"jobId": {"$exists": False}},
                {"jobId": None},
                {"jobId": ""}
            ]
        })
        
        # Count applications with jobId
        apps_with_jobid = await applications_collection.count_documents({
            "jobId": {"$exists": True, "$ne": None, "$ne": ""}
        })
        
        print(f"📊 Final state:")
        print(f"   ✅ Applications with jobId: {apps_with_jobid}")
        print(f"   ❌ Applications without jobId: {apps_without_jobid}")
        
        if apps_without_jobid == 0:
            print("🎉 SUCCESS: All applications now have jobId references!")
        else:
            print(f"⚠️  {apps_without_jobid} applications still need manual jobId assignment")
            
        # Next steps
        print(f"\n📋 NEXT STEPS:")
        print("1. Update backend API to resolve job titles from jobpostings collection")
        print("2. Update frontend components to handle job title resolution")
        print("3. Consider removing position field after full migration")
        print("4. Implement job reference validation in application creation")
        
    except Exception as e:
        print(f"💥 Error during implementation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔄 Starting job reference system implementation...")
    print("This approach normalizes data by using jobId references instead of duplicating position data")
    asyncio.run(implement_job_reference_system())
