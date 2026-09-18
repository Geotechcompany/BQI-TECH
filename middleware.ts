import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_PATH_COOKIE,
  DEFAULT_ADMIN_BASE,
  INTERNAL_ADMIN_BASE,
  isValidAdminPathSlug,
  normalizeAdminPathSlug,
} from "@/lib/admin-path";

// Paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth/verify-email",
  `${INTERNAL_ADMIN_BASE}/login`,
  `${DEFAULT_ADMIN_BASE}/login`,
  "/employee/login",
  "/about",
  "/contact-us",
  "/services",
  "/blog",
  "/careers",
  "/offline",
  "/__app-not-found",
];

// Paths that don't require email verification
const noVerificationPaths = [
  "/auth/verify-email",
  `${INTERNAL_ADMIN_BASE}/login`,
  `${DEFAULT_ADMIN_BASE}/login`,
  "/employee/login",
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/logout",
  "/api",
];

type AdminPathGate = {
  hidden: boolean;
  slug: string | null;
  publicBase: string;
};

let adminPathCache: { at: number; value: AdminPathGate } | null = null;
const ADMIN_PATH_CACHE_MS = 5_000;

async function loadAdminPathGate(request: NextRequest): Promise<AdminPathGate> {
  const now = Date.now();
  const cookieBase = request.cookies.get(ADMIN_PATH_COOKIE)?.value;
  if (
    adminPathCache &&
    cookieBase &&
    cookieBase !== adminPathCache.value.publicBase
  ) {
    // Client just changed the public base — force refresh.
    adminPathCache = null;
  }
  if (adminPathCache && now - adminPathCache.at < ADMIN_PATH_CACHE_MS) {
    return adminPathCache.value;
  }

  const fallback: AdminPathGate = {
    hidden: false,
    slug: null,
    publicBase: DEFAULT_ADMIN_BASE,
  };

  const parse = (data: any): AdminPathGate => {
    const slug = normalizeAdminPathSlug(data?.admin_path_slug);
    const hidden =
      Boolean(data?.admin_path_hidden) && isValidAdminPathSlug(slug);
    return {
      hidden,
      slug: hidden ? slug : slug,
      publicBase: hidden && slug ? `/${slug}` : DEFAULT_ADMIN_BASE,
    };
  };

  try {
    const gateKey =
      process.env.ADMIN_PATH_GATE_SECRET ||
      process.env.SECRET_KEY ||
      process.env.NEXTAUTH_SECRET ||
      "";
    const backend = (
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_PYTHON_API_URL ||
      ""
    ).replace(/\/+$/, "");

    let response: Response | null = null;
    if (backend && gateKey) {
      response = await fetch(`${backend}/api/admin-path-config`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Admin-Path-Key": gateKey,
        },
        cache: "no-store",
      });
    }

    if (!response || !response.ok) {
      const url = new URL("/api/internal/admin-path", request.nextUrl.origin);
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    }

    if (!response.ok) {
      adminPathCache = { at: now, value: fallback };
      return fallback;
    }
    const data = await response.json();
    const value = parse(data);
    adminPathCache = { at: now, value };
    return value;
  } catch {
    if (adminPathCache) return adminPathCache.value;
    return fallback;
  }
}

