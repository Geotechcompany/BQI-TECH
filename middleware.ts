import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth/verify-email",
  "/admin/login",
  "/employee/login",
  "/about",
  "/contact-us",
  "/services",
  "/blog",
  "/careers",
  "/offline",
];

// Paths that don't require email verification
const noVerificationPaths = [
  "/auth/verify-email",
  "/admin/login",
  "/employee/login",
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/logout",
  "/api",
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

function isNoVerificationPath(pathname: string): boolean {
  return noVerificationPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

// Helper function to get auth token from custom auth system
function getAuthToken(request: NextRequest): string | null {
  // Check for token in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check for token in cookies (if stored there)
  const tokenCookie = request.cookies.get("auth_token");
  if (tokenCookie) {
    return tokenCookie.value;
  }

  return null;
}

// Helper function to decode JWT token (basic decode without verification)
function decodeToken(token: string): any {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch (error) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authSession = request.cookies.get("auth_session")?.value;

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

  // Allow public paths without authentication
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isEmployeeRoute =
    pathname === "/employee" || pathname.startsWith("/employee/");
  const isEmployeeLogin = pathname === "/employee/login" || pathname.startsWith("/employee/login/");

  // If no session, redirect to the matching login
  if (!authSession) {
    if (isEmployeeRoute && !isEmployeeLogin) {
      return NextResponse.redirect(new URL("/employee/login", request.url));
    }
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Parse the session to check email verification status
    const session = JSON.parse(authSession);
    const user = session?.user;
    const isEmailVerified = user?.isEmailVerified;

    // If email is not verified and not on a verification-exempt path,
    // redirect to verification page with email
    if (!isEmailVerified && !isNoVerificationPath(pathname)) {
      const verifyUrl = new URL("/auth/verify-email", request.url);
      if (user?.email) {
        verifyUrl.searchParams.set("email", user.email);
      }
      return NextResponse.redirect(verifyUrl);
    }

    // Check admin access for admin routes (case-insensitive)
    const role = String(user?.role ?? "").toUpperCase();
    const isAdminRole = role === "ADMIN" || role === "SUPER_ADMIN";
    if (pathname.startsWith("/admin") && !isAdminRole) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Employee routes: auth required (roster/EMPLOYEE role enforced in layout + API).
    // Keep login public (handled above). Admins with employee records may enter.
    if (isEmployeeRoute && !isEmployeeLogin) {
      // Soft gate: session must exist (already true). Layout verifies roster match.
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Error parsing session:", error);
    // If session is invalid, clear it and redirect to login
    const loginPath =
      isEmployeeRoute && !isEmployeeLogin ? "/employee/login" : "/login";
    const response = NextResponse.redirect(new URL(loginPath, request.url));
    response.cookies.delete("auth_session");
    return response;
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
