import { authService } from "./auth-backend";
import { BACKEND_URL } from "./config";
import { normalizeAdminNotification } from "./admin-notification-utils";
import { ResponseDecryption } from "./encryption-decoder";
import { ResponseDecoder } from "./response-decoder";
import type {
  CommunicationEmail,
  CommunicationEmailCounts,
} from "@/types/communication-email";

const API_FETCH_TIMEOUT_MS = 30_000;

function createFetchTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function mergeFetchOptions(
  options: RequestInit,
  timeoutMs: number
): RequestInit {
  const timeoutSignal = createFetchTimeoutSignal(timeoutMs);
  const signals = [options.signal, timeoutSignal].filter(Boolean) as AbortSignal[];

  if (signals.length === 0) {
    return { ...options, signal: timeoutSignal };
  }

  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return {
      ...options,
      signal: AbortSignal.any(signals),
    };
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    ...options,
    signal: controller.signal,
  };
}

function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) {
      return obj.message;
    }
    if (Array.isArray(obj.missingFields) && obj.missingFields.length) {
      return `Cannot activate position. Missing required fields: ${obj.missingFields
        .map(String)
        .join(", ")}`;
    }
    if (typeof obj.detail === "string" && obj.detail.trim()) {
      return obj.detail;
    }
    if (obj.detail !== undefined && obj.detail !== null) {
      const nested = formatFastApiDetail(obj.detail);
      if (nested !== "Request failed") {
        return nested;
      }
    }
  }
  return "Request failed";
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.detail) {
      return formatFastApiDetail(body.detail);
    }
    if (typeof body?.message === "string") {
      return body.message;
    }
  } catch {
    // Fall through to status-based message.
  }
  return `API request failed: ${response.status}`;
}

