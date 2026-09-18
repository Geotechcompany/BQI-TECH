/** HR employee types for the admin People module (/api/admin/employees). */

export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "probation"
  | "onboarding"
  | "offboarding"
  | "terminated";

export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

export type OnboardingStage =
  | "paperwork"
  | "it_setup"
  | "orientation"
  | "buddy_assigned"
  | "complete";

export type OffboardingStage =
  | "notice"
  | "knowledge_transfer"
  | "asset_return"
  | "exit_interview"
  | "complete";

export interface EmployeeAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface EmployeeSkill {
  name: string;
  level?: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface CompensationBreakdown {
  label: string;
  amount: number;
  color: string;
}

export interface CompensationRecord {
  effectiveDate: string;
  type: "raise" | "promotion" | "adjustment" | "bonus" | "equity_grant";
  previousBase?: number;
  newBase?: number;
  note: string;
}

export interface EquityGrant {
  id: string;
  grantDate: string;
  shares: number;
  vestedShares: number;
  vestSchedule: string;
  cliffMonths: number;
  status: "active" | "fully_vested" | "cancelled";
  grantType?: "rsu" | "options";
  grantValue?: number;
}

export interface AttendanceDay {
  date: string;
  status: "present" | "remote" | "leave" | "late" | "absent" | "holiday";
  checkIn?: string;
  checkOut?: string;
  overtimeHours?: number;
}

export interface LeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "approved" | "pending" | "rejected";
}

export interface PerformanceGoal {
  id: string;
  title: string;
  progress: number;
  dueDate: string;
  status: "on_track" | "at_risk" | "completed" | "not_started";
}

export interface PeerFeedback {
  id: string;
  fromName: string;
  date: string;
  summary: string;
  rating: number;
}

export type EmployeeDocumentCategory =
  | "national_id"
  | "good_conduct"
  | "cv"
  | "tax_id"
  | "contract"
  | "certificate"
  | "other";

export type EmployeeDocumentStatus = "uploaded" | "pending" | "failed" | "sent";

export interface EmployeeDocument {
  id: string;
  name: string;
  category: EmployeeDocumentCategory;
  uploadedAt: string;
  sizeKb: number;
  url?: string;
  fileName?: string;
  status?: EmployeeDocumentStatus;
}

export const EMPLOYEE_DOCUMENT_TYPE_OPTIONS: {
  id: EmployeeDocumentCategory;
  label: string;
}[] = [
  { id: "national_id", label: "National ID" },
  { id: "good_conduct", label: "Good Conduct" },
  { id: "cv", label: "CV / Resume" },
  { id: "tax_id", label: "Tax ID / PAN" },
  { id: "contract", label: "Contract" },
  { id: "certificate", label: "Certificate" },
  { id: "other", label: "Other" },
];

export const EMPLOYEE_DOCUMENT_CATEGORY_LABELS: Record<
  EmployeeDocumentCategory,
  string
> = {
  national_id: "National ID",
  good_conduct: "Good Conduct",
  cv: "CV / Resume",
  tax_id: "Tax ID / PAN",
  contract: "Contracts",
  certificate: "Certificates",
  other: "Other",
};

export interface ActivityEntry {
  id: string;
  date: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  jobTitle: string;
  departmentId: string;
  departmentName: string;
  managerId?: string;
  managerName?: string;
  location: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  startDate: string;
  endDate?: string;
  workEmail: string;
  personalEmail?: string;
  dateOfBirth?: string;
  nationality?: string;
  displayName?: string;
  pronouns?: string;
  gender?: string;
  maritalStatus?: string;
  jobGrade?: string;
  probationMonths?: number | null;
  workArrangement?: string;
  weeklyHours?: number | null;
  address?: EmployeeAddress;
  emergencyContact?: { name: string; relation: string; phone: string };
  skills: EmployeeSkill[];
  tags: string[];
  /** Years of tenure derived for display; also computable from startDate */
  tenureYears: number;
  leaveBalanceDays: number;
  performanceRating: number;
  baseSalary: number;
  currency: string;
  totalCompensation: number;
  equityValue: number;
  bonusTarget?: number;
  signOnBonus?: number;
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    branch?: string;
  } | null;
  onboardingChecklist?: {
    docusignOffer?: boolean;
    sso?: boolean;
    payroll?: boolean;
    buddy?: boolean;
    equipment?: boolean;
  } | null;
  invitePreferences?: {
    method?: string;
    timing?: string;
    welcomeMessage?: string;
    sendInvite?: boolean;
    inviteStatus?: "sent" | "failed" | "skipped" | "deferred" | "sending" | string;
    pendingInvite?: boolean;
    inviteSentAt?: string | null;
    scheduledInviteAt?: string | null;
  } | null;
  compensationBreakdown: CompensationBreakdown[];
  compensationHistory: CompensationRecord[];
  equityGrants: EquityGrant[];
  attendanceSummary: {
    presentDays: number;
    leaveDays: number;
    lateDays: number;
    overtimeHours: number;
  };
  attendanceTrend: { labels: string[]; values: number[] };
  timesheet: AttendanceDay[];
  leaveHistory: LeaveRecord[];
  goals: PerformanceGoal[];
  peerFeedback: PeerFeedback[];
  ratingHistory: { labels: string[]; values: number[] };
  documents: EmployeeDocument[];
  activity: ActivityEntry[];
  onboardingStage?: OnboardingStage;
  offboardingStage?: OffboardingStage;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headEmployeeId?: string;
  headName?: string;
  employeeCount: number;
  description?: string;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeListFilters {
  q?: string;
  departmentId?: string;
  status?: EmployeeStatus | "all";
  employmentType?: EmploymentType | "all";
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  probation: "Probation",
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  terminated: "Terminated",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
};
