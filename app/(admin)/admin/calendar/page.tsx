"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { RecruitmentCalendar } from "@/components/admin/calendar/RecruitmentCalendar";
import {
  applicationsToCalendarEvents,
  CalendarEvent,
  microsoftEventsToCalendarEvents,
  type MicrosoftCalendarEventPayload,
} from "@/components/admin/calendar/calendar-utils";
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { useAuth } from "@/contexts/AuthContext";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import { Application } from "@/types/application";
import { getPositionDisplay } from "@/components/admin/utils/table-utils";
import { adminApi } from "@/lib/api-backend";
import { toast } from "react-hot-toast";

const CALENDAR_STATUSES = [
  "Interviewing",
  "Technical Assessment",
  "Hired",
] as const;

export default function AdminCalendarPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();

  const [applications, setApplications] = useState<Application[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [microsoftEvents, setMicrosoftEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewApplication, setViewApplication] = useState<Application | null>(
    null
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!authLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isAdmin, authLoading, router]);

  const loadCalendarData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [responses, microsoftResponse] = await Promise.all([
        Promise.all(
          CALENDAR_STATUSES.map((status) =>
            adminApplicationsApi.getAllApplicationsPaginated({}, status)
          )
        ),
        adminApi.getMicrosoftCalendarEvents().catch(() => ({ events: [] })),
      ]);

      const merged = new Map<string, Application>();
      for (const response of responses) {
        for (const app of response.applications || []) {
          merged.set(app.id, app);
        }
      }

      const allApplications = Array.from(merged.values());
      setApplications(allApplications);

      const titles: Record<string, string> = {};
      for (const app of allApplications) {
        const jobId =
          typeof app.jobId === "object" && app.jobId?._id
            ? app.jobId._id
            : typeof app.jobId === "string"
              ? app.jobId
              : undefined;
        const title =
          app.jobDetails?.title ||
          (typeof app.jobId === "object" ? app.jobId?.title : undefined);
        if (jobId && title) {
          titles[jobId] = title;
        }
      }
      setJobTitles(titles);

      const msPayload = (microsoftResponse as { events?: MicrosoftCalendarEventPayload[] })
        ?.events;
      setMicrosoftEvents(
        microsoftEventsToCalendarEvents(Array.isArray(msPayload) ? msPayload : [])
      );
    } catch (err) {
      console.error("Failed to load calendar:", err);
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    void loadCalendarData();
  }, [isAuthenticated, isAdmin, loadCalendarData]);

  const events = useMemo(() => {
    const recruitment = applicationsToCalendarEvents(applications, jobTitles);
    return [...recruitment, ...microsoftEvents].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [applications, jobTitles, microsoftEvents]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) {
      const position = getPositionDisplay(app, jobTitles);
      if (position && position !== "Position Not Available") {
        set.add(position);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications, jobTitles]);

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (event.source === "microsoft") {
        const target = event.joinUrl || event.webLink;
        if (target) {
          window.open(target, "_blank", "noopener,noreferrer");
        } else {
          toast("Outlook event — open Calendar in Outlook for details");
        }
        return;
      }

      const application = applications.find(
        (app) => app.id === event.applicationId
      );
      if (application) {
        setViewApplication(application);
      }
    },
    [applications]
  );

  const handleSaveFromView = useCallback(
    async (updatedApplication: Application) => {
      try {
        const saved = (await adminApplicationsApi.updateApplication(
          updatedApplication.id,
          updatedApplication
        )) as Application;

        const merged = { ...updatedApplication, ...saved };
        setApplications((current) =>
          current.map((app) =>
            app.id === updatedApplication.id ? merged : app
          )
        );
        setViewApplication(merged);
        toast.success("Application updated");
      } catch (err) {
        console.error("Failed to save application:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to save application"
        );
        throw err;
      }
    },
    []
  );

  if (isLoading || authLoading) {
    return (
      <AdminPageLayout title="Calendar" showSearch={false}>
        <TableSkeleton rows={8} columns={7} />
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (error) {
    return (
      <AdminPageLayout title="Calendar" showSearch={false}>
        <FailedStatusState message={error} />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title="Calendar" showSearch={false} tourId="calendar" guideInBanner>
      <TourPageHelper tourId="calendar" />
      <div className="mb-4">
        <AdminPageWelcomeBanner bannerKey="calendar" tourId="calendar" />
      </div>
      <RecruitmentCalendar
        events={events}
        positions={positions}
        onEventClick={handleEventClick}
      />

      <ViewApplicationModal
        application={viewApplication}
        isOpen={Boolean(viewApplication)}
        onClose={() => setViewApplication(null)}
        jobTitles={jobTitles}
        onSave={handleSaveFromView}
      />
    </AdminPageLayout>
  );
}
