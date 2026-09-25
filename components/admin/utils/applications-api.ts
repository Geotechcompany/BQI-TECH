/**
 * Unified API service for admin application management across all status pages
 * This ensures consistency between Applications, Shortlisted, Technical Assessment,
 * Interviewing, Hired, and Disqualified pages
 */

import { authService } from "../../../lib/auth-backend";
import type { Application } from "@/types/application";
import { BACKEND_URL } from "@/lib/config";

export interface ApplicationFilters {
  position?: string;
  search?: string;
  skip?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  jobId?: string;
  aiScoreFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ApiResponse<T> {
  applications: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface BulkUpdateRequest {
  ids: string[];
  status: string;
}

/** Strip read-only aggregation fields before PUT /applications/:id */
export function sanitizeApplicationUpdate(
  updateData: Record<string, unknown>
): Record<string, unknown> {
  const {
    id: _id,
    _id: _mongoId,
    jobDetails,
    userDetails,
    jobTitle,
    user,
    job,
    ...rest
  } = updateData;
  return rest;
}

/**
 * CV download + detailed LLM scoring can exceed normal API latency.
 * Must exceed Backend LLM_RANK_TIMEOUT_S × (retries + 1) plus CV fetch overhead.
 */
export const AI_RANK_TIMEOUT_MS = 360_000;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function formatRequestTimeoutError(timeoutMs?: number): Error {
  const seconds = timeoutMs ? Math.round(timeoutMs / 1000) : 360;
  return new Error(
    `BQI Intelligence ranking timed out after ${seconds}s. Large CVs can take several minutes — keep this tab open and try again.`
  );
}

function wrapFetchError(error: unknown, timeoutMs?: number): Error {
  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      /signal timed out/i.test(error.message)
    ) {
      return formatRequestTimeoutError(timeoutMs);
    }
    return error;
  }
  return new Error("Request failed");
}

class AdminApplicationsApi {
  private baseUrl = BACKEND_URL;

