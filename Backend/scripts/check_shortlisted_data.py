#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
import json

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import get_database
from bson import ObjectId

async def check_shortlisted_applications():
    """Check shortlisted applications data structure"""
    try:
        # Import database functions
        from app.database import connect_to_database, get_database
        
        # Connect to database first
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("Failed to connect to database")
            return
            
        applications_collection = db.applications
        
        print("=== SHORTLISTED APPLICATIONS DATA ANALYSIS ===")
        print(f"Timestamp: {datetime.now()}")
        print("=" * 60)
        
        # Find shortlisted applications
        shortlisted_apps = await applications_collection.find({
            "status": "Shortlisted"
        }).to_list(length=None)
        
        print(f"Found {len(shortlisted_apps)} shortlisted applications")
        print("=" * 60)
        
        for i, app in enumerate(shortlisted_apps[:10], 1):  # Show first 10
            print(f"\n--- APPLICATION {i} ---")
            print(f"ID: {app.get('_id')}")
            print(f"Name (processed): {app.get('name', 'NOT SET')}")
            print(f"Email (processed): {app.get('email', 'NOT SET')}")
            print(f"Position (processed): {app.get('position', 'NOT SET')}")
            print(f"Status: {app.get('status')}")
            print(f"Applied Date: {app.get('appliedDate')}")
            
            # Check user details if available
            if 'user' in app and app['user']:
                print(f"User.name: {app['user'].get('name', 'NOT SET')}")
                print(f"User.email: {app['user'].get('email', 'NOT SET')}")
            
            # Check job details
            if 'jobDetails' in app and app['jobDetails']:
                print(f"JobDetails.title: {app['jobDetails'].get('title', 'NOT SET')}")
                print(f"JobDetails.department: {app['jobDetails'].get('department', 'NOT SET')}")
            
            # Check jobId
            if 'jobId' in app and app['jobId']:
                if isinstance(app['jobId'], dict):
                    print(f"JobId.title: {app['jobId'].get('title', 'NOT SET')}")
                    print(f"JobId._id: {app['jobId'].get('_id', 'NOT SET')}")
                else:
                    print(f"JobId (string): {app['jobId']}")
            
            # Check answers array
            answers = app.get('answers', [])
            if answers and isinstance(answers, list):
                print(f"Answers array length: {len(answers)}")
                print("Key answers:")
                for answer in answers:
                    if answer.get('questionText') and answer.get('answer'):
                        question = answer['questionText'].lower()
                        if any(keyword in question for keyword in ['name', 'email', 'position', 'role', 'job']):
                            print(f"  Q: {answer['questionText']}")
                            print(f"  A: {answer['answer']}")
            else:
                print("No answers array or empty")
            
            print("-" * 40)
        
        # Check for specific examples mentioned
        print("\n=== CHECKING SPECIFIC APPLICANTS ===")
        
        # Look for Ananta Saini
        ananta = await applications_collection.find_one({
            "$or": [
                {"name": {"$regex": "Ananta", "$options": "i"}},
                {"answers.answer": {"$regex": "Ananta", "$options": "i"}}
            ]
        })
        
        if ananta:
            print("\n--- ANANTA SAINI APPLICATION ---")
            print(f"Full document: {json.dumps(ananta, indent=2, default=str)}")
        
        # Look for applications with "Junior Salesforce Developer" in position
        junior_apps = await applications_collection.find({
            "$or": [
                {"position": {"$regex": "Junior.*Salesforce", "$options": "i"}},
                {"answers.answer": {"$regex": "Junior.*Salesforce", "$options": "i"}}
            ]
        }).to_list(length=3)
        
        print(f"\n=== APPLICATIONS WITH 'Junior Salesforce Developer' ===")
        for app in junior_apps:
            print(f"Name: {app.get('name')}")
            print(f"Position field: {app.get('position')}")
            print(f"Status: {app.get('status')}")
            
            # Check answers for position
            answers = app.get('answers', [])
            for answer in answers:
                if answer.get('questionText') and 'position' in answer['questionText'].lower():
                    print(f"Position from answers: {answer.get('answer')}")
            print("---")
        
    except Exception as e:
        print(f"Error checking shortlisted applications: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_shortlisted_applications())
