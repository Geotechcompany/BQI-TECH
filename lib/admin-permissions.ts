import {
  DEFAULT_ADMIN_BASE,
  readAdminBasePathCookie,
  toInternalAdminPath,
} from "@/lib/admin-path";

export type AdminModuleKey =
  | "overview"
  | "help"
  | "candidates"
  | "recruitment"
  | "people"
  | "leave"
  | "content"
  | "user_management"
  | "notifications"
  | "email_broadcast"
  | "audit_logs"
  | "settings"
  | "backup";

export interface AdminModuleDefinition {
  key: AdminModuleKey;
  label: string;
  description: string;
  group: string;
}

export const ADMIN_MODULE_DEFINITIONS: AdminModuleDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Dashboard metrics and hiring insights",
    group: "General",
  },
  {
    key: "help",
    label: "Help Center",
    description: "Platform guides and support resources",
    group: "General",
  },
  {
    key: "candidates",
    label: "Candidates",
    description: "Applicants, applications, archive, and pipeline",
    group: "Hiring",
  },
  {
    key: "recruitment",
    label: "Recruitment",
    description: "Create and manage positions",
    group: "Hiring",
  },
  {
    key: "people",
    label: "People",
    description: "Employees, departments, attendance, and org chart",
    group: "People",
  },
  {
    key: "leave",
    label: "Leave",
    description: "Leave requests, balances, calendar, types, and policies",
    group: "People",
  },
  {
    key: "content",
    label: "Content",
    description: "Blog, surveys, documents, and release notes",
    group: "Marketing",
  },
  {
    key: "user_management",
    label: "User Management",
    description: "Invite admins and manage permissions",
    group: "Workspace",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "System and admin notifications",
    group: "Workspace",
  },
  {
    key: "email_broadcast",
    label: "Email Broadcast",
    description: "Bulk email campaigns to users",
    group: "Workspace",
  },
  {
    key: "audit_logs",
    label: "Admin Activity",
    description: "Audit trail of admin actions",
    group: "Workspace",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Platform configuration and preferences",
    group: "Workspace",
  },
  {
    key: "backup",
    label: "Backup & Recovery",
    description: "Off-site backups, schedules, and OneDrive exports",
    group: "Workspace",
  },
];

const ROUTE_MODULE_MAP: Record<string, AdminModuleKey> = {
  "/manage/overview": "overview",
  "/manage/reports": "overview",
  "/manage/help": "help",
  "/manage/applications": "candidates",
  "/manage/candidates": "candidates",
  "/manage/calendar": "candidates",
  "/manage/inbox": "candidates",
  "/manage/tasks": "candidates",
  "/manage/communications": "email_broadcast",
  "/manage/shortlisted": "candidates",
  "/manage/technical-assessment": "candidates",
  "/manage/interviewing": "candidates",
  "/manage/hired": "candidates",
  "/manage/disqualified": "candidates",
  "/manage/archived": "candidates",
  "/manage/cv-vault": "candidates",
  "/manage/applicants": "candidates",
  "/manage/jobs": "candidates",
  "/manage/rejected": "candidates",
  "/manage/job-postings": "recruitment",
  "/manage/employees": "people",
  "/manage/departments": "people",
  "/manage/attendance": "people",
  "/manage/leave": "leave",
  "/manage/blog-management": "content",
  "/manage/surveys": "content",
  "/manage/documents": "content",
  "/manage/whats-new": "content",
  "/manage/user-management": "user_management",
  "/manage/notifications": "notifications",
  "/manage/email-broadcast": "email_broadcast",
  "/manage/audit-logs": "audit_logs",
  "/manage/settings": "settings",
  "/manage/backup": "backup",
};

export function resolveModuleForPath(pathname: string): AdminModuleKey | null {
  const internal = toInternalAdminPath(
    pathname,
    readAdminBasePathCookie() || DEFAULT_ADMIN_BASE
  );
  if (!internal.startsWith("/manage")) return null;

  const sortedRoutes = Object.keys(ROUTE_MODULE_MAP).sort(
    (a, b) => b.length - a.length
  );
  for (const route of sortedRoutes) {
    if (internal === route || internal.startsWith(`${route}/`)) {
      return ROUTE_MODULE_MAP[route];
    }
  }
  return null;
}

