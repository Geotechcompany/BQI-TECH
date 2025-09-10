#!/usr/bin/env python3

from pymongo import MongoClient
import re

MONGODB_URI = "mongodb+srv://Geotechcompany:Locamade12182@cluster0.r8itkxl.mongodb.net/BQITECH?retryWrites=true&w=majority"

def populate_missing_cv_urls():
    """Populate missing cvUrl fields for newer applications by extracting from answers array"""
    
    try:
        client = MongoClient(MONGODB_URI)
        db = client['BQITECH']
        applications_collection = db['applications']

        print('✅ Connected to database: BQITECH')
        print('\n🔍 Finding applications missing cvUrl field...')

        # Find applications that don't have cvUrl but have answers array
        missing_cv_url = list(applications_collection.find({
            '$or': [
                {'cvUrl': {'$exists': False}},
                {'cvUrl': {'$in': [None, '']}},
            ],
            'answers': {'$exists': True, '$ne': []}
        }))

        print(f'Found {len(missing_cv_url)} applications potentially missing cvUrl field')

        fixed_count = 0
        skipped_count = 0

        for app in missing_cv_url:
            app_id = app['_id']
            
            # Extract name for logging
            name = "Unknown"
            first_name = ""
            last_name = ""
            cv_url = None
            
            for answer in app.get('answers', []):
                question_text = answer.get('questionText', '').lower()
                answer_text = answer.get('answer', '').strip()
                
                if 'first name' in question_text:
                    first_name = answer_text
                elif 'last name' in question_text:
                    last_name = answer_text
                elif any(keyword in question_text for keyword in ['cv', 'resume', 'upload']):
                    if answer_text and len(answer_text) > 10:  # Basic URL validation
                        cv_url = answer_text
            
            if first_name and last_name:
                name = f"{first_name} {last_name}"
            
            if cv_url:
                # Update the application with the extracted CV URL
                result = applications_collection.update_one(
                    {'_id': app_id},
                    {'$set': {'cvUrl': cv_url}}
                )
                
                if result.modified_count > 0:
                    fixed_count += 1
                    print(f'✅ Fixed: {name} - Added cvUrl from answers')
                else:
                    print(f'⚠️  Failed to update: {name}')
            else:
                skipped_count += 1
                print(f'⏭️  Skipped: {name} - No CV found in answers')

        print(f'\n📊 SUMMARY:')
        print(f'   Applications fixed: {fixed_count}')
        print(f'   Applications skipped (no CV): {skipped_count}')
        print(f'   Total processed: {len(missing_cv_url)}')

        # Verify the fix
        print(f'\n🔍 Verifying the fix...')
        remaining_without_cv = applications_collection.count_documents({
            '$or': [
                {'cvUrl': {'$exists': False}},
                {'cvUrl': {'$in': [None, '']}},
            ],
            'answers': {'$exists': True, '$ne': []}
        })

        print(f'   Remaining applications without cvUrl: {remaining_without_cv}')

        # Show some examples of the fixed applications
        print(f'\n📋 Sample of fixed applications:')
        fixed_apps = list(applications_collection.find({
            'cvUrl': {'$exists': True, '$ne': ''},
            'status': 'Shortlisted'
        }).limit(5))

        for i, app in enumerate(fixed_apps, 1):
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
                
            cv_url = app.get('cvUrl', 'N/A')
            cv_preview = cv_url[:50] + '...' if len(cv_url) > 50 else cv_url
            print(f'   {i}. {name} - CV: {cv_preview}')

        client.close()
        print(f'\n✅ CV URL population complete!')

    except Exception as e:
        print(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    populate_missing_cv_urls()
