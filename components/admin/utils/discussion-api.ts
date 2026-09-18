import { backendApi } from "@/lib/api-backend";
import type {
  ApplicationComment,
  CommentMention,
} from "@/types/application-comment";

interface CommentsResponse {
  comments: ApplicationComment[];
}

function mapDiscussionError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message === "Not Found") {
      return new Error(
        "Discussion API is unavailable. Restart the backend with the latest code or set NEXT_PUBLIC_PYTHON_API_URL to your local API (for example http://localhost:9000)."
      );
    }
    if (error.message === "Application not found") {
      return new Error(
        "This application was not found. Refresh the page or reopen the candidate from the pipeline."
      );
    }
    return error;
  }
  return new Error("Discussion request failed");
}

class DiscussionApi {
  async getComments(applicationId: string): Promise<CommentsResponse> {
    try {
      return await backendApi.get<CommentsResponse>(
        `/api/admin/applications/${applicationId}/comments`
      );
    } catch (error) {
      throw mapDiscussionError(error);
    }
  }

  async createComment(
    applicationId: string,
    data: { body: string; parentId?: string | null; mentions?: CommentMention[] }
  ): Promise<ApplicationComment> {
    try {
      return await backendApi.post<ApplicationComment>(
        `/api/admin/applications/${applicationId}/comments`,
        data
      );
    } catch (error) {
      throw mapDiscussionError(error);
    }
  }

  async updateComment(
    applicationId: string,
    commentId: string,
    data: { body: string; mentions?: CommentMention[] }
  ): Promise<ApplicationComment> {
    try {
      return await backendApi.patch<ApplicationComment>(
        `/api/admin/applications/${applicationId}/comments/${commentId}`,
        data
      );
    } catch (error) {
      throw mapDiscussionError(error);
    }
  }

  async deleteComment(applicationId: string, commentId: string): Promise<void> {
    try {
      await backendApi.delete(
        `/api/admin/applications/${applicationId}/comments/${commentId}`
      );
    } catch (error) {
      throw mapDiscussionError(error);
    }
  }

  async summarizeComments(
    applicationId: string
  ): Promise<{ summary: string; commentCount: number }> {
    try {
      return await backendApi.post<{ summary: string; commentCount: number }>(
        `/api/admin/applications/${applicationId}/comments/summarize`,
        {}
      );
    } catch (error) {
      throw mapDiscussionError(error);
    }
  }
}

export const discussionApi = new DiscussionApi();
