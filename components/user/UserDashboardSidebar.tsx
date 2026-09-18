"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  Briefcase,
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { getSidebarSkin } from "@/lib/admin-sidebar-skin";
import type { AdminTheme } from "@/contexts/AdminThemeContext";
import { SidebarVersionLabel } from "@/components/admin/AdminBrandTitle";
import { SidebarUserMenu } from "@/components/admin/SidebarUserMenu";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { cn } from "@/lib/utils";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

const ICON_STROKE = 1.75;

/** Constant icon capsule width (px). Always visible on md+. */
export const USER_ICON_RAIL_WIDTH = 68;
/** Secondary labeled panel width when expanded (px). */
export const USER_SECONDARY_PANEL_WIDTH = 188;

export function userShellOffset(collapsed: boolean) {
  return USER_ICON_RAIL_WIDTH + (collapsed ? 0 : USER_SECONDARY_PANEL_WIDTH);
}

export function userSidebarSpring(reducedMotion: boolean): Transition {
  if (reducedMotion) {
    return { duration: 0.18, ease: [0.32, 0.72, 0, 1] };
  }
  return { type: "spring", bounce: 0, duration: 0.38 };
}

interface MenuItem {
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const menuSections: MenuSection[] = [
  {
    title: "Main",
    items: [
      {
        id: "overview",
        name: "Overview",
        href: "/dashboard/overview",
        icon: LayoutDashboard,
      },
      {
        id: "jobs",
        name: "Jobs",
        href: "/dashboard/jobs",
        icon: Briefcase,
      },
      {
        id: "applications",
        name: "Applications",
        href: "/dashboard/applications",
        icon: FileText,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        id: "settings",
        name: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

/** Flat list for mobile bottom tabs (same routes / tour ids). */
export const userDashboardTabs = menuSections.flatMap((section) =>
  section.items.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: item.name,
    href: item.href,
  }))
);

const mainNavItems = menuSections[0].items;
const settingsItem = menuSections[1].items[0];

function resolveSidebarTheme(
  theme: "light" | "dark" | "system" | "studio"
): AdminTheme {
  if (theme === "studio") return "studio";
  if (theme === "dark") return "dark";
  return "light";
}

function isItemActive(pathname: string, item: MenuItem) {
  if (item.id === "overview") {
    return (
      pathname === "/dashboard" ||
      pathname === "/dashboard/" ||
      pathname === "/dashboard/overview" ||
      pathname.startsWith("/dashboard/overview/")
    );
  }
  if (item.id === "settings") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.id === "jobs") {
    return (
      pathname === "/dashboard/jobs" ||
      pathname.startsWith("/dashboard/jobs/") ||
      pathname.startsWith("/dashboard/apply/")
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const pressTap = { scale: 0.97 };

interface SidebarProps {
  onClose?: () => void;
  className?: string;
}

export default function UserDashboardSidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { sidebarCollapsed, theme, updateSettings } = useSettings();
  const skin = useMemo(
    () => getSidebarSkin(resolveSidebarTheme(theme)),
    [theme]
  );

  const panelOpen = !sidebarCollapsed;
  const shellWidth = userShellOffset(sidebarCollapsed);
  const spring = userSidebarSpring(!!reducedMotion);

  const togglePanel = () => {
    void updateSettings({ sidebarCollapsed: !sidebarCollapsed });
  };

  return (
    <motion.aside
      className={cn(
        "fixed left-0 top-0 z-[9999] hidden h-[100dvh] md:flex",
        className
      )}
      initial={false}
      animate={{ width: shellWidth }}
      transition={spring}
      style={{ willChange: "width" }}
      aria-label="Applicant navigation"
    >
      <TooltipProvider delayDuration={200}>
        <div className="flex h-full w-full overflow-hidden">
          {/* Constant icon capsule rail */}
          <div
            className={cn(
              "relative z-10 flex h-full shrink-0 flex-col items-center py-3",
              skin.studio
                ? "bg-gradient-to-b from-[#272156] via-[#2a265c] to-[#1f1c42] text-white"
                : "bg-card text-foreground"
            )}
            style={{ width: USER_ICON_RAIL_WIDTH }}
          >
            <div className="mb-1.5 flex h-11 w-11 items-center justify-center">
              <motion.img
                src={skin.logoSrc}
                alt="BQI"
                width={36}
                height={36}
                className="rounded-xl object-contain"
                whileHover={reducedMotion ? undefined : { scale: 1.04 }}
                whileTap={reducedMotion ? undefined : pressTap}
                transition={spring}
              />
            </div>

            <div className="mb-3 flex flex-col items-center px-2">
              <UiTooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    onClick={togglePanel}
                    aria-label={
                      panelOpen
                        ? "Collapse navigation panel"
                        : "Expand navigation panel"
                    }
                    aria-expanded={panelOpen}
                    className={cn(
                      railIconClass(skin, false),
                      skin.studio
                        ? "bg-white/[0.06] hover:bg-white/[0.1]"
                        : "bg-[#272156]/[0.05] hover:bg-[#272156]/[0.09]"
                    )}
                    whileTap={reducedMotion ? undefined : pressTap}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    data-tour="user-nav-panel-toggle"
                  >
                    {panelOpen ? (
                      <PanelLeftClose
                        className="h-[18px] w-[18px]"
                        strokeWidth={ICON_STROKE}
                      />
                    ) : (
                      <PanelLeftOpen
                        className="h-[18px] w-[18px]"
                        strokeWidth={ICON_STROKE}
                      />
                    )}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {panelOpen ? "Collapse panel" : "Expand panel"}
                </TooltipContent>
              </UiTooltip>
            </div>

            <nav
              className="flex flex-1 flex-col items-center gap-1 px-2"
              aria-label="Primary"
            >
              {mainNavItems.map((item) => {
                const active = isItemActive(pathname, item);
                return (
                  <UiTooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileTap={reducedMotion ? undefined : pressTap}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                      >
                        <Link
                          href={item.href}
                          aria-label={item.name}
                          aria-current={active ? "page" : undefined}
                          className={railIconClass(skin, active)}
                          data-tour={`user-nav-${item.id}`}
                        >
                          <item.icon
                            className="h-[18px] w-[18px]"
                            strokeWidth={ICON_STROKE}
                          />
                        </Link>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.name}
                    </TooltipContent>
                  </UiTooltip>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col items-center gap-1.5 px-2 pb-1">
              <InstallPwaButton
                rail
                tone={skin.studio ? "on-dark" : "subtle"}
                className={railIconClass(skin, false)}
              />

              <UiTooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    whileTap={reducedMotion ? undefined : pressTap}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                  >
                    <Link
                      href={settingsItem.href}
                      aria-label={settingsItem.name}
                      aria-current={
                        isItemActive(pathname, settingsItem)
                          ? "page"
                          : undefined
                      }
                      className={railIconClass(
                        skin,
                        isItemActive(pathname, settingsItem)
                      )}
                      data-tour={`user-nav-${settingsItem.id}`}
                    >
                      <settingsItem.icon
                        className="h-[18px] w-[18px]"
                        strokeWidth={ICON_STROKE}
                      />
                    </Link>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {settingsItem.name}
                </TooltipContent>
              </UiTooltip>

              {!panelOpen && (
                <div className="mt-1 w-full">
                  <SidebarUserMenu
                    collapsed
                    studio={skin.studio}
                    flyoutClassName={skin.flyout}
                    emptyNameLabel="Applicant"
                    accountLinks={{
                      settings: { href: "/dashboard/settings" },
                      help: { href: "/contact-us", label: "Help" },
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Expandable secondary labeled panel */}
          <motion.div
            className={cn(
              "relative flex h-full flex-col overflow-hidden border-l",
              skin.studio
                ? "border-white/[0.08] bg-[#272156]/95 text-white"
                : "border-[#272156]/08 bg-card/95 text-foreground backdrop-blur-md"
            )}
            initial={false}
            animate={{
              width: panelOpen ? USER_SECONDARY_PANEL_WIDTH : 0,
              opacity: panelOpen ? 1 : 0,
            }}
            transition={spring}
            aria-hidden={!panelOpen}
          >
            <div
              className="flex h-full w-full flex-col"
              style={{ width: USER_SECONDARY_PANEL_WIDTH }}
            >
              <div className="px-3.5 pb-2 pt-4">
                <p
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-[0.1em]",
                    skin.studio ? "text-white/40" : "text-muted-foreground/80"
                  )}
                >
                  Navigation
                </p>
              </div>

              <nav className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-2.5 pb-4">
                {menuSections.map((section) => (
                  <div key={section.title} className="space-y-0.5">
                    <div className={skin.sectionLabel}>{section.title}</div>
                    {section.items.map((item) => {
                      const active = isItemActive(pathname, item);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={skin.navLink(active)}
                          data-tour={`user-nav-${item.id}`}
                        >
                          <item.icon
                            className={cn(
                              skin.navIcon,
                              active ? undefined : skin.sectionIcon
                            )}
                            strokeWidth={ICON_STROKE}
                          />
                          <span className="ml-2.5 truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div
                className={cn(
                  "mt-auto space-y-2 px-3 pb-4 pt-2",
                  skin.profileFooter
                )}
              >
                <SidebarVersionLabel studio={skin.studio} />
                <SidebarUserMenu
                  collapsed={false}
                  studio={skin.studio}
                  flyoutClassName={skin.flyout}
                  emptyNameLabel="Applicant"
                  accountLinks={{
                    settings: { href: "/dashboard/settings" },
                    help: { href: "/contact-us", label: "Help" },
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </TooltipProvider>
    </motion.aside>
  );
}

function railIconClass(
  skin: ReturnType<typeof getSidebarSkin>,
  active: boolean
) {
  return cn(
    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
    skin.studio
      ? active
        ? "bg-[#31CDFF]/18 text-[#31CDFF]"
        : "text-white/65 hover:bg-white/[0.08] hover:text-white"
      : active
        ? "bg-[#272156]/12 text-[#272156]"
        : "text-muted-foreground hover:bg-[#272156]/06 hover:text-[#272156]"
  );
}

/** iOS-style bottom tabs for applicant mobile navigation. */
export function MobileBottomTabs() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-white/90 dark:bg-gray-900/80 ios-backdrop-blur border-t border-gray-200/30 dark:border-gray-800 shadow-2xl">
        <div className="safe-area-pb">
          <nav className="flex items-center justify-around px-1 py-1">
            {userDashboardTabs.map((tab) => {
              const isActive = isItemActive(pathname, {
                id: tab.id,
                name: tab.label,
                href: tab.href,
                icon: tab.icon,
              });
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  data-tour={`user-nav-${tab.id}`}
                  className="flex flex-col items-center justify-center min-w-0 flex-1 relative"
                >
                  <motion.div
                    className="flex flex-col items-center justify-center relative px-3 py-2 rounded-2xl"
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 17,
                      duration: 0.15,
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabMobile"
                        className="absolute inset-0 bg-[#272156]/08 rounded-2xl border border-[#272156]/12 dark:bg-[#31CDFF]/10 dark:border-[#31CDFF]/20"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                          duration: 0.3,
                        }}
                      />
                    )}

                    <div className="relative z-10 mb-1">
                      <motion.div
                        animate={{ scale: isActive ? 1.1 : 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <tab.icon
                          className={cn(
                            "h-6 w-6 transition-all duration-300",
                            isActive
                              ? "text-[#272156] drop-shadow-sm dark:text-[#31CDFF]"
                              : "text-gray-500"
                          )}
                          strokeWidth={ICON_STROKE}
                        />
                      </motion.div>
                    </div>

                    <motion.span
                      className={cn(
                        "text-xs font-medium transition-all duration-300 relative z-10",
                        isActive
                          ? "text-[#272156] font-semibold dark:text-[#31CDFF]"
                          : "text-gray-500"
                      )}
                      animate={{ scale: isActive ? 1.05 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {tab.label}
                    </motion.span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
