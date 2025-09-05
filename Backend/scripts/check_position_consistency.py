#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
import json

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database
from bson import ObjectId

async def check_shortlisted_position_data():
    """Check shortlisted applications position data specifically"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("Failed to connect to database")
            return
            
        applications_collection = db.applications
        jobs_collection = db.job_postings  # Check if we have job postings collection
        
        print("=== SHORTLISTED APPLICATIONS POSITION ANALYSIS ===")
        print(f"Timestamp: {datetime.now()}")
        print("=" * 70)
        
        # Find all shortlisted applications
        shortlisted_apps = await applications_collection.find({
            "status": "Shortlisted"
        }).to_list(length=None)
        
        print(f"Found {len(shortlisted_apps)} shortlisted applications")
        print("=" * 70)
        
        # Group by position patterns
        position_data = {}
        job_ids = set()
        
        for app in shortlisted_apps:
            app_id = str(app.get('_id'))
            position_field = app.get('position', 'NOT SET')
            job_id = app.get('jobId')
            job_details = app.get('jobDetails', {})
            
            # Collect job IDs
            if job_id:
                job_ids.add(str(job_id))
            
            # Check what determines the position
            position_source = "UNKNOWN"
            final_position = position_field
            
            if position_field and position_field != 'NOT SET':
                position_source = "position_field"
            elif job_details and job_details.get('title'):
                final_position = job_details['title']
                position_source = "job_details"
            else:
                # Check answers
                answers = app.get('answers', [])
                for answer in answers:
                    if answer.get('questionText') and 'position' in answer['questionText'].lower():
                        final_position = answer.get('answer', 'N/A')
                        position_source = "answers_array"
                        break
            
            position_data[app_id] = {
                'name': app.get('name', 'NOT SET'),
                'position_field': position_field,
                'job_id': str(job_id) if job_id else 'NOT SET',
                'job_details_title': job_details.get('title', 'NOT SET') if job_details else 'NOT SET',
                'final_position': final_position,
                'position_source': position_source,
                'applied_date': app.get('appliedDate')
            }
        
        # Show position inconsistencies
        print("\n=== POSITION DATA ANALYSIS ===")
        position_groups = {}
        for app_id, data in position_data.items():
            pos = data['final_position']
            if pos not in position_groups:
                position_groups[pos] = []
            position_groups[pos].append(data)
        
        for position, apps in position_groups.items():
            print(f"\nPosition: '{position}' ({len(apps)} applications)")
            print(f"Source patterns:")
            sources = {}
            job_ids_for_pos = set()
            for app in apps:
                source = app['position_source']
                if source not in sources:
                    sources[source] = 0
                sources[source] += 1
                if app['job_id'] != 'NOT SET':
                    job_ids_for_pos.add(app['job_id'])
            
            for source, count in sources.items():
                print(f"  - {source}: {count} apps")
            
            print(f"Job IDs: {list(job_ids_for_pos)}")
            
            # Show sample apps
            for i, app in enumerate(apps[:3], 1):
                print(f"  Sample {i}: name={app['name']}, jobId={app['job_id']}, source={app['position_source']}")
        
        # Check actual job postings
        print(f"\n=== JOB POSTINGS ANALYSIS ===")
        print(f"Unique job IDs found: {len(job_ids)}")
        
        try:
            for job_id in list(job_ids)[:10]:  # Check first 10 job IDs
                if job_id != 'NOT SET':
                    # Try to find job posting
                    job_doc = await jobs_collection.find_one({"_id": ObjectId(job_id)})
                    if job_doc:
                        print(f"Job ID {job_id}: {job_doc.get('title', 'NO TITLE')} | Status: {job_doc.get('status', 'NO STATUS')}")
                    else:
                        print(f"Job ID {job_id}: NOT FOUND in job_postings collection")
        except Exception as e:
            print(f"Error checking job postings: {e}")
        
        # Show detailed breakdown of specific cases
        print(f"\n=== DETAILED CASE ANALYSIS ===")
        
        # Find apps with same job ID but different positions
        job_id_groups = {}
        for app_id, data in position_data.items():
            job_id = data['job_id']
            if job_id != 'NOT SET':
                if job_id not in job_id_groups:
                    job_id_groups[job_id] = []
                job_id_groups[job_id].append(data)
        
        for job_id, apps in job_id_groups.items():
            if len(apps) > 1:
                positions = set(app['final_position'] for app in apps)
                if len(positions) > 1:
                    print(f"\nINCONSISTENCY - Job ID {job_id} has {len(positions)} different positions:")
                    for pos in positions:
                        matching_apps = [app for app in apps if app['final_position'] == pos]
                        print(f"  Position '{pos}': {len(matching_apps)} applications")
                        for app in matching_apps[:2]:  # Show 2 examples
                            print(f"    - {app['name']} (source: {app['position_source']})")
        
    except Exception as e:
        print(f"Error checking position data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_shortlisted_position_data())
