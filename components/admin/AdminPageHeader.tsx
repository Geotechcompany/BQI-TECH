"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  Search,
  Settings,
  HelpCircle,
  ChevronDown,
  Sun,
  Moon,
  Laptop,
  Sparkles,
  Lock,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useAdminTheme, type AdminTheme } from "@/contexts/AdminThemeContext";
import { useOptionalAdminLockScreen } from "@/contexts/AdminLockScreenContext";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminApi } from "@/lib/api-backend";
import { useSettings } from "@/contexts/SettingsContext";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { formatAdminRoleLabel, isAdminRoleLabel } from "@/lib/format-admin-role";
import { AdminNotificationDropdown } from "@/components/admin/AdminNotificationDropdown";
import { AdminFullscreenToggle } from "@/components/admin/AdminFullscreenToggle";
import { AiRankHeaderIndicator } from "@/components/admin/AiRankProgress";
import {
  AdminCommandSearch,
  openAdminCommandSearch,
} from "@/components/admin/AdminCommandSearch";
import {
  EMPLOYEE_DEFAULT_AVATAR_SRC,
  resolveEmployeeAvatarSrc,
} from "@/lib/employee-portal-avatar";
import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  title: string;
  onMenuClick?: () => void;
  /** @deprecated Page filters use AdminPageLayout search; header always shows global search */
  showSearch?: boolean;
  /** @deprecated Unused — global command search replaced header page filtering */
  onSearch?: (value: string) => void;
}

