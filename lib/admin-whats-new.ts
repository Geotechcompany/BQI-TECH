import {
  Brain,
  Eye,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const WHATS_NEW_STORAGE_KEY = "admin_whats_new_dismissed_v2";

// Tracks the latest feature-release slug a user has already previewed, so the
// first-login preview dialog only reappears when a newer release ships.
export const FEATURE_PREVIEW_STORAGE_KEY = "admin_feature_preview_seen_v1";

export function getSeenFeatureRelease(): string | null {
  try {
    return localStorage.getItem(FEATURE_PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markFeatureReleaseSeen(slug: string): void {
  try {
    localStorage.setItem(FEATURE_PREVIEW_STORAGE_KEY, slug);
  } catch {
    // ignore
  }
}

export interface WhatsNewFeature {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

export interface WhatsNewRelease {
  title: string;
  description: string;
  date: string;
  icon: LucideIcon;
  category: "New Feature" | "Improvement" | "Security" | "Performance";
}

export const WHATS_NEW_FLOAT_FEATURES: WhatsNewFeature[] = [
  {
    title: "AI Score column",
    description:
      "See a 0–100 fit score and recommendation (Strong Fit, Good Fit, etc.) for every applicant on the Applications table.",
    icon: Sparkles,
    accent: "from-violet-500 to-purple-600",
  },
  {
    title: "AI Assessment summaries",
    description:
      "Read why each candidate matches the role they applied for — hover for strengths, gaps, and full reasoning.",
    icon: Brain,
    accent: "from-blue-500 to-indigo-600",
  },
  {
    title: "Rank & update in one place",
    description:
      "Use AI Rank Page to score the current list, or open a candidate with the eye icon to change status and re-rank inline.",
    icon: Eye,
    accent: "from-emerald-500 to-teal-600",
  },
];

export const WHATS_NEW_PAGE_RELEASES: WhatsNewRelease[] = [
  {
    title: "AI Applicant Ranking",
    description:
      "Rank candidates against their applied role using CV text and application answers. Scores and assessments are saved on each application and visible across pipeline views.",
    date: "June 22, 2026",
    icon: Sparkles,
    category: "New Feature",
  },
  {
    title: "AI Score & Assessment columns",
    description:
      "Applications table now shows color-coded AI scores and role-specific assessment summaries. Hover an assessment to see strengths and gaps.",
    date: "June 22, 2026",
    icon: Brain,
    category: "New Feature",
  },
  {
    title: "Editable application popup",
    description:
      "Update candidate status directly from the eye-icon view modal — no need to open the separate edit dialog for status changes.",
    date: "June 22, 2026",
    icon: Eye,
    category: "Improvement",
  },
  {
    title: "Animated AI ranking progress",
    description:
      "Batch and single-candidate ranking show a live progress overlay with step-by-step feedback while NVIDIA AI evaluates each applicant.",
    date: "June 22, 2026",
    icon: Sparkles,
    category: "Improvement",
  },
  {
    title: "Surveys Builder",
    description:
      "Create and share surveys from Admin → Content → Surveys. Public page at /survey/[id] collects responses.",
    date: "October 12, 2025",
    icon: Sparkles,
    category: "New Feature",
  },
  {
    title: "Email Broadcast relocation",
    description: "Email Broadcast moved to Admin → Workspace for quicker access.",
    date: "October 12, 2025",
    icon: Sparkles,
    category: "Improvement",
  },
];
