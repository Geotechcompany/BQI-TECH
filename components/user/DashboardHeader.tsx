"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserNotificationButton } from "@/components/user/UserNotificationButton";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import {
  UserCommandSearch,
  openUserCommandSearch,
} from "@/components/user/UserCommandSearch";
import {
  LogOut,
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  /** When set, shows Guide in the header (pages without a welcome-banner Guide). */
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

export function DashboardHeader({
  title = "Dashboard",
  subtitle,
  tourId,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const { theme, updateTheme, sidebarCollapsed, updateSettings } =
    useSettings();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : user?.email || "User";
  const userEmail = user?.email || "";
  const initials = getInitials(userName);

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
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
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

          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 md:max-w-md lg:max-w-lg">
            <UserCommandSearch className="hidden md:flex" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl md:hidden"
            onClick={openUserCommandSearch}
            aria-label="Search dashboard"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>

          {tourId ? <TourHelpButton tourId={tourId} /> : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle theme"
                className="h-9 w-9 rounded-xl hover:bg-muted"
              >
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : theme === "light" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
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

          <UserNotificationButton />

          <div className="mx-1 hidden h-6 w-px bg-border/70 sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-10 items-center gap-2.5 rounded-xl border border-transparent px-2.5 hover:border-border/60 hover:bg-accent/70"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={user?.avatar || undefined}
                    alt={userName}
                  />
                  <AvatarFallback className="bg-[#272156]/15 text-xs font-semibold text-[#272156]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 flex-col items-start md:flex">
                  <span className="max-w-[160px] truncate text-sm font-semibold leading-none">
                    {userName}
                  </span>
                  {userEmail ? (
                    <span className="mt-1 max-w-[160px] truncate text-[11px] text-muted-foreground">
                      {userEmail}
                    </span>
                  ) : null}
                </div>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user?.avatar || undefined}
                      alt={userName}
                    />
                    <AvatarFallback className="bg-[#272156]/15 text-sm font-semibold text-[#272156]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-none">
                      {userName}
                    </p>
                    {userEmail ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {userEmail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/settings"
                    className="flex w-full items-center"
                  >
                    <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className={cn(
                  "text-rose-700 focus:bg-rose-50 focus:text-rose-800"
                )}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
