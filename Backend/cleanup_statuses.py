#!/usr/bin/env python3
"""
Clean up remaining invalid application statuses
"""

import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def cleanup_invalid_statuses():
    """Clean up remaining invalid application statuses"""
    connection_string = os.getenv("MONGODB_URI")
    if not connection_string:
        print("❌ MONGODB_URI not found in environment variables")
        return
    
    client = MongoClient(connection_string)
    db = client.BQITECH
    
    print("🧹 BQI TECH - Clean Up Invalid Statuses")
    print("=" * 50)
    
    try:
        # Map invalid statuses to valid ones
        cleanup_mappings = [
            {"from": "", "to": "New"},  # Empty status → New
            {"from": "Application", "to": "New"},  # Application → New
            {"from": "Applications", "to": "New"}  # Applications → New
        ]
        
        total_cleaned = 0
        
        for mapping in cleanup_mappings:
            from_status = mapping["from"]
            to_status = mapping["to"]
            
            print(f"\n🧹 Cleaning '{from_status}' → '{to_status}'...")
            
            # Count applications with invalid status
            query = {"status": from_status} if from_status else {"status": {"$in": ["", None]}}
            count = db.applications.count_documents(query)
            print(f"📊 Found {count} applications with status '{from_status}'")
            
            if count > 0:
                # Update all applications with this status
                result = db.applications.update_many(
                    query,
                    {
                        "$set": {
                            "status": to_status,
                            "statusCleanedAt": datetime.utcnow(),
                            "previousStatus": from_status,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                print(f"✅ Cleaned {result.modified_count} applications")
                total_cleaned += result.modified_count
            else:
                print(f"ℹ️  No applications found with status '{from_status}'")
        
        print(f"\n🎉 CLEANUP SUMMARY:")
        print(f"📊 Total applications cleaned: {total_cleaned}")
        
        # Show final status distribution
        print(f"\n📈 Final Status Distribution:")
        valid_statuses = ["New", "Shortlisted", "Technical Assessment", "Interviewing", "Hired", "Rejected", "Disqualified"]
        
        total_valid = 0
        for status in valid_statuses:
            count = db.applications.count_documents({"status": status})
            total_valid += count
            print(f"  - {status}: {count} applications")
        
        # Final check for any remaining invalid statuses
        print(f"\n🔍 Final validation...")
        remaining_invalid = []
        
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        
        for result in db.applications.aggregate(pipeline):
            status = result["_id"]
            if status not in valid_statuses:
                remaining_invalid.append({"status": status, "count": result["count"]})
        
        if remaining_invalid:
            print(f"⚠️  Still found {len(remaining_invalid)} invalid status(es):")
            for invalid in remaining_invalid:
                print(f"    - '{invalid['status']}': {invalid['count']} applications")
        else:
            print(f"✅ All application statuses are now valid!")
            print(f"📊 Total applications: {total_valid}")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    cleanup_invalid_statuses()
