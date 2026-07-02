import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_HOSTNAMES = new Set([
  "dl.dropboxusercontent.com",
  "www.dropbox.com",
  "dropbox.com",
  "ucarecdn.com",
  "res.cloudinary.com",
  "api.bqitech.com",
  "bqitech.com",
  "www.bqitech.com",
]);

function isHostAllowed(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (ALLOWED_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith(".dropboxusercontent.com")) return true;
  if (normalized.endsWith(".cloudinary.com")) return true;
  return false;
}

function normalizeTargetUrl(parsed: URL): URL {
  const next = new URL(parsed.toString());

  if (next.hostname === "dl.dropboxusercontent.com") {
    return next;
  }

  if (next.hostname.includes("dropbox.com")) {
    if (next.pathname.includes("/scl/fi/")) {
      next.searchParams.set("raw", "1");
      next.searchParams.delete("dl");
      return next;
    }

    next.hostname = "dl.dropboxusercontent.com";
    next.searchParams.set("dl", "1");
  }

  return next;
}

function extractFilename(parsed: URL, contentType: string, contentDisposition: string | null): string {
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
    );
    if (filenameMatch) {
      return filenameMatch[1].replace(/['"]/g, "");
    }
  }

  const pathParts = parsed.pathname.split("/");
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && lastPart.includes(".")) {
    return lastPart.split("?")[0];
  }

  if (contentType.includes("pdf") || /\.pdf($|\?)/i.test(parsed.pathname + parsed.search)) {
    return "document.pdf";
  }

  const extension = contentType.includes("word")
    ? ".docx"
    : contentType.includes("text")
      ? ".txt"
      : "";
  return `document${extension}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    if (!targetUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
    }

    if (!isHostAllowed(parsed.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
    }

    const fetchUrl = normalizeTargetUrl(parsed).toString();
    const upstreamResponse = await fetch(fetchUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BQI-Proxy/1.0)",
        Accept: "application/pdf,application/octet-stream,*/*",
      },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamResponse.status}` },
        { status: 502 }
      );
    }

    const buffer = await upstreamResponse.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large to preview" }, { status: 413 });
    }

    const contentType =
      upstreamResponse.headers.get("content-type") || "application/octet-stream";
    const isPdf =
      contentType.includes("pdf") ||
      /\.pdf($|\?)/i.test(parsed.pathname + parsed.search);
    const filename = extractFilename(
      parsed,
      contentType,
      upstreamResponse.headers.get("content-disposition")
    );

    const headers = new Headers();
    headers.set("Content-Type", isPdf ? "application/pdf" : contentType);
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Length", String(buffer.byteLength));

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
