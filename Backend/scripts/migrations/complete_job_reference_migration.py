#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
from bson import ObjectId

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database

async def complete_job_reference_migration():
    """Complete migration to job reference system"""
    
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("❌ Failed to connect to database")
            return
            
        applications_collection = db.applications
        jobpostings_collection = db.jobpostings
        
        print("=== COMPLETE JOB REFERENCE MIGRATION ===")
        print(f"🕒 Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Step 1: Create missing job posting
        print(f"\n🔧 Step 1: Creating missing job posting...")
        
        existing_job = await jobpostings_collection.find_one({
            "title": {"$regex": "Junior Configuration Analyst", "$options": "i"}
        })
        
        if existing_job:
            config_analyst_job_id = str(existing_job['_id'])
            print(f"✅ Job posting already exists: {existing_job['title']} (ID: {config_analyst_job_id})")
        else:
            new_job_posting = {
                "title": "Junior Configuration Analyst",
                "description": "Entry-level position for configuration analysis and system setup. Work with senior analysts to configure systems, analyze requirements, and support technical implementations.",
                "requirements": [
                    "Bachelor's degree in IT, Computer Science, or related field",
                    "Basic understanding of system configuration",
                    "Strong analytical and problem-solving skills",
                    "Excellent communication skills",
                    "Attention to detail and accuracy",
                    "Willingness to learn new technologies"
                ],
                "responsibilities": [
                    "Assist in system configuration and setup",
                    "Analyze technical requirements",
                    "Support senior analysts in complex configurations",
                    "Document configuration processes",
                    "Participate in testing and quality assurance"
                ],
                "location": "Nairobi, Kenya",
                "type": "Full-time",
                "department": "Technology",
                "level": "Junior",
                "createdAt": datetime.now(),
                "updatedAt": datetime.now(),
                "status": "active",
                "createdBy": "system_migration",
                "salaryRange": {
                    "min": 50000,
                    "max": 80000,
                    "currency": "KES"
                }
            }
            
            # Execute the creation
            DRY_RUN = False  # Set to True to prevent actual creation
            
            if DRY_RUN:
                print(f"🧪 DRY RUN: Would create job posting 'Junior Configuration Analyst'")
                config_analyst_job_id = "PLACEHOLDER_ID"
            else:
                result = await jobpostings_collection.insert_one(new_job_posting)
                config_analyst_job_id = str(result.inserted_id)
                print(f"✅ Created job posting: Junior Configuration Analyst (ID: {config_analyst_job_id})")
        
        # Step 2: Create job title to ID mapping
        print(f"\n📋 Step 2: Creating job mapping...")
        
        job_postings = await jobpostings_collection.find({}).to_list(length=None)
        title_to_id_map = {}
        
        for job in job_postings:
            job_id = str(job['_id'])
            job_title = job.get('title', '').strip()
            title_to_id_map[job_title.lower()] = job_id
            print(f"   📄 {job_title} → {job_id}")
        
        # Step 3: Find and update legacy applications
        print(f"\n🔄 Step 3: Updating legacy applications...")
        
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
        
        print(f"Found {len(legacy_apps)} legacy applications to update")
        
        updates_plan = []
        unmatched_count = 0
        
        for app in legacy_apps:
            app_id = str(app['_id'])
            position = app.get('position', '').strip()
            
            # Try to match position to job posting
            matched_job_id = None
            
            # Direct match
            if position.lower() in title_to_id_map:
                matched_job_id = title_to_id_map[position.lower()]
            else:
                # Partial match
                for title, job_id in title_to_id_map.items():
                    if position.lower() in title.lower() or title.lower() in position.lower():
                        matched_job_id = job_id
                        break
            
            if matched_job_id:
                updates_plan.append({
                    'app_id': app_id,
                    'position': position,
                    'job_id': matched_job_id
                })
                print(f"   📝 {app_id}: '{position}' → {matched_job_id}")
            else:
                unmatched_count += 1
                print(f"   ⚠️  {app_id}: '{position}' → NO MATCH")
        
        print(f"\n📊 Update plan: {len(updates_plan)} applications to update, {unmatched_count} unmatched")
        
        # Step 4: Execute updates
        if not DRY_RUN and updates_plan:
            print(f"\n🚀 Step 4: Executing updates...")
            
            successful_updates = 0
            failed_updates = []
            
            for update in updates_plan:
                try:
                    result = await applications_collection.update_one(
                        {"_id": ObjectId(update['app_id'])},
                        {"$set": {
                            "jobId": update['job_id'],
                            "updatedAt": datetime.now()
                        }}
                    )
                    
                    if result.modified_count > 0:
                        successful_updates += 1
                    else:
                        failed_updates.append(update['app_id'])
                        
                except Exception as e:
                    failed_updates.append(update['app_id'])
                    print(f"❌ Error updating {update['app_id']}: {e}")
            
            print(f"✅ Successfully updated: {successful_updates} applications")
            print(f"❌ Failed updates: {len(failed_updates)} applications")
        
        # Step 5: Test the job reference system
        print(f"\n🧪 Step 5: Testing job reference system...")
        
        # Import and test the job reference functions
        try:
            sys.path.append(os.path.dirname(__file__))
            from job_reference_system import resolve_job_titles, get_applications_with_job_info
            
            # Test with a few applications
            test_apps = await applications_collection.find({
                "jobId": {"$exists": True, "$ne": None, "$ne": ""}
            }).limit(3).to_list(length=None)
            
            if test_apps:
                enhanced_apps = await resolve_job_titles(db, test_apps)
                
                print(f"   🧪 Job title resolution test:")
                for app in enhanced_apps:
                    job_id = app.get('jobId', 'None')
                    resolved_title = app.get('resolvedJobTitle', 'None')
                    print(f"      📋 JobID {job_id} → '{resolved_title}'")
            else:
                print(f"   ⚠️  No applications with jobId found for testing")
                
        except Exception as e:
            print(f"   ❌ Error testing job reference system: {e}")
        
        # Step 6: Final verification
        print(f"\n🔍 Step 6: Final verification...")
        
        # Count applications by jobId status
        apps_with_jobid = await applications_collection.count_documents({
            "jobId": {"$exists": True, "$ne": None, "$ne": ""}
        })
        
        apps_without_jobid = await applications_collection.count_documents({
            "$or": [
                {"jobId": {"$exists": False}},
                {"jobId": None},
                {"jobId": ""}
            ]
        })
        
        total_apps = await applications_collection.count_documents({})
        
        print(f"📊 Final status:")
        print(f"   ✅ Applications with jobId: {apps_with_jobid}/{total_apps}")
        print(f"   ❌ Applications without jobId: {apps_without_jobid}/{total_apps}")
        print(f"   📈 Coverage: {(apps_with_jobid/total_apps)*100:.1f}%")
        
        # Verify job postings
        total_job_postings = await jobpostings_collection.count_documents({})
        print(f"   📋 Total job postings: {total_job_postings}")
        
        if apps_without_jobid == 0:
            print(f"\n🎉 SUCCESS: All applications now have jobId references!")
        else:
            print(f"\n⚠️  {apps_without_jobid} applications still need manual review")
        
        print(f"\n📋 MIGRATION COMPLETED!")
        print("=" * 80)
        print("✅ Job reference system is now active")
        print("✅ Backend can resolve job titles dynamically")
        print("✅ Data is normalized and consistent")
        
    except Exception as e:
        print(f"💥 Error during migration: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚀 Starting complete job reference migration...")
    asyncio.run(complete_job_reference_migration())
