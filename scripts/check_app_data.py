#!/usr/bin/env python3
"""
Script to check actual application data structure in the database
"""
import asyncio
import os
import sys
from bson import ObjectId
from datetime import datetime

# Add the Backend directory to Python path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Backend')
sys.path.insert(0, backend_path)

from app.database import get_database

async def check_application_data():
    """Check the actual application data structure"""
    
    print("=== Checking Application Data Structure ===")
    
    # Get database connection
    db = get_database()
    if not db:
        print("❌ Could not connect to database")
        return
        
    print("✅ Connected to database")
    
    # Get a few sample applications
    try:
        applications = await db.applications.find().limit(3).to_list(length=3)
        
        print(f"\n📊 Found {len(applications)} sample applications")
        
        for i, app in enumerate(applications, 1):
            print(f"\n--- Application {i} ---")
            print(f"ID: {app.get('_id')} (type: {type(app.get('_id'))})")
            print(f"Status: {app.get('status')} (type: {type(app.get('status'))})")
            print(f"Name: {app.get('name', 'N/A')}")
            print(f"Email: {app.get('email', 'N/A')}")
            print(f"Created: {app.get('createdAt', 'N/A')}")
            
            # Check if it has an 'id' field (sometimes different from '_id')
            if 'id' in app:
                print(f"id field: {app.get('id')} (type: {type(app.get('id'))})")
                
        # Test ObjectId conversion with actual IDs
        print("\n=== Testing ObjectId Conversion ===")
        for app in applications[:1]:  # Test with first application
            app_id = app.get('_id')
            try:
                if isinstance(app_id, ObjectId):
                    print(f"✅ ID is already ObjectId: {app_id}")
                    # Convert to string and back
                    id_str = str(app_id)
                    back_to_objectid = ObjectId(id_str)
                    print(f"✅ String conversion works: {id_str} -> {back_to_objectid}")
                else:
                    print(f"⚠️  ID is not ObjectId: {app_id} (type: {type(app_id)})")
                    # Try to convert to ObjectId
                    converted = ObjectId(app_id)
                    print(f"✅ Conversion successful: {converted}")
                    
            except Exception as e:
                print(f"❌ ObjectId conversion failed: {e}")
                
    except Exception as e:
        print(f"❌ Error fetching applications: {e}")

if __name__ == "__main__":
    asyncio.run(check_application_data())
