import { NextResponse } from "next/server";

const ALLOWED_HOSTNAMES = new Set([
  "dl.dropboxusercontent.com",
  "www.dropbox.com",
  "dropbox.com",
  "ucarecdn.com", // add other cdn providers here if needed
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    if (!targetUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new NextResponse("Invalid url parameter", { status: 400 });
    }

    if (!(parsed.protocol === "https:" || parsed.protocol === "http:")) {
      return new NextResponse("Unsupported protocol", { status: 400 });
    }

    // Optionally restrict to known hosts to prevent open proxy abuse
    if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
      return new NextResponse("Host not allowed", { status: 400 });
    }

    // Normalize Dropbox share links to direct file endpoints
    if (parsed.hostname.includes("dropbox.com") && parsed.hostname !== "dl.dropboxusercontent.com") {
      parsed.hostname = "dl.dropboxusercontent.com";
      parsed.searchParams.set("dl", "1");
    }

    const upstreamResponse = await fetch(parsed.toString(), {
      // Disable caching for safety; tweak if desired
      cache: "no-store",
      headers: {
        // Some providers require a UA
        "User-Agent": "Mozilla/5.0 (compatible; BQI-Proxy/1.0)"
      },
    });

    if (!upstreamResponse.ok) {
      return new NextResponse(`Upstream error: ${upstreamResponse.status}`, { status: 502 });
    }

    // Stream the body through
    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
    const isPdf = contentType.includes("pdf") || /\.pdf($|\?)/i.test(parsed.pathname + parsed.search);
    const headers = new Headers();
    headers.set("Content-Type", isPdf ? "application/pdf" : contentType);
    headers.set("Content-Disposition", "inline");
    // Allow embedding in iframe from our own origin
    headers.set("X-Content-Type-Options", "nosniff");

    return new NextResponse(upstreamResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new NextResponse("Proxy error", { status: 500 });
  }
}