export default function AdminPageHeader({ 
  title, 
  onMenuClick,
}: AdminPageHeaderProps) {
  const { user, logout, userRole } = useAuth();
  const lockScreen = useOptionalAdminLockScreen();
  const { setTheme: setGlobalTheme } = useTheme();
  const { theme, setTheme } = useAdminTheme();
  const { sidebarCollapsed, updateSettings } = useSettings();

  const displayRole = formatAdminRoleLabel(userRole || user?.role);
  const isAdminUser = isAdminRoleLabel(userRole || user?.role);
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") ||
    user?.name?.slice(0, 2).toUpperCase() ||
    "A";
  const avatarSrc = resolveEmployeeAvatarSrc(
    user?.avatar,
    user?.avatarUrl,
    user?.profileImage
  );
  const isDefaultAvatar = avatarSrc === EMPLOYEE_DEFAULT_AVATAR_SRC;

  const applyAdminTheme = (next: AdminTheme) => {
    setTheme(next);
    void adminApi.updateSettings({ theme: next }).catch(() => {});
  };

  return (
    <header
      className="sticky top-0 z-50 flex h-16 w-full items-center overflow-visible border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
      style={{ top: "var(--admin-banner-offset, 0px)" }}
      data-collapsed={sidebarCollapsed}
    >
      <div className="flex w-full items-center justify-between gap-3 px-4">
        {/* Left Section */}
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden shrink-0 items-center gap-2.5 md:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                void updateSettings({ sidebarCollapsed: !sidebarCollapsed })
              }
              aria-label={
                sidebarCollapsed
                  ? "Expand navigation panel"
                  : "Collapse navigation panel"
              }
              className="h-8 w-8 rounded-md border border-border/60 bg-background hover:bg-muted"
            >
              <img
                src="/collapse-svg-black.svg"
                alt=""
                width={16}
                height={16}
                className="block dark:hidden"
                aria-hidden="true"
              />
              <img
                src="/collapse-svg-white.svg"
                alt=""
                width={16}
                height={16}
                className="hidden dark:block"
                aria-hidden="true"
              />
            </Button>
            <div className="h-5 w-px bg-border/70" aria-hidden="true" />
          </div>
          
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
          </div>

          <div className="min-w-0 flex-1 md:max-w-md lg:max-w-lg">
            <AdminCommandSearch className="hidden md:flex" />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-visible sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl md:hidden"
            onClick={openAdminCommandSearch}
            aria-label="Search BQI HR"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>
          <BackendStatusIndicator />

          <AiRankHeaderIndicator />

          <div className="hidden sm:block h-6 w-px bg-border/70 mx-1" />

          <AdminFullscreenToggle />

          {/* Theme Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                {theme === "studio" ? (
                  <Sparkles className="h-4 w-4 text-[#31CDFF]" />
                ) : (
                  <>
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </>
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => applyAdminTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyAdminTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => applyAdminTheme("studio")}
                className="flex items-center justify-between gap-4"
              >
                <span className="flex items-center">
                  <Sparkles className="mr-2 h-4 w-4 shrink-0 text-[#31CDFF]" />
                  Studio
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  Dark sidebar
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGlobalTheme("system")}>
                <Laptop className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <AdminNotificationDropdown />

          {/* Help */}
          <Link href="/admin/help" aria-label="Help">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </Button>
          </Link>

          <div className="hidden sm:block h-6 w-px bg-border/70 mx-1" />

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2.5 px-2.5 h-10 hover:bg-accent/70 rounded-xl border border-transparent hover:border-border/60"
              >
                <Avatar className={`h-8 w-8 ${isAdminUser ? "ring-2 ring-blue-500/30 ring-offset-2 ring-offset-background" : ""}`}>
                  <AvatarImage
                    src={avatarSrc}
                    alt={user?.name || "Admin"}
                    className={cn(
                      "object-cover",
                      isDefaultAvatar && "bg-[#272156]"
                    )}
                  />
                  <AvatarFallback className="bg-blue-600/10 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start min-w-0">
                  <span className="text-sm font-semibold leading-none truncate max-w-[160px]">
                    {user?.name || "Admin User"}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {isAdminUser && (
                      <ShieldCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    )}
                    <Badge
                      variant={isAdminUser ? "default" : "secondary"}
                      className={`h-5 px-2 text-[10px] font-medium tracking-wide ${
                        isAdminUser
                          ? "bg-blue-600/10 text-blue-700 hover:bg-blue-600/10 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30"
                          : ""
                      }`}
                    >
                      {displayRole}
                    </Badge>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={avatarSrc}
                        alt={user?.name || "Admin"}
                        className={cn(
                          "object-cover",
                          isDefaultAvatar && "bg-[#272156]"
                        )}
                      />
                      <AvatarFallback className="bg-blue-600/10 text-blue-700 dark:text-blue-300 text-sm font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none truncate">
                        {user?.name || "Admin User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground truncate mt-1">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={isAdminUser ? "default" : "secondary"}
                    className={`w-fit ${
                      isAdminUser
                        ? "bg-blue-600/10 text-blue-700 hover:bg-blue-600/10 dark:bg-blue-500/15 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {displayRole}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Link href="/admin/settings" className="flex w-full items-center">
                    <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {lockScreen ? (
                <DropdownMenuItem onClick={() => lockScreen.lock()}>
                  <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Lock screen
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem 
                className="text-red-600 focus:text-red-600" 
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
} 

function BackendStatusIndicator() {
  const { status, label, latencyMs, dbStatus, isLoading, refetch } = useBackendHealth()

  const color = status === "healthy" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-red-500"
  const pulse = status === "healthy" ? "animate-pulse" : status === "degraded" ? "animate-pulse slow" : ""

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted/70 transition-colors"
          aria-label="Backend status"
        >
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-40 ${pulse}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
          </span>
          <span className="hidden sm:block">{label}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" className="w-72">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <span className={`inline-block h-3 w-3 rounded-full ${color}`}></span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Backend API</p>
            <p className="text-xs text-muted-foreground">
              {status === "healthy" && "All systems operational"}
              {status === "degraded" && "API reachable, database degraded"}
              {status === "down" && "API unreachable"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border p-2 dark:border-gray-700">
                <div className="text-muted-foreground">Latency</div>
                <div className="font-medium">{latencyMs ?? "-"} ms</div>
              </div>
              <div className="rounded-md border p-2 dark:border-gray-700">
                <div className="text-muted-foreground">Database</div>
                <div className="font-medium capitalize">{dbStatus || "unknown"}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}