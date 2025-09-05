#!/usr/bin/env python3

import os
import sys
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

# MongoDB URI
MONGODB_URI = "mongodb+srv://Geotechcompany:Locamade12182@cluster0.r8itkxl.mongodb.net/BQITECH?retryWrites=true&w=majority"

def investigate_cv_links():
    """Investigate why some shortlisted applications have CV links while others don't"""
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client['BQITECH']
        applications_collection = db['applications']
        
        print("✅ Connected to database: BQITECH")
        
        # Get all shortlisted applications
        shortlisted_apps = list(applications_collection.find({"status": "Shortlisted"}))
        
        print(f"\n🔍 Analyzing {len(shortlisted_apps)} shortlisted applications for CV data...")
        
        cv_with_links = 0
        cv_without_links = 0
        
        print("\n📋 CV Link Analysis:")
        print("=" * 80)
        
        for i, app in enumerate(shortlisted_apps, 1):
            # Extract name from answers
            name = "Unknown"
            first_name = ""
            last_name = ""
            email = ""
            cv_link = None
            position = app.get('position', 'N/A')
            
            # Get name and email from answers
            for answer in app.get('answers', []):
                question_text = answer.get('questionText', '').lower()
                if 'first name' in question_text:
                    first_name = answer.get('answer', '').strip()
                elif 'last name' in question_text:
                    last_name = answer.get('answer', '').strip()
                elif 'email' in question_text:
                    email = answer.get('answer', '').strip()
                elif any(keyword in question_text for keyword in ['resume', 'cv', 'upload']):
                    cv_link = answer.get('answer', '').strip()
            
            if first_name and last_name:
                name = f"{first_name} {last_name}"
            
            # Check if CV link exists and is valid
            has_cv_link = bool(cv_link and cv_link.strip() and cv_link != '')
            
            if has_cv_link:
                cv_with_links += 1
                cv_status = "✅ HAS CV"
            else:
                cv_without_links += 1
                cv_status = "❌ NO CV"
            
            print(f"{i:2d}. {name:<25} | {position:<25} | {cv_status}")
            if has_cv_link:
                print(f"    CV URL: {cv_link[:80]}...")
            else:
                print(f"    CV Data: {cv_link if cv_link else 'None found'}")
            
            # Show applied date for pattern analysis
            applied_date = app.get('appliedDate', 'N/A')
            if applied_date != 'N/A':
                print(f"    Applied: {applied_date}")
            print()
        
        print("=" * 80)
        print(f"\n📊 SUMMARY:")
        print(f"   Applications with CV links: {cv_with_links}")
        print(f"   Applications without CV links: {cv_without_links}")
        print(f"   Total shortlisted: {len(shortlisted_apps)}")
        print(f"   CV link coverage: {(cv_with_links/len(shortlisted_apps)*100):.1f}%")
        
        # Analyze by date pattern
        print(f"\n📅 DATE PATTERN ANALYSIS:")
        older_apps = [app for app in shortlisted_apps if app.get('appliedDate', '').startswith('2025-05')]
        newer_apps = [app for app in shortlisted_apps if app.get('appliedDate', '').startswith('2025-08') or app.get('appliedDate', '').startswith('2025-09')]
        
        print(f"   May 2025 applications: {len(older_apps)}")
        print(f"   Aug/Sep 2025 applications: {len(newer_apps)}")
        
        # Check CV links in older vs newer apps
        older_with_cv = 0
        newer_with_cv = 0
        
        for app in older_apps:
            for answer in app.get('answers', []):
                question_text = answer.get('questionText', '').lower()
                if any(keyword in question_text for keyword in ['resume', 'cv', 'upload']):
                    cv_link = answer.get('answer', '').strip()
                    if cv_link and cv_link.strip():
                        older_with_cv += 1
                        break
        
        for app in newer_apps:
            for answer in app.get('answers', []):
                question_text = answer.get('questionText', '').lower()
                if any(keyword in question_text for keyword in ['resume', 'cv', 'upload']):
                    cv_link = answer.get('answer', '').strip()
                    if cv_link and cv_link.strip():
                        newer_with_cv += 1
                        break
        
        older_percentage = (older_with_cv/len(older_apps)*100) if len(older_apps) > 0 else 0
        newer_percentage = (newer_with_cv/len(newer_apps)*100) if len(newer_apps) > 0 else 0
        print(f"   May 2025 apps with CV: {older_with_cv}/{len(older_apps)} ({older_percentage:.1f}%)")
        print(f"   Aug/Sep 2025 apps with CV: {newer_with_cv}/{len(newer_apps)} ({newer_percentage:.1f}%)")
        
        # Close connection
        client.close()
        print("\n✅ CV link investigation complete")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    investigate_cv_links()
