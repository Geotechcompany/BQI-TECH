export function normalizeDropboxUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("dropbox")) {
      return url;
    }

    if (
      parsed.hostname === "www.dropbox.com" ||
      parsed.hostname === "dropbox.com"
    ) {
      parsed.hostname = "dl.dropboxusercontent.com";
    }

    parsed.searchParams.set("dl", "1");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isPdfUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return /\.pdf($|\?|#)/i.test(parsed.pathname + parsed.search);
  } catch {
    return /\.pdf($|\?|#)/i.test(url);
  }
}

export function isNonPreviewableDoc(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return /\.(docx?|doc)($|\?|#)/i.test(parsed.pathname + parsed.search);
  } catch {
    return /\.(docx?|doc)($|\?|#)/i.test(url);
  }
}

export function getProxyFetchUrl(url: string): string {
  if (!url) return "";
  const normalized = normalizeDropboxUrl(url);
  return `/api/proxy?url=${encodeURIComponent(normalized)}`;
}

export function isPreviewableContentType(contentType: string, url: string): boolean {
  return contentType.includes("pdf") || isPdfUrl(url);
}

export function getProxiedUrl(url: string): string {
  return getProxyFetchUrl(url);
}

export function getDownloadUrl(url: string): string {
  return normalizeDropboxUrl(url);
}

export function getCvDisplayLabel(url: string): string {
  if (!url) return "Link to CV";

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];

    if (!lastPart?.includes(".")) {
      return "Link to CV";
    }

    const filename = decodeURIComponent(lastPart.split("?")[0]);
    const isUuidFilename =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(
        filename
      );

    if (isUuidFilename) {
      return "Link to CV";
    }

    const extension = filename.match(/(\.[a-z0-9]+)$/i)?.[1] ?? "";
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
    const cleaned = nameWithoutExt
      .replace(/[-_]/g, " ")
      .replace(/\s+\d{10,}$/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 3) {
      return "Link to CV";
    }

    return `${cleaned}${extension}`;
  } catch {
    return "Link to CV";
  }
}
