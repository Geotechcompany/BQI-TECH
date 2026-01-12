#!/usr/bin/env python3
"""
Test script for AI email generation
"""
import asyncio
import httpx
import json
import os
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_ai_email_generation():
    """Test the AI email generation endpoint"""
    
    # Get credentials
    username = "admin"
    password = "admin123"
    
    # First, get auth token
    async with httpx.AsyncClient() as client:
        # Login
        login_response = await client.post(
            "http://localhost:9000/auth/login",
            data={"username": username, "password": password}
        )
        
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.status_code}")
            print(login_response.text)
            return
            
        token_data = login_response.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            print("No access token received")
            return
            
        print(f"✅ Login successful, token: {access_token[:20]}...")
        
        # Test AI email generation
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "prompt": "generate an email about our hr portal name suggestions"
        }
        
        print("🤖 Testing AI email generation...")
        ai_response = await client.post(
            "http://localhost:9000/api/admin/emails/ai/generate",
            headers=headers,
            json=payload
        )
        
        print(f"AI Response Status: {ai_response.status_code}")
        print(f"AI Response: {ai_response.text}")
        
        if ai_response.status_code == 200:
            result = ai_response.json()
            print("\n📧 Generated Email:")
            print(f"Subject: {result.get('subject', 'N/A')}")
            print(f"Body: {result.get('body', 'N/A')[:200]}...")
        else:
            print(f"❌ AI generation failed: {ai_response.text}")

if __name__ == "__main__":
    asyncio.run(test_ai_email_generation())
