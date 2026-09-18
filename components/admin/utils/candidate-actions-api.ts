import { backendApi } from "@/lib/api-backend";
import type { ApplicationEmailMessage } from "@/types/application-email";

export interface ApplicationTask {
  id: string;
  applicationId: string;
  jobId?: string | null;
  title: string;
  dueAt?: string | null;
  completed: boolean;
  createdById?: string;
  createdByName?: string;
  candidateName?: string | null;
  href?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicationAssignee {
  id: string;
  name: string;
  email: string;
  role: string;
}

function mapActionError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    if (error.message === "Not Found") {
      return new Error(
        "Candidate actions API is unavailable. Restart the backend with the latest code."
      );
    }
    return error;
  }
  return new Error(fallback);
}

class CandidateActionsApi {
  async listTasks(applicationId: string): Promise<ApplicationTask[]> {
    try {
      const response = await backendApi.get<{ tasks: ApplicationTask[] }>(
        `/api/admin/applications/${applicationId}/tasks`
      );
      return response.tasks || [];
    } catch (error) {
      throw mapActionError(error, "Failed to load tasks");
    }
  }

  async createTask(
    applicationId: string,
    data: { title: string; dueAt?: string | null }
  ): Promise<ApplicationTask> {
    try {
      return await backendApi.post<ApplicationTask>(
        `/api/admin/applications/${applicationId}/tasks`,
        data
      );
    } catch (error) {
      throw mapActionError(error, "Failed to create task");
    }
  }

  async updateTask(
    applicationId: string,
    taskId: string,
    data: { title?: string; dueAt?: string | null; completed?: boolean }
  ): Promise<ApplicationTask> {
    try {
      return await backendApi.patch<ApplicationTask>(
        `/api/admin/applications/${applicationId}/tasks/${taskId}`,
        data
      );
    } catch (error) {
      throw mapActionError(error, "Failed to update task");
    }
  }

  async requestApplication(
    applicationId: string
  ): Promise<ApplicationEmailMessage> {
    try {
      return await backendApi.post<ApplicationEmailMessage>(
        `/api/admin/applications/${applicationId}/request-application`,
        {}
      );
    } catch (error) {
      throw mapActionError(error, "Failed to request application update");
    }
  }

  async setReminder(
    applicationId: string,
    data: { dueAt: string; note?: string }
  ): Promise<{ reminderAt: string; reminderNote?: string | null }> {
    try {
      return await backendApi.post(
        `/api/admin/applications/${applicationId}/reminders`,
        data
      );
    } catch (error) {
      throw mapActionError(error, "Failed to set reminder");
    }
  }

  async setPrivacy(
    applicationId: string,
    isPrivate: boolean
  ): Promise<{ isPrivate: boolean; privateOwnerId?: string | null }> {
    try {
      return await backendApi.put(
        `/api/admin/applications/${applicationId}/privacy`,
        { isPrivate }
      );
    } catch (error) {
      throw mapActionError(error, "Failed to update privacy");
    }
  }

  async setAssignees(
    applicationId: string,
    assignees: ApplicationAssignee[]
  ): Promise<{ assignedHiringTeam: ApplicationAssignee[] }> {
    try {
      return await backendApi.put(
        `/api/admin/applications/${applicationId}/assignees`,
        { assignees }
      );
    } catch (error) {
      throw mapActionError(error, "Failed to update assignees");
    }
  }

  async setFollow(
    applicationId: string,
    followed: boolean
  ): Promise<{ isFollowed: boolean; followedBy: string[] }> {
    try {
      return await backendApi.put(
        `/api/admin/applications/${applicationId}/follow`,
        { followed }
      );
    } catch (error) {
      throw mapActionError(error, "Failed to update follow status");
    }
  }

  async bulkUpdateTags(data: {
    ids: string[];
    add?: string[];
    remove?: string[];
  }): Promise<{ message: string; updated_count: number }> {
    try {
      return await backendApi.put("/api/admin/applications/bulk-tags", {
        ids: data.ids,
        add: data.add || [],
        remove: data.remove || [],
      });
    } catch (error) {
      throw mapActionError(error, "Failed to update tags");
    }
  }

  async mergeApplications(data: {
    primaryId: string;
    sourceIds: string[];
  }): Promise<{
    message: string;
    primaryId: string;
    merged_count: number;
    deleted_ids: string[];
  }> {
    try {
      return await backendApi.post("/api/admin/applications/merge", data);
    } catch (error) {
      throw mapActionError(error, "Failed to merge candidates");
    }
  }

  async sendQuestionnaire(data: {
    ids: string[];
    jobId: string;
    questionnaireId: string;
  }): Promise<{
    message: string;
    sent_count: number;
    failed_ids: string[];
    skipped_ids: string[];
  }> {
    try {
      return await backendApi.post(
        "/api/admin/applications/send-questionnaire",
        data
      );
    } catch (error) {
      throw mapActionError(error, "Failed to send questionnaire");
    }
  }
}

export const candidateActionsApi = new CandidateActionsApi();
