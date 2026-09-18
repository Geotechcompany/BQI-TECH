/** Canonical Learn More paths for job wizard and pipeline UI. */
export const HELP_PATHS = {
  questionnaires: "/admin/help/questionnaires/questionnaires",
  applicationForms: "/admin/help/questionnaires/application-forms",
  positionPipeline: "/admin/help/pipelines/position-pipeline",
  jobDescription: "/admin/help",
  adminApi: "/admin/help/developers/admin-api",
} as const;

export type HelpPathKey = keyof typeof HELP_PATHS;
