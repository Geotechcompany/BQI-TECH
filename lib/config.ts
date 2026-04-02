/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

export const API_CONFIG = {
  BACKEND_URL: "http://localhost:10000",
  APP_URL: "http://localhost:3000",
} as const;

// Export individual values for convenience
export const BACKEND_URL = API_CONFIG.BACKEND_URL;
export const APP_URL = API_CONFIG.APP_URL;



