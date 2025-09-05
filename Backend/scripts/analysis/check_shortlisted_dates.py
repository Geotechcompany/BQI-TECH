#!/usr/bin/env python3
"""
Check Shortlisted Dates Analysis
Investigates shortlisted applications and their date fields
"""

import os
import sys
import json
from typing import List, Dict, Any
from datetime import datetime
from bson import ObjectId

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.database import get_database

def analyze_shortlisted_dates():
    """Analyze shortlisted applications and their date fields"""
    print("🔍 Checking Shortlisted Applications and Date Fields")
    print("=" * 60)
    
    try:
        # Get database
        db = get_database()
        applications_collection = db.applications
        
        # Find all shortlisted applications
        shortlisted_apps = list(applications_collection.find({
            "status": "Shortlisted"
        }, {
            "_id": 1,
            "name": 1,
            "email": 1,
            "position": 1,
            "jobId": 1,
            "status": 1,
            "shortlistedDate": 1,
            "appliedDate": 1,
            "createdAt": 1,
            "updatedAt": 1
        }))
        
        print(f"📊 Found {len(shortlisted_apps)} shortlisted applications")
        print()
        
        if not shortlisted_apps:
            print("ℹ️  No shortlisted applications found")
            return
        
        # Analyze date fields
        date_analysis = {
            "has_shortlisted_date": 0,
            "missing_shortlisted_date": 0,
            "invalid_shortlisted_date": 0,
            "valid_shortlisted_date": 0
        }
        
        print("📋 Shortlisted Applications Analysis:")
        print("-" * 40)
        
        for i, app in enumerate(shortlisted_apps, 1):
            app_id = str(app.get('_id', 'N/A'))
            name = app.get('name', 'Unknown')
            email = app.get('email', 'No Email')
            position = app.get('position', app.get('jobId', 'N/A'))
            
            print(f"{i}. {name} ({email})")
            print(f"   ID: {app_id}")
            print(f"   Position: {position}")
            print(f"   Status: {app.get('status', 'N/A')}")
            
            # Check shortlisted date
            shortlisted_date = app.get('shortlistedDate')
            if shortlisted_date is None:
                print(f"   Shortlisted Date: ❌ MISSING")
                date_analysis["missing_shortlisted_date"] += 1
            else:
                date_analysis["has_shortlisted_date"] += 1
                try:
                    if isinstance(shortlisted_date, str):
                        parsed_date = datetime.fromisoformat(shortlisted_date.replace('Z', '+00:00'))
                        print(f"   Shortlisted Date: ✅ {parsed_date.strftime('%Y-%m-%d %H:%M:%S')}")
                        date_analysis["valid_shortlisted_date"] += 1
                    elif isinstance(shortlisted_date, datetime):
                        print(f"   Shortlisted Date: ✅ {shortlisted_date.strftime('%Y-%m-%d %H:%M:%S')}")
                        date_analysis["valid_shortlisted_date"] += 1
                    else:
                        print(f"   Shortlisted Date: ⚠️  INVALID TYPE: {type(shortlisted_date)} - {shortlisted_date}")
                        date_analysis["invalid_shortlisted_date"] += 1
                except Exception as e:
                    print(f"   Shortlisted Date: ❌ PARSE ERROR: {shortlisted_date} - {e}")
                    date_analysis["invalid_shortlisted_date"] += 1
            
            # Show other relevant dates
            applied_date = app.get('appliedDate')
            if applied_date:
                try:
                    if isinstance(applied_date, str):
                        parsed_date = datetime.fromisoformat(applied_date.replace('Z', '+00:00'))
                        print(f"   Applied Date: {parsed_date.strftime('%Y-%m-%d %H:%M:%S')}")
                    elif isinstance(applied_date, datetime):
                        print(f"   Applied Date: {applied_date.strftime('%Y-%m-%d %H:%M:%S')}")
                    else:
                        print(f"   Applied Date: {applied_date}")
                except:
                    print(f"   Applied Date: {applied_date}")
            
            created_at = app.get('createdAt')
            if created_at:
                try:
                    if isinstance(created_at, str):
                        parsed_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        print(f"   Created At: {parsed_date.strftime('%Y-%m-%d %H:%M:%S')}")
                    elif isinstance(created_at, datetime):
                        print(f"   Created At: {created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    else:
                        print(f"   Created At: {created_at}")
                except:
                    print(f"   Created At: {created_at}")
            
            print()
        
        # Summary
        print("📈 Date Analysis Summary:")
        print("-" * 30)
        print(f"Total Shortlisted Applications: {len(shortlisted_apps)}")
        print(f"✅ Valid Shortlisted Dates: {date_analysis['valid_shortlisted_date']}")
        print(f"❌ Missing Shortlisted Dates: {date_analysis['missing_shortlisted_date']}")
        print(f"⚠️  Invalid Shortlisted Dates: {date_analysis['invalid_shortlisted_date']}")
        
        # Recommendations
        print("\n💡 Recommendations:")
        if date_analysis['missing_shortlisted_date'] > 0:
            print(f"- Fix {date_analysis['missing_shortlisted_date']} applications missing shortlistedDate")
            print("- Consider setting shortlistedDate when status changes to 'Shortlisted'")
        
        if date_analysis['invalid_shortlisted_date'] > 0:
            print(f"- Fix {date_analysis['invalid_shortlisted_date']} applications with invalid shortlistedDate")
        
        if date_analysis['valid_shortlisted_date'] == len(shortlisted_apps):
            print("- ✅ All shortlisted applications have valid dates!")
        
    except Exception as e:
        print(f"❌ Error analyzing shortlisted dates: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_shortlisted_dates()
