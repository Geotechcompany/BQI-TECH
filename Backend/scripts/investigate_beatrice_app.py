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

async def investigate_specific_application():
    """Investigate specific application ID 68b5d7cf19242f8a74194515"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("Failed to connect to database")
            return
            
        applications_collection = db.applications
        
        print("=== INVESTIGATING APPLICATION ID: 68b5d7cf19242f8a74194515 ===")
        print(f"Timestamp: {datetime.now()}")
        print("=" * 70)
        
        # Find the specific application
        app_id = "68b5d7cf19242f8a74194515"
        
        try:
            # Convert to ObjectId
            object_id = ObjectId(app_id)
            application = await applications_collection.find_one({"_id": object_id})
        except Exception as e:
            print(f"Error converting to ObjectId: {e}")
            # Try as string ID
            application = await applications_collection.find_one({"id": app_id})
        
        if not application:
            print(f"APPLICATION NOT FOUND: {app_id}")
            # Search for similar IDs
            similar_apps = await applications_collection.find({
                "_id": {"$regex": app_id[:10]}
            }).to_list(length=5)
            
            if similar_apps:
                print(f"Found {len(similar_apps)} applications with similar IDs:")
                for app in similar_apps:
                    print(f"  - {app.get('_id')}: {app.get('name', 'NO NAME')}")
            return
        
        print(f"FOUND APPLICATION:")
        print(f"MongoDB _id: {application.get('_id')}")
        print(f"Application id field: {application.get('id', 'NOT SET')}")
        print(f"Status: {application.get('status')}")
        print(f"Applied Date: {application.get('appliedDate')}")
        print()
        
        # Examine all position-related fields
        print("=== POSITION DATA ANALYSIS ===")
        print(f"position field: '{application.get('position', 'NOT SET')}'")
        print(f"position type: {type(application.get('position'))}")
        
        # Check jobId and jobDetails
        job_id = application.get('jobId')
        job_details = application.get('jobDetails')
        
        print(f"jobId: {job_id} (type: {type(job_id)})")
        if job_details:
            print(f"jobDetails.title: '{job_details.get('title', 'NOT SET')}'")
            print(f"jobDetails: {json.dumps(job_details, indent=2, default=str)}")
        else:
            print("jobDetails: NOT SET")
        
        # Check user data
        user_data = application.get('user')
        if user_data:
            print(f"user.name: '{user_data.get('name', 'NOT SET')}'")
            print(f"user.email: '{user_data.get('email', 'NOT SET')}'")
        else:
            print("user: NOT SET")
        
        # Check processed name/email fields
        print(f"name (processed): '{application.get('name', 'NOT SET')}'")
        print(f"email (processed): '{application.get('email', 'NOT SET')}'")
        
        # Examine answers array in detail
        answers = application.get('answers', [])
        print(f"\n=== ANSWERS ARRAY ({len(answers)} items) ===")
        
        position_found_in_answers = False
        name_parts = {}
        
        for i, answer in enumerate(answers, 1):
            question = answer.get('questionText', 'NO QUESTION')
            response = answer.get('answer', 'NO ANSWER')
            
            print(f"{i}. Q: {question}")
            print(f"   A: {response}")
            
            # Check for position-related questions
            question_lower = question.lower()
            if any(keyword in question_lower for keyword in ['position', 'job', 'role', 'applying']):
                position_found_in_answers = True
                print(f"   *** POSITION-RELATED QUESTION ***")
            
            # Check for name parts
            if 'first name' in question_lower:
                name_parts['first'] = response
            elif 'last name' in question_lower:
                name_parts['last'] = response
            elif 'email' in question_lower:
                name_parts['email'] = response
            
            print()
        
        # Show what name should be constructed
        if name_parts:
            constructed_name = f"{name_parts.get('first', '')} {name_parts.get('last', '')}".strip()
            print(f"=== NAME CONSTRUCTION ===")
            print(f"First Name from answers: '{name_parts.get('first', 'NOT FOUND')}'")
            print(f"Last Name from answers: '{name_parts.get('last', 'NOT FOUND')}'")
            print(f"Email from answers: '{name_parts.get('email', 'NOT FOUND')}'")
            print(f"Constructed full name: '{constructed_name}'")
            print(f"Expected: 'Beatrice Kilonzo'")
            print()
        
        # Check if position is in answers
        if not position_found_in_answers:
            print("*** NO POSITION-RELATED QUESTIONS FOUND IN ANSWERS ***")
        
        # Now let's check what the job posting says
        if job_id:
            print(f"=== CHECKING JOB POSTING FOR ID: {job_id} ===")
            try:
                # Try different collections for job postings
                collections_to_check = ['job_postings', 'jobs', 'jobPostings']
                job_posting = None
                
                for collection_name in collections_to_check:
                    if hasattr(db, collection_name):
                        collection = getattr(db, collection_name)
                        try:
                            job_posting = await collection.find_one({"_id": ObjectId(job_id)})
                            if job_posting:
                                print(f"Found job in '{collection_name}' collection")
                                break
                        except:
                            try:
                                job_posting = await collection.find_one({"id": job_id})
                                if job_posting:
                                    print(f"Found job in '{collection_name}' collection (string ID)")
                                    break
                            except:
                                pass
                
                if job_posting:
                    print(f"Job Title: '{job_posting.get('title', 'NOT SET')}'")
                    print(f"Job Status: '{job_posting.get('status', 'NOT SET')}'")
                    print(f"Job Department: '{job_posting.get('department', 'NOT SET')}'")
                    print(f"Full job posting: {json.dumps(job_posting, indent=2, default=str)[:500]}...")
                else:
                    print("JOB POSTING NOT FOUND in any collection")
                    
            except Exception as e:
                print(f"Error checking job posting: {e}")
        
        # Check what our frontend logic would produce
        print(f"\n=== FRONTEND LOGIC SIMULATION ===")
        
        # Simulate our position accessor logic
        position_result = "LOGIC ERROR"
        position_source = "unknown"
        
        # First try processed position field
        if application.get('position') and str(application.get('position')).strip() != '' and str(application.get('position')).strip() != 'N/A':
            position_result = str(application.get('position')).strip()
            position_source = "processed_position_field"
        
        # Check if it's a UUID (job reference)
        elif application.get('position') and len(str(application.get('position'))) == 24:  # ObjectId length
            position_result = f"UUID_REFERENCE: {application.get('position')}"
            position_source = "uuid_reference"
        
        # Try job details
        elif job_details and job_details.get('title'):
            position_result = job_details.get('title').strip()
            position_source = "job_details"
        
        # Try answers extraction
        else:
            for answer in answers:
                question = answer.get('questionText', '').lower()
                if any(keyword in question for keyword in ['position', 'job title', 'role', 'applying']):
                    position_result = str(answer.get('answer', '')).strip()
                    position_source = "answers_extraction"
                    break
            else:
                position_result = "N/A"
                position_source = "no_data_found"
        
        print(f"Position Result: '{position_result}'")
        print(f"Position Source: {position_source}")
        print(f"Expected in UI: 'N/A' (as shown in modal)")
        
        if position_result != "N/A":
            print("*** INCONSISTENCY DETECTED ***")
            print("The application shows position data but UI shows 'N/A'")
        
    except Exception as e:
        print(f"Error investigating application: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(investigate_specific_application())