function isPublicPath(pathname: string, adminLoginPublicPath: string): boolean {
  const paths = [...publicPaths];
  if (
    adminLoginPublicPath !== `${INTERNAL_ADMIN_BASE}/login` &&
    adminLoginPublicPath !== `${DEFAULT_ADMIN_BASE}/login`
  ) {
    paths.push(adminLoginPublicPath);
  }
  return paths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

function isNoVerificationPath(
  pathname: string,
  adminLoginPublicPath: string
): boolean {
  const paths = [...noVerificationPaths];
  if (
    adminLoginPublicPath !== `${INTERNAL_ADMIN_BASE}/login` &&
    adminLoginPublicPath !== `${DEFAULT_ADMIN_BASE}/login`
  ) {
    paths.push(adminLoginPublicPath);
  }
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function withAdminBaseCookie(
  response: NextResponse,
  publicBase: string
): NextResponse {
  response.cookies.set({
    name: ADMIN_PATH_COOKIE,
    value: publicBase,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function clearAdminBaseCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: ADMIN_PATH_COOKIE,
    value: "",
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 0,
  });
  return response;
}

/**
 * Custom app 404 UI — used when hiding the internal `/admin` tree (or an
 * obsolete public base) so we never leak that an admin panel exists via a
 * bare text response.
 */
function opaqueNotFound(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/__app-not-found";
  const response = NextResponse.rewrite(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow internal gate + other Next API routes without auth redirects
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Dedicated opaque 404 surface (rewrite target)
  if (pathname === "/__app-not-found") {
    return NextResponse.next();
  }

  // Allow static assets (served from /public) to bypass auth and other checks
  // This is critical because Next.js image optimizer fetches images without cookies.
  const isStaticAsset =
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|txt|woff|woff2|ttf|otf|eot|json|xml|webmanifest)$/i.test(
      pathname
    ) ||
    pathname.startsWith("/Teams/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/Sliders/") ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/swe-worker-") ||
    pathname.startsWith("/fallback-");
  if (isStaticAsset) {
    return NextResponse.next();
  }

  const gate = await loadAdminPathGate(request);
  const publicAdminBase = gate.publicBase;
  const adminLoginPublicPath = `${publicAdminBase}/login`;
  const adminLoginInternalPath = `${INTERNAL_ADMIN_BASE}/login`;

  const finish = (response: NextResponse) => {
    if (gate.hidden && gate.slug) {
      return withAdminBaseCookie(response, publicAdminBase);
    }
    // Always publish the active public base so client href helpers stay in sync.
    return withAdminBaseCookie(response, publicAdminBase);
  };

  // Legacy /admin bookmarks, emails, and stored notification links → public base.
  // Do not serve the internal App Router tree under /admin (URL must stay public).
  if (
    pathname === INTERNAL_ADMIN_BASE ||
    pathname.startsWith(`${INTERNAL_ADMIN_BASE}/`)
  ) {
    const rest = pathname.slice(INTERNAL_ADMIN_BASE.length) || "";
    const url = request.nextUrl.clone();
    url.pathname = `${publicAdminBase}${rest}`;
    return finish(NextResponse.redirect(url));
  }

  // When a custom slug is active, also hide the default public base (/manage).
  if (
    gate.hidden &&
    publicAdminBase !== DEFAULT_ADMIN_BASE &&
    (pathname === DEFAULT_ADMIN_BASE ||
      pathname.startsWith(`${DEFAULT_ADMIN_BASE}/`))
  ) {
    return opaqueNotFound(request);
  }

  // Rewrite public base → internal /admin routes (URL bar keeps the public path).
  let effectivePathname = pathname;
  let rewriteUrl: URL | null = null;

  if (
    pathname === publicAdminBase ||
    pathname.startsWith(`${publicAdminBase}/`)
  ) {
    const rest = pathname.slice(publicAdminBase.length) || "";
    effectivePathname = `${INTERNAL_ADMIN_BASE}${rest}`;
    rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = effectivePathname;
  }

  const nextOrRewrite = () => {
    if (rewriteUrl) {
      return finish(NextResponse.rewrite(rewriteUrl));
    }
    return finish(NextResponse.next());
  };

  // Allow public paths without authentication (use public URL for login checks)
  if (isPublicPath(pathname, adminLoginPublicPath)) {
    return nextOrRewrite();
  }
  // Also treat rewritten internal login as public
  if (
    effectivePathname === adminLoginInternalPath ||
    effectivePathname.startsWith(`${adminLoginInternalPath}/`)
  ) {
    return nextOrRewrite();
  }

  const authSession = request.cookies.get("auth_session")?.value;

  const isEmployeeRoute =
    pathname === "/employee" || pathname.startsWith("/employee/");
  const isEmployeeLogin =
    pathname === "/employee/login" || pathname.startsWith("/employee/login/");
  const isAdminRoute =
    effectivePathname === INTERNAL_ADMIN_BASE ||
    effectivePathname.startsWith(`${INTERNAL_ADMIN_BASE}/`);

  // If no session, redirect to the matching login
  if (!authSession) {
    if (isEmployeeRoute && !isEmployeeLogin) {
      return finish(
        NextResponse.redirect(new URL("/employee/login", request.url))
      );
    }
    if (isAdminRoute) {
      return finish(
        NextResponse.redirect(new URL(adminLoginPublicPath, request.url))
      );
    }
    return finish(NextResponse.redirect(new URL("/login", request.url)));
  }

  try {
    // Parse the session to check email verification status
    const session = JSON.parse(authSession);
    const user = session?.user;
    const isEmailVerified = user?.isEmailVerified;

    // If email is not verified and not on a verification-exempt path,
    // redirect to verification page with email
    if (
      !isEmailVerified &&
      !isNoVerificationPath(pathname, adminLoginPublicPath) &&
      !(
        effectivePathname === adminLoginInternalPath ||
        effectivePathname.startsWith(`${adminLoginInternalPath}/`)
      )
    ) {
      const verifyUrl = new URL("/auth/verify-email", request.url);
      if (user?.email) {
        verifyUrl.searchParams.set("email", user.email);
      }
      return finish(NextResponse.redirect(verifyUrl));
    }

    // Check admin access for admin routes (case-insensitive)
    const role = String(user?.role ?? "").toUpperCase();
    const isAdminRole = role === "ADMIN" || role === "SUPER_ADMIN";
    if (isAdminRoute && !isAdminRole) {
      return finish(
        NextResponse.redirect(new URL("/dashboard", request.url))
      );
    }

    // Employee routes: auth required (roster/EMPLOYEE role enforced in layout + API).
    // Keep login public (handled above). Admins with employee records may enter.
    if (isEmployeeRoute && !isEmployeeLogin) {
      // Soft gate: session must exist (already true). Layout verifies roster match.
      return nextOrRewrite();
    }

    return nextOrRewrite();
  } catch (error) {
    console.error("Error parsing session:", error);
    // If session is invalid, clear it and redirect to login
    const loginPath =
      isEmployeeRoute && !isEmployeeLogin
        ? "/employee/login"
        : isAdminRoute
          ? adminLoginPublicPath
          : "/login";
    const response = NextResponse.redirect(new URL(loginPath, request.url));
    response.cookies.delete("auth_session");
    return finish(response);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    // Exclude common static assets, PWA service worker, and Workbox files
    "/((?!_next/static|_next/image|favicon.ico|public/|api/proxy|sw\\.js|workbox-|swe-worker-|fallback-|manifest\\.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|txt|woff|woff2|ttf|otf|eot|json|xml|webmanifest)$).*)",
  ],
};
