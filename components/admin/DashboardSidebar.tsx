"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useAdminPath } from "@/contexts/AdminPathContext";
import { useAdminTheme } from "@/contexts/AdminThemeContext";
import { adminHref as buildAdminHref } from "@/lib/admin-path";
import { getSidebarSkin } from "@/lib/admin-sidebar-skin";
import { SidebarVersionLabel } from "@/components/admin/AdminBrandTitle";
import { SidebarUserMenu } from "@/components/admin/SidebarUserMenu";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EMPLOYEE_DEFAULT_AVATAR_SRC } from "@/lib/employee-portal-avatar";
import { filterAdminMenuSections } from "@/lib/admin-permissions";
import {
  AuthUserAvatarFileInput,
  useAuthUserAvatarUpload,
} from "@/hooks/use-auth-user-avatar-upload";
import {
  adminNavSections,
  isNavGroupDefaultExpanded,
  isNavGroupPathActive,
  isNavLinkActive,
  type AdminNavGroup,
  type AdminNavLink,
  type AdminNavSection,
} from "@/lib/admin-nav";
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

/** Re-export for AdminCommandSearch / mobile sidebar consumers. */
export { adminNavSections, menuSections } from "@/lib/admin-nav";

const ICON_STROKE = 1.75;

/** Constant icon capsule width (px). Always visible on md+. */
export const ADMIN_ICON_RAIL_WIDTH = 68;
/** Secondary labeled panel width when expanded (px). */
export const ADMIN_SECONDARY_PANEL_WIDTH = 188;

export function adminShellOffset(collapsed: boolean) {
  return (
    ADMIN_ICON_RAIL_WIDTH + (collapsed ? 0 : ADMIN_SECONDARY_PANEL_WIDTH)
  );
}

export function adminSidebarSpring(reducedMotion: boolean): Transition {
  if (reducedMotion) {
    return { duration: 0.18, ease: [0.32, 0.72, 0, 1] };
  }
  return { type: "spring", bounce: 0, duration: 0.38 };
}

const pressTap = { scale: 0.97 };

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

type Skin = ReturnType<typeof getSidebarSkin>;

function groupRailHref(group: AdminNavGroup, publicBase: string) {
  return buildAdminHref(group.children[0]?.href ?? "/manage/overview", publicBase);
}

