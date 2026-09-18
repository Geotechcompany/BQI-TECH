export interface JobPosting {
  _id: string;
  id: string;
  title: string;
  department?: string;
  location: string;
  
  description: string;
  postedDate: string;
  employmentType: string;
  category: string;
  isActive: boolean;
  /** draft | active | inactive — prefer this over deriving from isActive alone. */
  status?: "draft" | "active" | "inactive" | "closed";
  autoOpenEnabled?: boolean;
  autoOpenAt?: string | null;
  autoCloseEnabled?: boolean;
  autoCloseAt?: string | null;
  salary?: {
    currency: string;
    min: number;
    max: number;
  } | null;
  requirements?: string[];
  questions?: string[];
  formSchema?: import("./job-wizard").ApplicationFormField[];
  customQuestions?: import("./job-wizard").CustomApplicationQuestion[];
  questionnaires?: import("./job-wizard").ApplicationQuestionnaire[];
  includeAnswersOnExperience?: boolean;
  pipelineStages?: import("./job-wizard").PipelineStageConfig[];
  pipelineSettings?: import("./pipeline-settings").PipelineSettings;
  aiRequirements?: string;
  enableAiRank?: boolean;
  hiringTeam?: import("./job-wizard").HiringTeamMember[];
  externalRecruiters?: import("./job-wizard").ExternalRecruiter[];
  createdAt?: string;
  updatedAt?: string;
}
