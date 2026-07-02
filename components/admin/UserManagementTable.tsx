"use client";

import { User as UserType } from "@/src/types/user";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  getEffectiveAdminModules,
  getModuleLabel,
  isAdminRole,
  isSuperAdmin,
} from "@/lib/admin-permissions";
import { cn } from "@/lib/utils";

interface UserManagementTableProps {
  users: UserType[];
  isLoading?: boolean;
  noDataMessage?: string;
  resendingUserId?: string;
  onResendInvite?: (userId: string) => void;
  onEdit?: (user: UserType) => void;
  onDelete?: (userId: string) => void;
}

function RoleBadge({ role }: { role: string }) {
  const upper = role.toUpperCase();
  if (upper === "SUPER_ADMIN") {
    return (
      <Badge className="bg-violet-600 hover:bg-violet-600">Super Admin</Badge>
    );
  }
  if (upper === "ADMIN") {
    return <Badge className="bg-blue-600 hover:bg-blue-600">Admin</Badge>;
  }
  return <Badge variant="secondary">User</Badge>;
}

function ModuleBadges({ user }: { user: UserType }) {
  if (!isAdminRole(user.role)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const modules = getEffectiveAdminModules(user.role, user.adminModules);
  const visible = modules.slice(0, 3);
  const remaining = modules.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {isSuperAdmin(user.role) ? (
        <Badge variant="outline" className="text-xs">
          Full access
        </Badge>
      ) : (
        <>
          {visible.map((module) => (
            <Badge key={module} variant="outline" className="text-xs font-normal">
              {getModuleLabel(module)}
            </Badge>
          ))}
          {remaining > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              +{remaining} more
            </Badge>
          )}
        </>
      )}
    </div>
  );
}

export function UserManagementTable({
  users,
  isLoading,
  noDataMessage = "No users found",
  resendingUserId,
  onResendInvite,
  onEdit,
  onDelete,
}: UserManagementTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!users?.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center">
        <UserRound className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{noDataMessage}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Invite someone to get started with your admin team.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                User
              </th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                Role
              </th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:table-cell">
                Permissions
              </th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                Status
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-muted/20"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(user.name || user.email || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {user.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                      <div className="mt-1 lg:hidden">
                        <RoleBadge role={user.role} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-5 py-4 lg:table-cell">
                  <RoleBadge role={user.role} />
                </td>
                <td className="hidden px-5 py-4 xl:table-cell">
                  <ModuleBadges user={user} />
                </td>
                <td className="hidden px-5 py-4 md:table-cell">
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-fit text-xs",
                        user.isEmailVerified
                          ? "border-emerald-200 text-emerald-700"
                          : "border-amber-200 text-amber-700"
                      )}
                    >
                      {user.isEmailVerified ? "Verified" : "Unverified"}
                    </Badge>
                    {user.invitePending && (
                      <Badge
                        variant="outline"
                        className="w-fit border-sky-200 text-xs text-sky-700"
                      >
                        Invite pending
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {user.invitePending && onResendInvite && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:inline-flex"
                        disabled={resendingUserId === user.id}
                        onClick={() => onResendInvite(user.id)}
                      >
                        {resendingUserId === user.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Resend invite
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden sm:inline-flex"
                      onClick={() => onEdit?.(user)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit permissions
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.invitePending && onResendInvite && (
                          <DropdownMenuItem
                            onSelect={() => onResendInvite(user.id)}
                            disabled={resendingUserId === user.id}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Resend invite email
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => onEdit?.(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit permissions
                        </DropdownMenuItem>
                        {isAdminRole(user.role) && (
                          <DropdownMenuItem disabled>
                            <Shield className="mr-2 h-4 w-4" />
                            Admin access
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => onDelete?.(user.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
