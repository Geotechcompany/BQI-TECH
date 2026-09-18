/** Canonical Learn More paths for job wizard and pipeline UI. */
export const HELP_PATHS = {
  questionnaires: "/manage/help/questionnaires/questionnaires",
  applicationForms: "/manage/help/questionnaires/application-forms",
  positionPipeline: "/manage/help/pipelines/position-pipeline",
  jobDescription: "/manage/help",
  adminApi: "/manage/help/developers/admin-api",
} as const;

export type HelpPathKey = keyof typeof HELP_PATHS;
