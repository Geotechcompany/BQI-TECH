#!/usr/bin/env python3

import os
import sys
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

# MongoDB URI
MONGODB_URI = "mongodb+srv://Geotechcompany:Locamade12182@cluster0.r8itkxl.mongodb.net/BQITECH?retryWrites=true&w=majority"

def fix_missing_shortlisted_dates():
    """Fix applications that are marked as Shortlisted but missing shortlistedDate field"""
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client['BQITECH']
        applications_collection = db['applications']
        
        print("✅ Connected to database: BQITECH")
        
        # Find all shortlisted applications without shortlistedDate field
        shortlisted_without_date = list(applications_collection.find({
            "status": "Shortlisted",
            "shortlistedDate": {"$exists": False}
        }))
        
        print(f"\n🔍 Found {len(shortlisted_without_date)} shortlisted applications missing shortlistedDate field")
        
        # Set today's date (September 5, 2025)
        today_date = datetime(2025, 9, 5)
        
        trainee_names = [
            "Michael Vukasu", "Beatrice Kilonzo", "Terryann Odinga", "Richard Oluoch",
            "Wycliffe Ochego", "Joyline Kwamboka", "Michael Oyamo", "Felista Kimani",
            "Stacy Nzula", "Aggrey Odhiambo", "Jane Kalondu", "Mercy Mwangi",
            "Dennis Ngugi", "George Mburu"
        ]
        
        fixed_count = 0
        trainee_count = 0
        
        for app in shortlisted_without_date:
            # Extract name from answers
            name = "Unknown"
            first_name = ""
            last_name = ""
            
            for answer in app.get('answers', []):
                if 'First Name' in answer.get('questionText', ''):
                    first_name = answer.get('answer', '').strip()
                elif 'Last Name' in answer.get('questionText', ''):
                    last_name = answer.get('answer', '').strip()
            
            if first_name and last_name:
                name = f"{first_name} {last_name}"
            
            # Check if this is a trainee
            is_trainee = any(trainee_name.lower() in name.lower() or name.lower() in trainee_name.lower() 
                           for trainee_name in trainee_names)
            
            # Update the application with shortlistedDate
            update_result = applications_collection.update_one(
                {"_id": app["_id"]},
                {
                    "$set": {
                        "shortlistedDate": today_date
                    }
                }
            )
            
            if update_result.modified_count > 0:
                fixed_count += 1
                status_indicator = "🎯 TRAINEE" if is_trainee else "👤"
                print(f"   {status_indicator} Fixed: {name} - Set shortlistedDate to {today_date.strftime('%Y-%m-%d')}")
                
                if is_trainee:
                    trainee_count += 1
            else:
                print(f"   ❌ Failed to update: {name}")
        
        print(f"\n✅ Successfully fixed {fixed_count} applications")
        print(f"🎯 {trainee_count} of these were identified as trainees")
        print(f"📅 All shortlistedDate fields set to: {today_date.strftime('%Y-%m-%d')}")
        
        # Verify the fix
        print("\n🔍 Verifying the fix...")
        remaining_without_date = applications_collection.count_documents({
            "status": "Shortlisted",
            "shortlistedDate": {"$exists": False}
        })
        
        print(f"   Remaining applications without shortlistedDate: {remaining_without_date}")
        
        # Show a few examples of the fixed applications
        print("\n📋 Sample of fixed applications:")
        fixed_apps = list(applications_collection.find({
            "status": "Shortlisted",
            "shortlistedDate": today_date
        }).limit(5))
        
        for i, app in enumerate(fixed_apps, 1):
            # Extract name from answers
            name = "Unknown"
            first_name = ""
            last_name = ""
            
            for answer in app.get('answers', []):
                if 'First Name' in answer.get('questionText', ''):
                    first_name = answer.get('answer', '').strip()
                elif 'Last Name' in answer.get('questionText', ''):
                    last_name = answer.get('answer', '').strip()
            
            if first_name and last_name:
                name = f"{first_name} {last_name}"
            
            print(f"   {i}. {name} - Shortlisted Date: {app.get('shortlistedDate', 'N/A')}")
        
        # Close connection
        client.close()
        print("\n✅ Fix complete!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fix_missing_shortlisted_dates()
