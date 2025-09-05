"""
Enhanced admin router with job reference system integration
"""

import sys
import os
from typing import List, Dict, Any, Optional

# Add project root to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from job_reference_system import (
    resolve_job_titles, 
    get_applications_with_job_info,
    extract_data_from_answers_with_job_resolution
)

async def get_enhanced_applications(db, query: Dict[Any, Any] = None, limit: int = None) -> List[Dict[Any, Any]]:
    """
    Get applications with enhanced job title resolution and data extraction
    """
    # Get applications with job info
    applications = await get_applications_with_job_info(db, query, limit)
    
    # Enhance each application with extracted data
    enhanced_applications = []
    for app in applications:
        # Extract data from answers with job resolution
        extracted_data = await extract_data_from_answers_with_job_resolution(db, app)
        
        # Merge extracted data with original application
        enhanced_app = app.copy()
        enhanced_app.update(extracted_data)
        
        # Ensure position uses resolved job title
        enhanced_app['position'] = extracted_data.get('position', app.get('resolvedJobTitle', 'Position Not Available'))
        
        enhanced_applications.append(enhanced_app)
    
    return enhanced_applications

def enhance_admin_router_functions():
    """
    Returns enhanced functions to replace in the admin router
    """
    
    # Enhanced applications endpoint function
    async def enhanced_get_applications(db, status_filter: Optional[str] = None, limit: int = 100):
        """Enhanced applications endpoint with job reference system"""
        
        # Build query
        query = {}
        if status_filter and status_filter != "all":
            query["status"] = status_filter
        
        # Get enhanced applications
        applications = await get_enhanced_applications(db, query, limit)
        
        # Convert ObjectIds to strings for JSON serialization
        for app in applications:
            if '_id' in app:
                app['_id'] = str(app['_id'])
            if 'jobId' in app:
                app['jobId'] = str(app['jobId'])
            if 'userId' in app:
                app['userId'] = str(app['userId'])
        
        return applications
    
    # Enhanced shortlisted endpoint function
    async def enhanced_get_shortlisted_applications(db, limit: int = 100):
        """Enhanced shortlisted applications with job reference system"""
        
        query = {"status": "Shortlisted"}
        applications = await get_enhanced_applications(db, query, limit)
        
        # Convert ObjectIds to strings
        for app in applications:
            if '_id' in app:
                app['_id'] = str(app['_id'])
            if 'jobId' in app:
                app['jobId'] = str(app['jobId'])
            if 'userId' in app:
                app['userId'] = str(app['userId'])
        
        return applications
    
    # Enhanced single application endpoint
    async def enhanced_get_application_by_id(db, application_id: str):
        """Get single application with enhanced data"""
        
        try:
            app = await db.applications.find_one({"_id": ObjectId(application_id)})
            if not app:
                return None
            
            # Enhance with job reference system
            enhanced_apps = await get_enhanced_applications(db, {"_id": ObjectId(application_id)}, 1)
            
            if enhanced_apps:
                enhanced_app = enhanced_apps[0]
                # Convert ObjectIds to strings
                if '_id' in enhanced_app:
                    enhanced_app['_id'] = str(enhanced_app['_id'])
                if 'jobId' in enhanced_app:
                    enhanced_app['jobId'] = str(enhanced_app['jobId'])
                if 'userId' in enhanced_app:
                    enhanced_app['userId'] = str(enhanced_app['userId'])
                
                return enhanced_app
            
            return None
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid application ID: {str(e)}")
    
    return {
        'enhanced_get_applications': enhanced_get_applications,
        'enhanced_get_shortlisted_applications': enhanced_get_shortlisted_applications,
        'enhanced_get_application_by_id': enhanced_get_application_by_id
    }

# Code to inject into admin.py
ADMIN_ROUTER_ENHANCEMENTS = '''
# Job Reference System Integration
import sys
import os

# Add Backend directory to path for job reference system
backend_dir = os.path.join(os.path.dirname(__file__), '..', '..')
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

try:
    from job_reference_system import (
        resolve_job_titles, 
        get_applications_with_job_info,
        extract_data_from_answers_with_job_resolution
    )
    JOB_REFERENCE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Job reference system not available: {e}")
    JOB_REFERENCE_AVAILABLE = False

async def get_enhanced_applications_data(db, query: Dict[Any, Any] = None, limit: int = None) -> List[Dict[Any, Any]]:
    """Get applications with enhanced job title resolution and data extraction"""
    
    if not JOB_REFERENCE_AVAILABLE:
        # Fallback to original method
        cursor = db.applications.find(query or {})
        if limit:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=None)
    
    # Get applications with job info
    applications = await get_applications_with_job_info(db, query, limit)
    
    # Enhance each application with extracted data
    enhanced_applications = []
    for app in applications:
        # Extract data from answers with job resolution
        extracted_data = await extract_data_from_answers_with_job_resolution(db, app)
        
        # Merge extracted data with original application
        enhanced_app = app.copy()
        enhanced_app.update(extracted_data)
        
        # Ensure position uses resolved job title
        enhanced_app['position'] = extracted_data.get('position', app.get('resolvedJobTitle', 'Position Not Available'))
        
        enhanced_applications.append(enhanced_app)
    
    return enhanced_applications

def extract_data_with_job_resolution(application, db=None):
    """Enhanced data extraction with job title resolution"""
    
    # Basic data extraction from answers
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
        
        # Motivation extraction (avoid position confusion)
        elif any(keyword in question_text for keyword in ['motivat', 'why', 'interest', 'reason']) and 'position' not in question_text:
            extracted_data['motivation'] = answer_text
    
    # Combine first and last name if available
    if 'firstName' in extracted_data and 'lastName' in extracted_data:
        extracted_data['name'] = f"{extracted_data['firstName']} {extracted_data['lastName']}"
    
    # Use resolved job title if available
    if 'resolvedJobTitle' in application:
        extracted_data['position'] = application['resolvedJobTitle']
    
    return extracted_data
'''

if __name__ == "__main__":
    print("Job Reference System Admin Integration")
    print("=" * 80)
    print("This module provides enhanced admin router functions")
    print("that integrate with the job reference system for:")
    print("- Dynamic job title resolution")
    print("- Enhanced data extraction")
    print("- Consistent position display")
    print("\nUse these functions to replace existing admin router endpoints")