// Generic API client class
export class BackendApiClient {
  private baseUrl: string;
  private origin: string;

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl;
    this.origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
  }

  // Get auth headers
  private getAuthHeaders(): Headers {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.set("Origin", this.origin);

    // Get session from auth service
    const session = authService.getSession();

    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }

    // Add X-User-Session header if we have user data
    if (session?.user) {
      const { id, _id, ...userData } = session.user;
      headers.set(
        "X-User-Session",
        JSON.stringify({
          ...userData,
          id: id || _id,
          _id: _id || id,
        })
      );
    }

    return headers;
  }

  // Build URL
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${
      endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    }`;
  }

  private async decodeJsonBody(response: Response): Promise<any> {
    const raw = await response.json();
    const userId = authService.getSession()?.user?.id;
    try {
      const decrypted = await ResponseDecryption.decrypt(raw, userId);
      if (
        decrypted &&
        typeof decrypted === "object" &&
        (decrypted as { encrypted?: boolean }).encrypted === true
      ) {
        return raw;
      }
      return decrypted;
    } catch {
      return ResponseDecoder.decode(raw);
    }
  }

  // Make request
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint);

    try {
      await authService.ensureValidSession();

      const requestHeaders = this.getAuthHeaders();
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          requestHeaders.set(key, value as string);
        });
      }

      const response = await fetch(
        url,
        mergeFetchOptions(
          {
            ...options,
            headers: requestHeaders,
            credentials: "include",
          },
          API_FETCH_TIMEOUT_MS
        )
      );

      if (response.status === 401) {
        // Token expired, try to refresh using AuthService
        const refreshResult = await authService.refreshToken();
        if (!refreshResult) {
          // Dispatch global auth error event
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("auth-error", {
                detail: { error: { status: 401, message: "Session expired" } },
              })
            );
          }
          throw new Error("Session expired — please log in again");
        }

        // Retry with new token
        const retryResponse = await fetch(
          url,
          mergeFetchOptions(
            {
              ...options,
              headers: this.getAuthHeaders(),
              credentials: "include",
            },
            API_FETCH_TIMEOUT_MS
          )
        );

        if (!retryResponse.ok) {
          throw new Error(await readApiErrorMessage(retryResponse));
        }

        return this.decodeJsonBody(retryResponse);
      }

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response));
      }

      return this.decodeJsonBody(response);
    } catch (error) {
      console.error("API request error:", error);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          "Request timed out. The server may be busy — please try again."
        );
      }
      throw error;
    }
  }

  // Parse response based on content type
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }

  // GET request
  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<T> {
    const url = new URL(this.buildUrl(endpoint));

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return this.request<T>(url.pathname + url.search);
  }

  // POST request
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PATCH request
  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Upload file
  async upload<T = any>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>,
    onProgress?: (percent: number) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append("file", file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const headers = this.getAuthHeaders();
    headers.delete("Content-Type"); // Let browser set correct content type for FormData

    if (!onProgress) {
      try {
        const response = await fetch(this.buildUrl(endpoint), {
          method: "POST",
          headers,
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail ||
              errorData.message ||
              `Upload failed: HTTP ${response.status}`
          );
        }

        return this.parseResponse(response);
      } catch (error) {
        console.error(`File upload failed for ${endpoint}:`, error);
        throw error;
      }
    }

    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", this.buildUrl(endpoint));
      xhr.withCredentials = true;
      headers.forEach((value, key) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        try {
          const body = xhr.responseText
            ? JSON.parse(xhr.responseText)
            : {};
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body as T);
            return;
          }
          reject(
            new Error(
              body.detail ||
                body.message ||
                `Upload failed: HTTP ${xhr.status}`
            )
          );
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });
  }
}

// Create a singleton instance
const backendApi = new BackendApiClient();

// Export the singleton instance
export { backendApi };

// Specific API functions for different modules
export const adminApi = {
  // Applications
  getApplications: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    jobId?: string;
  }) => backendApi.get("/api/admin/applications", params),

  getApplication: (id: string) =>
    backendApi.get(`/api/admin/applications/${id}`),

  updateApplication: (id: string, data: any) =>
    backendApi.put(`/api/admin/applications/${id}`, data),

  deleteApplication: (id: string) =>
    backendApi.delete(`/api/admin/applications/${id}`),

  // Bulk operations
  updateBulkApplicationStatus: (ids: string[], status: string) =>
    backendApi.put("/api/admin/applications/bulk-status", { ids, status }),

  deleteBulkApplications: (ids: string[]) =>
    backendApi.delete("/api/admin/applications/bulk", { ids }),

  // Status-specific endpoints
  getShortlisted: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/shortlisted", params),

  getTechnicalAssessment: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/technical-assessment", params),

  getInterviewing: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/interviewing", params),

  getHired: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/hired", params),

  getDisqualified: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/disqualified", params),

  // Job Postings
  getJobPostings: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/job-postings", params),

  createJobPosting: (data: any) =>
    backendApi.post("/api/admin/job-postings", data),

  generateJobDescription: (data: {
    prompt: string;
    title?: string;
    department?: string;
    location?: string;
    employmentType?: string;
    existingDescription?: string;
    mode?: "generate" | "adjust";
  }) =>
    backendApi.post<{ description: string }>(
      "/api/admin/job-postings/ai/generate-description",
      data
    ),

  getJobPosting: (id: string) =>
    backendApi.get(`/api/admin/job-postings/${id}`),

  updateJobPosting: (id: string, data: any) =>
    backendApi.put(`/api/admin/job-postings/${id}`, data),

  deleteJobPosting: (id: string) =>
    backendApi.delete(`/api/admin/job-postings/${id}`),

  toggleJobPostingStatus: (id: string, data: { isActive: boolean }) =>
    backendApi.patch(`/api/admin/job-postings/${id}/toggle-status`, data),

  // Users
  getUsers: (params?: {
    skip?: number;
    limit?: number;
    missing_2fa?: boolean;
  }) => backendApi.get("/api/admin/users", params),

  searchUsers: (params: { q: string }) =>
    backendApi.get("/api/admin/users/search", params),

  getAdminPermissionModules: () =>
    backendApi.get("/api/admin/permissions/modules"),

  getAdminInvites: () => backendApi.get("/api/admin/users/invites"),

  inviteUser: (data: {
    email: string;
    name: string;
    role: string;
    adminModules?: string[];
  }) => backendApi.post("/api/admin/users/invite", data),

  resendAdminInvite: (inviteId: string) =>
    backendApi.post(`/api/admin/users/invites/${inviteId}/resend`),

  resendAdminInviteForUser: (userId: string) =>
    backendApi.post(`/api/admin/users/${userId}/resend-invite`),

  sendPasswordReset: (userId: string) =>
    backendApi.post(`/api/admin/users/${userId}/send-password-reset`),

  setUserRequire2fa: (userId: string, require2fa: boolean) =>
    backendApi.put(`/api/admin/users/${userId}/require-2fa`, { require2fa }),

  revokeAdminInvite: (inviteId: string) =>
    backendApi.delete(`/api/admin/users/invites/${inviteId}`),

  updateUser: (id: string, data: any) =>
    backendApi.put(`/api/admin/users/${id}`, data),

  deleteUser: (id: string) => backendApi.delete(`/api/admin/users/${id}`),

  // People / Employees
  getEmployees: (params?: {
    search?: string;
    departmentId?: string;
    status?: string;
    employmentType?: string;
    skip?: number;
    limit?: number;
  }) => backendApi.get("/api/admin/employees", params),

  getEmployee: (id: string) => backendApi.get(`/api/admin/employees/${id}`),

  createEmployee: (data: Record<string, unknown>) =>
    backendApi.post("/api/admin/employees", data),

  updateEmployee: (id: string, data: Record<string, unknown>) =>
    backendApi.patch(`/api/admin/employees/${id}`, data),

  resendEmployeeInvite: (id: string) =>
    backendApi.post<{
      ok: boolean;
      inviteStatus: string;
      toEmail: string;
      message: string;
      invitePreferences?: Record<string, unknown>;
    }>(`/api/admin/employees/${id}/resend-invite`),

  uploadEmployeeDocument: (
    employeeId: string,
    data: {
      name: string;
      category: string;
      fileUrl: string;
      fileName: string;
      fileSize: number;
    }
  ) => backendApi.post(`/api/admin/employees/${employeeId}/documents`, data),

  deleteEmployee: (id: string) =>
    backendApi.delete(`/api/admin/employees/${id}`),

  getEmployeeOrgChart: () => backendApi.get("/api/admin/employees/org-chart"),

  getAttendanceOverview: () =>
    backendApi.get("/api/admin/employees/attendance-overview"),

  seedEmployees: () => backendApi.post("/api/admin/employees/seed"),

  importEmployees: (data: { rows: Record<string, unknown>[] }) =>
    backendApi.post("/api/admin/employees/import", data),

  getDepartments: () => backendApi.get("/api/admin/departments"),

  createDepartment: (data: Record<string, unknown>) =>
    backendApi.post("/api/admin/departments", data),

  updateDepartment: (id: string, data: Record<string, unknown>) =>
    backendApi.patch(`/api/admin/departments/${id}`, data),

  deleteDepartment: (id: string) =>
    backendApi.delete(`/api/admin/departments/${id}`),

  // Blog Posts
  getBlogPosts: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/blog-posts", params),

  createBlogPost: (data: any) => backendApi.post("/api/admin/blog-posts", data),

  getBlogPost: (id: string) => backendApi.get(`/api/admin/blog-posts/${id}`),

  updateBlogPost: (id: string, data: any) =>
    backendApi.put(`/api/admin/blog-posts/${id}`, data),

  deleteBlogPost: (id: string) =>
    backendApi.delete(`/api/admin/blog-posts/${id}`),

  // Overview & Analytics
  getOverview: (jobId?: string) =>
    backendApi.get("/api/admin/overview", jobId ? { job_id: jobId } : {}),

  getTrends: (days?: number, jobId?: string) =>
    backendApi.get("/api/admin/trends", {
      days,
      ...(jobId && { job_id: jobId }),
    }),

  getApplicationsByJob: (jobId?: string, options?: { archived?: boolean }) =>
    backendApi.get(
      "/api/admin/applications-by-job",
      {
        ...(jobId && { job_id: jobId }),
        ...(options?.archived && { archived: true }),
      }
    ),

  getMyAgenda: (params?: { limit?: number }) =>
    backendApi.get("/api/admin/my-agenda", params),

  getMyTasks: (params?: { limit?: number }) =>
    backendApi.get("/api/admin/my-tasks", params),

  getTasks: (params?: { filter?: "mine" | "team" | "completed"; limit?: number }) =>
    backendApi.get("/api/admin/tasks", params),

  createTask: (data: {
    title: string;
    description?: string;
    assigneeId?: string | null;
    assigneeName?: string | null;
    dueDate?: string | null;
    positionId?: string | null;
  }) => backendApi.post("/api/admin/tasks", data),

  updateTask: (
    taskId: string,
    data: {
      title?: string;
      description?: string;
      assigneeId?: string | null;
      assigneeName?: string | null;
      dueDate?: string | null;
      status?: "open" | "completed";
      positionId?: string | null;
    }
  ) => backendApi.patch(`/api/admin/tasks/${taskId}`, data),

  deleteTask: (taskId: string) =>
    backendApi.delete(`/api/admin/tasks/${taskId}`),

  listCompanyDocuments: (params?: {
    category?: string;
    search?: string;
    limit?: number;
  }) => backendApi.get("/api/admin/documents", params),

  createCompanyDocument: (data: {
    title: string;
    description?: string;
    category: "policies" | "handbooks" | "templates" | "forms";
    format: "PDF" | "DOC" | "XLS";
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }) => backendApi.post("/api/admin/documents", data),

  updateCompanyDocument: (
    documentId: string,
    data: {
      title?: string;
      description?: string;
      category?: "policies" | "handbooks" | "templates" | "forms";
    }
  ) => backendApi.patch(`/api/admin/documents/${documentId}`, data),

  markCompanyDocumentAccessed: (documentId: string) =>
    backendApi.post(`/api/admin/documents/${documentId}/access`, {}),

  deleteCompanyDocument: (documentId: string) =>
    backendApi.delete(`/api/admin/documents/${documentId}`),

  // Questions
  getQuestions: (jobId?: string) =>
    backendApi.get(
      "/api/admin/questions",
      jobId ? { job_id: jobId } : undefined
    ),

  getQuestion: (id: string) => backendApi.get(`/api/admin/questions/${id}`),

  createQuestion: (data: any) => backendApi.post("/api/admin/questions", data),

  updateQuestion: (id: string, data: any) =>
    backendApi.put(`/api/admin/questions/${id}`, data),

  deleteQuestion: (id: string) =>
    backendApi.delete(`/api/admin/questions/${id}`),

  reorderQuestions: (data: { updates: Array<{ id: string; order: number }> }) =>
    backendApi.put("/api/admin/questions/reorder-questions", data),

  // Settings
  getSettings: async () => {
    const response = await backendApi.get("/api/admin/settings");
    return response;
  },

  updateSettings: (data: any) => backendApi.put("/api/admin/settings", data),
  syncDatabases: (collections?: string[]) =>
    backendApi.post("/api/admin/settings/sync-databases", { collections }),
  getContactProtectionAnalytics: (params?: { days?: number; limit?: number }) =>
    backendApi.get("/api/admin/contact-protection/analytics", params),
  getRecaptchaSettings: () => backendApi.get("/api/admin/settings/recaptcha"),
  updateRecaptchaSettings: (data: { siteKey?: string; secretKey?: string }) =>
    backendApi.put("/api/admin/settings/recaptcha", data),

  getBackupSettings: () => backendApi.get("/api/admin/settings/backup"),
  updateBackupSettings: (data: Record<string, unknown>) =>
    backendApi.put("/api/admin/settings/backup", data),
  runBackup: () => backendApi.post("/api/admin/settings/backup/run"),
  getBackupRuns: (params?: { limit?: number }) =>
    backendApi.get("/api/admin/settings/backup/runs", params),
  getBackupCredentials: () =>
    backendApi.get("/api/admin/settings/backup/credentials"),
  updateBackupCredentials: (data: Record<string, unknown>) =>
    backendApi.put("/api/admin/settings/backup/credentials", data),

  getEmailTransportSettings: () =>
    backendApi.get("/api/admin/settings/email-transport"),
  updateEmailTransportSettings: (data: Record<string, unknown>) =>
    backendApi.put("/api/admin/settings/email-transport", data),
  testEmailTransport: (data?: { to?: string }) =>
    backendApi.post("/api/admin/settings/email-transport/test", data ?? {}),

  getAiProviderSettings: () =>
    backendApi.get("/api/admin/settings/ai-providers"),
  updateAiProviderSettings: (data: Record<string, unknown>) =>
    backendApi.put("/api/admin/settings/ai-providers", data),
  testAiProvider: (data?: Record<string, unknown>) =>
    backendApi.post("/api/admin/settings/ai-providers/test", data ?? {}),
  getAiStatus: () => backendApi.get("/api/admin/ai/status"),

  getMicrosoftIntegrationStatus: () =>
    backendApi.get("/api/admin/integrations/microsoft/status"),
  startMicrosoftConnect: () =>
    backendApi.get("/api/admin/integrations/microsoft/connect"),
  disconnectMicrosoft: () =>
    backendApi.delete("/api/admin/integrations/microsoft"),
  syncMicrosoftCalendar: () =>
    backendApi.post("/api/admin/integrations/microsoft/sync", {}),
  getMicrosoftCalendarEvents: () =>
    backendApi.get("/api/admin/integrations/microsoft/events"),

  getDocuSignIntegrationStatus: () =>
    backendApi.get("/api/admin/integrations/docusign/status"),
  getLinearIntegrationStatus: () =>
    backendApi.get("/api/admin/integrations/linear/status"),
  verifyLinearIntegration: () =>
    backendApi.post("/api/admin/integrations/linear/verify", {}),
  saveIntegrationCredentials: (
    provider: "microsoft" | "docusign" | "linear",
    data: Record<string, unknown>
  ) =>
    backendApi.put(
      `/api/admin/integrations/${provider}/credentials`,
      data
    ),
  clearIntegrationCredentials: (
    provider: "microsoft" | "docusign" | "linear"
  ) => backendApi.delete(`/api/admin/integrations/${provider}/credentials`),
  sendEmployeeOfferViaDocuSign: (employeeId: string) =>
    backendApi.post(
      `/api/admin/employees/${employeeId}/docusign/send-offer`,
      {}
    ),

  // Get notifications
  async getNotifications(params?: { skip?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.skip != null) searchParams.set("skip", String(params.skip));
    searchParams.set("limit", String(params?.limit ?? 50));
    const query = searchParams.toString();
    const response = await backendApi.request(
      `/api/admin/notifications${query ? `?${query}` : ""}`
    );
    const rows = response.notifications || [];
    const notifications = rows.map((row: Record<string, unknown>) =>
      normalizeAdminNotification(row)
    );
    const unreadFromApi = response.unreadCount ?? response.unread_count;
    const parsedUnread =
      typeof unreadFromApi === "number"
        ? unreadFromApi
        : typeof unreadFromApi === "string" && unreadFromApi.trim() !== ""
          ? Number(unreadFromApi)
          : NaN;
    const unreadFromList = notifications.filter((n) => !n.isRead).length;

    return {
      notifications,
      total: typeof response.total === "number" ? response.total : rows.length,
      unreadCount: Number.isFinite(parsedUnread)
        ? Math.max(parsedUnread, unreadFromList)
        : unreadFromList,
    };
  },

  // Mark notification as read
  async markNotificationAsRead(notificationId: string) {
    return backendApi.request(
      `/api/admin/notifications/${notificationId}/read`,
      {
        method: "PUT",
        body: JSON.stringify({}),
      }
    );
  },

  // Delete notification
  async deleteNotification(notificationId: string) {
    return backendApi.request(`/api/admin/notifications/${notificationId}`, {
      method: "DELETE",
    });
  },

  // Mark all notifications as read
  async markAllNotificationsAsRead() {
    return backendApi.request("/api/admin/notifications/mark-all-read", {
      method: "PUT",
    });
  },

  // Admin Activity
  getAuditLogs: (params?: {
    skip?: number;
    limit?: number;
    action?: string;
    resource_type?: string;
    search?: string;
    date?: string; // YYYY-MM-DD or YYYYMMDD
  }) =>
    backendApi.get<{
      activities: Array<{
        id: string;
        timestamp: string;
        actorEmail: string;
        actorName: string;
        action: string;
        resourceType: string;
        resourceId: string;
        resourceTitle: string;
        resourcePath: string;
        changes: string[];
        summary: string;
      }>;
      total: number;
    }>("/api/admin/audit-logs", params),

  // Surveys
  listSurveys: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/surveys", params),
  createSurvey: (data: any) => backendApi.post("/api/admin/surveys", data),
  updateSurvey: (id: string, data: any) =>
    backendApi.put(`/api/admin/surveys/${id}`, data),
  deleteSurvey: (id: string) => backendApi.delete(`/api/admin/surveys/${id}`),
  getSurveyAnalytics: (id: string) =>
    backendApi.get(`/api/admin/surveys/${id}/analytics`),

  // Leave
  getLeaveOverview: () => backendApi.get("/api/admin/leave/overview"),
  listLeaveRequests: (params?: {
    status?: string;
    skip?: number;
    limit?: number;
  }) => backendApi.get("/api/admin/leave/requests", params),
  createLeaveRequest: (data: Record<string, unknown>) =>
    backendApi.post("/api/admin/leave/requests", data),
  updateLeaveRequest: (id: string, data: Record<string, unknown>) =>
    backendApi.patch(`/api/admin/leave/requests/${id}`, data),
  listLeaveBalances: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/leave/balances", params),
  recomputeLeaveBalances: () =>
    backendApi.post("/api/admin/leave/balances/recompute", {}),
  listLeaveTypes: () => backendApi.get("/api/admin/leave/types"),
  updateLeaveType: (id: string, data: Record<string, unknown>) =>
    backendApi.patch(`/api/admin/leave/types/${id}`, data),
  listLeavePolicies: () => backendApi.get("/api/admin/leave/policies"),
  getLeaveCalendar: (year: number, month: number) =>
    backendApi.get("/api/admin/leave/calendar", { year, month }),
  seedLeaveData: (force = false) =>
    backendApi.post(`/api/admin/leave/seed?force=${force ? "true" : "false"}`, {}),

  // Email Broadcast
  getUsersCount: () => backendApi.get("/api/admin/users/count"),
  generateAIEmail: (data: { prompt: string }) =>
    backendApi.post("/api/admin/emails/ai/generate", data),
  sendEmailBroadcast: (data: {
    subject: string;
    body: string;
    recipients: string[];
    mode: string;
  }) => backendApi.post("/api/admin/emails/broadcast", data),
  listEmailTemplates: () =>
    backendApi.get<{
      items: Array<{
        id: string;
        stageKey: string;
        name: string;
        subject: string;
        html: string;
        body: string;
        isDefault?: boolean;
      }>;
      total: number;
    }>("/api/admin/emails/templates"),
  getEmailTemplateByStage: (stageKey: string) =>
    backendApi.get(
      `/api/admin/emails/templates/by-stage/${encodeURIComponent(stageKey)}`
    ),
  ensureEmailTemplates: () =>
    backendApi.post("/api/admin/emails/templates/ensure", {}),
  updateEmailTemplate: (
    id: string,
    data: { name?: string; subject?: string; html?: string; body?: string }
  ) => backendApi.patch(`/api/admin/emails/templates/${id}`, data),

  // Email History & Analytics
  getEmailCampaigns: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/emails/campaigns", params),
  getEmailCampaignDetails: (campaignId: string) =>
    backendApi.get(`/api/admin/emails/campaigns/${campaignId}`),
  getEmailLogs: (params?: {
    skip?: number;
    limit?: number;
    campaign_id?: string;
    status?: string;
  }) => backendApi.get("/api/admin/emails/logs", params),

  getCommunicationEmails: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    type?: string;
    q?: string;
    starred?: boolean;
  }) =>
    backendApi.get("/api/admin/communications/emails", params),

  starCommunicationEmail: (emailId: string, starred: boolean) =>
    backendApi.patch<CommunicationEmail>(
      `/api/admin/communications/emails/${emailId}/star`,
      { starred }
    ),

  getCommunicationEmailCounts: () =>
    backendApi.get<CommunicationEmailCounts>(
      "/api/admin/communications/emails/counts"
    ),

  resendCommunicationEmail: (emailId: string) =>
    backendApi.post(`/api/admin/communications/emails/${emailId}/resend`, {}),

  // Broadcast Lists
  listBroadcastLists: (params?: { skip?: number; limit?: number }) =>
    backendApi.get("/api/admin/broadcast-lists", params),
  createBroadcastList: (data: any) =>
    backendApi.post("/api/admin/broadcast-lists", data),
  getBroadcastList: (id: string) =>
    backendApi.get(`/api/admin/broadcast-lists/${id}`),
  updateBroadcastList: (id: string, data: any) =>
    backendApi.put(`/api/admin/broadcast-lists/${id}`, data),
  deleteBroadcastList: (id: string) =>
    backendApi.delete(`/api/admin/broadcast-lists/${id}`),
  getBroadcastListUsers: (id: string) =>
    backendApi.get(`/api/admin/broadcast-lists/${id}/users`),

  uploadAdminFile: (file: File) => backendApi.upload(`/api/upload`, file),
  exportSurveyResponses: async (
    id: string,
    format: "csv" | "xlsx" = "csv"
  ): Promise<Blob> => {
    const headers = new Headers();
    const session = authService.getSession();
    if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);
    const url = `${BACKEND_URL}/api/admin/surveys/${id}/export?format=${format}`;
    const res = await fetch(url, { headers, credentials: "include" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Export failed (${res.status}): ${txt}`);
    }
    return await res.blob();
  },
  listSurveyResponses: (
    id: string,
    params?: { skip?: number; limit?: number }
  ) => backendApi.get(`/api/admin/surveys/${id}/responses`, params),
  aiGenerateSurvey: (data: { prompt: string; num_questions?: number }) =>
    backendApi.post(`/api/admin/surveys/ai/generate`, data),
};

