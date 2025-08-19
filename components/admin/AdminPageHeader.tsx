"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  Bell, 
  Search, 
  Settings,
  HelpCircle,
  ChevronDown,
  Sun,
  Moon,
  Laptop,
  Trash2,
  Check,
  User,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useAdminTheme } from "@/contexts/AdminThemeContext";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminApi } from "@/lib/api-backend";
import { toast } from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/contexts/SettingsContext";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useBackendHealth } from "@/hooks/useBackendHealth";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
  expiresAt?: string;
  priority?: string;
  userId?: string;
}

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
  const { user, logout } = useAuth();
  const { setTheme: setGlobalTheme } = useTheme();
  const { theme, setTheme } = useAdminTheme();
  const { sidebarCollapsed } = useSettings();
  const [searchValue, setSearchValue] = useState("");
  const queryClient = useQueryClient();

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch?.(value);
  };

  // Fetch notifications
  const { data: notificationsResponse, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => adminApi.getNotifications(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Extract notifications from the response
  const notifications = notificationsResponse || [];

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => 
      adminApi.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error) => {
      toast.error('Failed to mark notification as read');
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => 
      adminApi.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Notification deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete notification');
    }
  });

  const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div 
      className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 flex h-16 items-center border-b w-full fixed top-0 left-0 right-0 transition-all duration-300 ease-in-out"
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
        <div className="flex items-center gap-2">
          {/* Backend status indicator */}
          <BackendStatusIndicator />
          {/* Theme Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGlobalTheme("system")}>
                <Laptop className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Notifications</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {unreadCount 
                      ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                      : 'No new notifications'
                    }
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoadingNotifications ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="max-h-[300px] overflow-auto">
                  {notifications.map((notification: Notification) => (
                    <DropdownMenuItem 
                      key={notification.id} 
                      className="flex flex-col items-start gap-1 p-4 cursor-default"
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{notification.title}</span>
                            {!notification.isRead && (
                              <Badge variant="secondary" className="h-auto py-0 px-1">New</Badge>
                            )}
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="w-full text-center cursor-pointer">
                <Link href="/admin/notifications" className="w-full text-center">
                  View all notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Help">
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 h-9 hover:bg-accent rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} alt={user?.name || 'Admin'} />
                  <AvatarFallback>
                    {[user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium">{user?.name || 'Admin User'}</span>
                  <span className="text-xs text-muted-foreground">{user?.role || 'admin'}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || 'Admin User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Link href="/admin/settings" className="flex w-full items-center">
                    <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                    Settings
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
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
                <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
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
          className="group inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white/60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/60"
          aria-label="Backend status"
        >
          <span className={`relative flex h-2.5 w-2.5 items-center justify-center`}> 
            <span className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${color} ${pulse} opacity-75`}></span>
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`}></span>
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