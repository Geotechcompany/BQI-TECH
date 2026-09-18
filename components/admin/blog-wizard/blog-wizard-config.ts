import {
  FileText,
  ImageIcon,
  Newspaper,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import type { BlogPost } from "@/types/blog";
import type { BlogWizardState, BlogWizardStepId } from "@/types/blog-wizard";

export interface BlogWizardStepConfig {
  id: BlogWizardStepId;
  label: string;
  icon: LucideIcon;
}

export const BLOG_WIZARD_STEPS: BlogWizardStepConfig[] = [
  { id: "basics", label: "Basics", icon: Newspaper },
  { id: "content", label: "Content", icon: FileText },
  { id: "media", label: "Media & Author", icon: ImageIcon },
  { id: "publish", label: "Review & Publish", icon: Rocket },
];

export function generateBlogSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createEmptyBlogWizardState(): BlogWizardState {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    imageUrl: "",
    category: "",
    readTime: "",
    published: false,
    tags: [],
    metaDescription: "",
    authorName: "",
    authorBio: "",
    authorTitle: "",
    authorProfileImage: "",
    authorTwitter: "",
    authorLinkedin: "",
    authorGithub: "",
    authorWebsite: "",
    slugTouched: false,
  };
}

export function blogPostToWizardState(
  post: BlogPost | Record<string, unknown>
): BlogWizardState {
  const base = createEmptyBlogWizardState();
  const authorProfile =
    (post.authorProfile as BlogPost["authorProfile"]) || undefined;
  const social = authorProfile?.socialLinks;

  const title = String(post.title || "");
  const slug = String(post.slug || "");

  return {
    ...base,
    title,
    slug: slug || (title ? generateBlogSlug(title) : ""),
    excerpt: String(post.excerpt || ""),
    content: String(post.content || ""),
    imageUrl: String(post.imageUrl || ""),
    category: String(post.category || ""),
    readTime: String(post.readTime || ""),
    published: Boolean(post.published),
    tags: Array.isArray(post.tags)
      ? (post.tags as string[]).map(String)
      : [],
    metaDescription: String(post.metaDescription || ""),
    authorName: String(authorProfile?.name || ""),
    authorBio: String(authorProfile?.bio || ""),
    authorTitle: String(authorProfile?.title || ""),
    authorProfileImage: String(authorProfile?.profileImage || ""),
    authorTwitter: String(social?.twitter || ""),
    authorLinkedin: String(social?.linkedin || ""),
    authorGithub: String(social?.github || ""),
    authorWebsite: String(social?.website || ""),
    slugTouched: Boolean(slug),
  };
}

export function wizardStateToBlogPayload(
  state: BlogWizardState,
  options?: { forceDraft?: boolean }
) {
  const slug =
    state.slug.trim() ||
    (state.title.trim() ? generateBlogSlug(state.title) : "");

  return {
    title: state.title.trim(),
    slug,
    excerpt: state.excerpt.trim(),
    content: state.content,
    imageUrl: state.imageUrl.trim(),
    category: state.category.trim(),
    readTime: state.readTime.trim(),
    published: options?.forceDraft ? false : state.published,
    tags: state.tags,
    metaDescription: state.metaDescription.trim() || undefined,
    authorName: state.authorName.trim(),
    authorBio: state.authorBio.trim(),
    authorTitle: state.authorTitle.trim(),
    authorProfileImage: state.authorProfileImage.trim(),
    authorTwitter: state.authorTwitter.trim() || undefined,
    authorLinkedin: state.authorLinkedin.trim() || undefined,
    authorGithub: state.authorGithub.trim() || undefined,
    authorWebsite: state.authorWebsite.trim() || undefined,
  };
}

export function contentHasText(html: string): boolean {
  return Boolean(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}
