#!/usr/bin/env python3

from pymongo import MongoClient

MONGODB_URI = "mongodb+srv://Geotechcompany:Locamade12182@cluster0.r8itkxl.mongodb.net/BQITECH?retryWrites=true&w=majority"

def quick_cv_analysis():
    try:
        client = MongoClient(MONGODB_URI)
        db = client['BQITECH']
        applications_collection = db['applications']

        print('=== CV LINK ISSUE INVESTIGATION ===')

        # Get a few shortlisted applications
        shortlisted = list(applications_collection.find({'status': 'Shortlisted'}).limit(8))

        for i, app in enumerate(shortlisted, 1):
            print(f'\n{i}. Application Analysis:')
            app_id = str(app.get('_id', 'N/A'))
            applied_date = app.get('appliedDate', 'N/A')
            cv_url_field = app.get('cvUrl', 'NOT FOUND')
            
            print(f'   Applied Date: {applied_date}')
            print(f'   cvUrl field: {cv_url_field}')
            
            # Check for CV in answers
            cv_in_answers = None
            if app.get('answers'):
                for answer in app.get('answers', []):
                    question_text = answer.get('questionText', '').lower()
                    if any(keyword in question_text for keyword in ['cv', 'resume', 'upload']):
                        cv_in_answers = answer.get('answer', '')
                        print(f'   CV in answers: {cv_in_answers[:60]}...')
                        break
            
            if not cv_in_answers:
                print(f'   CV in answers: NOT FOUND')
            
            # Extract name for reference
            name = "Unknown"
            for answer in app.get('answers', []):
                question_text = answer.get('questionText', '').lower()
                if 'first name' in question_text:
                    first_name = answer.get('answer', '').strip()
                elif 'last name' in question_text:
                    last_name = answer.get('answer', '').strip()
            
            try:
                if 'first_name' in locals() and 'last_name' in locals():
                    name = f"{first_name} {last_name}"
            except:
                pass
                
            print(f'   Name: {name}')

        client.close()
        print('\n=== ANALYSIS COMPLETE ===')
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    quick_cv_analysis()
