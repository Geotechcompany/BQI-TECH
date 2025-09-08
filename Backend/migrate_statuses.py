#!/usr/bin/env python3
"""
Migrate application statuses
- Applied → New
- In Review → Shortlisted
"""

import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def migrate_application_statuses():
    """Migrate old application statuses to new ones"""
    connection_string = os.getenv("MONGODB_URI")
    if not connection_string:
        print("❌ MONGODB_URI not found in environment variables")
        return
    
    client = MongoClient(connection_string)
    db = client.BQITECH
    
    print("🔄 BQI TECH - Application Status Migration")
    print("=" * 50)
    
    try:
        # Migration mappings
        migrations = [
            {"from": "Applied", "to": "New"},
            {"from": "In Review", "to": "Shortlisted"}
        ]
        
        total_migrated = 0
        
        for migration in migrations:
            from_status = migration["from"]
            to_status = migration["to"]
            
            print(f"\n🔄 Migrating '{from_status}' → '{to_status}'...")
            
            # Count applications with old status
            count = db.applications.count_documents({"status": from_status})
            print(f"📊 Found {count} applications with status '{from_status}'")
            
            if count > 0:
                # Update all applications with this status
                result = db.applications.update_many(
                    {"status": from_status},
                    {
                        "$set": {
                            "status": to_status,
                            "statusMigratedAt": datetime.utcnow(),
                            "previousStatus": from_status,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                print(f"✅ Migrated {result.modified_count} applications")
                total_migrated += result.modified_count
            else:
                print(f"ℹ️  No applications found with status '{from_status}'")
        
        print(f"\n🎉 MIGRATION SUMMARY:")
        print(f"📊 Total applications migrated: {total_migrated}")
        
        # Show current status distribution
        print(f"\n📈 Current Status Distribution:")
        valid_statuses = ["New", "Shortlisted", "Technical Assessment", "Interviewing", "Hired", "Rejected", "Disqualified"]
        
        for status in valid_statuses:
            count = db.applications.count_documents({"status": status})
            print(f"  - {status}: {count} applications")
        
        # Check for any remaining invalid statuses
        print(f"\n🔍 Checking for invalid statuses...")
        invalid_statuses = []
        
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        
        for result in db.applications.aggregate(pipeline):
            status = result["_id"]
            if status not in valid_statuses:
                invalid_statuses.append({"status": status, "count": result["count"]})
        
        if invalid_statuses:
            print(f"⚠️  Found {len(invalid_statuses)} invalid status(es):")
            for invalid in invalid_statuses:
                print(f"    - '{invalid['status']}': {invalid['count']} applications")
        else:
            print(f"✅ All application statuses are valid!")
        
    except Exception as e:
        print(f"❌ Error during migration: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    migrate_application_statuses()
