/**
 * Unified API service for admin application management across all status pages
 * This ensures consistency between Applications, Shortlisted, Technical Assessment,
 * Interviewing, Hired, and Disqualified pages
 */

import { authService } from "../../../lib/auth-backend";

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

import { BACKEND_URL } from "@/lib/config";

/** CV download + detailed LLM scoring can exceed normal API latency. */
export const AI_RANK_TIMEOUT_MS = 180_000;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function formatRequestTimeoutError(timeoutMs?: number): Error {
  const seconds = timeoutMs ? Math.round(timeoutMs / 1000) : 180;
  return new Error(
    `AI ranking timed out after ${seconds}s. CV analysis can take a few minutes — please try again.`
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
      const message =
        typeof detail === "string"
          ? detail
          : detail?.message ||
            detail?.error ||
            errorData.message ||
            `Request failed: ${response.status}`;
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

  // Update single application
  async updateApplication(applicationId: string, updateData: any) {
    return this.makeRequest(`/applications/${applicationId}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
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

  // Get job postings for position filtering
  async getJobPostings(params?: { limit?: number }) {
    const query = params?.limit ? `?limit=${params.limit}` : "";
    return this.makeRequest(`/job-postings${query}`);
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
}

export const adminApplicationsApi = new AdminApplicationsApi();
