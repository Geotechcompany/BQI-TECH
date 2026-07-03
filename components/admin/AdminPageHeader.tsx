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
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminApi } from "@/lib/api-backend";
import { useSettings } from "@/contexts/SettingsContext";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { formatAdminRoleLabel, isAdminRoleLabel } from "@/lib/format-admin-role";
import { AdminNotificationDropdown } from "@/components/admin/AdminNotificationDropdown";

interface AdminPageHeaderProps {
  title: string;
  onMenuClick?: () => void;
  showSearch?: boolean;
  onSearch?: (value: string) => void;
}

export default function AdminPageHeader({ 
  title, 
  onMenuClick,
  showSearch = false,
  onSearch 
}: AdminPageHeaderProps) {
  const { user, logout, userRole } = useAuth();
  const { setTheme: setGlobalTheme } = useTheme();
  const { theme, setTheme } = useAdminTheme();
  const { sidebarCollapsed } = useSettings();
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch?.(value);
  };

  const displayRole = formatAdminRoleLabel(userRole || user?.role);
  const isAdminUser = isAdminRoleLabel(userRole || user?.role);
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") ||
    user?.name?.slice(0, 2).toUpperCase() ||
    "A";

  const applyAdminTheme = (next: AdminTheme) => {
    setTheme(next);
    void adminApi.updateSettings({ theme: next }).catch(() => {});
  };

  return (
    <div 
      className="bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 z-50 flex h-16 items-center border-b border-border/60 w-full fixed left-0 right-0 transition-all duration-300 ease-in-out shadow-sm"
      style={{ top: "var(--admin-banner-offset, 0px)" }}
      data-collapsed={sidebarCollapsed}
    >
      <div className={`w-full flex items-center justify-between px-4 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
          </div>
        </div>

        {/* Search Section (Center) */}
        {showSearch && (
          <div className="hidden md:block flex-1 max-w-lg mx-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search..."
                className="w-full rounded-full border border-input bg-background px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <BackendStatusIndicator />

          <div className="hidden sm:block h-6 w-px bg-border/70 mx-1" />

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
                  <AvatarImage src={user?.avatar} alt={user?.name || "Admin"} />
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
                      <AvatarImage src={user?.avatar} alt={user?.name || "Admin"} />
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
    </div>
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