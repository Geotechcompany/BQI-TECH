"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import {
  AdminBrandTitle,
  SidebarVersionLabel,
} from "@/components/admin/AdminBrandTitle";
import { SidebarUserMenu } from "@/components/admin/SidebarUserMenu";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPath } from "@/contexts/AdminPathContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminTheme } from "@/contexts/AdminThemeContext";
import { getSidebarSkin } from "@/lib/admin-sidebar-skin";
import { EMPLOYEE_DEFAULT_AVATAR_SRC } from "@/lib/employee-portal-avatar";
import { cn } from "@/lib/utils";
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

const ICON_STROKE = 1.75;

interface MobileDashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDashboardSidebar({
  isOpen,
  onClose,
}: MobileDashboardSidebarProps) {
  const pathname = usePathname();
  const { toInternal, adminHref } = useAdminPath();
  const internalPathname = toInternal(pathname || "");
  const { user } = useAuth();
  const { theme } = useAdminTheme();
  const skin = useMemo(() => getSidebarSkin(theme), [theme]);
  const {
    openPicker: openAvatarPicker,
    isUploading: isAvatarUploading,
    inputRef: avatarInputRef,
    onFileChange: onAvatarFileChange,
    accept: avatarAccept,
  } = useAuthUserAvatarUpload();

  const visibleSections = useMemo(
    () =>
      filterAdminMenuSections(
        adminNavSections,
        user?.role,
        user?.adminModules
      ) as AdminNavSection[],
    [user?.role, user?.adminModules]
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

  return (
    <>
      <AuthUserAvatarFileInput
        inputRef={avatarInputRef}
        accept={avatarAccept}
        onFileChange={(event) => void onAvatarFileChange(event)}
      />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/50 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
            className={cn(
              "fixed inset-y-0 left-0 z-[9999] flex w-64 transform flex-col p-3 shadow-xl md:hidden",
              skin.studio
                ? "bg-gradient-to-b from-[#272156] via-[#2a265c] to-[#1f1c42] text-white"
                : "bg-white"
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <div
                className={cn(
                  "flex items-center gap-2",
                  skin.studio ? "text-white" : "text-slate-800"
                )}
              >
                <Image
                  src={skin.logoSrc}
                  alt="Logo"
                  width={56}
                  height={40}
                  className="rounded-lg"
                />
                <AdminBrandTitle
                  badgeVariant={skin.brandBadge}
                  titleClassName={skin.brandTitleClass}
                  showBadge={false}
                />
              </div>

              <button
                onClick={onClose}
                className={cn("rounded-md p-1.5", skin.iconButton)}
                aria-label="Close sidebar"
              >
                <X
                  className={cn(
                    "h-5 w-5",
                    skin.studio ? "text-white/70" : "text-slate-600"
                  )}
                  strokeWidth={ICON_STROKE}
                />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-0 overflow-y-auto">
              {visibleSections.map((section) => (
                <div key={section.title} className={skin.navSection}>
                  <div className={skin.sectionLabel}>{section.title}</div>
                  <div className="space-y-0.5">
                    {section.items.map((item) =>
                      item.kind === "group" ? (
                        <MobileNavGroup
                          key={item.id}
                          group={item}
                          pathname={internalPathname}
                          skin={skin}
                          expanded={isGroupExpanded(item)}
                          onToggle={() => toggleGroup(item)}
                          onNavigate={onClose}
                          resolveHref={adminHref}
                        />
                      ) : (
                        <MobileFlatLink
                          key={item.id}
                          item={item}
                          pathname={internalPathname}
                          skin={skin}
                          onNavigate={onClose}
                          resolveHref={adminHref}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </nav>

            <div className={cn("mt-3 space-y-2", skin.profileFooter)}>
              <InstallPwaButton tone={skin.studio ? "on-dark" : "brand"} />
              <SidebarVersionLabel studio={skin.studio} />
              <SidebarUserMenu
                studio={skin.studio}
                flyoutClassName={skin.flyout}
                onNavigate={onClose}
                enableLockScreen
                defaultAvatarSrc={EMPLOYEE_DEFAULT_AVATAR_SRC}
                onChangePhoto={openAvatarPicker}
                changePhotoDisabled={isAvatarUploading}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

type Skin = ReturnType<typeof getSidebarSkin>;

function MobileFlatLink({
  item,
  pathname,
  skin,
  onNavigate,
  resolveHref,
}: {
  item: AdminNavLink;
  pathname: string;
  skin: Skin;
  onNavigate: () => void;
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

function MobileNavGroup({
  group,
  pathname,
  skin,
  expanded,
  onToggle,
  onNavigate,
  resolveHref,
}: {
  group: AdminNavGroup;
  pathname: string;
  skin: Skin;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  resolveHref: (href: string) => string;
}) {
  const parentActive = isNavGroupPathActive(group, pathname);
  const Chevron = expanded ? ChevronDown : ChevronRight;

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
        <Chevron className={skin.chevron} strokeWidth={ICON_STROKE} />
      </button>

      {expanded && (
        <div className={cn("mt-0.5", skin.childRail)} role="group">
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
      )}
    </div>
  );
}
