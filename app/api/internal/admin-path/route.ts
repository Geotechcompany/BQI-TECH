import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";
import {
  DEFAULT_ADMIN_BASE,
  getPublicAdminBasePath,
  normalizeAdminPathSlug,
} from "@/lib/admin-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-only gate used by middleware to resolve the public admin base path.
 * Does not expose the slug to browsers — middleware calls this same-origin.
 */
export async function GET() {
  const gateKey =
    process.env.ADMIN_PATH_GATE_SECRET ||
    process.env.SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "";

  const fallback = {
    admin_path_hidden: false,
    admin_path_slug: null as string | null,
    public_base: DEFAULT_ADMIN_BASE,
  };

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin-path-config`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(gateKey ? { "X-Admin-Path-Key": gateKey } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const data = await response.json();
    const slug = normalizeAdminPathSlug(data?.admin_path_slug);
    const hidden = Boolean(data?.admin_path_hidden);
    const public_base =
      typeof data?.public_base === "string" && data.public_base.startsWith("/")
        ? data.public_base.replace(/\/+$/, "") || DEFAULT_ADMIN_BASE
        : getPublicAdminBasePath({
            admin_path_hidden: hidden,
            admin_path_slug: slug,
          });

    return NextResponse.json({
      admin_path_hidden: hidden,
      admin_path_slug: slug,
      public_base,
    });
  } catch {
    return NextResponse.json(fallback, { status: 200 });
  }
}