export const userApi = {
  // Applications
  submitApplication: (data: any) => backendApi.post("/api/applications", data),

  getMyApplications: (params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }) => backendApi.get("/api/applications", params),

  getApplication: (id: string) => backendApi.get(`/api/applications/${id}`),

  getApplicationStats: () => backendApi.get("/api/users/application-stats"),

  getLatestApplication: () => backendApi.get("/api/users/latest-application"),

  // Profile
  async getProfile() {
    return backendApi.get("/api/users/profile");
  },

  async updateProfile(data: any) {
    return backendApi.put("/api/users/profile", data);
  },

  // Settings
  async getSettings() {
    return backendApi.get("/api/users/settings");
  },

  async updateSettings(data: any) {
    return backendApi.put("/api/users/settings", data);
  },

  // Password
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    backendApi.post("/api/users/change-password", data),

  // Email verification
  async resendVerification() {
    const sessionEmail = authService.getSession()?.user?.email;
    let email = sessionEmail || "";
    try {
      const profile = await this.getProfile();
      if (typeof profile?.email === "string" && profile.email.trim()) {
        email = profile.email.trim();
      }
    } catch {
      // Fall back to session email when profile decrypt/load fails
    }
    if (!email) {
      throw new Error("No email available to resend verification");
    }
    return backendApi.post("/api/users/resend-verification", email);
  },

  // Avatar Upload
  uploadAvatar: (file: File) => backendApi.upload("/api/upload/avatar", file),

  // Jobs
  async getJobs({ skip = 0, limit = 10 } = {}) {
    return backendApi.get("/api/jobs", { skip, limit });
  },

  async hasApplied(jobId: string) {
    try {
      const response = await backendApi.get(`/api/applications/check/${jobId}`);
      return response.hasApplied;
    } catch (error) {
      console.error("Error checking application status:", error);
      return false;
    }
  },

  getJob: (id: string) => backendApi.get(`/api/jobs/${id}`),

  getHiringProgress: () => backendApi.get("/api/users/hiring-progress"),

  // User Notifications
  async getUserNotifications(params?: { skip?: number; limit?: number }) {
    return backendApi.get("/api/user-notifications/", params);
  },

  async markUserNotificationAsRead(notificationId: string) {
    return backendApi.patch(`/api/user-notifications/${notificationId}`, {
      isRead: true,
    });
  },

  async deleteUserNotification(notificationId: string) {
    return backendApi.delete(`/api/user-notifications/${notificationId}`);
  },

  async createUserNotification(notification: {
    title: string;
    message: string;
    type?: string;
    priority?: string;
    link?: string;
  }) {
    return backendApi.post("/api/user-notifications/", notification);
  },

  async seedUserNotifications() {
    return backendApi.post("/api/user-notifications/seed");
  },
};

