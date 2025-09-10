#!/usr/bin/env python3

import os
import sys
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

# MongoDB URI (using the same one from other scripts)
MONGODB_URI = "mongodb+srv://Geotechcompany:Locamade12182@cluster0.r8itkxl.mongodb.net/BQITECH?retryWrites=true&w=majority"

def investigate_shortlisted_trainee():
    """Investigate the specific shortlisted trainee record shown by the user"""
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client['BQITECH']
        applications_collection = db['applications']
        
        print("✅ Connected to database: BQITECH")
        
        # First, let's look for the specific application ID from the user's screenshot
        app_id = "68b5d7cf19242f8a74194515"
        
        print(f"\n🔍 Looking for application with ID: {app_id}")
        specific_app = applications_collection.find_one({"_id": ObjectId(app_id)})
        
        if specific_app:
            print("✅ Found the specific application!")
            print(f"   Name: {specific_app.get('name', 'N/A')}")
            print(f"   Email: {specific_app.get('email', 'N/A')}")
            print(f"   Position: {specific_app.get('position', 'N/A')}")
            print(f"   Status: {specific_app.get('status', 'N/A')}")
            print(f"   Applied Date: {specific_app.get('appliedDate', 'N/A')}")
            print(f"   Job ID: {specific_app.get('jobId', 'N/A')}")
            print(f"   Updated At: {specific_app.get('updatedAt', 'N/A')}")
            
            # Check if this application has a shortlisted date
            if 'shortlistedDate' in specific_app:
                print(f"   Shortlisted Date: {specific_app.get('shortlistedDate', 'N/A')}")
            else:
                print("   ⚠️  No shortlistedDate field found")
                
            # Check all fields in this application
            print(f"\n📋 All fields in this application:")
            for key, value in specific_app.items():
                print(f"   {key}: {value}")
        else:
            print("❌ Application not found")
        
        print("\n" + "="*60)
        
        # Now let's search for all shortlisted applications
        print("\n🔍 Searching for ALL shortlisted applications...")
        shortlisted_apps = list(applications_collection.find({"status": "Shortlisted"}))
        
        print(f"✅ Found {len(shortlisted_apps)} shortlisted applications")
        
        for i, app in enumerate(shortlisted_apps, 1):
            print(f"\n{i}. Application: {app.get('name', 'N/A')}")
            print(f"   Position: {app.get('position', 'N/A')}")
            print(f"   Status: {app.get('status', 'N/A')}")
            print(f"   Applied Date: {app.get('appliedDate', 'N/A')}")
            if 'shortlistedDate' in app:
                print(f"   Shortlisted Date: {app.get('shortlistedDate', 'N/A')}")
            else:
                print("   ⚠️  No shortlistedDate field")
        
        print("\n" + "="*60)
        
        # Let's also check for trainee positions specifically
        print("\n🔍 Searching for trainee applications (any status)...")
        trainee_apps = list(applications_collection.find({
            "$or": [
                {"position": {"$regex": "trainee", "$options": "i"}},
                {"position": {"$regex": "intern", "$options": "i"}}
            ]
        }))
        
        print(f"✅ Found {len(trainee_apps)} trainee/intern applications")
        
        trainee_shortlisted = [app for app in trainee_apps if app.get('status') == 'Shortlisted']
        print(f"   - {len(trainee_shortlisted)} are shortlisted")
        
        for app in trainee_shortlisted:
            print(f"   • {app.get('name', 'N/A')} - {app.get('position', 'N/A')} - {app.get('status', 'N/A')}")
        
        # Check if any of the shortlisted applications need their date set to today
        print(f"\n🗓️  Today's date: {datetime.now().strftime('%Y-%m-%d')}")
        
        # Close connection
        client.close()
        print("\n✅ Investigation complete")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    investigate_shortlisted_trainee()
