#!/usr/bin/env python3
"""
Script to check for applicant named Lucy in the MongoDB database
"""
import asyncio
import sys
import os
import json
from datetime import datetime

# Add the app directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_database
from bson import ObjectId

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

async def search_lucy():
    """Search for applications containing 'Lucy' in any field"""
    try:
        # First ensure database connection
        from app.database import connect_to_database
        await connect_to_database()
        
        db = get_database()
        if db is None:
            print("❌ Failed to connect to database")
            return
        
        print("✅ Connected to database successfully")
        print("🔍 Searching for applications containing 'Lucy'...")
        print("=" * 50)
        
        # Search in multiple ways
        search_queries = [
            # Direct search in answers array for Lucy
            {
                "answers": {
                    "$elemMatch": {
                        "answer": {"$regex": "Lucy", "$options": "i"}
                    }
                }
            },
            # Search in userDetails
            {
                "$or": [
                    {"userDetails.name": {"$regex": "Lucy", "$options": "i"}},
                    {"userDetails.email": {"$regex": "Lucy", "$options": "i"}}
                ]
            },
            # Search in any text field that might contain Lucy
            {
                "$or": [
                    {"name": {"$regex": "Lucy", "$options": "i"}},
                    {"email": {"$regex": "Lucy", "$options": "i"}}
                ]
            }
        ]
        
        found_applications = []
        
        for i, query in enumerate(search_queries):
            print(f"\n📋 Query {i+1}: {query}")
            applications = await db.applications.find(query).to_list(length=10)
            
            if applications:
                print(f"✅ Found {len(applications)} applications")
                found_applications.extend(applications)
            else:
                print("❌ No applications found")
        
        # Remove duplicates
        unique_apps = {}
        for app in found_applications:
            unique_apps[str(app['_id'])] = app
        
        if unique_apps:
            print(f"\n🎯 Total unique applications found: {len(unique_apps)}")
            print("=" * 50)
            
            for app_id, app in unique_apps.items():
                print(f"\n📄 Application ID: {app_id}")
                print(f"   Applied Date: {app.get('appliedDate', 'N/A')}")
                print(f"   Status: {app.get('status', 'N/A')}")
                print(f"   Job ID: {app.get('jobId', 'N/A')}")
                
                # Check userDetails
                if app.get('userDetails'):
                    print(f"   👤 User Details:")
                    print(f"      Name: {app['userDetails'].get('name', 'N/A')}")
                    print(f"      Email: {app['userDetails'].get('email', 'N/A')}")
                
                # Check processed fields
                print(f"   📝 Processed Fields:")
                print(f"      Name: {app.get('name', 'N/A')}")
                print(f"      Email: {app.get('email', 'N/A')}")
                print(f"      Position: {app.get('position', 'N/A')}")
                
                # Check answers array
                if app.get('answers'):
                    print(f"   💬 Form Answers ({len(app['answers'])} total):")
                    for j, answer in enumerate(app['answers'][:10]):  # Show first 10
                        q_text = answer.get('questionText', 'No question')
                        a_text = str(answer.get('answer', 'No answer'))
                        print(f"      {j+1}. Q: {q_text}")
                        print(f"         A: {a_text}")
                        if 'lucy' in a_text.lower():
                            print(f"         🎯 CONTAINS LUCY!")
                    
                    if len(app['answers']) > 10:
                        print(f"      ... and {len(app['answers']) - 10} more answers")
                else:
                    print(f"   💬 No answers array found")
                
                print("-" * 30)
        else:
            print("\n❌ No applications found containing 'Lucy'")
            
            # Let's also check a few random applications to see the data structure
            print("\n🔍 Checking a few random applications to understand data structure...")
            random_apps = await db.applications.find({}).limit(3).to_list(length=3)
            
            for i, app in enumerate(random_apps):
                print(f"\n📄 Sample Application {i+1}:")
                print(f"   ID: {app['_id']}")
                print(f"   Has userDetails: {'userDetails' in app}")
                print(f"   Has answers: {'answers' in app and len(app.get('answers', [])) > 0}")
                print(f"   Has name field: {'name' in app}")
                print(f"   Has email field: {'email' in app}")
                
                if app.get('answers'):
                    print(f"   Sample answer questions:")
                    for j, answer in enumerate(app['answers'][:3]):
                        print(f"      - {answer.get('questionText', 'No question')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(search_lucy())
