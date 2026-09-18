"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminDocumentsPage } from "@/components/admin/documents/AdminDocumentsPage";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminModule } from "@/lib/admin-permissions";
import { publicAdminHref } from "@/lib/admin-path";

export default function AdminDocumentsRoutePage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();

  const canViewDocuments = hasAdminModule(
    user?.role,
    user?.adminModules,
    "content"
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
    if (!canViewDocuments) {
      router.push(publicAdminHref("/manage/overview"));
    }
  }, [authLoading, canViewDocuments, isAdmin, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !isAdmin || !canViewDocuments) {
    return null;
  }

  return <AdminDocumentsPage />;
}
