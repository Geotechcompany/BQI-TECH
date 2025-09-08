#!/usr/bin/env python3
"""
Inspect MongoDB database and collections
"""

import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def inspect_database():
    """Inspect the database and collections"""
    connection_string = os.getenv("MONGODB_URI")
    if not connection_string:
        print("❌ MONGODB_URI not found in environment variables")
        return
    
    client = MongoClient(connection_string)
    
    print("🔍 MongoDB Database Inspection")
    print("=" * 40)
    
    # List all databases
    print("\n📊 Available databases:")
    for db_name in client.list_database_names():
        print(f"  - {db_name}")
    
    # Connect to BQITECH database
    db = client.BQITECH
    
    print(f"\n📋 Collections in BQITECH database:")
    collections = db.list_collection_names()
    for collection_name in collections:
        count = db[collection_name].count_documents({})
        print(f"  - {collection_name}: {count} documents")
    
    # Check for job postings specifically
    if 'job_postings' in collections:
        print(f"\n🎯 Job Postings Collection Details:")
        job_postings = db.job_postings
        
        # Sample a few documents to see structure
        sample_jobs = list(job_postings.find({}).limit(3))
        for i, job in enumerate(sample_jobs, 1):
            print(f"\n  Job {i}:")
            print(f"    _id: {job.get('_id')}")
            print(f"    title: {job.get('title', 'N/A')}")
            print(f"    createdBy: {job.get('createdBy', 'N/A')} (type: {type(job.get('createdBy'))})")
            print(f"    createdAt: {job.get('createdAt', 'N/A')}")
    
    client.close()

if __name__ == "__main__":
    inspect_database()
