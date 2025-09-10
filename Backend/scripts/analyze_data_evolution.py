#!/usr/bin/env python3

import asyncio
import sys
import os
from datetime import datetime
import json
from collections import defaultdict

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database
from bson import ObjectId

async def analyze_application_data_evolution():
    """Analyze data structure differences between February and August applications"""
    try:
        # Connect to database
        await connect_to_database()
        db = get_database()
        
        if db is None:
            print("Failed to connect to database")
            return
            
        applications_collection = db.applications
        
        print("=== APPLICATION DATA STRUCTURE EVOLUTION ANALYSIS ===")
        print(f"Timestamp: {datetime.now()}")
        print("=" * 80)
        
        # Define date ranges for comparison
        feb_start = datetime(2025, 2, 1)
        feb_end = datetime(2025, 2, 28, 23, 59, 59)
        
        aug_start = datetime(2025, 8, 1)
        aug_end = datetime(2025, 8, 31, 23, 59, 59)
        
        # Get February applications
        print("\n=== FEBRUARY 2025 APPLICATIONS ===")
        feb_apps = await applications_collection.find({
            "appliedDate": {"$gte": feb_start, "$lte": feb_end}
        }).to_list(length=None)
        
        print(f"Found {len(feb_apps)} applications in February 2025")
        
        # Get August applications
        print("\n=== AUGUST 2025 APPLICATIONS ===")
        aug_apps = await applications_collection.find({
            "appliedDate": {"$gte": aug_start, "$lte": aug_end}
        }).to_list(length=None)
        
        print(f"Found {len(aug_apps)} applications in August 2025")
        
        # Analyze field patterns
        def analyze_field_patterns(apps, period_name):
            print(f"\n=== {period_name} DATA STRUCTURE ANALYSIS ===")
            
            field_stats = defaultdict(lambda: {"present": 0, "null_or_empty": 0, "types": set(), "sample_values": []})
            
            for app in apps:
                for field in ["name", "email", "position", "jobId", "userId", "user", "jobDetails", "answers"]:
                    value = app.get(field)
                    
                    if value is None or value == "" or value == "NOT SET":
                        field_stats[field]["null_or_empty"] += 1
                    else:
                        field_stats[field]["present"] += 1
                        field_stats[field]["types"].add(type(value).__name__)
                        
                        # Collect sample values (first 3)
                        if len(field_stats[field]["sample_values"]) < 3:
                            if field == "answers" and isinstance(value, list):
                                field_stats[field]["sample_values"].append(f"Array[{len(value)}]")
                            elif field in ["user", "jobDetails"] and isinstance(value, dict):
                                field_stats[field]["sample_values"].append("Object")
                            else:
                                field_stats[field]["sample_values"].append(str(value)[:50])
            
            total_apps = len(apps)
            for field, stats in field_stats.items():
                present_pct = (stats["present"] / total_apps * 100) if total_apps > 0 else 0
                null_pct = (stats["null_or_empty"] / total_apps * 100) if total_apps > 0 else 0
                
                print(f"\n{field}:")
                print(f"  Present: {stats['present']}/{total_apps} ({present_pct:.1f}%)")
                print(f"  Null/Empty: {stats['null_or_empty']}/{total_apps} ({null_pct:.1f}%)")
                print(f"  Types: {list(stats['types'])}")
                if stats['sample_values']:
                    print(f"  Samples: {stats['sample_values']}")
        
        # Analyze both periods
        analyze_field_patterns(feb_apps, "FEBRUARY")
        analyze_field_patterns(aug_apps, "AUGUST")
        
        # Show specific examples
        print(f"\n=== DETAILED EXAMPLES ===")
        
        # February example
        if feb_apps:
            feb_example = feb_apps[0]
            print(f"\nFEBRUARY EXAMPLE (ID: {feb_example.get('_id')}):")
            print(f"  Applied Date: {feb_example.get('appliedDate')}")
            print(f"  name: {feb_example.get('name', 'NOT SET')}")
            print(f"  email: {feb_example.get('email', 'NOT SET')}")
            print(f"  position: {feb_example.get('position', 'NOT SET')}")
            print(f"  jobId: {feb_example.get('jobId', 'NOT SET')}")
            print(f"  userId: {feb_example.get('userId', 'NOT SET')}")
            print(f"  user: {'Present' if feb_example.get('user') else 'NOT SET'}")
            print(f"  jobDetails: {'Present' if feb_example.get('jobDetails') else 'NOT SET'}")
            print(f"  answers: {len(feb_example.get('answers', []))} items")
            
            if feb_example.get('answers'):
                print("  Sample answers:")
                for i, answer in enumerate(feb_example['answers'][:3], 1):
                    print(f"    {i}. Q: {answer.get('questionText', 'NO QUESTION')}")
                    print(f"       A: {answer.get('answer', 'NO ANSWER')}")
        
        # August example
        if aug_apps:
            aug_example = aug_apps[0]
            print(f"\nAUGUST EXAMPLE (ID: {aug_example.get('_id')}):")
            print(f"  Applied Date: {aug_example.get('appliedDate')}")
            print(f"  name: {aug_example.get('name', 'NOT SET')}")
            print(f"  email: {aug_example.get('email', 'NOT SET')}")
            print(f"  position: {aug_example.get('position', 'NOT SET')}")
            print(f"  jobId: {aug_example.get('jobId', 'NOT SET')}")
            print(f"  userId: {aug_example.get('userId', 'NOT SET')}")
            print(f"  user: {'Present' if aug_example.get('user') else 'NOT SET'}")
            print(f"  jobDetails: {'Present' if aug_example.get('jobDetails') else 'NOT SET'}")
            print(f"  answers: {len(aug_example.get('answers', []))} items")
            
            if aug_example.get('answers'):
                print("  Sample answers:")
                for i, answer in enumerate(aug_example['answers'][:3], 1):
                    print(f"    {i}. Q: {answer.get('questionText', 'NO QUESTION')}")
                    print(f"       A: {answer.get('answer', 'NO ANSWER')}")
        
        # Check job postings to understand available job titles
        print(f"\n=== JOB POSTINGS ANALYSIS ===")
        try:
            job_postings = await db.jobpostings.find({}).to_list(length=None)
            print(f"Found {len(job_postings)} job postings:")
            
            for job in job_postings[:10]:  # Show first 10
                print(f"  ID: {job.get('_id')} | Title: {job.get('title', 'NO TITLE')} | Status: {job.get('status', 'NO STATUS')}")
        except Exception as e:
            print(f"Error checking job postings: {e}")
        
        # Check for applications with jobId but no position
        print(f"\n=== MIGRATION CANDIDATES ===")
        
        candidates = await applications_collection.find({
            "$and": [
                {"jobId": {"$exists": True, "$ne": None, "$ne": ""}},
                {"$or": [
                    {"position": {"$exists": False}},
                    {"position": None},
                    {"position": ""},
                    {"position": "NOT SET"}
                ]}
            ]
        }).to_list(length=None)
        
        print(f"Found {len(candidates)} applications with jobId but missing position")
        
        if candidates:
            print("Sample candidates:")
            for i, candidate in enumerate(candidates[:5], 1):
                print(f"  {i}. ID: {candidate.get('_id')} | JobId: {candidate.get('jobId')} | Position: {candidate.get('position', 'NOT SET')} | Date: {candidate.get('appliedDate')}")
        
        # Check for applications with position but no jobId
        orphaned = await applications_collection.find({
            "$and": [
                {"position": {"$exists": True, "$ne": None, "$ne": "", "$ne": "NOT SET"}},
                {"$or": [
                    {"jobId": {"$exists": False}},
                    {"jobId": None},
                    {"jobId": ""}
                ]}
            ]
        }).to_list(length=None)
        
        print(f"\nFound {len(orphaned)} applications with position but missing jobId")
        
        if orphaned:
            print("Sample orphaned positions:")
            for i, orphan in enumerate(orphaned[:5], 1):
                print(f"  {i}. ID: {orphan.get('_id')} | Position: {orphan.get('position')} | JobId: {orphan.get('jobId', 'NOT SET')} | Date: {orphan.get('appliedDate')}")
    
    except Exception as e:
        print(f"Error analyzing application data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(analyze_application_data_evolution())
