/**
 * Welcome / page-header banner copy for admin routes.
 * Titles and subtitles stay concrete — what the page does for BQI HR.
 * Photo heroes belong on Guide intros only (`lib/admin-tour-heroes.ts`).
 */

export type AdminBannerKey =
  | "overview"
  | "inbox"
  | "tasks"
  | "communications"
  | "calendar"
  | "reports"
  | "applicants"
  | "candidates"
  | "archive"
  | "job-postings"
  | "blog"
  | "documents"
  | "surveys"
  | "releases"
  | "whats-new"
  | "user-management"
  | "employees"
  | "departments"
  | "attendance"
  | "leave"
  | "notifications"
  | "email-broadcast"
  | "audit-logs"
  | "backup"
  | "settings";

export type AdminPageBannerConfig = {
  title: string;
  subtitle: string;
};

export const ADMIN_PAGE_BANNERS: Record<AdminBannerKey, AdminPageBannerConfig> =
  {
    overview: {
      title: "Hiring overview",
      subtitle:
        "Application volume, open positions, and pipeline movement for your scoped jobs.",
    },
    inbox: {
      title: "Candidate inbox",
      subtitle:
        "Threaded hiring email with candidates. Open a thread, then jump to the profile.",
    },
    tasks: {
      title: "Hiring tasks",
      subtitle:
        "Your follow-ups and team assignments. Filter by Mine, Team, or Completed.",
    },
    communications: {
      title: "Email log",
      subtitle:
        "Outbound and inbound hiring messages by folder, with delivery status and candidate links.",
    },
    calendar: {
      title: "Recruitment calendar",
      subtitle:
        "Interviews, technical assessments, and hire dates pulled from applications.",
    },
    reports: {
      title: "Hiring reports",
      subtitle:
        "Volume, sources, pipeline conversion, and time to hire for the selected positions.",
    },
    applicants: {
      title: "Applicants by position",
      subtitle:
        "Pick a job, triage the stage list, and open a candidate without leaving this board.",
    },
    candidates: {
      title: "All candidates",
      subtitle:
        "Cross-position applicant table. Filter, bulk-act, score with BQI Intelligence, open profiles.",
    },
    archive: {
      title: "Archived applications",
      subtitle:
        "Applications removed from active pipelines. Search, filter by position, or restore.",
    },
    "job-postings": {
      title: "Open positions",
      subtitle:
        "Create and manage job postings, questionnaires, and pipeline boards.",
    },
    blog: {
      title: "Blog posts",
      subtitle:
        "Draft, publish, and edit careers-site posts that appear on the public blog.",
    },
    documents: {
      title: "Company documents",
      subtitle:
        "Policies, handbooks, templates, and forms for the hiring team.",
    },
    surveys: {
      title: "Surveys",
      subtitle:
        "Build forms, share a link, and review responses from candidates or staff.",
    },
    releases: {
      title: "Feature releases",
      subtitle:
        "Long-form notes on major platform changes and how to use them in hiring.",
    },
    "whats-new": {
      title: "Changelog",
      subtitle: "Dated product updates, fixes, and smaller improvements.",
    },
    "user-management": {
      title: "Admin users",
      subtitle:
        "Invite teammates, set roles and module access, and track pending invites.",
    },
    employees: {
      title: "Employees",
      subtitle:
        "Directory, profiles, onboarding, and org structure for BQI staff.",
    },
    departments: {
      title: "Departments",
      subtitle: "Teams, heads, and headcount across the company.",
    },
    attendance: {
      title: "Attendance",
      subtitle: "Presence, leave, and overtime across the workforce this period.",
    },
    leave: {
      title: "Leave",
      subtitle:
        "Usage, balances, approvals, and region policies for BQI staff time off.",
    },
    notifications: {
      title: "Notifications",
      subtitle:
        "In-app alerts for applications, assignments, and system events. Filter unread or by type.",
    },
    "email-broadcast": {
      title: "Email broadcast",
      subtitle:
        "Send one message to all users, a list, or selected recipients. Review send history here.",
    },
    "audit-logs": {
      title: "Admin activity",
      subtitle:
        "Who changed what in admin. Filter by action, actor, and date range.",
    },
    backup: {
      title: "Backup and recovery",
      subtitle:
        "Schedule off-site backups, run one now, and check recent job history.",
    },
    settings: {
      title: "Admin settings",
      subtitle:
        "Profile, notifications, email delivery, AI providers, and BQI Intelligence toggles.",
    },
  };

export function getAdminPageBanner(
  key: AdminBannerKey
): AdminPageBannerConfig {
  return ADMIN_PAGE_BANNERS[key];
}
