import { applicantsTour } from "./applicants-tour";
import { archiveTour } from "./archive-tour";
import { attendanceTour } from "./attendance-tour";
import { auditLogsTour } from "./audit-logs-tour";
import { backupTour } from "./backup-tour";
import { blogTour } from "./blog-tour";
import { calendarTour } from "./calendar-tour";
import { candidateProfileTour } from "./candidate-profile-tour";
import { candidatesTour } from "./candidates-tour";
import { communicationsTour } from "./communications-tour";
import { departmentsTour } from "./departments-tour";
import { documentsTour } from "./documents-tour";
import { emailBroadcastTour } from "./email-broadcast-tour";
import { employeesDirectoryTour } from "./employees-directory-tour";
import { employeesImportTour } from "./employees-import-tour";
import { employeesNewTour } from "./employees-new-tour";
import { employeesOffboardingTour } from "./employees-offboarding-tour";
import { employeesOnboardingTour } from "./employees-onboarding-tour";
import { employeesOrgChartTour } from "./employees-org-chart-tour";
import { employeesProfileTour } from "./employees-profile-tour";
import { employeesTour } from "./employees-tour";
import { inboxTour } from "./inbox-tour";
import { jobPostingsTour } from "./job-postings-tour";
import { jobWizardTour } from "./job-wizard-tour";
import { leaveBalancesTour } from "./leave-balances-tour";
import { leaveCalendarTour } from "./leave-calendar-tour";
import { leaveOverviewTour } from "./leave-overview-tour";
import { leavePoliciesTour } from "./leave-policies-tour";
import { leaveRequestsTour } from "./leave-requests-tour";
import { leaveTypesTour } from "./leave-types-tour";
import { notificationsTour } from "./notifications-tour";
import { overviewTour } from "./overview-tour";
import { pipelineSettingsTour } from "./pipeline-settings-tour";
import { pipelineTour } from "./pipeline-tour";
import { reportsTour } from "./reports-tour";
import { settingsTour } from "./settings-tour";
import { surveysTour } from "./surveys-tour";
import { tasksTour } from "./tasks-tour";
import { userManagementTour } from "./user-management-tour";
import { EMPLOYEE_TOURS } from "@/lib/employee-tours";
import { USER_TOURS } from "@/lib/user-tours";
import type { TourDefinition } from "./types";

export const ADMIN_TOURS: Record<string, TourDefinition> = {
  [overviewTour.id]: overviewTour,
  [pipelineTour.id]: pipelineTour,
  [pipelineSettingsTour.id]: pipelineSettingsTour,
  [jobPostingsTour.id]: jobPostingsTour,
  [jobWizardTour.id]: jobWizardTour,
  [applicantsTour.id]: applicantsTour,
  [candidatesTour.id]: candidatesTour,
  [archiveTour.id]: archiveTour,
  [inboxTour.id]: inboxTour,
  [tasksTour.id]: tasksTour,
  [communicationsTour.id]: communicationsTour,
  [reportsTour.id]: reportsTour,
  [calendarTour.id]: calendarTour,
  [documentsTour.id]: documentsTour,
  [blogTour.id]: blogTour,
  [surveysTour.id]: surveysTour,
  [notificationsTour.id]: notificationsTour,
  [emailBroadcastTour.id]: emailBroadcastTour,
  [auditLogsTour.id]: auditLogsTour,
  [backupTour.id]: backupTour,
  [settingsTour.id]: settingsTour,
  [userManagementTour.id]: userManagementTour,
  [candidateProfileTour.id]: candidateProfileTour,
  [employeesTour.id]: employeesTour,
  [employeesDirectoryTour.id]: employeesDirectoryTour,
  [employeesProfileTour.id]: employeesProfileTour,
  [employeesNewTour.id]: employeesNewTour,
  [employeesOrgChartTour.id]: employeesOrgChartTour,
  [employeesOnboardingTour.id]: employeesOnboardingTour,
  [employeesOffboardingTour.id]: employeesOffboardingTour,
  [employeesImportTour.id]: employeesImportTour,
  [departmentsTour.id]: departmentsTour,
  [attendanceTour.id]: attendanceTour,
  [leaveOverviewTour.id]: leaveOverviewTour,
  [leaveRequestsTour.id]: leaveRequestsTour,
  [leaveBalancesTour.id]: leaveBalancesTour,
  [leaveCalendarTour.id]: leaveCalendarTour,
  [leaveTypesTour.id]: leaveTypesTour,
  [leavePoliciesTour.id]: leavePoliciesTour,
};

export function getTourById(tourId: string): TourDefinition | undefined {
  return ADMIN_TOURS[tourId] ?? USER_TOURS[tourId] ?? EMPLOYEE_TOURS[tourId];
}

export function getAllTours(): TourDefinition[] {
  return [
    ...Object.values(ADMIN_TOURS),
    ...Object.values(USER_TOURS),
    ...Object.values(EMPLOYEE_TOURS),
  ];
}

/** Map admin pathname to a tour id (HR + existing hiring pages). */
export function getAdminTourIdForPath(pathname: string): string | undefined {
  if (pathname.startsWith("/admin/employees/directory")) {
    return "employees-directory";
  }
  if (pathname.startsWith("/admin/employees/org-chart")) {
    return "employees-org-chart";
  }
  if (pathname.startsWith("/admin/employees/onboarding")) {
    return "employees-onboarding";
  }
  if (pathname.startsWith("/admin/employees/offboarding")) {
    return "employees-offboarding";
  }
  if (pathname.startsWith("/admin/employees/import")) {
    return "employees-import";
  }
  if (pathname.startsWith("/admin/employees/new")) {
    return "employees-new";
  }
  if (pathname === "/admin/employees" || pathname === "/admin/employees/") {
    return "employees";
  }
  {
    const profileMatch = pathname.match(/^\/admin\/employees\/([^/]+)(?:\/edit)?$/);
    const segment = profileMatch?.[1];
    const reserved = new Set([
      "directory",
      "org-chart",
      "onboarding",
      "offboarding",
      "import",
      "new",
      "edit",
      "profile",
    ]);
    if (segment && !reserved.has(segment)) {
      return "employees-profile";
    }
  }
  if (pathname.startsWith("/admin/departments")) return "departments";
  if (pathname.startsWith("/admin/attendance")) return "attendance";
  if (pathname.startsWith("/admin/leave/requests")) return "leave-requests";
  if (pathname.startsWith("/admin/leave/balances")) return "leave-balances";
  if (pathname.startsWith("/admin/leave/calendar")) return "leave-calendar";
  if (pathname.startsWith("/admin/leave/types")) return "leave-types";
  if (pathname.startsWith("/admin/leave/policies")) return "leave-policies";
  if (
    pathname.startsWith("/admin/leave/overview") ||
    pathname === "/admin/leave" ||
    pathname === "/admin/leave/"
  ) {
    return "leave-overview";
  }
  return undefined;
}

export type { TourDefinition, TourStep, TourPlacement } from "./types";
export {
  dismissTour,
  snoozeTour,
  isTourDismissed,
  isTourSnoozed,
  clearTourPreferences,
} from "./storage";
