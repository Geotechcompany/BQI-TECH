import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

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

/** Convert Dropbox share links into direct file download URLs. */
function normalizeTargetUrl(parsed: URL): URL {
  const next = new URL(parsed.toString());
  const host = next.hostname.toLowerCase();

  if (host.includes("dropbox.com") || host.endsWith(".dropboxusercontent.com")) {
    // Shared file links: prefer content CDN + dl=1 for reliable binary fetch.
    if (next.pathname.includes("/scl/fi/") || next.pathname.includes("/s/")) {
      if (host === "www.dropbox.com" || host === "dropbox.com") {
        next.hostname = "dl.dropboxusercontent.com";
      }
      next.searchParams.delete("raw");
      next.searchParams.set("dl", "1");
      return next;
    }

    if (host === "www.dropbox.com" || host === "dropbox.com") {
      next.hostname = "dl.dropboxusercontent.com";
    }
    next.searchParams.delete("raw");
    next.searchParams.set("dl", "1");
  }

  return next;
}

function looksLikePdf(bytes: Uint8Array, pathname: string, search: string, contentType: string): boolean {
  if (bytes.length >= 4) {
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic === "%PDF") return true;
  }
  if (contentType.toLowerCase().includes("pdf")) return true;
  return /\.pdf($|\?)/i.test(pathname + search);
}

function extractFilename(parsed: URL, contentType: string, contentDisposition: string | null): string {
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(
      /filename\*?[^;=\n]*=(?:UTF-8''|(['"]))?([^;\n]*)/i
    );
    if (filenameMatch?.[2]) {
      try {
        return decodeURIComponent(filenameMatch[2].replace(/['"]/g, "").trim());
      } catch {
        return filenameMatch[2].replace(/['"]/g, "").trim();
      }
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

async function fetchUpstream(fetchUrl: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const upstreamResponse = await fetch(fetchUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/pdf,application/octet-stream,*/*",
        },
      });
      return upstreamResponse;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Upstream fetch failed");
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
    const upstreamResponse = await fetchUpstream(fetchUrl);

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

    const bytes = new Uint8Array(buffer);
    const upstreamType =
      upstreamResponse.headers.get("content-type") || "application/octet-stream";

    // Dropbox sometimes returns an HTML interstitial with 200; reject those.
    const head = String.fromCharCode(...bytes.slice(0, Math.min(64, bytes.length))).toLowerCase();
    if (head.includes("<!doctype html") || head.includes("<html")) {
      return NextResponse.json({ error: "Upstream returned HTML instead of a file" }, { status: 502 });
    }

    const isPdf = looksLikePdf(bytes, parsed.pathname, parsed.search, upstreamType);
    const contentType = isPdf ? "application/pdf" : upstreamType;
    const filename = extractFilename(
      parsed,
      contentType,
      upstreamResponse.headers.get("content-disposition")
    );

    const headers = new Headers();
    headers.set("Content-Type", contentType);
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
