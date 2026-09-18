/**
 * Leave module API client.
 * LIVE: FastAPI `/api/admin/leave/*` backed by Mongo collections.
 *
 * Seeding Calamari leave types (idempotent, insert-if-missing only):
 * - Automatic on backend startup and when listing `/types`
 * - POST `/api/admin/leave/types/ensure` (leave/people access)
 * - POST `/api/admin/leave/seed?typesOnly=true` (SUPER_ADMIN)
 * Existing types are never overwritten by seed — edit via PATCH `/types/{id}`
 * Full demo wipe/reseed: POST `/api/admin/leave/seed?force=true` (SUPER_ADMIN)
 */

import { backendApi } from "@/lib/api-backend";
import type {
  LeaveBalanceRow,
  LeaveCalendarDay,
  LeaveOverviewKpis,
  LeavePolicy,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveTypeDefinition,
  LeaveUsageMonth,
  OnLeaveEntry,
} from "@/types/leave";

export type LeaveOverviewResponse = {
  kpis: LeaveOverviewKpis;
  usageTrend: LeaveUsageMonth[];
  onLeaveThisWeek: OnLeaveEntry[];
};

export type LeaveListResponse<T> = {
  items: T[];
  total: number;
};

export type LeaveCalendarResponse = {
  year: number;
  month: number;
  days: LeaveCalendarDay[];
  events: OnLeaveEntry[];
};

export const leaveApi = {
  overview: () =>
    backendApi.get<LeaveOverviewResponse>("/api/admin/leave/overview"),

  listRequests: (params?: {
    status?: LeaveRequestStatus | "all";
    skip?: number;
    limit?: number;
  }) =>
    backendApi.get<LeaveListResponse<LeaveRequest>>(
      "/api/admin/leave/requests",
      params
    ),

  createRequest: (data: Partial<LeaveRequest>) =>
    backendApi.post<LeaveRequest>("/api/admin/leave/requests", data),

  updateRequest: (id: string, data: Partial<LeaveRequest>) =>
    backendApi.patch<LeaveRequest>(`/api/admin/leave/requests/${id}`, data),

  listBalances: (params?: { skip?: number; limit?: number }) =>
    backendApi.get<LeaveListResponse<LeaveBalanceRow>>(
      "/api/admin/leave/balances",
      params
    ),

  listTypes: () =>
    backendApi.get<LeaveListResponse<LeaveTypeDefinition>>(
      "/api/admin/leave/types"
    ),

  createType: (data: Partial<LeaveTypeDefinition>) =>
    backendApi.post<LeaveTypeDefinition>("/api/admin/leave/types", data),

  updateType: (id: string, data: Partial<LeaveTypeDefinition>) =>
    backendApi.patch<LeaveTypeDefinition>(
      `/api/admin/leave/types/${id}`,
      data
    ),

  listPolicies: () =>
    backendApi.get<LeaveListResponse<LeavePolicy>>(
      "/api/admin/leave/policies"
    ),

  getPolicy: (id: string) =>
    backendApi.get<LeavePolicy>(`/api/admin/leave/policies/${id}`),

  createPolicy: (data: Partial<LeavePolicy>) =>
    backendApi.post<LeavePolicy>("/api/admin/leave/policies", data),

  calendar: (year: number, month: number) =>
    backendApi.get<LeaveCalendarResponse>("/api/admin/leave/calendar", {
      year,
      month,
    }),

  /** Ops — SUPER_ADMIN. typesOnly=true ensures Calamari types; force=true wipes demo data. */
  seed: (force = false, typesOnly = false) =>
    backendApi.post<{
      seeded: boolean;
      message: string;
      counts?: Record<string, number>;
    }>(
      `/api/admin/leave/seed?force=${force ? "true" : "false"}&typesOnly=${typesOnly ? "true" : "false"}`,
      {}
    ),

  ensureTypes: () =>
    backendApi.post<{
      seeded: boolean;
      message: string;
      inserted: number;
      skipped: number;
      total: number;
    }>("/api/admin/leave/types/ensure", {}),
};
