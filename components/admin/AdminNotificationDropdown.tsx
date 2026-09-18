"use client";



import { useState } from "react";

import Link from "next/link";

import {

  Bell,

  Check,

  CheckCircle2,

  AlertCircle,

  Info,

  XCircle,

  Trash2,

  ArrowRight,

  UserPlus,

  RefreshCw,

} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ListSkeleton } from "@/components/ui/skeleton";

import {

  Popover,

  PopoverContent,

  PopoverTrigger,

} from "@/components/ui/popover";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { adminApi } from "@/lib/api-backend";

import { toast } from "react-hot-toast";

import { cn } from "@/lib/utils";

import {

  type AdminNotification,

  formatAdminNotificationTime,

  formatUnreadBadgeCount,

} from "@/lib/admin-notification-utils";



function notificationIcon(notification: AdminNotification) {

  switch (notification.category) {

    case "new_application":

      return <UserPlus className="h-4 w-4 text-violet-600 dark:text-violet-400" />;

    case "status_update":

      return <RefreshCw className="h-4 w-4 text-sky-600 dark:text-sky-400" />;

    default:

      break;

  }



  switch (notification.type) {

    case "success":

      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;

    case "warning":

      return <AlertCircle className="h-4 w-4 text-amber-500" />;

    case "error":

      return <XCircle className="h-4 w-4 text-red-500" />;

    default:

      return <Info className="h-4 w-4 text-blue-500" />;

  }

}



function iconBackground(notification: AdminNotification) {

  switch (notification.category) {

    case "new_application":

      return "bg-violet-500/10";

    case "status_update":

      return "bg-sky-500/10";

    default:

      break;

  }



  switch (notification.type) {

    case "success":

      return "bg-emerald-500/10";

    case "warning":

      return "bg-amber-500/10";

    case "error":

      return "bg-red-500/10";

    default:

      return "bg-blue-500/10";

  }

}



export function AdminNotificationDropdown() {

  const queryClient = useQueryClient();

  const { isAuthenticated, isAdmin, authLoading } = useAuth();

  const [open, setOpen] = useState(false);



  const { data, isLoading, isFetching } = useQuery({

    queryKey: ["admin-notifications"],

    queryFn: () => adminApi.getNotifications({ limit: 50 }),

    enabled: !authLoading && isAuthenticated && isAdmin,

    refetchInterval: 20_000,

    staleTime: 5_000,

    refetchOnWindowFocus: true,

  });



  const notifications = data?.notifications ?? [];

  const unreadFromList = notifications.filter((n) => !n.isRead).length;

  const unreadCount = Math.max(data?.unreadCount ?? 0, unreadFromList);



  const markAsReadMutation = useMutation({

    mutationFn: (notificationId: string) =>

      adminApi.markNotificationAsRead(notificationId),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });

    },

    onError: () => {

      toast.error("Could not mark notification as read");

    },

  });



  const deleteNotificationMutation = useMutation({

    mutationFn: (notificationId: string) =>

      adminApi.deleteNotification(notificationId),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });

    },

    onError: () => {

      toast.error("Could not delete notification");

    },

  });



  const markAllAsReadMutation = useMutation({

    mutationFn: () => adminApi.markAllNotificationsAsRead(),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });

    },

    onError: () => {

      toast.error("Could not mark all as read");

    },

  });



  const handleOpenChange = (next: boolean) => {

    setOpen(next);

    if (next) {

      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });

    }

  };



  const headerSubtitle =

    unreadCount > 0

      ? `${formatUnreadBadgeCount(unreadCount)} unread`

      : notifications.length > 0

        ? "You're up to date"

        : "Nothing new";



  return (

    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0 overflow-visible rounded-xl"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${formatUnreadBadgeCount(unreadCount)} unread`
              : "Notifications"
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-0.5 -top-0.5 z-[60] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm"
            >
              {formatUnreadBadgeCount(unreadCount)}
            </span>
          )}
        </Button>
      </PopoverTrigger>



      <PopoverContent

        align="end"

        className="flex w-[380px] max-h-[min(520px,calc(100vh-5rem))] flex-col overflow-hidden p-0"

        sideOffset={8}

      >

        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">

          <div>

            <p className="text-sm font-semibold tracking-tight">Notifications</p>

            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>

          </div>

          {unreadCount > 0 && (

            <Button

              variant="ghost"

              size="sm"

              className="h-8 text-xs"

              onClick={() => markAllAsReadMutation.mutate()}

              disabled={markAllAsReadMutation.isPending}

            >

              Mark all read

            </Button>

          )}

        </div>



        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

          {isLoading ? (

            <div className="px-3 py-3">

              <ListSkeleton items={5} />

            </div>

          ) : notifications.length === 0 ? (

            <div className="flex flex-col items-center px-6 py-10 text-center">

              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">

                <Bell className="h-5 w-5 text-muted-foreground" />

              </div>

              <p className="text-sm font-medium">No notifications yet</p>

              <p className="mt-1 text-xs text-muted-foreground">

                New applications and status changes show up here.

              </p>

            </div>

          ) : (

            <div className="flex flex-col gap-1 p-2">

              {notifications.map((notification) => (

                <NotificationRow

                  key={notification.id}

                  notification={notification}

                  onMarkRead={() => markAsReadMutation.mutate(notification.id)}

                  onDelete={() => deleteNotificationMutation.mutate(notification.id)}

                  isMarkingRead={markAsReadMutation.isPending}

                />

              ))}

            </div>

          )}

        </div>



        <div className="shrink-0 border-t bg-popover p-2">

          <Button

            variant="ghost"

            className="h-9 w-full justify-between rounded-lg text-sm"

            asChild

          >

            <Link href="/admin/notifications">

              View all

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

            </Link>

          </Button>

        </div>



        {isFetching && !isLoading && (

          <div className="shrink-0 border-t px-4 py-1.5 text-center text-[10px] text-muted-foreground">

            Refreshing…

          </div>

        )}

      </PopoverContent>

    </Popover>

  );

}



