import { BACKEND_URL } from "@/lib/config";
import { NextResponse } from "next/server";

// Track uptime from first module load within the current runtime instance
const startedAt = Date.now();

export async function GET() {
  const now = Date.now();
  const payload = {
    ok: true,
    status: "ok",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeMs: Math.max(0, now - startedAt),
    backendUrl: BACKEND_URL,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}


