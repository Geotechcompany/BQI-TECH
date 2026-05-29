/** Resolve email verification from API/user payloads without clobbering a true value. */
export function resolveEmailVerified(
  value: unknown,
  fallback = false
): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }
  return fallback;
}