// Public API (no auth required)
export const publicApi = {
  // Health check
  healthCheck: () => fetch(`${BACKEND_URL}/health`).then((r) => r.json()),
  // Surveys
  getSurvey: (id: string) =>
    fetch(`${BACKEND_URL}/api/surveys/${id}`).then((r) => r.json()),
  submitSurveyResponse: (id: string, answers: Record<string, any>) =>
    fetch(`${BACKEND_URL}/api/surveys/${id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }).then((r) => r.json()),
  uploadPublicFile: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BACKEND_URL}/api/upload`, {
      method: "POST",
      body: form,
    });
    return res.json();
  },

  // Blog posts
  getBlogPosts: (params?: { skip?: number; limit?: number }) =>
    fetch(
      `${BACKEND_URL}/api/blog-posts?${new URLSearchParams(params as any)}`
    ).then((r) => r.json()),

  getBlogPost: (slug: string) =>
    fetch(`${BACKEND_URL}/api/blog-posts/${slug}`).then((r) => r.json()),

  // Contact
  getContactFormStatus: () =>
    fetch(`${BACKEND_URL}/api/contact/status`).then((r) => r.json()),
  getContactCaptchaChallenge: () =>
    fetch(`${BACKEND_URL}/api/contact/captcha-challenge`).then((r) => r.json()),
  submitContact: async (data: any) => {
    const response = await fetch(`${BACKEND_URL}/api/contact/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await response.json().catch(() => ({}));
    return { ...json, httpStatus: response.status, ok: response.ok };
  },
};

/** Employee self-service portal (`/api/employee/*`). */
export const employeePortalApi = {
  getMe: () => backendApi.get("/api/employee/me"),
  updateMe: (data: Record<string, unknown>) =>
    backendApi.patch("/api/employee/me", data),
  getLeaveBalances: () =>
    backendApi.get<{ items: unknown[]; total: number }>(
      "/api/employee/leave/balances"
    ),
  getLeaveTypes: () =>
    backendApi.get<{ items: unknown[]; total: number }>(
      "/api/employee/leave/types"
    ),
  getLeaveRequests: () =>
    backendApi.get<{ items: unknown[]; total: number }>(
      "/api/employee/leave/requests"
    ),
  getLeaveRequestDetail: (requestId: string) =>
    backendApi.get<unknown>(`/api/employee/leave/requests/${requestId}`),
  cancelLeaveRequest: (requestId: string) =>
    backendApi.post<unknown>(
      `/api/employee/leave/requests/${requestId}/cancel`,
      {}
    ),
  getLeaveRequestOverlaps: (requestId: string) =>
    backendApi.get<{
      department: unknown[];
      company: unknown[];
      departmentName?: string | null;
    }>(`/api/employee/leave/requests/${requestId}/overlaps`),
  getLeaveRequestComments: (requestId: string) =>
    backendApi.get<{ items: unknown[]; total: number }>(
      `/api/employee/leave/requests/${requestId}/comments`
    ),
  addLeaveRequestComment: (requestId: string, body: string) =>
    backendApi.post<unknown>(
      `/api/employee/leave/requests/${requestId}/comments`,
      { body }
    ),
  getLeaveCalendar: (year: number, month: number) =>
    backendApi.get<{
      year: number;
      month: number;
      days: Array<{ date: string; entries: unknown[] }>;
      events: unknown[];
    }>("/api/employee/leave/calendar", { year, month }),
  getLeaveCalendarFilters: () =>
    backendApi.get<{
      users: Array<{
        id: string;
        name: string;
        departmentName: string;
        jobTitle: string;
      }>;
      teams: string[];
      positions: string[];
    }>("/api/employee/leave/calendar/filters"),
  createLeaveRequest: (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    startPeriod?: "morning" | "afternoon";
    endPeriod?: "end_of_day" | "morning" | "afternoon";
    reason?: string;
    substituteEmployeeId?: string;
  }) =>
    backendApi.post<unknown>("/api/employee/leave/requests", data),
  getDocuments: () =>
    backendApi.get<{ items: unknown[]; total: number }>(
      "/api/employee/documents"
    ),
  uploadFile: (file: File, onProgress?: (percent: number) => void) =>
    backendApi.upload<{
      url?: string;
      fileName?: string;
      fileSize?: number;
    }>("/api/upload", file, undefined, onProgress),
  addDocument: (data: {
    name: string;
    category: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }) =>
    backendApi.post<{ document: unknown; items: unknown[] }>(
      "/api/employee/documents",
      data
    ),
  replaceDocument: (
    documentId: string,
    data: {
      name: string;
      category: string;
      fileUrl: string;
      fileName: string;
      fileSize: number;
    }
  ) =>
    backendApi.patch<{ document: unknown; items: unknown[] }>(
      `/api/employee/documents/${documentId}`,
      data
    ),
};

export default backendApi;
