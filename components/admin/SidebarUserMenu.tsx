"use client";

import Link from "next/link";
import {
  Camera,
  ChevronsUpDown,
  HelpCircle,
  Lock,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalAdminLockScreen } from "@/contexts/AdminLockScreenContext";
import { useAdminPath } from "@/contexts/AdminPathContext";
import { canAccessAdminPath } from "@/lib/admin-permissions";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { resolveEmployeeAvatarSrc } from "@/lib/employee-portal-avatar";

const ICON_STROKE = 1.75;

type AccountLink = {
  href: string;
  label?: string;
};

type SidebarUserMenuProps = {
  collapsed?: boolean;
  studio?: boolean;
  flyoutClassName?: string;
  onNavigate?: () => void;
  /**
   * When set, use these routes instead of admin Settings/Help + permission checks.
   * Pass `help: false` to hide Help (e.g. applicant shell without a help center).
   */
  accountLinks?: {
    settings?: AccountLink | false;
    help?: AccountLink | false;
  };
  /** Fallback display name when the user has no name/email (default "Admin"). */
  emptyNameLabel?: string;
  /** Show Lock screen above Log Out (admin shell only). */
  enableLockScreen?: boolean;
  /**
   * Image shown when the user has no personal avatar (circular BQI mark in
   * admin + employee shells). Initials fallback when unset (e.g. applicant).
   */
  defaultAvatarSrc?: string;
  /** When set, shows a "Change photo" item (employee portal avatar upload). */
  onChangePhoto?: () => void;
  changePhotoDisabled?: boolean;
};

type AvatarUser = {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
};

function getInitials(user: AvatarUser | null): string {
  const fromNames = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join("");
  if (fromNames) return fromNames.toUpperCase();
  if (user?.name?.trim()) return user.name.trim().slice(0, 2).toUpperCase();
  if (user?.email?.trim()) return user.email.trim().slice(0, 2).toUpperCase();
  return "A";
}

function isBrandLogoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("bqilogo") ||
    lower.includes("/logo.") ||
    lower.endsWith("/logo")
  );
}

function resolveAvatarSrc(user: AvatarUser | null): string | undefined {
  const resolved = resolveEmployeeAvatarSrc(
    user?.avatar,
    user?.avatarUrl,
    user?.profileImage
  );
  // resolveEmployeeAvatarSrc always returns the brand default when empty —
  // callers that pass defaultAvatarSrc need undefined so they can substitute.
  if (!resolved || isBrandLogoUrl(resolved)) return undefined;
  return resolved;
}

