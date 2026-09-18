/**
 * Public admin base path helpers (WordPress-style hidden admin URL).
 * Internal App Router paths remain under `/admin`; the public URL may be a custom slug.
 */

export const DEFAULT_ADMIN_BASE = "/admin";
export const ADMIN_PATH_COOKIE = "bqi_admin_base";

/** Top-level route segments that must not be used as the admin slug. */
export const RESERVED_ADMIN_PATH_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "sign-up",
  "signup",
  "forgot-password",
  "reset-password",
  "auth",
  "logout",
  "about",
  "contact-us",
  "contact",
  "services",
  "blog",
  "careers",
  "apply",
  "dashboard",
  "employee",
  "employees",
  "offline",
  "status",
  "sitemap",
  "robots",
  "manifest",
  "favicon",
  "icons",
  "images",
  "public",
  "private",
  "temp",
  "draft",
  "teams",
  "sliders",
  "_next",
  "next",
  "static",
  "assets",
  "sw",
  "workbox",
  "monitoring",
  "health",
  "internal",
  "proxy",
  "cdn",
  "www",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type AdminPathConfig = {
  admin_path_hidden: boolean;
  admin_path_slug: string | null;
};

export function normalizeAdminPathSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  return slug || null;
}

export function isValidAdminPathSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  if (slug.length < 3 || slug.length > 64) return false;
  if (!SLUG_PATTERN.test(slug)) return false;
  if (RESERVED_ADMIN_PATH_SLUGS.has(slug)) return false;
  return true;
}

export function validateAdminPathSlug(raw: unknown): {
  ok: boolean;
  slug: string | null;
  error?: string;
} {
  const slug = normalizeAdminPathSlug(raw);
  if (!slug) {
    return { ok: false, slug: null, error: "Enter a custom URL slug." };
  }
  if (slug.length < 3 || slug.length > 64) {
    return {
      ok: false,
      slug,
      error: "Slug must be 3–64 characters.",
    };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      slug,
      error: "Use lowercase letters, numbers, and hyphens only.",
    };
  }
  if (RESERVED_ADMIN_PATH_SLUGS.has(slug)) {
    return {
      ok: false,
      slug,
      error: `"${slug}" is reserved. Choose a different slug.`,
    };
  }
  return { ok: true, slug };
}

export function getPublicAdminBasePath(config: Partial<AdminPathConfig> | null | undefined): string {
  const hidden = Boolean(config?.admin_path_hidden);
  const slug = normalizeAdminPathSlug(config?.admin_path_slug);
  if (hidden && slug && isValidAdminPathSlug(slug)) {
    return `/${slug}`;
  }
  return DEFAULT_ADMIN_BASE;
}

/** Build a public admin URL from an internal `/admin/...` path (or bare segment). */
export function adminHref(
  path: string = "",
  publicBase: string = DEFAULT_ADMIN_BASE
): string {
  const base = (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  let rest = (path || "").trim();
  if (!rest || rest === "/") return base;
  if (rest.startsWith(DEFAULT_ADMIN_BASE + "/") || rest === DEFAULT_ADMIN_BASE) {
    rest = rest.slice(DEFAULT_ADMIN_BASE.length);
  }
  if (!rest.startsWith("/")) rest = `/${rest}`;
  return `${base}${rest === "/" ? "" : rest}`;
}

/** Map a browser pathname back to the internal `/admin/...` path. */
export function toInternalAdminPath(
  pathname: string,
  publicBase: string = DEFAULT_ADMIN_BASE
): string {
  if (!pathname) return pathname;
  const base = (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  if (base !== DEFAULT_ADMIN_BASE) {
    if (pathname === base) return DEFAULT_ADMIN_BASE;
    if (pathname.startsWith(`${base}/`)) {
      return `${DEFAULT_ADMIN_BASE}${pathname.slice(base.length)}`;
    }
  }
  return pathname;
}

export function isPublicAdminPath(
  pathname: string,
  publicBase: string = DEFAULT_ADMIN_BASE
): boolean {
  const base = (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function readAdminBasePathCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_PATH_COOKIE}=`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match.split("=").slice(1).join("="));
    if (!value.startsWith("/")) return null;
    if (value === DEFAULT_ADMIN_BASE) return DEFAULT_ADMIN_BASE;
    const slug = value.slice(1);
    if (!isValidAdminPathSlug(slug)) return null;
    return `/${slug}`;
  } catch {
    return null;
  }
}

export function writeAdminBasePathCookie(publicBase: string) {
  if (typeof document === "undefined") return;
  const base = (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${ADMIN_PATH_COOKIE}=${encodeURIComponent(base)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearAdminBasePathCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_PATH_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
