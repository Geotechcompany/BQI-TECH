"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MailPlus, Shield } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { adminApi } from "@/lib/api-backend";
import {
  showInviteEmailError,
  showInviteEmailToast,
} from "@/lib/admin-invite-toast";
import { AdminModulePicker } from "@/components/admin/AdminModulePicker";
import {
  AdminModuleKey,
  getEffectiveAdminModules,
  isAdminRole,
} from "@/lib/admin-permissions";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_MODULES: AdminModuleKey[] = [
  "overview",
  "help",
  "candidates",
  "recruitment",
];

export function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [adminModules, setAdminModules] =
    useState<AdminModuleKey[]>(DEFAULT_MODULES);

  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setRole("ADMIN");
      setAdminModules(DEFAULT_MODULES);
    }
  }, [open]);

  useEffect(() => {
    if (role === "SUPER_ADMIN") {
      setAdminModules(getEffectiveAdminModules(role, []));
    }
  }, [role]);

  const inviteUser = useMutation({
    mutationFn: () =>
      adminApi.inviteUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        adminModules: isAdminRole(role) ? adminModules : [],
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      showInviteEmailToast(data);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showInviteEmailError(error);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    inviteUser.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailPlus className="h-5 w-5 text-primary" />
            Invite admin user
          </DialogTitle>
          <DialogDescription>
            Send a secure invitation with module-level permissions. New users
            will set their password from the email link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
            <Input
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Access level
            </label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value as "ADMIN" | "SUPER_ADMIN")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Administrator (scoped modules)
                  </span>
                </SelectItem>
                <SelectItem value="SUPER_ADMIN">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Super Administrator (full access)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AdminModulePicker
            role={role}
            selected={adminModules}
            onChange={setAdminModules}
          />

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={inviteUser.isPending}>
              {inviteUser.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailPlus className="mr-2 h-4 w-4" />
              )}
              Send invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