function NotificationRow({

  notification,

  onMarkRead,

  onDelete,

  isMarkingRead,

}: {

  notification: AdminNotification;

  onMarkRead: () => void;

  onDelete: () => void;

  isMarkingRead: boolean;

}) {

  const content = (

    <div

      className={cn(

        "group flex gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-border/60 hover:bg-muted/50",

        !notification.isRead && "border-primary/15 bg-primary/5",

        notification.category === "new_application" &&

          !notification.isRead &&

          "border-violet-500/20 bg-violet-500/5"

      )}

    >

      <div

        className={cn(

          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",

          iconBackground(notification)

        )}

      >

        {notificationIcon(notification)}

      </div>



      <div className="min-w-0 flex-1">

        <div className="flex items-start justify-between gap-2">

          <p

            className={cn(

              "text-sm leading-snug",

              !notification.isRead ? "font-semibold" : "font-medium"

            )}

          >

            {notification.title}

          </p>

          {!notification.isRead && (

            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />

          )}

        </div>

        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">

          {notification.message}

        </p>

        <p className="mt-1.5 text-[11px] text-muted-foreground/80">

          {formatAdminNotificationTime(notification.createdAt)}

        </p>

      </div>



      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">

        {!notification.isRead && (

          <Button

            variant="ghost"

            size="icon"

            className="h-7 w-7 rounded-lg"

            onClick={(e) => {

              e.preventDefault();

              e.stopPropagation();

              onMarkRead();

            }}

            disabled={isMarkingRead}

            aria-label="Mark as read"

          >

            <Check className="h-3.5 w-3.5" />

          </Button>

        )}

        <Button

          variant="ghost"

          size="icon"

          className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"

          onClick={(e) => {

            e.preventDefault();

            e.stopPropagation();

            onDelete();

          }}

          aria-label="Delete notification"

        >

          <Trash2 className="h-3.5 w-3.5" />

        </Button>

      </div>

    </div>

  );



  if (notification.link) {

    return (

      <Link href={notification.link} className="block">

        {content}

      </Link>

    );

  }



  return content;

}


