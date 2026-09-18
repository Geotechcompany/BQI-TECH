export interface ApplicationEmailMessage {
  id: string;
  applicationId: string;
  jobId?: string | null;
  channel: "email" | "sms" | string;
  to: string;
  subject: string;
  body: string;
  status: "sent" | "failed" | string;
  error?: string | null;
  sentById: string;
  sentByName: string;
  sentByEmail: string;
  sentAt: string;
}

export interface InboxConversation {
  applicationId: string;
  jobId?: string | null;
  candidateName: string;
  candidateEmail: string;
  position?: string | null;
  status?: string;
  messageCount: number;
  lastMessage: ApplicationEmailMessage;
}
