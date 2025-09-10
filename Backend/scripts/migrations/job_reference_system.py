#!/usr/bin/env python3

"""
Job Reference System Enhancement for Backend API

This module provides functions to resolve job titles from jobId references
and enhance application data with job information dynamically.
"""

import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId

async def resolve_job_titles(db, applications: List[Dict[Any, Any]]) -> List[Dict[Any, Any]]:
    """
    Resolve job titles for applications based on their jobId references.
    
    Args:
        db: Database connection
        applications: List of application documents
        
    Returns:
        List of applications with resolved job titles
    """
    
    # Get all unique jobIds from applications
    job_ids = []
    for app in applications:
        job_id = app.get('jobId')
        if job_id and job_id not in job_ids:
            job_ids.append(job_id)
    
    if not job_ids:
        # No jobIds to resolve, return applications as-is
        for app in applications:
            app['resolvedJobTitle'] = app.get('position', 'Position Not Available')
        return applications
    
    # Convert string jobIds to ObjectIds for database query
    object_ids = []
    for job_id in job_ids:
        try:
            if isinstance(job_id, str):
                object_ids.append(ObjectId(job_id))
            else:
                object_ids.append(job_id)
        except Exception:
            # Invalid ObjectId, skip
            continue
    
    # Fetch job postings
    job_postings = await db.jobpostings.find({
        "_id": {"$in": object_ids}
    }).to_list(length=None)
    
    # Create jobId to title mapping
    job_title_map = {}
    for job in job_postings:
        job_id_str = str(job['_id'])
        job_title = job.get('title', 'Unknown Position').strip()
        job_title_map[job_id_str] = job_title
    
    # Enhance applications with resolved job titles
    enhanced_applications = []
    for app in applications:
        enhanced_app = app.copy()
        job_id = app.get('jobId')
        
        if job_id and str(job_id) in job_title_map:
            enhanced_app['resolvedJobTitle'] = job_title_map[str(job_id)]
        else:
            # Fallback to position field or default
            enhanced_app['resolvedJobTitle'] = app.get('position', 'Position Not Available')
        
        enhanced_applications.append(enhanced_app)
    
    return enhanced_applications

async def get_job_posting_by_id(db, job_id: str) -> Optional[Dict[Any, Any]]:
    """
    Get a specific job posting by its ID.
    
    Args:
        db: Database connection
        job_id: Job posting ID (string)
        
    Returns:
        Job posting document or None
    """
    try:
        object_id = ObjectId(job_id)
        job_posting = await db.jobpostings.find_one({"_id": object_id})
        return job_posting
    except Exception:
        return None

async def validate_job_reference(db, job_id: str) -> bool:
    """
    Validate that a jobId references an existing job posting.
    
    Args:
        db: Database connection
        job_id: Job posting ID to validate
        
    Returns:
        True if valid, False otherwise
    """
    job_posting = await get_job_posting_by_id(db, job_id)
    return job_posting is not None

async def get_applications_with_job_info(db, query: Dict[Any, Any] = None, limit: int = None) -> List[Dict[Any, Any]]:
    """
    Get applications with automatically resolved job information.
    
    Args:
        db: Database connection
        query: MongoDB query filter
        limit: Maximum number of applications to return
        
    Returns:
        List of applications with resolved job titles
    """
    if query is None:
        query = {}
    
    # Fetch applications
    cursor = db.applications.find(query)
    if limit:
        cursor = cursor.limit(limit)
    
    applications = await cursor.to_list(length=None)
    
    # Resolve job titles
    enhanced_applications = await resolve_job_titles(db, applications)
    
    return enhanced_applications

