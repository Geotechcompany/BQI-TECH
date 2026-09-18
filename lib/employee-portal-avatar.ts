/** Circular light-on-navy BQI mark used as the employee portal default avatar. */
export const EMPLOYEE_DEFAULT_AVATAR_SRC = "/bqilogo-light.png";

function isBrandLogoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("bqilogo") ||
    lower.includes("/logo.") ||
    lower.endsWith("/logo")
  );
}

/**
 * Prefer a personal avatar when present; otherwise the circular BQI brand mark.
 * Brand-logo URLs stored as avatar fields are ignored so the default mark is used.
 */
export function resolveEmployeeAvatarSrc(
  ...candidates: Array<string | null | undefined>
): string {
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || isBrandLogoUrl(trimmed)) continue;
    return trimmed;
  }
  return EMPLOYEE_DEFAULT_AVATAR_SRC;
}
