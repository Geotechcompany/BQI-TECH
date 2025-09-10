#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime, timedelta
import json

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database
from bson import ObjectId

async def check_recent_trainee_applications():
    """Check recent trainee applications data structure"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("Failed to connect to database")
            return
            
        applications_collection = db.applications
        
        print("=== RECENT TRAINEE APPLICATIONS ANALYSIS ===")
        print(f"Timestamp: {datetime.now()}")
        print("=" * 70)
        
        # Find recent applications (last 30 days) that might be trainee positions
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        # Search for trainee applications by various criteria
        trainee_queries = [
            {"position": {"$regex": "trainee", "$options": "i"}},
            {"jobDetails.title": {"$regex": "trainee", "$options": "i"}},
            {"answers.answer": {"$regex": "trainee", "$options": "i"}},
        ]
        
        all_trainee_apps = []
        
        for query in trainee_queries:
            # Add recent date filter
            query["appliedDate"] = {"$gte": thirty_days_ago}
            apps = await applications_collection.find(query).to_list(length=None)
            all_trainee_apps.extend(apps)
        
        # Remove duplicates by ID
        unique_apps = {}
        for app in all_trainee_apps:
            app_id = str(app.get('_id'))
            if app_id not in unique_apps:
                unique_apps[app_id] = app
        
        recent_trainee_apps = list(unique_apps.values())
        
        # Sort by applied date (most recent first)
        recent_trainee_apps.sort(key=lambda x: x.get('appliedDate', datetime.min), reverse=True)
        
        print(f"Found {len(recent_trainee_apps)} recent trainee applications")
        print("=" * 70)
        
        # Show detailed analysis of recent trainee apps
        for i, app in enumerate(recent_trainee_apps[:10], 1):  # Show first 10
            print(f"\n--- TRAINEE APPLICATION {i} ---")
            print(f"ID: {app.get('_id')}")
            print(f"Applied Date: {app.get('appliedDate')}")
            print(f"Status: {app.get('status')}")
            print(f"Name (processed): {app.get('name', 'NOT SET')}")
            print(f"Email (processed): {app.get('email', 'NOT SET')}")
            print(f"Position (processed): {app.get('position', 'NOT SET')}")
            
            # Check user details if available
            if 'user' in app and app['user']:
                print(f"User.name: {app['user'].get('name', 'NOT SET')}")
                print(f"User.email: {app['user'].get('email', 'NOT SET')}")
            else:
                print("User data: NOT SET")
            
            # Check job details
            if 'jobDetails' in app and app['jobDetails']:
                print(f"JobDetails.title: {app['jobDetails'].get('title', 'NOT SET')}")
                print(f"JobDetails.department: {app['jobDetails'].get('department', 'NOT SET')}")
            else:
                print("JobDetails: NOT SET")
            
            # Check jobId
            if 'jobId' in app and app['jobId']:
                if isinstance(app['jobId'], dict):
                    print(f"JobId.title: {app['jobId'].get('title', 'NOT SET')}")
                    print(f"JobId._id: {app['jobId'].get('_id', 'NOT SET')}")
                else:
                    print(f"JobId (string): {app['jobId']}")
            else:
                print("JobId: NOT SET")
            
            # Check answers array in detail
            answers = app.get('answers', [])
            if answers and isinstance(answers, list):
                print(f"Answers array length: {len(answers)}")
                print("ALL ANSWERS:")
                for j, answer in enumerate(answers, 1):
                    if answer.get('questionText') and answer.get('answer'):
                        print(f"  {j}. Q: {answer['questionText']}")
                        print(f"     A: {answer['answer']}")
                    else:
                        print(f"  {j}. INCOMPLETE: {answer}")
            else:
                print("Answers array: EMPTY or NOT SET")
            
            print("-" * 50)
        
        # Check for Lucy specifically since she was mentioned
        print("\n=== CHECKING FOR LUCY SPECIFICALLY ===")
        lucy_apps = await applications_collection.find({
            "$or": [
                {"name": {"$regex": "Lucy", "$options": "i"}},
                {"answers.answer": {"$regex": "Lucy", "$options": "i"}},
                {"user.name": {"$regex": "Lucy", "$options": "i"}}
            ]
        }).to_list(length=None)
        
        print(f"Found {len(lucy_apps)} applications mentioning 'Lucy'")
        for app in lucy_apps:
            print(f"\n--- LUCY APPLICATION ---")
            print(f"ID: {app.get('_id')}")
            print(f"Status: {app.get('status')}")
            print(f"Applied Date: {app.get('appliedDate')}")
            print(f"Name (processed): {app.get('name', 'NOT SET')}")
            print(f"Email (processed): {app.get('email', 'NOT SET')}")
            print(f"Position (processed): {app.get('position', 'NOT SET')}")
            
            # Show answers if available
            answers = app.get('answers', [])
            if answers:
                print("Answers:")
                for answer in answers:
                    if answer.get('questionText') and answer.get('answer'):
                        print(f"  Q: {answer['questionText']}")
                        print(f"  A: {answer['answer']}")
        
        # Get overall statistics
        print(f"\n=== OVERALL STATISTICS ===")
        total_apps = await applications_collection.count_documents({})
        recent_apps = await applications_collection.count_documents({
            "appliedDate": {"$gte": thirty_days_ago}
        })
        
        print(f"Total applications in database: {total_apps}")
        print(f"Applications in last 30 days: {recent_apps}")
        print(f"Recent trainee applications: {len(recent_trainee_apps)}")
        
        # Check different statuses
        statuses = await applications_collection.distinct("status")
        print(f"All application statuses: {statuses}")
        
        # Check data completeness patterns
        print("\n=== DATA COMPLETENESS ANALYSIS ===")
        
        # Apps with processed name/email
        apps_with_processed_name = await applications_collection.count_documents({
            "name": {"$exists": True, "$ne": None, "$ne": ""}
        })
        apps_with_processed_email = await applications_collection.count_documents({
            "email": {"$exists": True, "$ne": None, "$ne": ""}
        })
        
        # Apps with answers array
        apps_with_answers = await applications_collection.count_documents({
            "answers": {"$exists": True, "$type": "array", "$ne": []}
        })
        
        # Apps with user data
        apps_with_user = await applications_collection.count_documents({
            "user": {"$exists": True, "$ne": None}
        })
        
        print(f"Applications with processed name: {apps_with_processed_name}/{total_apps}")
        print(f"Applications with processed email: {apps_with_processed_email}/{total_apps}")
        print(f"Applications with answers array: {apps_with_answers}/{total_apps}")
        print(f"Applications with user data: {apps_with_user}/{total_apps}")
        
    except Exception as e:
        print(f"Error checking trainee applications: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_recent_trainee_applications())
