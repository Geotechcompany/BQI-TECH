/**
 * Public admin base path helpers (WordPress-style hidden admin URL).
 * Internal App Router paths remain under `/admin`; the public URL defaults to `/manage`
 * (and may be a further custom slug when "hide admin path" is enabled).
 */

/** App Router / filesystem base — never change without renaming `app/(admin)/admin`. */
export const INTERNAL_ADMIN_BASE = "/admin";

/** Default public URL for the admin app (what users see in the address bar). */
export const DEFAULT_ADMIN_BASE = "/manage";

export const ADMIN_PATH_COOKIE = "bqi_admin_base";

/** Top-level route segments that must not be used as the admin slug. */
export const RESERVED_ADMIN_PATH_SLUGS = new Set([
  "admin",
  "manage",
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

export function getPublicAdminBasePath(
  config: Partial<AdminPathConfig> | null | undefined
): string {
  const hidden = Boolean(config?.admin_path_hidden);
  const slug = normalizeAdminPathSlug(config?.admin_path_slug);
  if (hidden && slug && isValidAdminPathSlug(slug)) {
    return `/${slug}`;
  }
  return DEFAULT_ADMIN_BASE;
}

function stripKnownAdminPrefix(path: string): string {
  let rest = path;
  for (const prefix of [INTERNAL_ADMIN_BASE, DEFAULT_ADMIN_BASE]) {
    if (rest === prefix || rest.startsWith(`${prefix}/`)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }
  return rest;
}

/** Build a public admin URL from an internal `/admin/...` or `/manage/...` path. */
export function adminHref(
  path: string = "",
  publicBase: string = DEFAULT_ADMIN_BASE
): string {
  const base =
    (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  let rest = (path || "").trim();
  if (!rest || rest === "/") return base;
  rest = stripKnownAdminPrefix(rest);
  if (!rest.startsWith("/")) rest = `/${rest}`;
  return `${base}${rest === "/" ? "" : rest}`;
}

/** Map a browser pathname back to the internal `/admin/...` path. */
export function toInternalAdminPath(
  pathname: string,
  publicBase: string = DEFAULT_ADMIN_BASE
): string {
  if (!pathname) return pathname;
  const base =
    (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  if (pathname === INTERNAL_ADMIN_BASE || pathname.startsWith(`${INTERNAL_ADMIN_BASE}/`)) {
    return pathname;
  }
  if (base !== INTERNAL_ADMIN_BASE) {
    if (pathname === base) return INTERNAL_ADMIN_BASE;
    if (pathname.startsWith(`${base}/`)) {
      return `${INTERNAL_ADMIN_BASE}${pathname.slice(base.length)}`;
    }
  }
  if (pathname === DEFAULT_ADMIN_BASE) return INTERNAL_ADMIN_BASE;
  if (pathname.startsWith(`${DEFAULT_ADMIN_BASE}/`)) {
    return `${INTERNAL_ADMIN_BASE}${pathname.slice(DEFAULT_ADMIN_BASE.length)}`;
  }
  return pathname;
}

export function isPublicAdminPath(
  pathname: string,
  publicBase: string = DEFAULT_ADMIN_BASE
): boolean {
  const base =
    (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isInternalAdminPath(pathname: string): boolean {
  return (
    pathname === INTERNAL_ADMIN_BASE ||
    pathname.startsWith(`${INTERNAL_ADMIN_BASE}/`)
  );
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
    if (value === INTERNAL_ADMIN_BASE) return DEFAULT_ADMIN_BASE;
    const slug = value.slice(1);
    if (!isValidAdminPathSlug(slug)) return null;
    return `/${slug}`;
  } catch {
    return null;
  }
}

export function writeAdminBasePathCookie(publicBase: string) {
  if (typeof document === "undefined") return;
  const base =
    (publicBase || DEFAULT_ADMIN_BASE).replace(/\/+$/, "") || DEFAULT_ADMIN_BASE;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${ADMIN_PATH_COOKIE}=${encodeURIComponent(base)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearAdminBasePathCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_PATH_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
