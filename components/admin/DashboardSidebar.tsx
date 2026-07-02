"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  X,
  LogOut,
  Folder,
  Users,
  FileText,
  Settings,
  LayoutDashboard,
  BriefcaseBusiness,
  ClipboardList,
  BrainCircuit,
  BadgeCheck,
  Laptop2,
  Handshake,
  Ban,
  Archive,
  FileArchive,
  BookText,
  Rocket,
  BarChart,
  HelpCircle,
  Bell,
  ScrollText,
  Mail as MailIcon,
  HardDrive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useAdminTheme } from "@/contexts/AdminThemeContext";
import { getSidebarSkin } from "@/lib/admin-sidebar-skin";
import { AdminBrandTitle } from "@/components/admin/AdminBrandTitle";
import { useState, useMemo } from "react";
import {
  filterAdminMenuSections,
  hasAdminModule,
} from "@/lib/admin-permissions";
import { cn } from "@/lib/utils";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface MenuSection {
  title: string;
  icon: any; // Using any for Lucide icons type
  alwaysExpanded: boolean;
  items: {
    name: string;
    href: string;
    icon: any;
    moduleKey?: import("@/lib/admin-permissions").AdminModuleKey;
  }[];
}

export const menuSections: MenuSection[] = [
  {
    title: "Candidates",
    icon: Users,
    alwaysExpanded: true,
    items: [
      { name: "Applications", href: "/admin/applications", icon: Folder, moduleKey: "candidates" },
      { name: "Shortlisted", href: "/admin/shortlisted", icon: BadgeCheck, moduleKey: "candidates" },
      { name: "Technical Screen", href: "/admin/technical-assessment", icon: Laptop2, moduleKey: "candidates" },
      { name: "Interviews", href: "/admin/interviewing", icon: Handshake, moduleKey: "candidates" },
      { name: "Hired", href: "/admin/hired", icon: Rocket, moduleKey: "candidates" },
      { name: "Disqualified", href: "/admin/disqualified", icon: Ban, moduleKey: "candidates" },
      { name: "Archive", href: "/admin/archived", icon: Archive, moduleKey: "candidates" },
      { name: "CV Vault", href: "/admin/cv-vault", icon: FileArchive, moduleKey: "candidates" },
    ],
  },
  {
    title: "Recruitment",
    icon: BriefcaseBusiness,
    alwaysExpanded: true,
    items: [
      { name: "Job Postings", href: "/admin/job-postings", icon: ClipboardList, moduleKey: "recruitment" },
      { name: "Questions Bank", href: "/admin/job-postings/questions", icon: BrainCircuit, moduleKey: "recruitment" },
    ],
  },
  {
    title: "Content",
    icon: BookText,
    alwaysExpanded: false,
    items: [
      { name: "Blog Management", href: "/admin/blog-management", icon: FileText, moduleKey: "content" },
      { name: "Surveys", href: "/admin/surveys", icon: BarChart, moduleKey: "content" },
      { name: "Feature Releases", href: "/admin/releases", icon: Rocket, moduleKey: "content" },
      { name: "Changelog", href: "/admin/whats-new", icon: ScrollText, moduleKey: "content" },
    ],
  },
  {
    title: "Workspace",
    icon: LayoutDashboard,
    alwaysExpanded: false,
    items: [
      { name: "User Management", href: "/admin/user-management", icon: Users, moduleKey: "user_management" },
      { name: "Notifications", href: "/admin/notifications", icon: Bell, moduleKey: "notifications" },
      { name: "Email Broadcast", href: "/admin/email-broadcast", icon: MailIcon, moduleKey: "email_broadcast" },
      { name: "Admin Activity", href: "/admin/audit-logs", icon: ScrollText, moduleKey: "audit_logs" },
      { name: "Backup", href: "/admin/backup", icon: HardDrive, moduleKey: "backup" },
      { name: "Settings", href: "/admin/settings", icon: Settings, moduleKey: "settings" },
    ],
  },
];

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export default function DashboardSidebar({
  isOpen,
  onClose,
  className,
}: DashboardSidebarProps) {
  const { sidebarCollapsed, updateSettings } = useSettings();
  const { theme } = useAdminTheme();
  const skin = useMemo(() => getSidebarSkin(theme), [theme]);
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "Workspace"
  );

  const visibleSections = useMemo(
    () =>
      filterAdminMenuSections(
        menuSections,
        user?.role,
        user?.adminModules
      ),
    [user?.role, user?.adminModules]
  );

  const canViewOverview = hasAdminModule(
    user?.role,
    user?.adminModules,
    "overview"
  );
  const canViewHelp = hasAdminModule(user?.role, user?.adminModules, "help");

  if (pathname === "/admin/login") return null;

  const toggleSection = (title: string) => {
    const section = menuSections.find((s) => s.title === title);
    if (section?.alwaysExpanded) return; // Don't toggle always expanded sections
    setExpandedSection(expandedSection === title ? null : title);
  };

  const isExpanded = (section: MenuSection) => {
    return section.alwaysExpanded || expandedSection === section.title;
  };

  return (
    <aside
      className={`
        translate-x-0
        ${sidebarCollapsed ? "w-20" : "w-64"}
        ${skin.shell}
        ${className || ""}
      `}
      style={{
        top: "var(--admin-banner-offset, 0px)",
        height: "calc(100vh - var(--admin-banner-offset, 0px))",
      }}
    >
      <TooltipProvider>
        <div className="flex items-center justify-between mb-8 p-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2"
          >
            <img
              src={skin.logoSrc}
              alt="Logo"
              width={sidebarCollapsed ? 32 : 68}
              height={sidebarCollapsed ? 32 : 48}
              className="rounded-lg"
            />
            {!sidebarCollapsed && (
              <AdminBrandTitle
                badgeVariant={skin.brandBadge}
                titleClassName={skin.brandTitleClass}
              />
            )}
          </motion.div>

          <div className="flex gap-2">
            <UiTooltip>
              <TooltipTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={() =>
                    updateSettings({ sidebarCollapsed: !sidebarCollapsed })
                  }
                  className={cn("hidden md:block p-2 rounded-lg", skin.iconButton)}
                >
                  <img
                    src={skin.collapseIconSrc}
                    alt={sidebarCollapsed ? "Expand" : "Collapse"}
                    width={20}
                    height={20}
                    className={skin.studio ? "block" : "block dark:hidden"}
                  />
                  {!skin.studio && (
                    <img
                      src={skin.collapseIconDarkSrc}
                      alt={sidebarCollapsed ? "Expand" : "Collapse"}
                      width={20}
                      height={20}
                      className="hidden dark:block"
                    />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              </TooltipContent>
            </UiTooltip>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={cn("md:hidden p-2 rounded-lg", skin.iconButton)}
            >
              <X className={cn("w-6 h-6", skin.studio ? "text-white/70" : "text-muted-foreground")} />
            </motion.button>
          </div>
        </div>

        <nav className="space-y-2 px-4 pt-1.5 pb-20 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          {/* Standalone Overview Link */}
          {canViewOverview && (
          <motion.div whileHover={{ scale: 1.01 }} className="space-y-2">
            {sidebarCollapsed ? (
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/overview"
                    className={skin.navLinkCollapsed(pathname === "/admin/overview")}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Overview</TooltipContent>
              </UiTooltip>
            ) : (
              <Link
                href="/admin/overview"
                className={cn(skin.navLink(pathname === "/admin/overview"), "p-3")}
              >
                <LayoutDashboard className={cn("w-5 h-5", skin.sectionIcon)} />
                <span className="ml-3">Overview</span>
              </Link>
            )}
          </motion.div>
          )}

          {/* Help Link */}
          {canViewHelp && (
          <motion.div whileHover={{ scale: 1.02 }}>
            {sidebarCollapsed ? (
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/help"
                    className={skin.navLinkCollapsed(pathname === "/admin/help")}
                  >
                    <HelpCircle className="w-5 h-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Help</TooltipContent>
              </UiTooltip>
            ) : (
              <Link
                href="/admin/help"
                className={cn(skin.navLink(pathname === "/admin/help"), "p-3")}
              >
                <HelpCircle className={cn("w-5 h-5", skin.sectionIcon)} />
                <span className="ml-3">Help</span>
              </Link>
            )}
          </motion.div>
          )}

          {visibleSections.map((section: MenuSection) => (
            <div key={section.title} className="space-y-1">
              {sidebarCollapsed ? (
                // Collapsed sidebar - show section icon with dropdown on hover
                <div className="relative group">
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        className={skin.navLinkCollapsed(
                          pathname.includes(section.items[0].href.split("/")[2])
                        )}
                        whileHover={{ scale: 1.02 }}
                      >
                        <section.icon className="w-5 h-5" />
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {section.title}
                    </TooltipContent>
                  </UiTooltip>

                  {/* Hover dropdown for collapsed sidebar */}
                  <div
                    className={cn(
                      "absolute left-full top-1/2 -translate-y-1/2 ml-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out pointer-events-none group-hover:pointer-events-auto z-50 min-w-[200px] py-2",
                      skin.flyout
                    )}
                  >
                    <div className="p-2">
                      <div className={skin.flyoutHeading}>
                        {section.title}
                      </div>
                      {section.items.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={skin.flyoutLink(pathname === item.href)}
                        >
                          <item.icon className="w-4 h-4 mr-3 shrink-0" />
                          <span className="font-medium truncate">
                            {item.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Expanded sidebar
                <>
                  <motion.button
                    onClick={() => toggleSection(section.title)}
                    className={cn(
                      skin.sectionButton,
                      section.alwaysExpanded ? "cursor-default" : "cursor-pointer"
                    )}
                    whileHover={{ scale: section.alwaysExpanded ? 1 : 1.02 }}
                  >
                    <section.icon className={cn("w-5 h-5", skin.sectionIcon)} />
                    <span className="ml-3 text-sm font-medium">
                      {section.title}
                    </span>
                    {!section.alwaysExpanded && (
                      <ChevronRight
                        className={`w-4 h-4 ml-auto transition-transform ${
                          isExpanded(section) ? "rotate-90" : ""
                        }`}
                      />
                    )}
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {isExpanded(section) && (
                      <motion.div
                        initial={false}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-8 space-y-1"
                      >
                        {section.items.map((item) => (
                          <div key={item.name}>
                            <Link
                              href={item.href}
                              className={skin.subLink(pathname === item.href)}
                            >
                              <item.icon className="w-4 h-4" />
                              <span className="ml-3">{item.name}</span>
                            </Link>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          ))}
        </nav>

        <motion.div
          className={cn("absolute bottom-4 left-4 right-4", skin.logoutFooter)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {sidebarCollapsed ? (
            <UiTooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => logout()}
                  className={cn(skin.logoutButton, "justify-center")}
                >
                  <span className={skin.logoutIconWrap || "inline-flex"}>
                    <LogOut className="w-4 h-4" />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log Out</TooltipContent>
            </UiTooltip>
          ) : (
            <button
              onClick={() => logout()}
              className={cn(skin.logoutButton, "gap-3")}
            >
              <span className={skin.logoutIconWrap || "inline-flex"}>
                <LogOut className="w-4 h-4" />
              </span>
              <span className={skin.logoutLabel}>Log Out</span>
            </button>
          )}
        </motion.div>
      </TooltipProvider>
    </aside>
  );
}
