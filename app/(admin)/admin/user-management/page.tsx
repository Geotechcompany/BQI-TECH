"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { Button } from "@/components/ui/button";
import {
  MailPlus,
  ShieldCheck,
  UserCheck,
  Users,
  Clock3,
  Send,
  Loader2,
} from "lucide-react";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { InviteUserModal } from "@/components/admin/InviteUserModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User as UserType } from "@/src/types/user";
import { toast } from "react-hot-toast";
import { Pagination } from "@/components/Pagination";
import { EditUserModal } from "@/components/admin/EditUserModal";
import { adminApi } from "@/lib/api-backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  showInviteEmailError,
  showInviteEmailToast,
} from "@/lib/admin-invite-toast";

export default function UserManagementPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) return;
    setCurrentPage(1);
  }, [debouncedSearchQuery, searchQuery]);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users", currentPage, debouncedSearchQuery],
    queryFn: async () => {
      if (debouncedSearchQuery.trim()) {
        const res = await adminApi.searchUsers({
          q: debouncedSearchQuery.trim(),
        });
        const users = (res as any).users ?? [];
        return { data: users as UserType[], total: users.length };
      }

      const skip = (currentPage - 1) * itemsPerPage;
      const res = await adminApi.getUsers({ skip, limit: itemsPerPage });
      return {
        data: ((res as any).users ?? []) as UserType[],
        total: (res as any).total ?? 0,
      };
    },
  });

  const { data: userStats } = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: async () => {
      const res = (await adminApi.getUsersCount()) as {
        count?: number;
        total?: number;
        administrators?: number;
        verified?: number;
        pendingInvites?: number;
      };
      return {
        total: res.total ?? res.count ?? 0,
        administrators: res.administrators ?? 0,
        verified: res.verified ?? 0,
        pendingInvites: res.pendingInvites ?? 0,
      };
    },
  });

  const { data: invitesData } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => adminApi.getAdminInvites(),
  });

  const queryClient = useQueryClient();
  const users = usersData?.data || [];
  const pendingInvites = (invitesData as any)?.invites ?? [];
  const pendingInviteTotal =
    (invitesData as any)?.total ??
    userStats?.pendingInvites ??
    pendingInvites.length;

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-count"] });
      toast.success("User deleted successfully");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => adminApi.revokeAdminInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-count"] });
      toast.success("Invitation revoked");
    },
    onError: () => toast.error("Failed to revoke invitation"),
  });

  const resendInvite = useMutation({
    mutationFn: (inviteId: string) => adminApi.resendAdminInvite(inviteId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      showInviteEmailToast(data as any);
    },
    onError: (error) => showInviteEmailError(error),
  });

  const resendInviteForUser = useMutation({
    mutationFn: (userId: string) => adminApi.resendAdminInviteForUser(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      showInviteEmailToast(data as any);
    },
    onError: (error) => showInviteEmailError(error),
  });

  const resendingInviteId = resendInvite.isPending
    ? (resendInvite.variables as string | undefined)
    : undefined;
  const resendingUserId = resendInviteForUser.isPending
    ? (resendInviteForUser.variables as string | undefined)
    : undefined;

  const stats = [
    {
      label: "Total users",
      value: userStats?.total ?? usersData?.total ?? users.length,
      icon: Users,
      tone: "text-blue-600 bg-blue-50",
    },
    {
      label: "Administrators",
      value: userStats?.administrators ?? 0,
      icon: ShieldCheck,
      tone: "text-violet-600 bg-violet-50",
    },
    {
      label: "Verified",
      value: userStats?.verified ?? 0,
      icon: UserCheck,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Pending invites",
      value: pendingInviteTotal,
      icon: Clock3,
      tone: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <>
      <AdminPageLayout
        title="User Management"
        searchPlaceholder="Search users by name, email or role"
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        tourId="user-management"
        guideInBanner
        headerActions={
          <Button
            onClick={() => setInviteOpen(true)}
            className="shadow-sm"
            data-tour="user-management-invite"
          >
            <MailPlus className="mr-2 h-4 w-4" />
            Invite user
          </Button>
        }
      >
        <TourPageHelper tourId="user-management" />
        <div className="mx-auto max-w-screen-2xl space-y-6 px-4 pb-8">
          <AdminPageWelcomeBanner bannerKey="user-management" tourId="user-management" />
          <div
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            data-tour="user-management-stats"
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.tone}`}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pendingInvites.length > 0 && (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">
                    Pending invitations
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Users who have not yet accepted their admin invite.
                  </p>
                </div>
                <Badge variant="outline">{pendingInvites.length} pending</Badge>
              </div>
              <div className="space-y-3">
                {pendingInvites.slice(0, 5).map((invite: any) => (
                  <div
                    key={invite.id || invite._id}
                    className="flex flex-col gap-3 rounded-xl border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{invite.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {invite.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{invite.role}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resendInvite.isPending}
                        onClick={() =>
                          resendInvite.mutate(invite.id || invite._id)
                        }
                      >
                        {resendingInviteId === (invite.id || invite._id) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Resend email
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revokeInvite.isPending}
                        onClick={() =>
                          revokeInvite.mutate(invite.id || invite._id)
                        }
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Team members</h2>
              <p className="text-sm text-muted-foreground">
                Invite admins or edit a user to change role and module permissions.
              </p>
            </div>
            <Button onClick={() => setInviteOpen(true)} className="shrink-0 shadow-sm">
              <MailPlus className="mr-2 h-4 w-4" />
              Invite user
            </Button>
          </div>

          <div data-tour="user-management-table">
            <UserManagementTable
              users={users}
              isLoading={isLoading || deleteUser.isPending}
              resendingUserId={resendingUserId}
              onResendInvite={(userId) => resendInviteForUser.mutate(userId)}
              onEdit={setEditingUser}
              onDelete={(userId) => {
                const target = users.find((user) => user.id === userId) ?? null;
                setDeleteTarget(target);
              }}
            />
          </div>

          {!debouncedSearchQuery.trim() && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil((usersData?.total || 0) / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </AdminPageLayout>

      <InviteUserModal open={inviteOpen} onOpenChange={setInviteOpen} />

      <EditUserModal
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteTarget?.name || deleteTarget?.email}</strong> from
              the platform. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
