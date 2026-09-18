"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { AdminInbox } from "@/components/admin/inbox/AdminInbox";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminModule } from "@/lib/admin-permissions";

export default function AdminInboxPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();

  const canViewInbox = hasAdminModule(
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
    if (!canViewInbox) {
      router.push("/admin/overview");
    }
  }, [authLoading, canViewInbox, isAdmin, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !isAdmin || !canViewInbox) {
    return null;
  }

  return (
    <AdminPageLayout title="Inbox" showSearch={false} fillViewport tourId="inbox" guideInBanner>
      <TourPageHelper tourId="inbox" />
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <AdminPageWelcomeBanner bannerKey="inbox" compact className="mx-4 mt-1 shrink-0" tourId="inbox" />
        <div className="min-h-0 flex-1">
          <AdminInbox />
        </div>
      </div>
    </AdminPageLayout>
  );
}
