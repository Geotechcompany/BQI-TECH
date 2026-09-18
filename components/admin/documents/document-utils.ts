import type {
  CompanyDocument,
  DocumentFormat,
} from "@/types/company-document";

const RECENT_DOCS_KEY = "bqi-admin-recent-documents";
const MAX_RECENT = 8;

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectFormatFromFilename(filename: string): DocumentFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (ext === "xls" || ext === "xlsx") return "XLS";
  return null;
}

export function formatModifiedDate(value?: string | null): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function readRecentDocumentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function pushRecentDocumentId(documentId: string): void {
  if (typeof window === "undefined" || !documentId) return;
  try {
    const existing = readRecentDocumentIds().filter((id) => id !== documentId);
    const next = [documentId, ...existing].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(next));
  } catch {
    // private browsing / quota
  }
}

export function resolveRecentDocuments(
  documents: CompanyDocument[],
  recentIds: string[]
): CompanyDocument[] {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const fromStorage = recentIds
    .map((id) => byId.get(id))
    .filter((doc): doc is CompanyDocument => Boolean(doc));

  if (fromStorage.length > 0) {
    return fromStorage.slice(0, 6);
  }

  return [...documents]
    .filter((doc) => doc.lastAccessedAt)
    .sort((a, b) => {
      const aTime = a.lastAccessedAt ? Date.parse(a.lastAccessedAt) : 0;
      const bTime = b.lastAccessedAt ? Date.parse(b.lastAccessedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, 6);
}
