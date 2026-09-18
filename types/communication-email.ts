export type CommunicationEmailStatus = "sent" | "failed" | "pending" | string;

export type CommunicationEmailType =
  | "candidate"
  | "request_application"
  | "broadcast"
  | "mention"
  | "hiring_team"
  | "generic"
  | "system"
  | string;

export type CommunicationFolder =
  | "inbox"
  | "starred"
  | "sent"
  | "failed"
  | "all";

export interface CommunicationEmail {
  id: string;
  source: "application_email" | "email_log" | string;
  type: CommunicationEmailType;
  to: string;
  subject: string;
  status: CommunicationEmailStatus;
  error?: string | null;
  sentAt?: string | null;
  applicationId?: string | null;
  jobId?: string | null;
  campaignId?: string | null;
  candidateName?: string | null;
  position?: string | null;
  sentByName?: string | null;
  canResend?: boolean;
  starred?: boolean;
  snippet?: string | null;
  /** Plain-text body when no HTML was logged (e.g. candidate threads). */
  body?: string | null;
  /** Full logged HTML (branded email) when available. */
  htmlBody?: string | null;
}

export interface CommunicationEmailsResponse {
  emails: CommunicationEmail[];
  total: number;
  skip: number;
  limit: number;
}

export interface CommunicationEmailCounts {
  all: number;
  sent: number;
  failed: number;
  starred: number;
  pending: number;
}
