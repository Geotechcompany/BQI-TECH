"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SidebarVersionLabel } from "@/components/admin/AdminBrandTitle";
import { SidebarUserMenu } from "@/components/admin/SidebarUserMenu";
import { useEmployeeAvatarUpload, EmployeeAvatarFileInput } from "@/components/employee/EmployeeAvatarUploader";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { useSettings } from "@/contexts/SettingsContext";
import { getSidebarSkin } from "@/lib/admin-sidebar-skin";
import { EMPLOYEE_DEFAULT_AVATAR_SRC } from "@/lib/employee-portal-avatar";
import {
  EMPLOYEE_LEAVE_NAV,
  isEmployeeLeaveNavActive,
  isEmployeeLeavePath,
} from "@/lib/employee-leave-nav";
import type { AdminTheme } from "@/contexts/AdminThemeContext";
import { cn } from "@/lib/utils";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICON_STROKE = 1.75;

/** Constant icon capsule width (px). Always visible on md+. */
export const EMPLOYEE_ICON_RAIL_WIDTH = 68;
/** Secondary labeled panel width when expanded (px). */
export const EMPLOYEE_SECONDARY_PANEL_WIDTH = 188;

export function employeeShellOffset(collapsed: boolean) {
  return (
    EMPLOYEE_ICON_RAIL_WIDTH +
    (collapsed ? 0 : EMPLOYEE_SECONDARY_PANEL_WIDTH)
  );
}

export function employeeSidebarSpring(reducedMotion: boolean): Transition {
  if (reducedMotion) {
    return { duration: 0.18, ease: [0.32, 0.72, 0, 1] };
  }
  return { type: "spring", bounce: 0, duration: 0.38 };
}

interface MenuLink {
  kind: "link";
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
}

interface MenuChild {
  id: string;
  name: string;
  href: string;
}

interface MenuGroup {
  kind: "group";
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
  children: MenuChild[];
}

type MenuItem = MenuLink | MenuGroup;

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const employeeMenuSections: MenuSection[] = [
  {
    title: "Main",
    items: [
      {
        kind: "link",
        id: "overview",
        name: "Overview",
        href: "/employee",
        icon: LayoutDashboard,
      },
      {
        kind: "link",
        id: "profile",
        name: "My profile",
        href: "/employee/profile",
        icon: UserRound,
      },
      {
        kind: "group",
        id: "leave",
        name: "Leave",
        href: "/employee/leave/apply",
        icon: CalendarDays,
        children: EMPLOYEE_LEAVE_NAV.map((item) => ({
          id: `leave-${item.id}`,
          name: item.name,
          href: item.href,
        })),
      },
      {
        kind: "link",
        id: "documents",
        name: "Documents",
        href: "/employee/documents",
        icon: FileText,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        kind: "link",
        id: "settings",
        name: "Settings",
        href: "/employee/settings",
        icon: Settings,
      },
    ],
  },
];

const mainNavItems = employeeMenuSections[0].items;
const settingsItem = employeeMenuSections[1].items[0] as MenuLink;

/** Flat tabs for mobile bottom nav (groups collapse to parent href). */
export const employeeMobileTabs = employeeMenuSections.flatMap((section) =>
  section.items.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: item.name,
    href: item.href,
  }))
);

function resolveSidebarTheme(
  theme: "light" | "dark" | "system" | "studio"
): AdminTheme {
  if (theme === "studio") return "studio";
  if (theme === "dark") return "dark";
  return "light";
}

