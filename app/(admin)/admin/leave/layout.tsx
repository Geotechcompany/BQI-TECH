"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminModule } from "@/lib/admin-permissions";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";

export default function LeaveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();

  const canView =
    hasAdminModule(user?.role, user?.adminModules, "leave") ||
    hasAdminModule(user?.role, user?.adminModules, "people");

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
    if (!canView) {
      router.push("/manage/overview");
    }
  }, [authLoading, canView, isAdmin, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !isAdmin || !canView) {
    return null;
  }

  return (
    <AdminPageLayout title="Leave" showSearch={false}>
      {children}
    </AdminPageLayout>
  );
}
