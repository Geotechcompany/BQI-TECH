/**
 * Per-tour hero images for Guide intro modals (and optional popover strips).
 * Page welcome banners do not use these — guides only.
 */

const GUIDE_DIR = "/images/admin-guides";

export const ADMIN_TOUR_HERO_IMAGES: Record<string, string> = {
  overview: `${GUIDE_DIR}/overview.jpg`,
  applicants: `${GUIDE_DIR}/applicants.jpg`,
  candidates: `${GUIDE_DIR}/candidates.jpg`,
  calendar: `${GUIDE_DIR}/calendar.jpg`,
  documents: `${GUIDE_DIR}/documents.jpg`,
  reports: `${GUIDE_DIR}/reports.jpg`,
  inbox: `${GUIDE_DIR}/inbox.jpg`,
  tasks: `${GUIDE_DIR}/tasks.jpg`,
  communications: `${GUIDE_DIR}/communications.jpg`,
  archive: `${GUIDE_DIR}/archive.jpg`,
  "job-postings": `${GUIDE_DIR}/job-postings.jpg`,
  "job-wizard": `${GUIDE_DIR}/job-wizard.jpg`,
  blog: `${GUIDE_DIR}/blog.jpg`,
  surveys: `${GUIDE_DIR}/surveys.jpg`,
  notifications: `${GUIDE_DIR}/notifications.jpg`,
  "email-broadcast": `${GUIDE_DIR}/email-broadcast.jpg`,
  "audit-logs": `${GUIDE_DIR}/audit-logs.jpg`,
  backup: `${GUIDE_DIR}/backup.jpg`,
  settings: `${GUIDE_DIR}/settings.jpg`,
  "user-management": `${GUIDE_DIR}/user-management.jpg`,
  pipeline: `${GUIDE_DIR}/pipeline.jpg`,
  "pipeline-settings": `${GUIDE_DIR}/pipeline-settings.jpg`,
  "candidate-profile": `${GUIDE_DIR}/candidate-profile.jpg`,
  employees: `${GUIDE_DIR}/user-management.jpg`,
  "employees-directory": `${GUIDE_DIR}/applicants.jpg`,
  "employees-profile": `${GUIDE_DIR}/candidate-profile.jpg`,
  "employees-new": `${GUIDE_DIR}/job-wizard.jpg`,
  "employees-org-chart": `${GUIDE_DIR}/pipeline.jpg`,
  "employees-onboarding": `${GUIDE_DIR}/overview.jpg`,
  "employees-offboarding": `${GUIDE_DIR}/archive.jpg`,
  "employees-import": `${GUIDE_DIR}/documents.jpg`,
  departments: `${GUIDE_DIR}/user-management.jpg`,
  attendance: `${GUIDE_DIR}/calendar.jpg`,
  "leave-overview": `${GUIDE_DIR}/calendar.jpg`,
  "leave-requests": `${GUIDE_DIR}/tasks.jpg`,
  "leave-balances": `${GUIDE_DIR}/reports.jpg`,
  "leave-calendar": `${GUIDE_DIR}/calendar.jpg`,
  "leave-types": `${GUIDE_DIR}/settings.jpg`,
  "leave-policies": `${GUIDE_DIR}/pipeline-settings.jpg`,
};

const EMPLOYEE_GUIDE_FALLBACK = "/images/portal-user-login-cover.jpg";

/** Employee self-service portal tours (ids prefixed with `employee-`). */
export const EMPLOYEE_TOUR_HERO_IMAGES: Record<string, string> = {
  "employee-overview": EMPLOYEE_GUIDE_FALLBACK,
  "employee-profile": `${GUIDE_DIR}/candidate-profile.jpg`,
  "employee-leave": `${GUIDE_DIR}/calendar.jpg`,
  "employee-documents": `${GUIDE_DIR}/documents.jpg`,
  "employee-settings": `${GUIDE_DIR}/settings.jpg`,
};

const USER_GUIDE_FALLBACK = "/images/portal-user-login-cover.jpg";
const FALLBACK_HERO = "/images/admin-login-cover.png";

/** User dashboard tours (ids prefixed with `user-`). */
export const USER_TOUR_HERO_IMAGES: Record<string, string> = {
  "user-overview": USER_GUIDE_FALLBACK,
  "user-applications": `${GUIDE_DIR}/applicants.jpg`,
  "user-jobs": `${GUIDE_DIR}/job-postings.jpg`,
  "user-settings": `${GUIDE_DIR}/settings.jpg`,
  "user-apply": `${GUIDE_DIR}/job-wizard.jpg`,
};

export function getTourHeroImage(tourId: string): string {
  return (
    ADMIN_TOUR_HERO_IMAGES[tourId] ??
    USER_TOUR_HERO_IMAGES[tourId] ??
    EMPLOYEE_TOUR_HERO_IMAGES[tourId] ??
    (tourId.startsWith("user-") || tourId.startsWith("employee-")
      ? USER_GUIDE_FALLBACK
      : FALLBACK_HERO)
  );
}
