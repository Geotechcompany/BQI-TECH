@router.post("/emails/ai/generate")
async def ai_generate_email(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Generate email content using AI based on a prompt"""
    try:
        import os
        import httpx
        import json
        import re

        prompt = (payload.get("prompt") or "").strip()
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        from app.lib.ai_provider_settings import get_active_ai_config

        base_url, api_key, model = await get_active_ai_config()

        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="AI service not configured — add a provider in Admin → Settings → AI providers",
            )

        # Create the system prompt for email generation
        system_prompt = """You are an expert email marketing specialist. Generate professional email content based on the user's prompt.

Requirements:
1. Return ONLY valid JSON with "subject" and "body" fields
2. The subject should be compelling and concise (under 60 characters)
3. The body should be well-formatted HTML with proper styling
4. Use professional tone appropriate for business communications
5. Include BQI Tech branding colors: #272055 (dark blue) and #31CDFF (light blue)
6. Make the email engaging and actionable
7. Include a clear call-to-action when appropriate
8. Use proper HTML structure with headings, paragraphs, and styling

Example format:
{
  "subject": "Your Email Subject Here",
  "body": "<h1 style=\"color: #272055;\">Heading</h1><p>Content here...</p>"
}

Generate an email based on this prompt:"""

        user_prompt = f"{system_prompt}\n\n{prompt}"

        # Make request to NVIDIA API
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000,
                },
                timeout=30.0,
            )

        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"AI service error: {resp.status_code}")

        data = resp.json()
        content = (
            data.get("choices", [{}])[0].get("message", {}).get("content", "")
        )

        # Parse JSON response from AI
        json_patterns = [
            r'```json\s*(\{[\s\S]*?\})\s*```',  # JSON in code blocks
            r'```\s*(\{[\s\S]*?\})\s*```',      # JSON in generic code blocks
            r'(\{[\s\S]*?\})',                   # Any JSON object
        ]

        for pattern in json_patterns:
            match = re.search(pattern, content.strip(), re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group(1))
                    # Validate the structure
                    if isinstance(parsed, dict) and "subject" in parsed and "body" in parsed:
                        return parsed
                except (json.JSONDecodeError, KeyError):
                    continue

        # Fallback: create a basic email structure
        return {
            "subject": f"Email: {prompt[:50]}...",
            "body": f"<h1 style=\"color: #272055;\">Generated Email</h1><p>Based on your prompt: {prompt}</p><p>Please customize this content as needed.</p>"
        }

    except Exception as e:
        logger.error(f"Error in AI email generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
