/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

export const API_CONFIG = {
  BACKEND_URL:
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_PYTHON_API_URL ||
    "https://api.bqitech.com/",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || "https://bqitech.com",
} as const;

// Export individual values for convenience
export const BACKEND_URL = API_CONFIG.BACKEND_URL;
export const APP_URL = API_CONFIG.APP_URL;



