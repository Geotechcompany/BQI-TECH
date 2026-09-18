export interface BqiIntelligenceSettings {
  applicantInsights: boolean;
  activitySummary: boolean;
  resumeAudit: boolean;
  helpMeWrite: boolean;
  candidateSourcing: boolean;
}

/** Defaults match the product reference: Insights / Activity / Resume Audit on; Write / Sourcing off. */
export const DEFAULT_BQI_INTELLIGENCE: BqiIntelligenceSettings = {
  applicantInsights: true,
  activitySummary: true,
  resumeAudit: true,
  helpMeWrite: false,
  candidateSourcing: false,
};

export function normalizeBqiIntelligence(
  value?: Partial<BqiIntelligenceSettings> | null
): BqiIntelligenceSettings {
  return {
    applicantInsights:
      value?.applicantInsights ?? DEFAULT_BQI_INTELLIGENCE.applicantInsights,
    activitySummary:
      value?.activitySummary ?? DEFAULT_BQI_INTELLIGENCE.activitySummary,
    resumeAudit: value?.resumeAudit ?? DEFAULT_BQI_INTELLIGENCE.resumeAudit,
    helpMeWrite: value?.helpMeWrite ?? DEFAULT_BQI_INTELLIGENCE.helpMeWrite,
    candidateSourcing:
      value?.candidateSourcing ?? DEFAULT_BQI_INTELLIGENCE.candidateSourcing,
  };
}

export const BQI_INTELLIGENCE_FEATURES: {
  key: keyof BqiIntelligenceSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "applicantInsights",
    label: "Applicant Insights",
    description:
      "Define criteria to measure and explain how well candidates match your requirements for a position.",
  },
  {
    key: "activitySummary",
    label: "Activity Summary",
    description:
      "Summarize candidate timelines, message history, and hiring team discussion so you can catch up quickly.",
  },
  {
    key: "resumeAudit",
    label: "Resume Audit",
    description:
      "Check resumes for AI-generated or copied content before advancing candidates.",
  },
  {
    key: "helpMeWrite",
    label: "Help Me Write",
    description:
      "Get help from BQI Intelligence drafting job descriptions and emails to candidates.",
  },
  {
    key: "candidateSourcing",
    label: "Candidate Sourcing",
    description:
      "Find matches from previous applicants who may fit open positions.",
  },
];