/** Prefer local@domain; avoid showing a domain-only fragment. */
function formatCompactEmail(email: string, maxLen = 24): string {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length <= maxLen) return trimmed;

  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return `${trimmed.slice(0, maxLen - 1)}…`;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const roomForLocal = maxLen - domain.length - 1;

  if (roomForLocal >= 2) {
    return `${local.slice(0, roomForLocal)}…${domain}`;
  }

  // Domain alone is long — keep start of full address, never domain-only.
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function UserAvatar({
  src,
  initials,
  alt,
  studio,
  sizeClass,
  textClass,
  ringClass,
}: {
  src?: string;
  initials: string;
  alt: string;
  studio: boolean;
  sizeClass: string;
  textClass: string;
  ringClass?: string;
}) {
  const fallbackClass = studio
    ? cn(
        "bg-[#31CDFF]/20 text-[#31CDFF] font-semibold tracking-wide",
        textClass
      )
    : cn(
        "bg-[#272156]/15 text-[#272156] font-semibold tracking-wide",
        textClass
      );
  const isBrandMark = Boolean(src && isBrandLogoUrl(src));

  return (
    <Avatar className={cn(sizeClass, "shrink-0", ringClass)}>
      {src ? (
        <AvatarImage
          src={src}
          alt={alt}
          className={
            isBrandMark ? "object-cover bg-[#272156]" : "object-cover"
          }
        />
      ) : null}
      <AvatarFallback delayMs={0} className={fallbackClass}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function SidebarUserMenu({
  collapsed = false,
  studio = false,
  flyoutClassName,
  onNavigate,
  accountLinks,
  emptyNameLabel = "Admin",
  enableLockScreen = false,
  defaultAvatarSrc,
  onChangePhoto,
  changePhotoDisabled = false,
}: SidebarUserMenuProps) {
  const { user, logout } = useAuth();
  const { adminHref } = useAdminPath();
  const lockScreen = useOptionalAdminLockScreen();

  const displayName =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    emptyNameLabel;
  const email = (user?.email || "").trim();
  const initials = getInitials(user);
  const avatarSrc = resolveAvatarSrc(user) ?? defaultAvatarSrc;
  const compactEmail = email ? formatCompactEmail(email) : "";

  const useCustomLinks = accountLinks !== undefined;
  const settingsLink = useCustomLinks
    ? accountLinks.settings === false
      ? null
      : accountLinks.settings ?? null
    : canAccessAdminPath("/manage/settings", user?.role, user?.adminModules)
      ? { href: adminHref("/manage/settings"), label: "Settings" }
      : null;
  const helpLink = useCustomLinks
    ? accountLinks.help === false
      ? null
      : accountLinks.help ?? null
    : canAccessAdminPath("/manage/help", user?.role, user?.adminModules)
      ? { href: adminHref("/manage/help"), label: "Help" }
      : null;

  // Account flyout is always a solid light card — never inherit studio cyan/navy link skins.
  const itemRowClass =
    "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#0f172a] focus:bg-[#272156]/6 focus:text-[#0f172a]";
  const itemIconClass = "h-4 w-4 shrink-0 text-[#272156]";
  const separatorClass = "bg-[#272156]/10";

  const menuContent = (
    <DropdownMenuContent
      side="right"
      align="end"
      sideOffset={12}
      collisionPadding={12}
      className={cn(
        "z-[10000] w-60 rounded-xl p-1.5",
        // Keep prop for callers, but force a light readable surface after skin.flyout
        flyoutClassName,
        "!border-[#272156]/10 !bg-[#fafafa] !opacity-100 !text-[#0f172a] shadow-[0_16px_40px_-12px_rgba(39,33,86,0.22)] backdrop-blur-none"
      )}
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <UserAvatar
            src={avatarSrc}
            initials={initials}
            alt={displayName}
            studio={false}
            sizeClass="h-10 w-10"
            textClass="text-[12px]"
            ringClass="ring-2 ring-[#272156]/12 ring-offset-1 ring-offset-[#fafafa]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#0f172a]">
              {displayName}
            </p>
            {email ? (
              <p
                className="mt-0.5 break-all text-[11px] leading-snug text-slate-500"
                title={email}
              >
                {email}
              </p>
            ) : null}
          </div>
        </div>
      </DropdownMenuLabel>

      <DropdownMenuSeparator className={separatorClass} />

      {onChangePhoto ? (
        <DropdownMenuItem
          className={itemRowClass}
          disabled={changePhotoDisabled}
          onSelect={() => {
            onNavigate?.();
            // Defer so the menu can close before the OS file dialog opens.
            window.setTimeout(() => onChangePhoto(), 0);
          }}
        >
          <Camera
            className={itemIconClass}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          {changePhotoDisabled ? "Uploading…" : "Change photo"}
        </DropdownMenuItem>
      ) : null}

      {settingsLink ? (
        <DropdownMenuItem asChild className={itemRowClass}>
          <Link href={settingsLink.href} onClick={onNavigate}>
            <Settings
              className={itemIconClass}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            {settingsLink.label ?? "Settings"}
          </Link>
        </DropdownMenuItem>
      ) : null}
      {helpLink ? (
        <DropdownMenuItem asChild className={itemRowClass}>
          <Link href={helpLink.href} onClick={onNavigate}>
            <HelpCircle
              className={itemIconClass}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            {helpLink.label ?? "Help"}
          </Link>
        </DropdownMenuItem>
      ) : null}

      {(settingsLink || helpLink || onChangePhoto) && (
        <DropdownMenuSeparator className={separatorClass} />
      )}

      {enableLockScreen && lockScreen ? (
        <DropdownMenuItem
          className={itemRowClass}
          onClick={() => {
            onNavigate?.();
            lockScreen.lock();
          }}
        >
          <Lock
            className={itemIconClass}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          Lock screen
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuItem
        className={cn(
          itemRowClass,
          "text-rose-700 focus:bg-rose-50 focus:text-rose-800"
        )}
        onClick={() => void logout()}
      >
        <LogOut
          className="h-4 w-4 shrink-0 text-rose-700"
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
        Log Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (collapsed) {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Account menu${email ? ` for ${email}` : ""}`}
                className={cn(
                  "mx-auto flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2",
                  studio
                    ? "hover:bg-white/10 focus-visible:ring-[#31CDFF]/55"
                    : "hover:bg-[#272156]/8 focus-visible:ring-[#272156]/40"
                )}
              >
                <UserAvatar
                  src={avatarSrc}
                  initials={initials}
                  alt={displayName}
                  studio={studio}
                  sizeClass="h-9 w-9"
                  textClass="text-[11px]"
                  ringClass={
                    studio
                      ? "ring-1 ring-white/20"
                      : "ring-1 ring-[#272156]/20"
                  }
                />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p className="font-medium">{displayName}</p>
            {email ? (
              <p className="text-[11px] opacity-80">{email}</p>
            ) : null}
          </TooltipContent>
        </Tooltip>
        {menuContent}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu${email ? ` for ${email}` : ""}`}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2",
            studio
              ? "border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-white/[0.08] focus-visible:ring-[#31CDFF]/50 data-[state=open]:bg-white/[0.1] data-[state=open]:border-white/20"
              : "border border-[#272156]/10 bg-[#272156]/[0.04] hover:bg-[#272156]/[0.07] focus-visible:ring-[#272156]/35 data-[state=open]:bg-[#272156]/[0.08] data-[state=open]:border-[#272156]/18"
          )}
        >
          <UserAvatar
            src={avatarSrc}
            initials={initials}
            alt={displayName}
            studio={studio}
            sizeClass="h-8 w-8"
            textClass="text-[11px]"
            ringClass={
              studio ? "ring-1 ring-white/20" : "ring-1 ring-[#272156]/18"
            }
          />

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[12px] font-semibold leading-tight",
                studio ? "text-white/95" : "text-[#272156]"
              )}
            >
              {displayName}
            </p>
            {email ? (
              <p
                className={cn(
                  "mt-0.5 truncate text-[10px] leading-tight",
                  studio ? "text-white/50" : "text-muted-foreground"
                )}
                title={email}
              >
                {compactEmail}
              </p>
            ) : null}
          </div>

          <span
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              studio
                ? "text-white/55 group-hover:bg-white/10 group-hover:text-white group-data-[state=open]:bg-white/10 group-data-[state=open]:text-white"
                : "text-[#272156]/55 group-hover:bg-[#272156]/8 group-hover:text-[#272156] group-data-[state=open]:bg-[#272156]/10 group-data-[state=open]:text-[#272156]"
            )}
            aria-hidden
          >
            <ChevronsUpDown className="h-4 w-4" strokeWidth={ICON_STROKE} />
          </span>
        </button>
      </DropdownMenuTrigger>
      {menuContent}
    </DropdownMenu>
  );
}
