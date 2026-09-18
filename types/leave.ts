/** Leave module types for admin HR.
 * Data comes from FastAPI `/api/admin/leave/*` (Mongo collections).
 */

export type LeaveRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type LeaveTypeCode =
  | "annual"
  | "sick"
  | "unpaid"
  | "maternity"
  | "paternity"
  | "compassionate"
  | "study"
  | "birth_holiday"
  | "toil";

export interface LeaveTypeDefinition {
  id: string;
  name: string;
  code: LeaveTypeCode;
  /** Hex accent for tags/charts */
  color: string;
  paid: boolean;
  defaultAllowanceDays: number;
  requiresApproval: boolean;
  description: string;
  active: boolean;
  /** No fixed annual cap (e.g. sick) — UI shows — */
  unlimited?: boolean;
}

export interface LeavePolicy {
  id: string;
  name: string;
  region: string;
  teamTags: string[];
  headcount: number;
  updatedAt: string;
  accrualRule: string;
  approvalFlow: string;
  carryOverDays: number;
  description: string;
}

export type LeaveStartPeriod = "morning" | "afternoon";
export type LeaveEndPeriod = "end_of_day" | "morning" | "afternoon";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  /** morning | afternoon — start of first day */
  startPeriod?: LeaveStartPeriod;
  /** end_of_day | morning | afternoon — end of last day */
  endPeriod?: LeaveEndPeriod;
  days: number;
  status: LeaveRequestStatus;
  reason?: string;
  substituteEmployeeId?: string;
  substituteName?: string;
  requestedAt: string;
  approverName?: string;
}

export interface LeaveRequestHistoryEvent {
  id: string;
  action: string;
  label: string;
  at: string;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
}

export interface LeaveRequestComment {
  id: string;
  body: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
}

export interface LeaveRequestAttachment {
  id: string;
  name: string;
  url?: string | null;
}

export interface LeaveRequestDetail extends LeaveRequest {
  avatarUrl?: string | null;
  history: LeaveRequestHistoryEvent[];
  comments: LeaveRequestComment[];
  attachments: LeaveRequestAttachment[];
  remainingDays?: number | null;
  entitledDays?: number | null;
  unlimited?: boolean;
}

export interface LeaveOverlapEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  jobTitle: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  avatarUrl?: string | null;
}

export interface LeaveRequestOverlaps {
  department: LeaveOverlapEntry[];
  company: LeaveOverlapEntry[];
  departmentName?: string | null;
}

export interface LeaveBalanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  leaveTypeId?: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface OnLeaveEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  departmentName: string;
  leaveTypeId?: string | null;
  leaveTypeName: string;
  leaveTypeColor: string;
  /** From leave type; defaults true when unknown */
  paid?: boolean;
  startDate: string;
  endDate: string;
  days: number;
}

export interface LeaveCalendarDay {
  date: string;
  entries: OnLeaveEntry[];
}

export interface LeaveUsageMonth {
  label: string;
  days: number;
}

export interface LeaveOverviewKpis {
  onLeaveToday: number;
  pendingRequests: number;
  approvedThisMonth: number;
  avgBalanceDays: number;
  topUsageType: string;
  sparklines: {
    onLeaveToday: number[];
    pendingRequests: number[];
    approvedThisMonth: number[];
    avgBalanceDays: number[];
  };
}

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
