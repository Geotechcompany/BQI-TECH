# Survey Generation Test Commands

## Prerequisites

Make sure your backend is running on `http://localhost:10000` and you have admin credentials.

## Step 1: Login to get admin token

```bash
curl -X POST "http://localhost:10000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@bqitech.com&password=your_admin_password"
```

**Expected Response:**

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "...",
  "token_type": "bearer",
  "user": {...}
}
```

## Step 2: Test Survey Generation

Replace `YOUR_ACCESS_TOKEN` with the token from step 1:

```bash
curl -X POST "http://localhost:10000/api/admin/surveys/ai/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "Employee satisfaction survey",
    "num_questions": 5
  }'
```

## Step 3: Test with Different Prompts

### Customer Feedback Survey

```bash
curl -X POST "http://localhost:10000/api/admin/surveys/ai/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "Customer feedback about our new product features",
    "num_questions": 3
  }'
```

### Event Planning Survey

```bash
curl -X POST "http://localhost:10000/api/admin/surveys/ai/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "Company annual event planning preferences",
    "num_questions": 4
  }'
```

## Expected Response Format

```json
{
  "title": "Employee Satisfaction Survey",
  "description": "<p>Survey about employee satisfaction and workplace experience</p>",
  "questions": [
    {
      "title": "How satisfied are you with your current role?",
      "type": "single_choice",
      "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"]
    },
    {
      "title": "What is your biggest challenge at work?",
      "type": "long_text"
    },
    {
      "title": "Rate your work-life balance",
      "type": "single_choice",
      "options": ["Excellent", "Good", "Fair", "Poor"]
    }
  ]
}
```

## Troubleshooting

### If you get 401 Unauthorized:

- Check that your access token is valid
- Make sure you're using the correct admin credentials
- Token might have expired, try logging in again

### If you get 500 Internal Server Error:

- Check that NVIDIA_API_KEY is set in your .env file
- Check backend logs for specific error messages
- Verify the AI service is responding

### If you get malformed JSON:

- The improved parsing should handle this automatically
- Check the backend logs for "AI Response:" to see what the AI returned
- The fallback system should create a valid response structure

## Quick Test Script

You can also run the provided `test_survey_generation.sh` script:

```bash
chmod +x test_survey_generation.sh
./test_survey_generation.sh
```

Make sure to update the admin credentials in the script first!