function isLinkActive(pathname: string, item: MenuLink) {
  if (item.id === "overview") {
    return pathname === "/employee" || pathname === "/employee/";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isGroupActive(pathname: string, _group: MenuGroup) {
  return isEmployeeLeavePath(pathname);
}

function isChildActive(pathname: string, child: MenuChild) {
  return isEmployeeLeaveNavActive(pathname, child.href);
}

const pressTap = { scale: 0.97 };

interface SidebarProps {
  className?: string;
}

export function EmployeePortalSidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { sidebarCollapsed, theme, updateSettings } = useSettings();
  const skin = useMemo(
    () => getSidebarSkin(resolveSidebarTheme(theme)),
    [theme]
  );

  const panelOpen = !sidebarCollapsed;
  const shellWidth = employeeShellOffset(sidebarCollapsed);
  const spring = employeeSidebarSpring(!!reducedMotion);

  const [leaveExpanded, setLeaveExpanded] = useState(() =>
    isEmployeeLeavePath(pathname)
  );
  const {
    openPicker: openAvatarPicker,
    isUploading: isAvatarUploading,
    inputRef: avatarInputRef,
    onFileChange: onAvatarFileChange,
    accept: avatarAccept,
  } = useEmployeeAvatarUpload();

  useEffect(() => {
    if (isEmployeeLeavePath(pathname)) {
      setLeaveExpanded(true);
    }
  }, [pathname]);

  const togglePanel = () => {
    void updateSettings({ sidebarCollapsed: !sidebarCollapsed });
  };

  const avatarMenuProps = {
    onChangePhoto: openAvatarPicker,
    changePhotoDisabled: isAvatarUploading,
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
      aria-label="Employee navigation"
    >
      <EmployeeAvatarFileInput
        inputRef={avatarInputRef}
        accept={avatarAccept}
        onFileChange={(event) => void onAvatarFileChange(event)}
      />
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
            style={{ width: EMPLOYEE_ICON_RAIL_WIDTH }}
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
                    data-tour="employee-nav-panel-toggle"
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
                if (item.kind === "group") {
                  const active = isGroupActive(pathname, item);
                  return (
                    <LeaveRailIcon
                      key={item.id}
                      item={item}
                      active={active}
                      pathname={pathname}
                      panelOpen={panelOpen}
                      skin={skin}
                      reducedMotion={!!reducedMotion}
                      onExpandPanel={() => {
                        if (!panelOpen) {
                          void updateSettings({ sidebarCollapsed: false });
                          setLeaveExpanded(true);
                        }
                      }}
                    />
                  );
                }

                const active = isLinkActive(pathname, item);
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
                          data-tour={`employee-nav-${item.id}`}
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
                        isLinkActive(pathname, settingsItem)
                          ? "page"
                          : undefined
                      }
                      className={railIconClass(
                        skin,
                        isLinkActive(pathname, settingsItem)
                      )}
                      data-tour={`employee-nav-${settingsItem.id}`}
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
                    emptyNameLabel="Employee"
                    defaultAvatarSrc={EMPLOYEE_DEFAULT_AVATAR_SRC}
                    accountLinks={{
                      settings: { href: "/employee/settings" },
                      help: { href: "/contact-us", label: "Help" },
                    }}
                    {...avatarMenuProps}
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
              width: panelOpen ? EMPLOYEE_SECONDARY_PANEL_WIDTH : 0,
              opacity: panelOpen ? 1 : 0,
            }}
            transition={spring}
            aria-hidden={!panelOpen}
          >
            <div
              className="flex h-full w-full flex-col"
              style={{ width: EMPLOYEE_SECONDARY_PANEL_WIDTH }}
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
                {employeeMenuSections.map((section) => (
                  <div key={section.title} className="space-y-0.5">
                    <div className={skin.sectionLabel}>{section.title}</div>
                    {section.items.map((item) => {
                      if (item.kind === "group") {
                        const parentActive = isGroupActive(pathname, item);
                        return (
                          <div key={item.id}>
                            <button
                              type="button"
                              onClick={() => setLeaveExpanded((v) => !v)}
                              className={skin.sectionButtonActive(parentActive)}
                              aria-expanded={leaveExpanded}
                              data-tour={`employee-nav-${item.id}`}
                            >
                              <item.icon
                                className={cn(
                                  skin.navIcon,
                                  parentActive ? undefined : skin.sectionIcon
                                )}
                                strokeWidth={ICON_STROKE}
                              />
                              <span className="ml-2.5 min-w-0 flex-1 truncate text-left">
                                {item.name}
                              </span>
                              <motion.span
                                animate={{ rotate: leaveExpanded ? 0 : -90 }}
                                transition={spring}
                                className="inline-flex"
                              >
                                <ChevronDown
                                  className={skin.chevron}
                                  strokeWidth={ICON_STROKE}
                                />
                              </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                              {leaveExpanded ? (
                                <motion.div
                                  key="leave-children"
                                  initial={
                                    reducedMotion
                                      ? { opacity: 0 }
                                      : { height: 0, opacity: 0 }
                                  }
                                  animate={
                                    reducedMotion
                                      ? { opacity: 1 }
                                      : { height: "auto", opacity: 1 }
                                  }
                                  exit={
                                    reducedMotion
                                      ? { opacity: 0 }
                                      : { height: 0, opacity: 0 }
                                  }
                                  transition={spring}
                                  className="overflow-hidden"
                                >
                                  <div
                                    className={cn("mt-0.5", skin.childRail)}
                                    role="group"
                                    aria-label="Leave sections"
                                  >
                                    {item.children.map((child) => {
                                      const active = isChildActive(
                                        pathname,
                                        child
                                      );
                                      return (
                                        <Link
                                          key={child.id}
                                          href={child.href}
                                          className={skin.subLink(active)}
                                          data-tour={`employee-nav-${child.id}`}
                                          aria-current={
                                            active ? "page" : undefined
                                          }
                                        >
                                          <span
                                            className={skin.childBullet}
                                            aria-hidden
                                          />
                                          <span className="truncate">
                                            {child.name}
                                          </span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        );
                      }

                      const active = isLinkActive(pathname, item);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={skin.navLink(active)}
                          data-tour={`employee-nav-${item.id}`}
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
                  emptyNameLabel="Employee"
                  defaultAvatarSrc={EMPLOYEE_DEFAULT_AVATAR_SRC}
                  accountLinks={{
                    settings: { href: "/employee/settings" },
                    help: { href: "/contact-us", label: "Help" },
                  }}
                  {...avatarMenuProps}
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

/** Icon-rail Leave control: origin-aware flyout when panel collapsed. */
function LeaveRailIcon({
  item,
  active,
  pathname,
  panelOpen,
  skin,
  reducedMotion,
  onExpandPanel,
}: {
  item: MenuGroup;
  active: boolean;
  pathname: string;
  panelOpen: boolean;
  skin: ReturnType<typeof getSidebarSkin>;
  reducedMotion: boolean;
  onExpandPanel: () => void;
}) {
  if (panelOpen) {
    return (
      <UiTooltip>
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
              data-tour={`employee-nav-${item.id}`}
              onClick={onExpandPanel}
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
  }

  return (
    <DropdownMenu>
      <UiTooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <motion.button
              type="button"
              aria-label={item.name}
              className={railIconClass(skin, active)}
              data-tour={`employee-nav-${item.id}`}
              whileTap={reducedMotion ? undefined : pressTap}
              transition={{ duration: 0.1, ease: "easeOut" }}
            >
              <item.icon
                className="h-[18px] w-[18px]"
                strokeWidth={ICON_STROKE}
              />
            </motion.button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.name}
        </TooltipContent>
      </UiTooltip>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={12}
        className={cn(
          "min-w-[11rem] origin-left p-1.5",
          skin.flyout
        )}
        style={{ backgroundColor: skin.flyoutBg }}
      >
        <DropdownMenuLabel className={skin.flyoutHeading}>
          {item.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator
          className={skin.studio ? "bg-white/10" : "bg-border"}
        />
        {item.children.map((child) => {
          const childActive = isChildActive(pathname, child);
          return (
            <DropdownMenuItem key={child.id} asChild>
              <Link
                href={child.href}
                className={skin.flyoutLink(childActive)}
                data-tour={`employee-nav-${child.id}`}
              >
                {child.name}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmployeeMobileBottomTabs() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="border-t border-gray-200/30 bg-white/90 shadow-2xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="safe-area-pb">
          <nav className="flex items-center justify-around px-1 py-1">
            {employeeMobileTabs.map((tab) => {
              const active =
                tab.id === "leave"
                  ? isEmployeeLeavePath(pathname)
                  : tab.id === "overview"
                    ? pathname === "/employee" || pathname === "/employee/"
                    : pathname === tab.href ||
                      pathname.startsWith(`${tab.href}/`);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  data-tour={`employee-nav-${tab.id}`}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                    active
                      ? "text-[#272156]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={ICON_STROKE} />
                  <span className="truncate">{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
