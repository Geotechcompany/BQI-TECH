export type AdminModuleKey =
  | "overview"
  | "help"
  | "candidates"
  | "recruitment"
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
    description: "Applications, pipeline stages, and CV vault",
    group: "Hiring",
  },
  {
    key: "recruitment",
    label: "Recruitment",
    description: "Job postings and interview question bank",
    group: "Hiring",
  },
  {
    key: "content",
    label: "Content",
    description: "Blog, surveys, and release notes",
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
  "/admin/overview": "overview",
  "/admin/help": "help",
  "/admin/applications": "candidates",
  "/admin/shortlisted": "candidates",
  "/admin/technical-assessment": "candidates",
  "/admin/interviewing": "candidates",
  "/admin/hired": "candidates",
  "/admin/disqualified": "candidates",
  "/admin/archived": "candidates",
  "/admin/cv-vault": "candidates",
  "/admin/rejected": "candidates",
  "/admin/job-postings": "recruitment",
  "/admin/blog-management": "content",
  "/admin/surveys": "content",
  "/admin/whats-new": "content",
  "/admin/user-management": "user_management",
  "/admin/notifications": "notifications",
  "/admin/email-broadcast": "email_broadcast",
  "/admin/audit-logs": "audit_logs",
  "/admin/settings": "settings",
  "/admin/backup": "backup",
};

export function resolveModuleForPath(pathname: string): AdminModuleKey | null {
  if (!pathname.startsWith("/admin")) return null;

  const sortedRoutes = Object.keys(ROUTE_MODULE_MAP).sort(
    (a, b) => b.length - a.length
  );
  for (const route of sortedRoutes) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
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
  href: string;
  icon: unknown;
  moduleKey?: AdminModuleKey;
}

export interface AdminMenuSectionLike {
  title: string;
  icon: unknown;
  alwaysExpanded: boolean;
  items: AdminMenuItemLike[];
}

export function filterAdminMenuSections<T extends AdminMenuSectionLike>(
  sections: T[],
  role?: string,
  modules?: string[] | null
): T[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const moduleKey =
          item.moduleKey ?? resolveModuleForPath(item.href) ?? undefined;
        if (!moduleKey) return true;
        return hasAdminModule(role, modules, moduleKey);
      }),
    }))
    .filter((section) => section.items.length > 0);
}
