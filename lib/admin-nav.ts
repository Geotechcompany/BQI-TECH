import {
  Folder,
  FolderOpen,
  Users,
  FileText,
  Settings,
  LayoutDashboard,
  ClipboardList,
  Archive,
  UserPlus,
  BookText,
  Rocket,
  BarChart,
  HelpCircle,
  Bell,
  ScrollText,
  Mail as MailIcon,
  HardDrive,
  CalendarDays,
  ChartColumnIncreasing,
  Inbox,
  MessagesSquare,
  ListTodo,
  Briefcase,
  UserCircle2,
  Palmtree,
  Scale,
  Layers,
  CalendarOff,
  Network,
  ClipboardCheck,
  UserMinus,
  FileUp,
  IdCard,
  Pencil,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { AdminModuleKey } from "@/lib/admin-permissions";

/** Flat leaf link in the admin sidebar. */
export interface AdminNavLink {
  kind: "link";
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
  moduleKey?: AdminModuleKey;
  anyModuleKeys?: AdminModuleKey[];
  /** Guide / product-tour attribute */
  tourAttr?: string;
  /**
   * Active-match strategy:
   * - prefix (default): pathname === href || startsWith(href + '/')
   * - exact: pathname === href only
   * - employees-root: /admin/employees list + /:id profile/edit (not named sub-routes)
   */
  match?: "prefix" | "exact" | "employees-root";
}

/** Collapsible parent with indented children. */
export interface AdminNavGroup {
  kind: "group";
  id: string;
  name: string;
  icon: LucideIcon;
  moduleKey?: AdminModuleKey;
  anyModuleKeys?: AdminModuleKey[];
  /** When true, starts expanded even if no child route is active. Default false (collapsed; auto-expands on active path). */
  defaultExpanded?: boolean;
  /** Extra path prefixes that keep this group expanded / parent-highlighted. */
  activePathPrefixes?: string[];
  children: AdminNavLink[];
}

export type AdminNavItem = AdminNavLink | AdminNavGroup;

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

/** Reserved employee path segments that are not profile IDs. */
export const EMPLOYEE_RESERVED_SEGMENTS = new Set([
  "directory",
  "new",
  "org-chart",
  "onboarding",
  "offboarding",
  "import",
  "profile",
  "edit",
]);

const RECRUITMENT_PATH_PREFIXES = [
  "/admin/applicants",
  "/admin/candidates",
  "/admin/archived",
  "/admin/job-postings",
  "/admin/applications",
  "/admin/cv-vault",
  "/admin/jobs",
  "/admin/shortlisted",
  "/admin/technical-assessment",
  "/admin/interviewing",
  "/admin/hired",
  "/admin/disqualified",
  "/admin/rejected",
];

/**
 * Single source of truth for admin sidebar IA.
 * Only routes that exist in the app tree — no mock/stub pages.
 */
export const adminNavSections: AdminNavSection[] = [
  {
    title: "Dashboards",
    items: [
      {
        kind: "link",
        id: "overview",
        name: "Overview",
        href: "/admin/overview",
        icon: LayoutDashboard,
        moduleKey: "overview",
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        kind: "group",
        id: "employees",
        name: "Employees",
        icon: Users,
        moduleKey: "people",
        defaultExpanded: false,
        activePathPrefixes: ["/admin/employees"],
        children: [
          {
            kind: "link",
            id: "employees-all",
            name: "All Employees",
            href: "/admin/employees",
            icon: Users,
            moduleKey: "people",
            match: "employees-root",
          },
          {
            kind: "link",
            id: "employees-directory",
            name: "Directory",
            href: "/admin/employees/directory",
            icon: UserCircle2,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-profile",
            name: "Employee Profile",
            href: "/admin/employees/profile",
            icon: IdCard,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-new",
            name: "Add Employee",
            href: "/admin/employees/new",
            icon: UserPlus,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-edit",
            name: "Edit Employee",
            href: "/admin/employees/edit",
            icon: Pencil,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-org-chart",
            name: "Org Chart",
            href: "/admin/employees/org-chart",
            icon: Network,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-onboarding",
            name: "Onboarding",
            href: "/admin/employees/onboarding",
            icon: ClipboardCheck,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-offboarding",
            name: "Offboarding",
            href: "/admin/employees/offboarding",
            icon: UserMinus,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-import",
            name: "Import / Export",
            href: "/admin/employees/import",
            icon: FileUp,
            moduleKey: "people",
          },
        ],
      },
      {
        kind: "link",
        id: "departments",
        name: "Departments",
        href: "/admin/departments",
        icon: Building2,
        moduleKey: "people",
      },
      {
        kind: "group",
        id: "leave",
        name: "Leave",
        icon: Palmtree,
        anyModuleKeys: ["leave", "people"],
        defaultExpanded: false,
        activePathPrefixes: ["/admin/leave"],
        children: [
          {
            kind: "link",
            id: "leave-overview",
            name: "Overview",
            href: "/admin/leave/overview",
            icon: LayoutDashboard,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-requests",
            name: "Requests",
            href: "/admin/leave/requests",
            icon: ClipboardList,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-balances",
            name: "Balances",
            href: "/admin/leave/balances",
            icon: Scale,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-calendar",
            name: "Calendar",
            href: "/admin/leave/calendar",
            icon: CalendarDays,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-types",
            name: "Leave Types",
            href: "/admin/leave/types",
            icon: Layers,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-policies",
            name: "Policies",
            href: "/admin/leave/policies",
            icon: CalendarOff,
            anyModuleKeys: ["leave", "people"],
          },
        ],
      },
    ],
  },
  {
    title: "Talent",
    items: [
      {
        kind: "group",
        id: "recruitment",
        name: "Recruitment",
        icon: Briefcase,
        anyModuleKeys: ["candidates", "recruitment"],
        defaultExpanded: false,
        activePathPrefixes: RECRUITMENT_PATH_PREFIXES,
        children: [
          {
            kind: "link",
            id: "applicants",
            name: "Applicants",
            href: "/admin/applicants",
            icon: UserPlus,
            moduleKey: "candidates",
          },
          {
            kind: "link",
            id: "candidates",
            name: "Candidates",
            href: "/admin/candidates",
            icon: Folder,
            moduleKey: "candidates",
          },
          {
            kind: "link",
            id: "archive",
            name: "Archive",
            href: "/admin/archived",
            icon: Archive,
            moduleKey: "candidates",
          },
          {
            kind: "link",
            id: "positions",
            name: "Positions",
            href: "/admin/job-postings",
            icon: ClipboardList,
            moduleKey: "recruitment",
            match: "prefix",
          },
        ],
      },
    ],
  },
  {
    title: "Workspace",
    items: [
      {
        kind: "link",
        id: "inbox",
        name: "Inbox",
        href: "/admin/inbox",
        icon: Inbox,
        moduleKey: "candidates",
        tourAttr: "nav-inbox",
      },
      {
        kind: "link",
        id: "tasks",
        name: "Tasks",
        href: "/admin/tasks",
        icon: ListTodo,
        moduleKey: "candidates",
      },
      {
        kind: "link",
        id: "communications",
        name: "Communications",
        href: "/admin/communications",
        icon: MessagesSquare,
        anyModuleKeys: ["email_broadcast", "candidates"],
        tourAttr: "nav-communications",
      },
      {
        kind: "link",
        id: "calendar",
        name: "Calendar",
        href: "/admin/calendar",
        icon: CalendarDays,
        moduleKey: "candidates",
      },
      {
        kind: "link",
        id: "documents",
        name: "Documents",
        href: "/admin/documents",
        icon: FolderOpen,
        moduleKey: "content",
      },
      {
        kind: "link",
        id: "reports",
        name: "Reports",
        href: "/admin/reports",
        icon: ChartColumnIncreasing,
        moduleKey: "overview",
        tourAttr: "nav-reports",
      },
      {
        kind: "link",
        id: "notifications",
        name: "Notifications",
        href: "/admin/notifications",
        icon: Bell,
        moduleKey: "notifications",
      },
      {
        kind: "group",
        id: "content",
        name: "Content",
        icon: BookText,
        moduleKey: "content",
        defaultExpanded: false,
        activePathPrefixes: [
          "/admin/blog-management",
          "/admin/surveys",
          "/admin/releases",
          "/admin/whats-new",
        ],
        children: [
          {
            kind: "link",
            id: "blog",
            name: "Blog Management",
            href: "/admin/blog-management",
            icon: FileText,
            moduleKey: "content",
          },
          {
            kind: "link",
            id: "surveys",
            name: "Surveys",
            href: "/admin/surveys",
            icon: BarChart,
            moduleKey: "content",
          },
          {
            kind: "link",
            id: "releases",
            name: "Feature Releases",
            href: "/admin/releases",
            icon: Rocket,
            moduleKey: "content",
          },
          {
            kind: "link",
            id: "changelog",
            name: "Changelog",
            href: "/admin/whats-new",
            icon: ScrollText,
            moduleKey: "content",
          },
        ],
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        kind: "group",
        id: "settings",
        name: "Settings",
        icon: Settings,
        anyModuleKeys: [
          "settings",
          "user_management",
          "email_broadcast",
          "audit_logs",
          "backup",
        ],
        defaultExpanded: false,
        activePathPrefixes: [
          "/admin/settings",
          "/admin/user-management",
          "/admin/email-broadcast",
          "/admin/audit-logs",
          "/admin/backup",
        ],
        children: [
          {
            kind: "link",
            id: "settings-general",
            name: "General",
            href: "/admin/settings",
            icon: Settings,
            moduleKey: "settings",
            match: "exact",
          },
          {
            kind: "link",
            id: "user-management",
            name: "User Management",
            href: "/admin/user-management",
            icon: Users,
            moduleKey: "user_management",
          },
          {
            kind: "link",
            id: "email-broadcast",
            name: "Email Broadcast",
            href: "/admin/email-broadcast",
            icon: MailIcon,
            moduleKey: "email_broadcast",
          },
          {
            kind: "link",
            id: "audit-logs",
            name: "Admin Activity",
            href: "/admin/audit-logs",
            icon: ScrollText,
            moduleKey: "audit_logs",
          },
          {
            kind: "link",
            id: "backup",
            name: "Backup",
            href: "/admin/backup",
            icon: HardDrive,
            moduleKey: "backup",
          },
        ],
      },
      {
        kind: "link",
        id: "help",
        name: "Help",
        href: "/admin/help",
        icon: HelpCircle,
        moduleKey: "help",
      },
    ],
  },
];

/** @deprecated Prefer adminNavSections — kept for callers expecting menuSections shape. */
export const menuSections = adminNavSections;

export function pathMatchesPrefix(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isEmployeesRootActive(pathname: string): boolean {
  if (pathname === "/admin/employees") return true;
  const profileMatch = pathname.match(/^\/admin\/employees\/([^/]+)(\/edit)?$/);
  if (!profileMatch) return false;
  return !EMPLOYEE_RESERVED_SEGMENTS.has(profileMatch[1]);
}

export function isNavLinkActive(item: AdminNavLink, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href;
  if (item.match === "employees-root") return isEmployeesRootActive(pathname);
  return pathMatchesPrefix(pathname, item.href);
}

export function isNavGroupPathActive(
  group: AdminNavGroup,
  pathname: string
): boolean {
  if (group.children.some((child) => isNavLinkActive(child, pathname))) {
    return true;
  }
  return (group.activePathPrefixes ?? []).some((prefix) =>
    pathMatchesPrefix(pathname, prefix)
  );
}

export function isNavGroupDefaultExpanded(
  group: AdminNavGroup,
  pathname: string
): boolean {
  if (isNavGroupPathActive(group, pathname)) return true;
  return group.defaultExpanded === true;
}

/** Flatten all leaf links for command palette / search. */
export function flattenAdminNavLinks(
  sections: AdminNavSection[]
): Array<AdminNavLink & { group: string }> {
  const out: Array<AdminNavLink & { group: string }> = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === "link") {
        out.push({ ...item, group: section.title });
      } else {
        for (const child of item.children) {
          out.push({ ...child, group: section.title });
        }
      }
    }
  }
  return out;
}
