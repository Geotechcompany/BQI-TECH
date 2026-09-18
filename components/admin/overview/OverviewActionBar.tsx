"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  FileText,
  FolderOpen,
  Inbox,
  LayoutGrid,
  ListTodo,
  Network,
  UserPlus,
  Users,
  UserSearch,
} from "lucide-react";
import DynamicActionBar, {
  type ActionItem,
} from "@/components/ui/dynamic-action";

type Shortcut = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
};

function ShortcutRow({ href, label, description, icon: Icon, tone }: Shortcut) {
  return (
    <Link
      href={href}
      className="flex w-[95%] items-center gap-3 rounded-2xl py-2.5 duration-300 hover:bg-[#272156]/[0.06] hover:px-3 dark:hover:bg-[#31CDFF]/10"
    >
      <Icon className={`h-12 w-12 shrink-0 rounded-xl p-3 ${tone}`} />
      <div className="flex min-w-0 flex-col items-start">
        <p className="font-bold text-[#272156] dark:text-[#e8f7ff]">{label}</p>
        <p className="text-sm text-[#272156]/70 dark:text-[#e8f7ff]/70">
          {description}
        </p>
      </div>
    </Link>
  );
}

function ShortcutList({ items }: { items: Shortcut[] }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-3">
      {items.map((item) => (
        <ShortcutRow key={item.href + item.label} {...item} />
      ))}
      <div className="mt-3 h-px w-[95%] bg-[#272156]/10 dark:bg-[#31CDFF]/15" />
    </div>
  );
}

const appsShortcuts: Shortcut[] = [
  {
    href: "/admin/candidates",
    label: "Candidates",
    description: "Browse candidate pool",
    icon: Users,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/job-postings",
    label: "Positions",
    description: "Open roles & postings",
    icon: Briefcase,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
  {
    href: "/admin/employees",
    label: "Employees",
    description: "Workforce records",
    icon: Users,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/leave",
    label: "Leave",
    description: "Policies & requests",
    icon: CalendarDays,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
  {
    href: "/admin/documents",
    label: "Documents",
    description: "Files & vault",
    icon: FolderOpen,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/calendar",
    label: "Calendar",
    description: "Schedule & events",
    icon: Calendar,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
  {
    href: "/admin/reports",
    label: "Reports",
    description: "Hiring analytics",
    icon: FileText,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
];

const peopleShortcuts: Shortcut[] = [
  {
    href: "/admin/employees/directory",
    label: "Directory",
    description: "Find people",
    icon: Users,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/employees/new",
    label: "Add Employee",
    description: "Create a record",
    icon: UserPlus,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
  {
    href: "/admin/departments",
    label: "Departments",
    description: "Org structure",
    icon: Building2,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/employees/org-chart",
    label: "Org Chart",
    description: "Reporting lines",
    icon: Network,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
];

const recruitShortcuts: Shortcut[] = [
  {
    href: "/admin/applicants",
    label: "Applicants",
    description: "Incoming applications",
    icon: UserSearch,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/job-postings",
    label: "Pipeline",
    description: "Open a posting to board",
    icon: Briefcase,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
  {
    href: "/admin/inbox",
    label: "Inbox",
    description: "Messages & mail",
    icon: Inbox,
    tone: "bg-[#31CDFF]/15 text-[#272156]",
  },
  {
    href: "/admin/tasks",
    label: "Tasks",
    description: "Your follow-ups",
    icon: ListTodo,
    tone: "bg-[#272156]/10 text-[#272156]",
  },
];

const overviewActions: ActionItem[] = [
  {
    id: "apps",
    label: "Apps",
    icon: LayoutGrid,
    content: <ShortcutList items={appsShortcuts} />,
    dimensions: { width: 420, height: 420 },
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    content: <ShortcutList items={peopleShortcuts} />,
    dimensions: { width: 400, height: 268 },
  },
  {
    id: "recruit",
    label: "Recruit",
    icon: UserSearch,
    content: <ShortcutList items={recruitShortcuts} />,
    dimensions: { width: 400, height: 268 },
  },
];

/** Fixed dock for Overview shortcuts. Below AdminLockScreen (z-200000), above sidebar/header. */
export function OverviewActionBar() {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] hidden -translate-x-1/2 md:flex">
      <div className="pointer-events-auto">
        <DynamicActionBar actions={overviewActions} />
      </div>
    </div>
  );
}
