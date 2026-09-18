/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

function normalizeBackendUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

const rawBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_PYTHON_API_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:9000"
    : "https://api.bqitech.com");

export const API_CONFIG = {
  BACKEND_URL: normalizeBackendUrl(rawBackendUrl),
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || "https://bqitech.com",
} as const;

// Export individual values for convenience
export const BACKEND_URL = API_CONFIG.BACKEND_URL;
export const APP_URL = API_CONFIG.APP_URL;



