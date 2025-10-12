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
    backendUrl:
      process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000",
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