async def extract_data_from_answers_with_job_resolution(db, application: Dict[Any, Any]) -> Dict[str, Any]:
    """
    Enhanced data extraction that includes job title resolution.
    
    Args:
        db: Database connection
        application: Application document
        
    Returns:
        Dictionary with extracted data including resolved job title
    """
    
    # First resolve the job title
    enhanced_apps = await resolve_job_titles(db, [application])
    enhanced_app = enhanced_apps[0] if enhanced_apps else application
    
    # Extract basic data from answers array
    answers = application.get('answers', [])
    extracted_data = {
        'name': application.get('name', 'NOT SET'),
        'email': application.get('email', 'NOT SET'),
        'position': enhanced_app.get('resolvedJobTitle', 'Position Not Available'),
        'phone': 'NOT SET',
        'motivation': 'NOT SET'
    }
    
    # Process answers to extract information
    for answer in answers:
        question_text = answer.get('questionText', '').lower()
        answer_text = answer.get('answer', '').strip()
        
        if not answer_text:
            continue
        
        # Name extraction
        if any(keyword in question_text for keyword in ['name', 'full name', 'first name', 'last name']):
            if 'first' in question_text:
                extracted_data['firstName'] = answer_text
            elif 'last' in question_text:
                extracted_data['lastName'] = answer_text
            else:
                extracted_data['name'] = answer_text
        
        # Email extraction
        elif 'email' in question_text:
            extracted_data['email'] = answer_text
        
        # Phone extraction
        elif any(keyword in question_text for keyword in ['phone', 'contact', 'mobile', 'telephone']):
            extracted_data['phone'] = answer_text
        
        # Motivation extraction (avoid position confusion)
        elif any(keyword in question_text for keyword in ['motivat', 'why', 'interest', 'reason']) and 'position' not in question_text:
            extracted_data['motivation'] = answer_text
    
    # Combine first and last name if available
    if 'firstName' in extracted_data and 'lastName' in extracted_data:
        extracted_data['name'] = f"{extracted_data['firstName']} {extracted_data['lastName']}"
    
    return extracted_data

# Testing and validation functions

async def test_job_reference_system(db):
    """Test the job reference system functionality"""
    
    print("=== TESTING JOB REFERENCE SYSTEM ===")
    print(f"🕒 Timestamp: {datetime.now()}")
    print("=" * 80)
    
    # Test 1: Resolve job titles for sample applications
    print("\n🧪 Test 1: Job title resolution...")
    
    sample_apps = await db.applications.find({
        "jobId": {"$exists": True, "$ne": None, "$ne": ""}
    }).limit(5).to_list(length=None)
    
    if sample_apps:
        enhanced_apps = await resolve_job_titles(db, sample_apps)
        
        for i, app in enumerate(enhanced_apps):
            job_id = app.get('jobId', 'None')
            resolved_title = app.get('resolvedJobTitle', 'None')
            original_position = app.get('position', 'None')
            
            print(f"   📋 App {i+1}: JobID {job_id} → '{resolved_title}' (was: '{original_position}')")
    else:
        print("   ⚠️  No applications with jobId found for testing")
    
    # Test 2: Validate job references
    print("\n🧪 Test 2: Job reference validation...")
    
    job_postings = await db.jobpostings.find({}).to_list(length=None)
    
    for job in job_postings[:3]:  # Test first 3
        job_id = str(job['_id'])
        is_valid = await validate_job_reference(db, job_id)
        print(f"   ✅ JobID {job_id}: {'Valid' if is_valid else 'Invalid'}")
    
    # Test 3: Enhanced data extraction
    print("\n🧪 Test 3: Enhanced data extraction...")
    
    if sample_apps:
        test_app = sample_apps[0]
        extracted_data = await extract_data_from_answers_with_job_resolution(db, test_app)
        
        print(f"   📋 Sample extraction:")
        print(f"      Name: {extracted_data.get('name', 'N/A')}")
        print(f"      Email: {extracted_data.get('email', 'N/A')}")
        print(f"      Position: {extracted_data.get('position', 'N/A')}")
        print(f"      Phone: {extracted_data.get('phone', 'N/A')}")
    
    print(f"\n✅ Job reference system testing completed!")

if __name__ == "__main__":
    # This module is meant to be imported, but can run tests when executed directly
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))
    from app.database import connect_to_database, get_database
    
    async def run_tests():
        await connect_to_database()
        db = get_database()
        if db is not None:
            await test_job_reference_system(db)
        else:
            print("❌ Failed to connect to database")
    
    asyncio.run(run_tests())
