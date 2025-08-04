#!/usr/bin/env python3
"""
Test script for verification code system
Run this to test the 10-minute expiration and storage functionality
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta

# Add the app directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import connect_to_database, get_database
from app.lib.email import send_verification_code, verify_code, get_verification_status, cleanup_expired_verification_codes


async def test_verification_system():
    """Test the verification code system"""
    print("🔧 Testing Verification Code System")
    print("=" * 50)
    
    try:
        # Connect to database
        await connect_to_database()
        print("✅ Connected to database")
        
        # Test email
        test_email = "test@example.com"
        print(f"📧 Testing with email: {test_email}")
        
        # 1. Send verification code
        print("\n1️⃣ Sending verification code...")
        code = await send_verification_code(test_email)
        
        if code:
            print(f"✅ Code generated and stored: {code}")
        else:
            print("❌ Failed to send verification code")
            return
        
        # 2. Check verification status
        print("\n2️⃣ Checking verification status...")
        status = await get_verification_status(test_email)
        print(f"📊 Status: {status}")
        
        if status.get("exists"):
            time_left = status.get("timeLeft", 0)
            print(f"⏰ Time left: {time_left:.1f} seconds ({time_left/60:.1f} minutes)")
        
        # 3. Test correct code verification
        print("\n3️⃣ Testing correct code verification...")
        is_valid = await verify_code(test_email, code)
        print(f"✅ Correct code verification: {'PASSED' if is_valid else 'FAILED'}")
        
        # 4. Test incorrect code verification
        print("\n4️⃣ Testing incorrect code verification...")
        is_invalid = await verify_code(test_email, "123456")
        print(f"✅ Incorrect code rejection: {'PASSED' if not is_invalid else 'FAILED'}")
        
        # 5. Test used code verification
        print("\n5️⃣ Testing used code verification...")
        is_used = await verify_code(test_email, code)
        print(f"✅ Used code rejection: {'PASSED' if not is_used else 'FAILED'}")
        
        # 6. Test status after verification
        print("\n6️⃣ Checking status after verification...")
        final_status = await get_verification_status(test_email)
        print(f"📊 Final status: {final_status}")
        
        # 7. Test cleanup
        print("\n7️⃣ Testing cleanup...")
        cleaned = await cleanup_expired_verification_codes()
        print(f"🧹 Cleaned up {cleaned} expired codes")
        
        # 8. Test database collection
        print("\n8️⃣ Checking database collection...")
        db = get_database()
        count = await db.verification_codes.count_documents({})
        print(f"📊 Total verification codes in DB: {count}")
        
        # List all codes for this test email
        codes = await db.verification_codes.find({"email": test_email}).to_list(None)
        print(f"📋 Codes for {test_email}:")
        for code_doc in codes:
            expires_at = code_doc.get("expiresAt", "N/A")
            used = code_doc.get("used", False)
            attempts = code_doc.get("attempts", 0)
            print(f"  - Code: {code_doc.get('code')}, Expires: {expires_at}, Used: {used}, Attempts: {attempts}")
        
        print("\n✅ Verification code system test completed!")
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


async def test_expiration():
    """Test that codes expire after 10 minutes"""
    print("\n🕐 Testing 10-minute expiration...")
    print("=" * 30)
    
    try:
        db = get_database()
        test_email = "expiration-test@example.com"
        
        # Create a code that expires in 1 second for testing
        from app.lib.email import store_verification_code
        test_code = "999999"
        
        print("⏰ Creating code that expires in 1 second...")
        stored = await store_verification_code(test_email, test_code, expires_in_minutes=0.0167)  # 1 second
        
        if stored:
            print("✅ Test code created")
            
            # Wait 2 seconds
            print("⏳ Waiting 2 seconds...")
            await asyncio.sleep(2)
            
            # Try to verify expired code
            print("🔍 Testing expired code...")
            is_valid = await verify_code(test_email, test_code)
            print(f"✅ Expired code rejection: {'PASSED' if not is_valid else 'FAILED'}")
            
            # Check status
            status = await get_verification_status(test_email)
            print(f"📊 Expired code status: {status}")
            
        else:
            print("❌ Failed to create test code")
            
    except Exception as e:
        print(f"❌ Expiration test failed: {str(e)}")


if __name__ == "__main__":
    asyncio.run(test_verification_system())
    asyncio.run(test_expiration())