export default function DashboardSidebar({
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { basePath, toInternal, adminHref } = useAdminPath();
  const internalPathname = toInternal(pathname || "");
  const reducedMotion = useReducedMotion();
  const { sidebarCollapsed, updateSettings } = useSettings();
  const { theme } = useAdminTheme();
  const skin = useMemo(() => getSidebarSkin(theme), [theme]);
  const { user } = useAuth();
  const {
    openPicker: openAvatarPicker,
    isUploading: isAvatarUploading,
    inputRef: avatarInputRef,
    onFileChange: onAvatarFileChange,
    accept: avatarAccept,
  } = useAuthUserAvatarUpload();

  const panelOpen = !sidebarCollapsed;
  const shellWidth = adminShellOffset(sidebarCollapsed);
  const spring = adminSidebarSpring(!!reducedMotion);

  const visibleSections = useMemo(
    () =>
      filterAdminMenuSections(
        adminNavSections,
        user?.role,
        user?.adminModules
      ) as AdminNavSection[],
    [user?.role, user?.adminModules]
  );

  const mainSections = useMemo(
    () => visibleSections.filter((section) => section.title !== "Settings"),
    [visibleSections]
  );
  const settingsSection = useMemo(
    () => visibleSections.find((section) => section.title === "Settings"),
    [visibleSections]
  );
  const mainRailItems = useMemo(
    () => mainSections.flatMap((section) => section.items),
    [mainSections]
  );
  const settingsRailItems = useMemo(
    () => settingsSection?.items ?? [],
    [settingsSection]
  );

  const [expandedOverrides, setExpandedOverrides] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setExpandedOverrides({});
  }, [internalPathname]);

  const isGroupExpanded = useCallback(
    (group: AdminNavGroup) => {
      if (expandedOverrides[group.id] !== undefined) {
        return expandedOverrides[group.id];
      }
      return isNavGroupDefaultExpanded(group, internalPathname);
    },
    [expandedOverrides, internalPathname]
  );

  const toggleGroup = (group: AdminNavGroup) => {
    setExpandedOverrides((prev) => ({
      ...prev,
      [group.id]: !isGroupExpanded(group),
    }));
  };

  const expandGroup = (groupId: string) => {
    setExpandedOverrides((prev) => ({ ...prev, [groupId]: true }));
  };

  const togglePanel = () => {
    void updateSettings({ sidebarCollapsed: !sidebarCollapsed });
  };

  if (internalPathname === "/manage/login" || internalPathname.startsWith("/manage/login/")) {
    return null;
  }

  const avatarMenuProps = {
    onChangePhoto: openAvatarPicker,
    changePhotoDisabled: isAvatarUploading,
  };

  return (
    <motion.aside
      className={cn(
        "fixed left-0 z-[9999] hidden h-[100dvh] md:flex",
        className
      )}
      style={{
        top: "var(--admin-banner-offset, 0px)",
        height: "calc(100dvh - var(--admin-banner-offset, 0px))",
        willChange: "width",
      }}
      initial={false}
      animate={{ width: shellWidth }}
      transition={spring}
      aria-label="Admin navigation"
    >
      <AuthUserAvatarFileInput
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
            style={{ width: ADMIN_ICON_RAIL_WIDTH }}
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
                    data-tour="admin-nav-panel-toggle"
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
              className="flex flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-2"
              aria-label="Primary"
            >
              {mainRailItems.map((item) => {
                if (item.kind === "group") {
                  return (
                    <GroupRailIcon
                      key={item.id}
                      item={item}
                      pathname={internalPathname}
                      panelOpen={panelOpen}
                      skin={skin}
                      reducedMotion={!!reducedMotion}
                      resolveHref={adminHref}
                      publicBase={basePath}
                      onExpandPanel={() => {
                        if (!panelOpen) {
                          void updateSettings({ sidebarCollapsed: false });
                        }
                        expandGroup(item.id);
                      }}
                    />
                  );
                }

                const active = isNavLinkActive(item, internalPathname);
                return (
                  <UiTooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileTap={reducedMotion ? undefined : pressTap}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                      >
                        <Link
                          href={adminHref(item.href)}
                          aria-label={item.name}
                          aria-current={active ? "page" : undefined}
                          className={railIconClass(skin, active)}
                          data-tour={item.tourAttr}
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

              {settingsRailItems.length > 0 ? (
                <div
                  role="separator"
                  aria-hidden
                  className={cn(
                    "my-0.5 h-px w-8",
                    skin.studio ? "bg-white/15" : "bg-border"
                  )}
                />
              ) : null}

              {settingsRailItems.map((item) => {
                if (item.kind === "group") {
                  return (
                    <GroupRailIcon
                      key={item.id}
                      item={item}
                      pathname={internalPathname}
                      panelOpen={panelOpen}
                      skin={skin}
                      reducedMotion={!!reducedMotion}
                      resolveHref={adminHref}
                      publicBase={basePath}
                      onExpandPanel={() => {
                        if (!panelOpen) {
                          void updateSettings({ sidebarCollapsed: false });
                        }
                        expandGroup(item.id);
                      }}
                    />
                  );
                }

                const active = isNavLinkActive(item, internalPathname);
                return (
                  <UiTooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileTap={reducedMotion ? undefined : pressTap}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                      >
                        <Link
                          href={adminHref(item.href)}
                          aria-label={item.name}
                          aria-current={active ? "page" : undefined}
                          className={railIconClass(skin, active)}
                          data-tour={item.tourAttr}
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

              {!panelOpen && (
                <div className="mt-1 w-full">
                  <SidebarUserMenu
                    collapsed
                    studio={skin.studio}
                    flyoutClassName={skin.flyout}
                    enableLockScreen
                    defaultAvatarSrc={EMPLOYEE_DEFAULT_AVATAR_SRC}
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
              width: panelOpen ? ADMIN_SECONDARY_PANEL_WIDTH : 0,
              opacity: panelOpen ? 1 : 0,
            }}
            transition={spring}
            aria-hidden={!panelOpen}
          >
            <div
              className="flex h-full w-full flex-col"
              style={{ width: ADMIN_SECONDARY_PANEL_WIDTH }}
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
                {visibleSections.map((section) => (
                  <div key={section.title} className="space-y-0.5">
                    <div className={skin.sectionLabel}>{section.title}</div>
                    {section.items.map((item) => {
                      if (item.kind === "group") {
                        return (
                          <ExpandedNavGroup
                            key={item.id}
                            group={item}
                            pathname={internalPathname}
                            skin={skin}
                            expanded={isGroupExpanded(item)}
                            onToggle={() => toggleGroup(item)}
                            spring={spring}
                            reducedMotion={!!reducedMotion}
                            resolveHref={adminHref}
                          />
                        );
                      }

                      return (
                        <FlatNavLink
                          key={item.id}
                          item={item}
                          pathname={internalPathname}
                          skin={skin}
                          resolveHref={adminHref}
                        />
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
                  enableLockScreen
                  defaultAvatarSrc={EMPLOYEE_DEFAULT_AVATAR_SRC}
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

function railIconClass(skin: Skin, active: boolean) {
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

function FlatNavLink({
  item,
  pathname,
  skin,
  onNavigate,
  resolveHref,
}: {
  item: AdminNavLink;
  pathname: string;
  skin: Skin;
  onNavigate?: () => void;
  resolveHref: (href: string) => string;
}) {
  const active = isNavLinkActive(item, pathname);
  return (
    <Link
      href={resolveHref(item.href)}
      className={skin.navLink(active)}
      data-tour={item.tourAttr}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <item.icon
        className={cn(skin.navIcon, active ? undefined : skin.sectionIcon)}
        strokeWidth={ICON_STROKE}
      />
      <span className="ml-2.5 truncate">{item.name}</span>
    </Link>
  );
}

function ExpandedNavGroup({
  group,
  pathname,
  skin,
  expanded,
  onToggle,
  onNavigate,
  spring,
  reducedMotion,
  resolveHref,
}: {
  group: AdminNavGroup;
  pathname: string;
  skin: Skin;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  spring: Transition;
  reducedMotion: boolean;
  resolveHref: (href: string) => string;
}) {
  const parentActive = isNavGroupPathActive(group, pathname);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={skin.sectionButtonActive(parentActive)}
        aria-expanded={expanded}
      >
        <group.icon
          className={cn(
            skin.navIcon,
            parentActive ? undefined : skin.sectionIcon
          )}
          strokeWidth={ICON_STROKE}
        />
        <span className="ml-2.5 min-w-0 flex-1 truncate text-left">
          {group.name}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={spring}
          className="inline-flex"
        >
          <ChevronDown className={skin.chevron} strokeWidth={ICON_STROKE} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={`${group.id}-children`}
            initial={
              reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
            }
            animate={
              reducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }
            }
            exit={
              reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
            }
            transition={spring}
            className="overflow-hidden"
          >
            <div
              className={cn("mt-0.5", skin.childRail)}
              role="group"
              aria-label={`${group.name} sections`}
            >
              {group.children.map((child) => {
                const active = isNavLinkActive(child, pathname);
                return (
                  <Link
                    key={child.id}
                    href={resolveHref(child.href)}
                    className={skin.subLink(active)}
                    data-tour={child.tourAttr}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <span className={skin.childBullet} aria-hidden />
                    <span className="truncate">{child.name}</span>
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

/** Icon-rail group control: origin-aware flyout when panel collapsed. */
function GroupRailIcon({
  item,
  pathname,
  panelOpen,
  skin,
  reducedMotion,
  onExpandPanel,
  resolveHref,
  publicBase,
}: {
  item: AdminNavGroup;
  pathname: string;
  panelOpen: boolean;
  skin: Skin;
  reducedMotion: boolean;
  onExpandPanel: () => void;
  resolveHref: (href: string) => string;
  publicBase: string;
}) {
  const active = isNavGroupPathActive(item, pathname);

  if (panelOpen) {
    return (
      <UiTooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileTap={reducedMotion ? undefined : pressTap}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            <Link
              href={groupRailHref(item, publicBase)}
              aria-label={item.name}
              aria-current={active ? "page" : undefined}
              className={railIconClass(skin, active)}
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
        className={cn("min-w-[11rem] origin-left p-1.5", skin.flyout)}
        style={{ backgroundColor: skin.flyoutBg }}
      >
        <DropdownMenuLabel className={skin.flyoutHeading}>
          {item.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator
          className={skin.studio ? "bg-white/10" : "bg-border"}
        />
        {item.children.map((child) => {
          const childActive = isNavLinkActive(child, pathname);
          return (
            <DropdownMenuItem key={child.id} asChild>
              <Link
                href={resolveHref(child.href)}
                className={skin.flyoutLink(childActive)}
                data-tour={child.tourAttr}
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
