export type BlogWizardStepId =
  | "basics"
  | "content"
  | "media"
  | "publish";

export interface BlogWizardState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  category: string;
  readTime: string;
  published: boolean;
  tags: string[];
  metaDescription: string;
  authorName: string;
  authorBio: string;
  authorTitle: string;
  authorProfileImage: string;
  authorTwitter: string;
  authorLinkedin: string;
  authorGithub: string;
  authorWebsite: string;
  /** When true, slug no longer auto-updates from title. */
  slugTouched: boolean;
}
