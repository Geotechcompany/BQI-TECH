"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { User as UserType } from "@/src/types/user";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { adminApi } from "@/lib/api-backend";
import { AdminModulePicker } from "@/components/admin/AdminModulePicker";
import {
  AdminModuleKey,
  getEffectiveAdminModules,
  isAdminRole,
} from "@/lib/admin-permissions";
import { useEffect, useState } from "react";

interface EditUserModalProps {
  user: UserType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onRequestPasswordReset?: (user: UserType) => void;
}

type EditUserForm = {
  name: string;
  email: string;
  role: UserType["role"];
};

export function EditUserModal({
  user,
  open,
  onOpenChange,
  onSuccess,
  onRequestPasswordReset,
}: EditUserModalProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } =
    useForm<EditUserForm>();
  const [adminModules, setAdminModules] = useState<AdminModuleKey[]>([]);
  const role = watch("role") ?? user?.role ?? "USER";

  useEffect(() => {
    if (user && open) {
      reset({
        name: user.name,
        email: user.email,
        role: user.role,
      });
      setAdminModules(
        getEffectiveAdminModules(user.role, user.adminModules ?? [])
      );
    }
  }, [user, open, reset]);

  const updateUser = useMutation({
    mutationFn: async (data: EditUserForm) => {
      const userId = user?.id || (user as any)?._id;
      if (!userId) throw new Error("User ID is missing");

      return adminApi.updateUser(userId, {
        name: data.name,
        email: data.email,
        role: data.role,
        adminModules: isAdminRole(data.role) ? adminModules : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit user
          </DialogTitle>
          <DialogDescription>
            Update profile details, role, and admin module permissions.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => updateUser.mutate(data))}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" {...register("name", { required: true })} />
            <Input
              label="Email"
              type="email"
              {...register("email", { required: true })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={role}
              onValueChange={(value) => {
                const nextRole = value as UserType["role"];
                setValue("role", nextRole);
                if (isAdminRole(nextRole)) {
                  setAdminModules(getEffectiveAdminModules(nextRole, adminModules));
                } else {
                  setAdminModules([]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Administrator</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdminRole(role) && (
            <AdminModulePicker
              role={role}
              selected={adminModules}
              onChange={setAdminModules}
            />
          )}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {user && onRequestPasswordReset ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onRequestPasswordReset(user)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Send password reset link
              </Button>
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
