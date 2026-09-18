"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import {
  ChevronDown,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_DEFAULT_AVATAR_SRC,
  resolveEmployeeAvatarSrc,
} from "@/lib/employee-portal-avatar";

interface EmployeePortalHeaderProps {
  title?: string;
  subtitle?: string;
  tourId?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function EmployeePortalHeader({
  title = "Employee",
  subtitle,
  tourId,
}: EmployeePortalHeaderProps) {
  const { user, logout } = useAuth();
  const { theme, updateTheme, sidebarCollapsed, updateSettings } =
    useSettings();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/employee/login";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : user?.name || user?.email || "Employee";
  const userEmail = user?.email || "";
  const initials = getInitials(userName);
  const avatarSrc = resolveEmployeeAvatarSrc(
    user?.avatar,
    user?.avatarUrl,
    user?.profileImage
  );

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
      data-collapsed={sidebarCollapsed}
    >
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
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

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {tourId ? <TourHelpButton tourId={tourId} /> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                aria-label="Theme"
              >
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : theme === "system" ? (
                  <Monitor className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => updateTheme("light")}>
                <Sun className="mr-2 h-4 w-4" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2 py-1.5",
                  "transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/45"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={avatarSrc}
                    alt=""
                    className={cn(
                      "object-cover",
                      avatarSrc === EMPLOYEE_DEFAULT_AVATAR_SRC &&
                        "bg-[#272156]"
                    )}
                  />
                  <AvatarFallback className="bg-[#272156]/10 text-xs font-semibold text-[#272156]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
                  {userName}
                </span>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-0.5 font-normal">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/employee/settings">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
