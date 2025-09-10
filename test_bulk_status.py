#!/usr/bin/env python3
"""
Test script to verify the bulk status update endpoint
"""
import requests
import json
import os
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:9000"
API_URL = f"{BACKEND_URL}/api/admin/applications/bulk-status"

def test_bulk_status_update():
    """Test the bulk status update endpoint"""
    
    # First, let's test without authentication to see the CORS behavior
    print("=== Testing Bulk Status Update Endpoint ===")
    print(f"Testing URL: {API_URL}")
    
    # Test data
    test_data = {
        "ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],  # Mock ObjectIds
        "status": "Shortlisted"
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "http://localhost:3000"
    }
    
    try:
        # Test OPTIONS request (CORS preflight)
        print("\n1. Testing OPTIONS request (CORS preflight)...")
        options_response = requests.options(API_URL, headers=headers)
        print(f"OPTIONS Status: {options_response.status_code}")
        print(f"OPTIONS Headers: {dict(options_response.headers)}")
        
        # Test PUT request without auth (should get 401 or proper error)
        print("\n2. Testing PUT request without authentication...")
        put_response = requests.put(API_URL, json=test_data, headers=headers)
        print(f"PUT Status: {put_response.status_code}")
        print(f"PUT Response: {put_response.text}")
        
        # Test with invalid data
        print("\n3. Testing PUT request with invalid data...")
        invalid_data = {"ids": [], "status": "InvalidStatus"}
        invalid_response = requests.put(API_URL, json=invalid_data, headers=headers)
        print(f"Invalid Data Status: {invalid_response.status_code}")
        print(f"Invalid Data Response: {invalid_response.text}")
        
    except Exception as e:
        print(f"Error testing endpoint: {e}")

def test_health_check():
    """Test if the backend is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        print(f"Backend health check: {response.status_code}")
        if response.status_code == 200:
            print(f"Backend response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Backend not accessible: {e}")
        return False

if __name__ == "__main__":
    print("=== Backend Health Check ===")
    if test_health_check():
        print("✅ Backend is running")
        test_bulk_status_update()
    else:
        print("❌ Backend is not accessible")
