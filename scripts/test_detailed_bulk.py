#!/usr/bin/env python3
"""
Test script to verify the bulk status update endpoint with proper authentication
"""
import requests
import json
import os
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:9000"
API_URL = f"{BACKEND_URL}/api/admin/applications/bulk-status"

def test_bulk_status_with_auth():
    """Test the bulk status update endpoint with authentication"""
    
    print("=== Testing Bulk Status Update with Authentication ===")
    
    # First, let's see what actual application IDs exist in the database
    print("1. Getting existing applications...")
    
    # Test with minimal valid data
    test_data = {
        "ids": ["507f1f77bcf86cd799439011"],  # Mock ObjectId for now
        "status": "Shortlisted"
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "http://localhost:3000"
    }
    
    try:
        # Test the request structure
        print(f"Testing with data: {json.dumps(test_data, indent=2)}")
        
        response = requests.put(API_URL, json=test_data, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        print(f"Response Headers: {dict(response.headers)}")
        
        # Test with empty data to see validation
        print("\n2. Testing with empty data...")
        empty_data = {}
        response2 = requests.put(API_URL, json=empty_data, headers=headers)
        print(f"Empty data status: {response2.status_code}")
        print(f"Empty data response: {response2.text}")
        
        # Test with invalid status
        print("\n3. Testing with invalid status...")
        invalid_data = {
            "ids": ["507f1f77bcf86cd799439011"],
            "status": "InvalidStatus"
        }
        response3 = requests.put(API_URL, json=invalid_data, headers=headers)
        print(f"Invalid status code: {response3.status_code}")
        print(f"Invalid status response: {response3.text}")
        
        # Test with empty IDs array
        print("\n4. Testing with empty IDs array...")
        empty_ids_data = {
            "ids": [],
            "status": "Shortlisted"
        }
        response4 = requests.put(API_URL, json=empty_ids_data, headers=headers)
        print(f"Empty IDs status: {response4.status_code}")
        print(f"Empty IDs response: {response4.text}")
        
    except Exception as e:
        print(f"Error testing endpoint: {e}")

def test_get_applications():
    """Test getting applications to see the actual data structure"""
    try:
        print("\n=== Testing Get Applications (no auth) ===")
        apps_url = f"{BACKEND_URL}/api/admin/applications"
        response = requests.get(apps_url)
        print(f"Get applications status: {response.status_code}")
        if response.status_code in [401, 403]:
            print("Authentication required (expected)")
        else:
            print(f"Response: {response.text[:500]}...")
    except Exception as e:
        print(f"Error getting applications: {e}")

if __name__ == "__main__":
    test_get_applications()
    test_bulk_status_with_auth()
