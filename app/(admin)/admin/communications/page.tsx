"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { CommunicationManager } from "@/components/admin/communications/CommunicationManager";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminModule } from "@/lib/admin-permissions";

export default function AdminCommunicationsPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const canView =
    hasAdminModule(user?.role, user?.adminModules, "email_broadcast") ||
    hasAdminModule(user?.role, user?.adminModules, "candidates");

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
    <AdminPageLayout
      title="Communications"
      searchPlaceholder="Search by subject, recipient, or candidate…"
      searchValue={searchQuery}
      onSearch={setSearchQuery}
      showSearch
      fillViewport
      tourId="communications"
      guideInBanner
    >
      <TourPageHelper tourId="communications" />
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <AdminPageWelcomeBanner
          bannerKey="communications"
          compact
          className="mx-4 mt-1 shrink-0"
          tourId="communications"
        />
        <div className="min-h-0 flex-1">
          <CommunicationManager searchQuery={searchQuery} />
        </div>
      </div>
    </AdminPageLayout>
  );
}
