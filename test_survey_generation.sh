#!/bin/bash

# Test Survey Generation with curl
# This script tests the AI survey generation endpoint

echo "=== Testing Survey Generation ==="

# Configuration
BACKEND_URL="http://localhost:9000"
ADMIN_EMAIL="admin@bqitech.com"  # Replace with actual admin email
ADMIN_PASSWORD="your_admin_password"  # Replace with actual admin password

echo "1. Logging in as admin..."

# Step 1: Login to get admin token
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_EMAIL&password=$ADMIN_PASSWORD")

echo "Login Response: $LOGIN_RESPONSE"

# Extract token from response (assuming it returns JSON with access_token)
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to get access token. Please check credentials."
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Got access token: ${ACCESS_TOKEN:0:20}..."

echo ""
echo "2. Testing survey generation..."

# Step 2: Test survey generation
SURVEY_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/admin/surveys/ai/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "prompt": "Employee satisfaction survey",
    "num_questions": 5
  }')

echo "Survey Generation Response:"
echo "$SURVEY_RESPONSE" | jq '.' 2>/dev/null || echo "$SURVEY_RESPONSE"

echo ""
echo "3. Testing with different prompt..."

# Step 3: Test with different prompt
SURVEY_RESPONSE2=$(curl -s -X POST "$BACKEND_URL/api/admin/surveys/ai/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "prompt": "Customer feedback about our new product features",
    "num_questions": 3
  }')

echo "Second Survey Generation Response:"
echo "$SURVEY_RESPONSE2" | jq '.' 2>/dev/null || echo "$SURVEY_RESPONSE2"

echo ""
echo "=== Test Complete ==="