export function isSuperAdmin(role?: string): boolean {
  return String(role ?? "").toUpperCase() === "SUPER_ADMIN";
}

export function isAdminRole(role?: string): boolean {
  const upper = String(role ?? "").toUpperCase();
  return upper === "ADMIN" || upper === "SUPER_ADMIN";
}

export function getEffectiveAdminModules(
  role?: string,
  modules?: string[] | null
): AdminModuleKey[] {
  if (isSuperAdmin(role)) {
    return ADMIN_MODULE_DEFINITIONS.map((m) => m.key);
  }
  if (!isAdminRole(role)) return [];
  if (!modules?.length) return ADMIN_MODULE_DEFINITIONS.map((m) => m.key);
  return modules.filter((m): m is AdminModuleKey =>
    ADMIN_MODULE_DEFINITIONS.some((def) => def.key === m)
  );
}

export function hasAdminModule(
  role?: string,
  modules?: string[] | null,
  moduleKey?: AdminModuleKey
): boolean {
  if (!moduleKey) return true;
  if (isSuperAdmin(role)) return true;
  return getEffectiveAdminModules(role, modules).includes(moduleKey);
}

export function canAccessAdminPath(
  pathname: string,
  role?: string,
  modules?: string[] | null
): boolean {
  if (!isAdminRole(role)) return false;
  const moduleKey = resolveModuleForPath(pathname);
  if (!moduleKey) return true;
  return hasAdminModule(role, modules, moduleKey);
}

export function getModuleLabel(key: string): string {
  return (
    ADMIN_MODULE_DEFINITIONS.find((m) => m.key === key)?.label ??
    key.replace(/_/g, " ")
  );
}

export function groupModulesByCategory(
  modules: AdminModuleDefinition[] = ADMIN_MODULE_DEFINITIONS
): Record<string, AdminModuleDefinition[]> {
  return modules.reduce<Record<string, AdminModuleDefinition[]>>(
    (acc, module) => {
      if (!acc[module.group]) acc[module.group] = [];
      acc[module.group].push(module);
      return acc;
    },
    {}
  );
}

export interface AdminMenuItemLike {
  name: string;
  href?: string;
  icon: unknown;
  moduleKey?: AdminModuleKey;
  /** When set, any matching module grants access (OR). */
  anyModuleKeys?: AdminModuleKey[];
  /** Nested children for collapsible groups (admin-nav). */
  children?: AdminMenuItemLike[];
  kind?: "link" | "group";
}

export interface AdminMenuSectionLike {
  title: string;
  icon?: unknown;
  alwaysExpanded?: boolean;
  items: AdminMenuItemLike[];
}

function itemHasModuleAccess(
  item: AdminMenuItemLike,
  role?: string,
  modules?: string[] | null
): boolean {
  if (item.anyModuleKeys?.length) {
    return item.anyModuleKeys.some((key) =>
      hasAdminModule(role, modules, key)
    );
  }
  const moduleKey =
    item.moduleKey ??
    (item.href ? resolveModuleForPath(item.href) ?? undefined : undefined);
  if (!moduleKey) return true;
  return hasAdminModule(role, modules, moduleKey);
}

export function filterAdminMenuSections<T extends AdminMenuSectionLike>(
  sections: T[],
  role?: string,
  modules?: string[] | null
): T[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.children?.length) {
            const children = item.children.filter((child) =>
              itemHasModuleAccess(child, role, modules)
            );
            return { ...item, children };
          }
          return item;
        })
        .filter((item) => {
          if (item.children) {
            if (item.children.length === 0) return false;
            return itemHasModuleAccess(item, role, modules);
          }
          return itemHasModuleAccess(item, role, modules);
        }),
    }))
    .filter((section) => section.items.length > 0);
}
