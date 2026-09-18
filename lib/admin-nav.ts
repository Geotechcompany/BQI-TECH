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
  "/manage/applicants",
  "/manage/candidates",
  "/manage/archived",
  "/manage/job-postings",
  "/manage/applications",
  "/manage/cv-vault",
  "/manage/jobs",
  "/manage/shortlisted",
  "/manage/technical-assessment",
  "/manage/interviewing",
  "/manage/hired",
  "/manage/disqualified",
  "/manage/rejected",
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
        href: "/manage/overview",
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
        activePathPrefixes: ["/manage/employees"],
        children: [
          {
            kind: "link",
            id: "employees-all",
            name: "All Employees",
            href: "/manage/employees",
            icon: Users,
            moduleKey: "people",
            match: "employees-root",
          },
          {
            kind: "link",
            id: "employees-directory",
            name: "Directory",
            href: "/manage/employees/directory",
            icon: UserCircle2,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-profile",
            name: "Employee Profile",
            href: "/manage/employees/profile",
            icon: IdCard,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-new",
            name: "Add Employee",
            href: "/manage/employees/new",
            icon: UserPlus,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-edit",
            name: "Edit Employee",
            href: "/manage/employees/edit",
            icon: Pencil,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-org-chart",
            name: "Org Chart",
            href: "/manage/employees/org-chart",
            icon: Network,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-onboarding",
            name: "Onboarding",
            href: "/manage/employees/onboarding",
            icon: ClipboardCheck,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-offboarding",
            name: "Offboarding",
            href: "/manage/employees/offboarding",
            icon: UserMinus,
            moduleKey: "people",
          },
          {
            kind: "link",
            id: "employees-import",
            name: "Import / Export",
            href: "/manage/employees/import",
            icon: FileUp,
            moduleKey: "people",
          },
        ],
      },
      {
        kind: "link",
        id: "departments",
        name: "Departments",
        href: "/manage/departments",
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
        activePathPrefixes: ["/manage/leave"],
        children: [
          {
            kind: "link",
            id: "leave-overview",
            name: "Overview",
            href: "/manage/leave/overview",
            icon: LayoutDashboard,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-requests",
            name: "Requests",
            href: "/manage/leave/requests",
            icon: ClipboardList,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-balances",
            name: "Balances",
            href: "/manage/leave/balances",
            icon: Scale,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-calendar",
            name: "Calendar",
            href: "/manage/leave/calendar",
            icon: CalendarDays,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-types",
            name: "Leave Types",
            href: "/manage/leave/types",
            icon: Layers,
            anyModuleKeys: ["leave", "people"],
          },
          {
            kind: "link",
            id: "leave-policies",
            name: "Policies",
            href: "/manage/leave/policies",
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
            href: "/manage/applicants",
            icon: UserPlus,
            moduleKey: "candidates",
          },
          {
            kind: "link",
            id: "candidates",
            name: "Candidates",
            href: "/manage/candidates",
            icon: Folder,
            moduleKey: "candidates",
          },
          {
            kind: "link",
            id: "archive",
            name: "Archive",
            href: "/manage/archived",
            icon: Archive,
            moduleKey: "candidates",
          },
          {
            kind: "link",
            id: "positions",
            name: "Positions",
            href: "/manage/job-postings",
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
        href: "/manage/inbox",
        icon: Inbox,
        moduleKey: "candidates",
        tourAttr: "nav-inbox",
      },
      {
        kind: "link",
        id: "tasks",
        name: "Tasks",
        href: "/manage/tasks",
        icon: ListTodo,
        moduleKey: "candidates",
      },
      {
        kind: "link",
        id: "communications",
        name: "Communications",
        href: "/manage/communications",
        icon: MessagesSquare,
        anyModuleKeys: ["email_broadcast", "candidates"],
        tourAttr: "nav-communications",
      },
      {
        kind: "link",
        id: "calendar",
        name: "Calendar",
        href: "/manage/calendar",
        icon: CalendarDays,
        moduleKey: "candidates",
      },
      {
        kind: "link",
        id: "documents",
        name: "Documents",
        href: "/manage/documents",
        icon: FolderOpen,
        moduleKey: "content",
      },
      {
        kind: "link",
        id: "reports",
        name: "Reports",
        href: "/manage/reports",
        icon: ChartColumnIncreasing,
        moduleKey: "overview",
        tourAttr: "nav-reports",
      },
      {
        kind: "link",
        id: "notifications",
        name: "Notifications",
        href: "/manage/notifications",
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
          "/manage/blog-management",
          "/manage/surveys",
          "/manage/releases",
          "/manage/whats-new",
        ],
        children: [
          {
            kind: "link",
            id: "blog",
            name: "Blog Management",
            href: "/manage/blog-management",
            icon: FileText,
            moduleKey: "content",
          },
          {
            kind: "link",
            id: "surveys",
            name: "Surveys",
            href: "/manage/surveys",
            icon: BarChart,
            moduleKey: "content",
          },
          {
            kind: "link",
            id: "releases",
            name: "Feature Releases",
            href: "/manage/releases",
            icon: Rocket,
            moduleKey: "content",
          },
          {
            kind: "link",
            id: "changelog",
            name: "Changelog",
            href: "/manage/whats-new",
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
          "/manage/settings",
          "/manage/user-management",
          "/manage/email-broadcast",
          "/manage/audit-logs",
          "/manage/backup",
        ],
        children: [
          {
            kind: "link",
            id: "settings-general",
            name: "General",
            href: "/manage/settings",
            icon: Settings,
            moduleKey: "settings",
            match: "exact",
          },
          {
            kind: "link",
            id: "user-management",
            name: "User Management",
            href: "/manage/user-management",
            icon: Users,
            moduleKey: "user_management",
          },
          {
            kind: "link",
            id: "email-broadcast",
            name: "Email Broadcast",
            href: "/manage/email-broadcast",
            icon: MailIcon,
            moduleKey: "email_broadcast",
          },
          {
            kind: "link",
            id: "audit-logs",
            name: "Admin Activity",
            href: "/manage/audit-logs",
            icon: ScrollText,
            moduleKey: "audit_logs",
          },
          {
            kind: "link",
            id: "backup",
            name: "Backup",
            href: "/manage/backup",
            icon: HardDrive,
            moduleKey: "backup",
          },
        ],
      },
      {
        kind: "link",
        id: "help",
        name: "Help",
        href: "/manage/help",
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
  if (pathname === "/manage/employees") return true;
  const profileMatch = pathname.match(/^\/manage\/employees\/([^/]+)(\/edit)?$/);
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
