/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

export const API_CONFIG = {
  BACKEND_URL: "https://api.bqitech.com",
  APP_URL: "https://bqitech.com",
} as const;

// Export individual values for convenience
export const BACKEND_URL = API_CONFIG.BACKEND_URL;
export const APP_URL = API_CONFIG.APP_URL;