  private buildRequestInit(
    options: RequestInit,
    token: string,
    timeoutMs?: number
  ): RequestInit {
    const init: RequestInit = {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.headers as Record<string, string> | undefined),
      },
    };

    if (timeoutMs) {
      init.signal = createTimeoutSignal(timeoutMs);
    }

    return init;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useAdminEndpoint: boolean = true,
    timeoutMs?: number
  ): Promise<T> {
    const session = authService.getSession();
    if (!session) {
      throw new Error("No authentication session");
    }

    // Backend mounts recruitment routes at /api/admin/* (not the public UI base /manage).
    const url = `${this.baseUrl}/api${
      useAdminEndpoint ? "/admin" : ""
    }${endpoint}`;

    const fetchWithAuth = async (token: string) => {
      try {
        return await fetch(url, this.buildRequestInit(options, token, timeoutMs));
      } catch (error) {
        throw wrapFetchError(error, timeoutMs);
      }
    };

    let response = await fetchWithAuth(session.token);

    // Handle token refresh
    if (response.status === 401) {
      const refreshed = await authService.refreshToken();
      if (!refreshed) {
        window.location.href = "/login";
        throw new Error("Session expired");
      }

      response = await fetchWithAuth(refreshed.access_token);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail;
      let message: string;
      if (typeof detail === "string" && detail.trim()) {
        message = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI 422 validation errors: [{ loc, msg, type }, ...]
        const parts = detail
          .map((item: unknown) => {
            if (!item || typeof item !== "object") return null;
            const row = item as { msg?: string; loc?: unknown[] };
            const msg = typeof row.msg === "string" ? row.msg : null;
            if (!msg) return null;
            const field = Array.isArray(row.loc)
              ? row.loc.filter((p) => p !== "body" && p !== "query").join(".")
              : "";
            return field ? `${field}: ${msg}` : msg;
          })
          .filter(Boolean);
        message =
          parts.length > 0
            ? parts.join("; ")
            : `Request failed: ${response.status}`;
      } else if (detail && typeof detail === "object") {
        message =
          (detail as { message?: string }).message ||
          (detail as { error?: string }).error ||
          errorData.message ||
          `Request failed: ${response.status}`;
      } else {
        message =
          errorData.message || `Request failed: ${response.status}`;
      }
      throw new Error(message);
    }

    return response.json();
  }

  // Get applications by status
  async getApplicationsByStatus(
    status:
      | "all"
      | "shortlisted"
      | "technical-assessment"
      | "interviewing"
      | "hired"
      | "disqualified"
      | "archived",
    filters: ApplicationFilters = {}
  ) {
    const params = new URLSearchParams();

    // Map frontend status to backend status format
    const statusMap: Record<string, string> = {
      shortlisted: "Shortlisted",
      "technical-assessment": "Technical Assessment",
      interviewing: "Interviewing",
      hired: "Hired",
      disqualified: "Disqualified",
    };

    // Add status parameter for non-'all' statuses
    if (status !== "all") {
      const backendStatus = statusMap[status] || status;
      params.append("status", backendStatus);
    }

    if (filters.skip !== undefined)
      params.append("skip", filters.skip.toString());
    if (filters.limit !== undefined)
      params.append("limit", filters.limit.toString());
    if (filters.sortBy) params.append("sort_by", filters.sortBy);
    if (filters.sortOrder) params.append("sort_order", filters.sortOrder);
    if (filters.search) params.append("search", filters.search);
    if (filters.position && filters.position !== "all")
      params.append("position", filters.position);
    if (filters.jobId) params.append("jobId", filters.jobId);
    if (filters.aiScoreFilter && filters.aiScoreFilter !== "all")
      params.append("ai_score_filter", filters.aiScoreFilter);

    const queryString = params.toString();

    // Use the correct endpoint based on status
    let endpoint: string;
    if (status === "shortlisted") {
      // Use dedicated shortlisted endpoint
      endpoint = `/applications/shortlisted${
        queryString ? `?${queryString}` : ""
      }`;
    } else if (status === "disqualified") {
      // Use dedicated disqualified endpoint
      endpoint = `/applications/disqualified${
        queryString ? `?${queryString}` : ""
      }`;
    } else if (status === "archived") {
      endpoint = `/applications/archived${
        queryString ? `?${queryString}` : ""
      }`;
    } else {
      // Use general applications endpoint with status parameter
      endpoint = `/applications${queryString ? `?${queryString}` : ""}`;
    }

    const response = await this.makeRequest<ApiResponse<any>>(endpoint);

    // Ensure consistent response format
    if (Array.isArray(response)) {
      return {
        applications: response,
        total: response.length,
        page: 1,
        totalPages: 1,
      };
    }

    return response;
  }

  async getApplication(applicationId: string) {
    return this.makeRequest(`/applications/${applicationId}`);
  }

  // Update single application
  async updateApplication(applicationId: string, updateData: any) {
    return this.makeRequest(`/applications/${applicationId}`, {
      method: "PUT",
      body: JSON.stringify(sanitizeApplicationUpdate(updateData)),
    });
  }

  // Delete single application
  async deleteApplication(applicationId: string) {
    return this.makeRequest(`/applications/${applicationId}`, {
      method: "DELETE",
    });
  }

  // Bulk update application status
  async bulkUpdateStatus(request: BulkUpdateRequest) {
    return this.makeRequest("/applications/bulk-status", {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }

  // Archive all active applications
  async archiveAllApplications() {
    return this.makeRequest<{
      message: string;
      archived_count: number;
      matched_count: number;
    }>("/applications/archive-all", {
      method: "PUT",
    });
  }

  // Archive selected applications
  async bulkArchiveApplications(ids: string[]) {
    return this.makeRequest<{
      message: string;
      archived_count: number;
      matched_count: number;
    }>("/applications/bulk-archive", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  }

  // Permanently delete selected applications
  async bulkDeleteApplications(ids: string[]) {
    return this.makeRequest<{
      message?: string;
      deleted_count?: number;
    }>("/applications/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  // Restore archived applications
  async bulkUnarchiveApplications(ids: string[]) {
    return this.makeRequest<{
      message: string;
      restored_count: number;
      matched_count: number;
    }>("/applications/bulk-unarchive", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  }

  // Get job postings for position filtering (backend max limit is 100)
  async getJobPostings(params?: { limit?: number; skip?: number }) {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.skip !== undefined) search.set("skip", String(params.skip));
    const query = search.toString();
    return this.makeRequest(`/job-postings${query ? `?${query}` : ""}`);
  }

  // Get application positions for filtering
  async getApplicationPositions(
    status?: string,
    options?: { archived?: boolean }
  ) {
    const params = new URLSearchParams();
    if (options?.archived) {
      params.append("archived", "true");
    }
    if (status && status !== "all") {
      // Map frontend status to backend status format
      const statusMap: Record<string, string> = {
        shortlisted: "Shortlisted",
        "technical-assessment": "Technical Assessment",
        interviewing: "Interviewing",
        hired: "Hired",
        disqualified: "Disqualified",
      };

      const backendStatus = statusMap[status] || status;
      params.append("status", backendStatus);
    }

    const queryString = params.toString();
    const endpoint = `/applications/positions${
      queryString ? `?${queryString}` : ""
    }`;

    return this.makeRequest(endpoint);
  }

  // Get all applications with optional status filter (for main applications page)
  async getAllApplicationsWithStatusFilter(
    filters: ApplicationFilters = {},
    status?: string
  ) {
    const params = new URLSearchParams();

    // Add status parameter if provided
    if (status && status !== "all") {
      params.append("status", status);
    }

    if (filters.skip !== undefined)
      params.append("skip", filters.skip.toString());
    if (filters.limit !== undefined)
      params.append("limit", filters.limit.toString());
    if (filters.sortBy) params.append("sort_by", filters.sortBy);
    if (filters.sortOrder) params.append("sort_order", filters.sortOrder);
    if (filters.search) params.append("search", filters.search);
    if (filters.position && filters.position !== "all")
      params.append("position", filters.position);
    if (filters.jobId) params.append("jobId", filters.jobId);
    if (filters.aiScoreFilter && filters.aiScoreFilter !== "all")
      params.append("ai_score_filter", filters.aiScoreFilter);
    if (filters.dateFrom) params.append("date_from", filters.dateFrom);
    if (filters.dateTo) params.append("date_to", filters.dateTo);

    const queryString = params.toString();
    const endpoint = `/applications${queryString ? `?${queryString}` : ""}`;

    const response = await this.makeRequest<ApiResponse<any>>(endpoint);

    // Ensure consistent response format
    if (Array.isArray(response)) {
      return {
        applications: response,
        total: response.length,
        page: 1,
        totalPages: 1,
      };
    }

    return response;
  }

  // Get all applications (main applications page)
  async getAllApplications(filters: ApplicationFilters = {}) {
    return this.getAllApplicationsWithStatusFilter(filters);
  }

  /** Fetch every page when a view needs more than the API max limit (100). */
  async getAllApplicationsPaginated(
    filters: ApplicationFilters = {},
    status?: string
  ): Promise<ApiResponse<any>> {
    const pageSize = 100;
    let skip = 0;
    const allApplications: any[] = [];
    let total = 0;

    while (true) {
      const response = await this.getAllApplicationsWithStatusFilter(
        { ...filters, limit: pageSize, skip },
        status
      );

      const page = response.applications || [];
      allApplications.push(...page);
      total = response.total ?? allApplications.length;

      if (page.length < pageSize || allApplications.length >= total) {
        break;
      }

      skip += pageSize;
    }

    return {
      applications: allApplications,
      total,
      page: 1,
      totalPages: 1,
    };
  }

  // Status-specific methods for easier use
  async getShortlistedApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus("shortlisted", filters);
  }

  async getTechnicalAssessmentApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus("technical-assessment", filters);
  }

  async getInterviewingApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus("interviewing", filters);
  }

  async getHiredApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus("hired", filters);
  }

  async getDisqualifiedApplications(filters: ApplicationFilters = {}) {
    // Since rejected and disqualified are handled as a single status in the backend,
    // we just fetch disqualified applications using the dedicated endpoint
    return this.getApplicationsByStatus("disqualified", filters);
  }

  async getArchivedApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus("archived", filters);
  }

  async createManualApplication(payload: {
    jobId: string;
    name: string;
    email: string;
    status?: string;
    cvUrl?: string;
    phoneNumber?: string;
    location?: string;
  }) {
    return this.makeRequest<{
      applicationId: string;
      application: Record<string, unknown>;
      userId: string;
      userCreated: boolean;
      passwordSetupEmailSent: boolean;
    }>("/applications/manual", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /** Extract name/email/phone/location from a CV URL without creating an application. */
  extractContactPreview(payload: { cvUrl: string }) {
    return this.makeRequest<{
      cvUrl?: string | null;
      extracted: Partial<{
        phoneNumber: string;
        email: string;
        location: string;
        name: string;
      }>;
      hasText: boolean;
      source: string;
      warning?: string | null;
    }>("/applications/extract-contact-preview", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /** Upload a resume file to storage; returns the public URL. */
  async uploadResumeFile(file: File): Promise<{ url: string; fileName: string }> {
    const session = authService.getSession();
    if (!session) {
      throw new Error("No authentication session");
    }

    const uploadWithToken = async (token: string) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${this.baseUrl}/api/upload/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      });
      return response;
    };

    let response = await uploadWithToken(session.token);
    if (response.status === 401) {
      const refreshed = await authService.refreshToken();
      if (!refreshed) {
        window.location.href = "/login";
        throw new Error("Session expired");
      }
      response = await uploadWithToken(refreshed.access_token);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const detail =
        typeof errorBody.detail === "string"
          ? errorBody.detail
          : "Failed to upload resume";
      throw new Error(detail);
    }

    const payload = await response.json();
    const url = String(payload.url || "").trim();
    if (!url) {
      throw new Error("Upload succeeded but no file URL was returned");
    }
    return {
      url,
      fileName: String(payload.fileName || file.name),
    };
  }

  async rankApplications(request: {
    ids?: string[];
    limit?: number;
    position?: string;
    status?: string;
    jobId?: string;
  }) {
    return this.makeRequest<{
      ranked: number;
      results: Array<{
        id: string;
        aiRankScore: number;
        aiRankSummary?: string;
        aiRankStrengths?: string[];
        aiRankGaps?: string[];
        aiRankRequirements?: Array<{
          requirement: string;
          jdQuote?: string;
          category?: string;
          criticality?: number;
          match: string;
          score?: number;
          evidence?: string;
          gapNote?: string;
        }>;
        aiRankScoreReason?: string;
        aiRankRecommendation?: string;
        aiRankedAt?: string;
      }>;
      errors: Array<{ id: string; error: string }>;
    }>("/applications/ai-rank", {
      method: "POST",
      body: JSON.stringify(request),
    }, true, AI_RANK_TIMEOUT_MS);
  }

  /** Fill empty phone/location/name/email + experience from CV text (fill-if-empty). */
  extractContactFromCv(applicationId: string, options?: { force?: boolean }) {
    return this.makeRequest<{
      updated: boolean;
      skipped?: string | null;
      filled: Partial<{
        phoneNumber: string;
        email: string;
        location: string;
        name: string;
        experience: string;
        cvProfessionalSummary: string;
        cvWorkExperience: Array<{
          title: string;
          company?: string;
          dates?: string;
          bullets?: string[];
        }>;
      }>;
      extracted: Partial<{
        phoneNumber: string;
        email: string;
        location: string;
        name: string;
        experience: string;
        cvProfessionalSummary: string;
        cvWorkExperience: Array<{
          title: string;
          company?: string;
          dates?: string;
          bullets?: string[];
        }>;
      }>;
      experience?: {
        updated?: boolean;
        skipped?: string | null;
        filled?: Record<string, unknown>;
      };
      application: Application;
    }>(`/applications/${applicationId}/extract-contact`, {
      method: "POST",
      body: JSON.stringify({ force: Boolean(options?.force) }),
    });
  }
}

export const adminApplicationsApi = new AdminApplicationsApi();
