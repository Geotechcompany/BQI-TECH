/**
 * Resolve email verification from API/user payloads.
 * Once true (via value or fallback), never clobber back to false — false/missing
 * payloads from encrypted or partial responses must not wipe a verified session.
 */
export function resolveEmailVerified(
  value: unknown,
  fallback = false
): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (fallback === true) {
    return true;
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }
  return fallback;
}
