#!/usr/bin/env python3
"""
Test status update functionality
"""

import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_status_update():
    """Test the status update API endpoint"""
    connection_string = os.getenv("MONGODB_URI")
    if not connection_string:
        print("❌ MONGODB_URI not found in environment variables")
        return
    
    client = MongoClient(connection_string)
    db = client.BQITECH
    
    print("🧪 Testing Application Status Update")
    print("=" * 40)
    
    # Find a test application
    sample_app = db.applications.find_one({})
    if not sample_app:
        print("❌ No applications found in database for testing")
        return
        
    app_id = str(sample_app['_id'])
    current_status = sample_app.get('status', 'New')
    
    print(f"📋 Test Application ID: {app_id}")
    print(f"📊 Current Status: {current_status}")
    
    # Test status values from the frontend
    test_statuses = [
        "New",
        "Shortlisted",
        "Technical Assessment",
        "Interviewing",
        "Hired",
        "Rejected",
        "Disqualified"
    ]
    
    # Choose a different status for testing
    new_status = next((s for s in test_statuses if s != current_status), "In Review")
    
    print(f"🔄 Testing status change to: {new_status}")
    
    # Test the backend API endpoint
    backend_url = "http://localhost:9000"
    
    try:
        # Test without authentication first to see the response
        response = requests.put(
            f"{backend_url}/api/admin/applications/{app_id}",
            json={"status": new_status},
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📡 API Response Status: {response.status_code}")
        
        if response.status_code == 401:
            print("🔐 Authentication required (expected for admin endpoint)")
        elif response.status_code == 200:
            print("✅ Status update successful!")
            # Verify in database
            updated_app = db.applications.find_one({"_id": sample_app['_id']})
            if updated_app and updated_app.get('status') == new_status:
                print(f"✅ Database updated successfully: {updated_app.get('status')}")
            else:
                print(f"⚠️  Database status mismatch: {updated_app.get('status')}")
        else:
            print(f"❌ Unexpected response: {response.text}")
            
    except Exception as e:
        print(f"❌ API test failed: {str(e)}")
    
    # Test if all status values are valid
    print(f"\n📝 Available Status Options:")
    for i, status in enumerate(test_statuses, 1):
        # Count applications with this status
        count = db.applications.count_documents({"status": status})
        print(f"  {i}. {status}: {count} applications")
    
    client.close()
    print(f"\n✅ Status update functionality test completed!")

if __name__ == "__main__":
    test_status_update()
