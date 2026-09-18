export interface CommentMention {
  userId: string;
  email: string;
  name: string;
}

export interface ApplicationComment {
  id: string;
  applicationId: string;
  jobId?: string | null;
  body: string;
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorEmail: string;
  mentions: CommentMention[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}
