#!/usr/bin/env python3

from pymongo import MongoClient
import re

MONGODB_URI = "mongodb+srv://Geotechcompany:Locamade12182@cluster0.r8itkxl.mongodb.net/BQITECH?retryWrites=true&w=majority"

def check_newer_applications():
    try:
        client = MongoClient(MONGODB_URI)
        db = client['BQITECH']
        applications_collection = db['applications']

        print('=== NEWER APPLICATIONS ANALYSIS ===')

        # Get newer shortlisted applications (Aug/Sep 2025) - specifically the trainees
        newer_shortlisted = list(applications_collection.find({
            'status': 'Shortlisted',
            'appliedDate': {'$regex': '^2025-0[89]'}
        }))

        print(f"Found {len(newer_shortlisted)} newer shortlisted applications")

        for i, app in enumerate(newer_shortlisted, 1):
            print(f'\n{i}. NEWER Application:')
            print(f'   Applied: {app.get("appliedDate", "N/A")}')
            print(f'   cvUrl field: {app.get("cvUrl", "NOT FOUND")}')
            
            # Check answers for CV
            cv_found = False
            name_parts = []
            
            if app.get('answers'):
                for answer in app.get('answers', []):
                    question = answer.get('questionText', '').lower()
                    
                    # Get name for identification
                    if 'first name' in question:
                        name_parts.append(answer.get('answer', ''))
                    elif 'last name' in question:
                        name_parts.append(answer.get('answer', ''))
                    
                    # Check for CV
                    if 'cv' in question or 'resume' in question or 'upload' in question:
                        cv_url = answer.get('answer', '')
                        print(f'   CV in answers: {cv_url[:60]}...' if cv_url else 'EMPTY')
                        cv_found = True
            
            name = ' '.join(name_parts) if name_parts else 'Unknown'
            print(f'   Name: {name}')
            
            if not cv_found:
                print('   CV in answers: NOT FOUND')

        client.close()
        print('\n=== ANALYSIS COMPLETE ===')
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_newer_applications()
