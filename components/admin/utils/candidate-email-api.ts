import { backendApi } from "@/lib/api-backend";
import type {
  ApplicationEmailMessage,
  InboxConversation,
} from "@/types/application-email";

interface MessagesResponse {
  messages: ApplicationEmailMessage[];
}

interface ConversationsResponse {
  conversations: InboxConversation[];
}

function mapEmailError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message === "Not Found") {
      return new Error(
        "Email API is unavailable. Restart the backend with the latest code or set NEXT_PUBLIC_PYTHON_API_URL to your local API."
      );
    }
    return error;
  }
  return new Error("Email request failed");
}

class CandidateEmailApi {
  async listInboxConversations(
    limit = 50
  ): Promise<ConversationsResponse> {
    try {
      return await backendApi.get<ConversationsResponse>(
        "/api/admin/inbox/conversations",
        { limit }
      );
    } catch (error) {
      throw mapEmailError(error);
    }
  }

  async listMessages(applicationId: string): Promise<MessagesResponse> {
    try {
      return await backendApi.get<MessagesResponse>(
        `/api/admin/applications/${applicationId}/emails`
      );
    } catch (error) {
      throw mapEmailError(error);
    }
  }

  async sendEmail(
    applicationId: string,
    data: { to?: string; subject: string; body: string }
  ): Promise<ApplicationEmailMessage> {
    try {
      return await backendApi.post<ApplicationEmailMessage>(
        `/api/admin/applications/${applicationId}/emails`,
        data
      );
    } catch (error) {
      throw mapEmailError(error);
    }
  }
}

export const candidateEmailApi = new CandidateEmailApi();
