import { NextResponse } from "next/server";
import { normalizeDropboxUrl } from "@/lib/cv-url-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTNAMES = new Set([
  "dl.dropboxusercontent.com",
  "www.dropbox.com",
  "dropbox.com",
  "ucarecdn.com",
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

    if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
      return new NextResponse("Host not allowed", { status: 400 });
    }

    const fetchUrl = parsed.hostname.includes("dropbox")
      ? normalizeDropboxUrl(parsed.toString())
      : parsed.toString();

    const upstreamResponse = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BQI-Proxy/1.0)",
      },
    });

    if (!upstreamResponse.ok) {
      return new NextResponse(`Upstream error: ${upstreamResponse.status}`, {
        status: 502,
      });
    }

    const contentType =
      upstreamResponse.headers.get("content-type") || "application/octet-stream";
    const isPdf =
      contentType.includes("pdf") ||
      /\.pdf($|\?)/i.test(parsed.pathname + parsed.search);

    let filename = "document";
    const contentDisposition = upstreamResponse.headers.get("content-disposition");
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      );
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/['"]/g, "");
      }
    } else {
      const pathParts = parsed.pathname.split("/");
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.includes(".")) {
        filename = lastPart.split("?")[0];
      } else if (isPdf) {
        filename = "document.pdf";
      } else {
        const extension = contentType.includes("pdf")
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : contentType.includes("text")
              ? ".txt"
              : "";
        filename = `document${extension}`;
      }
    }

    const body = await upstreamResponse.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", isPdf ? "application/pdf" : contentType);
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
    headers.set("Content-Length", String(body.byteLength));
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "SAMEORIGIN");

    return new NextResponse(body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse("Proxy error", { status: 500 });
  }
}


