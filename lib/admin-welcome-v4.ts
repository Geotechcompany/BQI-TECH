export const WELCOME_V4_DISMISSED_KEY = "bqi.welcome.v4.dismissed";

export function isWelcomeV4Dismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_V4_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissWelcomeV4(): void {
  try {
    localStorage.setItem(WELCOME_V4_DISMISSED_KEY, "1");
  } catch {
    // localStorage may be unavailable
  }
}

export function clearWelcomeV4Dismissed(): void {
  try {
    localStorage.removeItem(WELCOME_V4_DISMISSED_KEY);
  } catch {
    // localStorage may be unavailable
  }
}
