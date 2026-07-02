#!/bin/bash

# Quick test - replace with your actual admin credentials
ADMIN_EMAIL="admin@bqitech.com"
ADMIN_PASSWORD="your_password_here"

echo "Testing Survey Generation..."

# Get token and test in one go
TOKEN=$(curl -s -X POST "http://localhost:10000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_EMAIL&password=$ADMIN_PASSWORD" | \
  grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✅ Got token, testing survey generation..."
    curl -X POST "http://localhost:10000/api/admin/surveys/ai/generate" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"prompt": "Employee satisfaction survey", "num_questions": 3}' | jq '.'
else
    echo "❌ Failed to get token. Check credentials."
fi
