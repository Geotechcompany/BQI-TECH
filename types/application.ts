interface User {
  id: string
  email: string
  name: string
  phoneNumber?: string
}

export interface StatusHistoryEntry {
  status: string
  date: Date | string
  changedBy?: string  // Actor email/name (legacy records may store user ObjectId)
  reason?: string     // Reason for the status change
  metadata?: {        // Additional context
    [key: string]: any
    previousStatus?: string
    automatedChange?: boolean
    reviewerNotes?: string
    reviewScore?: number
    interviewer?: string
    assessmentScore?: number
    startDate?: string
    disqualificationReason?: string
  }
}

export interface Application {
    id: string
    _id?: string
    name: string
    userId?: string
    user?: User
    email: string
    phoneNumber: string
    location: string
    position: string
    cvUrl: string
    resumeUrl?: string
    hearAbout: string
    otherSource?: string
    experience: string
    /** CV-parsed professional summary (fill-if-empty from resume text) */
    cvProfessionalSummary?: string
    /** CV-parsed work history entries (fill-if-empty from resume text) */
    cvWorkExperience?: Array<{
        title: string
        company?: string
        dates?: string
        bullets?: string[]
    }>
    salary: string
    status: string
    appliedDate: Date
    
    // Legacy date fields - kept for backward compatibility
    shortlistedDate?: string
    assessmentDate?: Date
    assessmentScore?: number
    interviewDate?: string
    interviewer?: string
    hireDate?: string
    startDate?: string
    disqualifiedDate?: string
    disqualifiedReason?: string
    
    // New status history tracking
    statusHistory?: StatusHistoryEntry[]
    
    answers?: Array<{
      questionId: string;
      questionText: string;
      answer: string;
    }>;
    cotsExperience?: string;
    sqlJavaScriptExperience?: string;
    reportDevelopmentExperience?: string;
    jobId?: {
      _id: string;
      title: string;
    };
    assessmentResult?: string;
    lastUpdated?: string;
    __v?: number;
    jobDetails?: {
      title?: string;
      department?: string;
      location?: string;
    };
    createdAt?: Date | string;
    updatedAt?: Date | string;
    isArchived?: boolean;
    archivedAt?: Date | string;
    archivedBy?: string;
    isPrivate?: boolean;
    privateOwnerId?: string | null;
    reminderAt?: Date | string | null;
    reminderNote?: string | null;
    assignedHiringTeam?: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
    }>;
    /** Admin user IDs following this candidate */
    followedBy?: string[];
    /** Whether the current admin is following this candidate */
    isFollowed?: boolean;

    // AI ranking (admin)
    aiRankScore?: number;
    aiRankSummary?: string;
    aiRankStrengths?: string[];
    aiRankGaps?: string[];
    aiRankRequirements?: AiRankRequirement[];
    aiRankScoreReason?: string;
    aiRankRecommendation?: string;
    aiRankedAt?: Date | string;

    /** Admin-managed labels on the candidate application */
    tags?: string[];

    /** Last CV URL that contact extraction was run against */
    contactSyncedCvUrl?: string;
    contactSyncedFromCvAt?: Date | string;
    /** Last CV URL that experience extraction was run against */
    experienceSyncedCvUrl?: string;
    experienceSyncedFromCvAt?: Date | string;
}

export interface AiRankRequirement {
    requirement: string;
    jdQuote?: string;
    category?: string;
    criticality?: number;
    match: 'full' | 'partial' | 'weak' | 'none' | 'unknown';
    score?: number;
    evidence?: string;
    gapNote?: string;
}

export interface ShortlistedCandidate extends Application {
  shortlistedDate: string // Ensure this is not optional for shortlisted candidates
}

export interface TechnicalAssessmentCandidate extends Application {
  assessmentDate: Date
}

export interface InterviewingCandidate extends Application {
  interviewDate: string // Ensure this is not optional for interviewing candidates
  interviewer: string // Ensure this is not optional for interviewing candidates
}

export interface DisqualifiedCandidate extends Application {
  disqualifiedDate: string // Ensure this is not optional for disqualified candidates
  disqualifiedReason: string // Ensure this is not optional for disqualified candidates
}

export interface HiredCandidate extends Application {
  hireDate: string // Ensure this is not optional for hired candidates
  startDate: string // Ensure this is not optional for hired candidates
}

export interface ApiResponse {
  applications: Application[]
  total: number
  page: number
  totalPages: number
}

export interface ApplicationStats {
  total: number;
  byStatus: {
    [key: string]: number;
  };
}