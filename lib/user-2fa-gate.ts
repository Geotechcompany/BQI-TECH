/**
 * Post-signup 2FA gate for normal (non-admin) users.
 * Admins continue to use org policy via the public admin base (AdminTwoFactorSetup).
 */

import {
  DEFAULT_ADMIN_BASE,
  INTERNAL_ADMIN_BASE,
  isPublicAdminPath,
  resolvePublicAdminBase,
} from "@/lib/admin-path";

export const USER_2FA_SETUP_PATH = "/auth/setup-2fa";

/** Paths allowed while email-verified but 2FA is not yet enrolled. */
export const USER_2FA_SETUP_EXEMPT_PATHS = [
  "/auth/verify-email",
  "/auth/setup-2fa",
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/logout",
  "/employee/login",
  `${DEFAULT_ADMIN_BASE}/login`,
  `${INTERNAL_ADMIN_BASE}/login`,
] as const;

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const upper = String(role).toUpperCase();
  return upper === "ADMIN" || upper === "SUPER_ADMIN";
}

export function userHasEnrolledTwoFactor(user?: {
  totpEnabled?: boolean;
  email2faEnabled?: boolean;
  admin2faFactors?: { email?: boolean; totp?: boolean };
} | null): boolean {
  if (!user) return false;
  if (user.totpEnabled || user.email2faEnabled) return true;
  const factors = user.admin2faFactors;
  if (factors?.totp || factors?.email) return true;
  return false;
}

/**
 * True when a normal user must enroll 2FA before using the app:
 * - Post-verify gate: email verified and no factor enrolled
 * - Admin force: `require2fa` set even for long-verified accounts
 *
 * Admins are excluded — they use admin 2FA policy on the public admin base.
 */
export function needsUserTwoFactorSetup(user?: {
  role?: string;
  isEmailVerified?: boolean;
  totpEnabled?: boolean;
  email2faEnabled?: boolean;
  require2fa?: boolean;
  admin2faFactors?: { email?: boolean; totp?: boolean };
} | null): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return false;
  if (userHasEnrolledTwoFactor(user)) return false;
  if (user.require2fa) return true;
  if (!user.isEmailVerified) return false;
  return true;
}

export function isUser2faSetupExemptPath(pathname: string): boolean {
  if (
    USER_2FA_SETUP_EXEMPT_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return true;
  }
  const adminBase = resolvePublicAdminBase();
  const loginPath = `${adminBase}/login`;
  return pathname === loginPath || pathname.startsWith(`${loginPath}/`);
}

export function buildUser2faSetupUrl(next?: string | null): string {
  if (!next || next.startsWith(USER_2FA_SETUP_PATH)) {
    return USER_2FA_SETUP_PATH;
  }
  if (!next.startsWith("/") || next.startsWith("//")) {
    return USER_2FA_SETUP_PATH;
  }
  return `${USER_2FA_SETUP_PATH}?next=${encodeURIComponent(next)}`;
}

/** True when pathname is under the active (or default) public admin base. */
export function isAnyPublicAdminPath(pathname: string): boolean {
  const adminBase = resolvePublicAdminBase();
  return (
    isPublicAdminPath(pathname, adminBase) ||
    isPublicAdminPath(pathname, DEFAULT_ADMIN_BASE)
  );
}
