import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";

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
      return NextResponse.json(
        {
          admin_path_hidden: false,
          admin_path_slug: null,
          public_base: "/admin",
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      admin_path_hidden: Boolean(data?.admin_path_hidden),
      admin_path_slug: data?.admin_path_slug ?? null,
      public_base: data?.public_base || "/admin",
    });
  } catch {
    return NextResponse.json(
      {
        admin_path_hidden: false,
        admin_path_slug: null,
        public_base: "/admin",
      },
      { status: 200 }
    );
  }
}
