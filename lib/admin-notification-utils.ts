export type AdminNotificationCategory =
  | "new_application"
  | "status_update"
  | string;

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: AdminNotificationCategory;
  isRead: boolean;
  link?: string;
  createdAt: string;
  priority?: string;
}

/**
 * Rewrite legacy public UI paths that used `/admin/...` to `/manage/...`.
 * Leaves `/api/admin/...` and unrelated URLs untouched. Prefer calling
 * `adminHref()` at click time when a custom public admin slug is active.
 */
export function rewriteLegacyAdminUiLink(link: string): string {
  const raw = link.trim();
  if (!raw || raw.startsWith("/api/")) return raw;

  const rewritePath = (pathname: string): string => {
    if (pathname === "/admin") return "/manage";
    if (pathname.startsWith("/admin/")) {
      return `/manage${pathname.slice("/admin".length)}`;
    }
    return pathname;
  };

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const nextPath = rewritePath(url.pathname);
      if (nextPath === url.pathname) return raw;
      url.pathname = nextPath;
      return url.toString();
    } catch {
      return raw;
    }
  }

  // Relative path, optionally with query/hash
  const match = raw.match(/^([^?#]*)(.*)$/);
  if (!match) return raw;
  const [, pathPart = "", suffix = ""] = match;
  return `${rewritePath(pathPart)}${suffix}`;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
}

function inferCategory(
  title: string,
  metadata?: Record<string, unknown>
): AdminNotificationCategory | undefined {
  const fromMetadata = metadata?.category;
  if (typeof fromMetadata === "string" && fromMetadata.trim()) {
    return fromMetadata;
  }
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.startsWith("new application")) return "new_application";
  if (lowerTitle.includes("status updated")) return "status_update";
  return undefined;
}

export function normalizeAdminNotification(raw: Record<string, unknown>): AdminNotification {
  const message =
    (typeof raw.message === "string" && raw.message) ||
    (typeof raw.description === "string" && raw.description) ||
    "";

  const isRead =
    coerceBoolean(raw.isRead) ??
    coerceBoolean(raw.read) ??
    false;

  const createdAt =
    (typeof raw.createdAt === "string" && raw.createdAt) ||
    (typeof raw.date === "string" && raw.date) ||
    (typeof raw.updatedAt === "string" && raw.updatedAt) ||
    new Date().toISOString();

  const rawType = String(raw.type ?? "info").toLowerCase();
  const legacyTypeMap: Record<string, AdminNotification["type"]> = {
    application: "info",
    interview: "success",
    system: "warning",
    other: "info",
  };
  const type =
    rawType in legacyTypeMap
      ? legacyTypeMap[rawType]
      : ["info", "warning", "error", "success"].includes(rawType)
        ? rawType
        : "info";

  const title = String(raw.title ?? "Notification");
  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : undefined;
  const category =
    (typeof raw.category === "string" && raw.category) ||
    inferCategory(title, metadata);

  const rawLink = typeof raw.link === "string" ? raw.link : undefined;

  return {
    id: String(raw.id ?? raw._id ?? ""),
    title,
    message,
    type,
    category,
    isRead,
    link: rawLink ? rewriteLegacyAdminUiLink(rawLink) : undefined,
    createdAt,
    priority: typeof raw.priority === "string" ? raw.priority : undefined,
  };
}

export function formatAdminNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const now = Date.now();
  const diffSeconds = Math.floor((now - date.getTime()) / 1000);

  if (diffSeconds < 0) return "Just now";
  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatUnreadBadgeCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}
