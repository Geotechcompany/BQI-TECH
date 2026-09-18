"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminTasksPage } from "@/components/admin/tasks/AdminTasksPage";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminModule } from "@/lib/admin-permissions";

export default function AdminTasksRoutePage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();

  const canViewTasks = hasAdminModule(
    user?.role,
    user?.adminModules,
    "candidates"
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    if (!canViewTasks) {
      router.push("/manage/overview");
    }
  }, [authLoading, canViewTasks, isAdmin, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !isAdmin || !canViewTasks) {
    return null;
  }

  return <AdminTasksPage />;
}
