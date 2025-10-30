"""
Job Reference System - Stub Implementation
Provides fallback functions when the full job reference system is not available.
"""

from typing import List, Dict, Any


async def resolve_job_titles(db, applications: List[Dict[Any, Any]]) -> List[Dict[Any, Any]]:
    """
    Resolve job titles for applications based on their jobId references.
    Fallback implementation that uses position field if available.
    
    Args:
        db: Database connection
        applications: List of application documents
        
    Returns:
        List of applications with resolved job titles
    """
    for app in applications:
        # Use existing position field as fallback
        if 'resolvedJobTitle' not in app:
            app['resolvedJobTitle'] = app.get('position', 'Position Not Available')
    
    return applications


async def get_applications_with_job_info(db, query: Dict[Any, Any] = None, limit: int = None) -> List[Dict[Any, Any]]:
    """
    Get applications with enhanced job information.
    Fallback implementation that returns applications as-is.
    
    Args:
        db: Database connection
        query: MongoDB query filter
        limit: Maximum number of results
        
    Returns:
        List of applications
    """
    cursor = db.applications.find(query or {})
    if limit:
        cursor = cursor.limit(limit)
    
    applications = await cursor.to_list(length=None)
    
    # Resolve job titles
    return await resolve_job_titles(db, applications)


async def extract_data_from_answers_with_job_resolution(db, application: Dict[Any, Any]) -> Dict[str, Any]:
    """
    Extract structured data from application answers with job title resolution.
    Fallback implementation with basic extraction.
    
    Args:
        db: Database connection
        application: Application document
        
    Returns:
        Dictionary with extracted data
    """
    answers = application.get('answers', [])
    extracted_data = {
        'name': application.get('name', 'NOT SET'),
        'email': application.get('email', 'NOT SET'),
        'position': application.get('position', 'Position Not Available'),
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
        
        # Motivation extraction
        elif any(keyword in question_text for keyword in ['motivat', 'why', 'interest', 'reason']) and 'position' not in question_text:
            extracted_data['motivation'] = answer_text
    
    # Combine first and last name if available
    if 'firstName' in extracted_data and 'lastName' in extracted_data:
        extracted_data['name'] = f"{extracted_data['firstName']} {extracted_data['lastName']}"
    
    # Use resolved job title if available
    if 'resolvedJobTitle' in application:
        extracted_data['position'] = application['resolvedJobTitle']
    
    return extracted_data

