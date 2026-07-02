import {
  ArchiveRestore,
  Brain,
  Eye,
  Megaphone,
  MousePointerClick,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface FeatureReleaseHighlight {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface FeatureReleaseStep {
  title: string;
  description: string;
}

// A single showcased feature inside a release. `howToTest` holds the short,
// action-oriented "try it" steps surfaced by the first-login preview dialog.
export interface FeatureReleaseItem {
  title: string;
  description: string;
  icon: LucideIcon;
  howToTest: string[];
  highlights?: string[];
  href?: string;
  ctaLabel?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface FeatureRelease {
  slug: string;
  title: string;
  tagline: string;
  version: string;
  date: string;
  category: string;
  summary: string;
  heroAccent: string;
  highlights: FeatureReleaseHighlight[];
  steps: FeatureReleaseStep[];
  capabilities: string[];
  features?: FeatureReleaseItem[];
  ctaHref?: string;
  ctaLabel?: string;
}

export const FEATURE_RELEASES: FeatureRelease[] = [
  {
    slug: "hiring-workflow-refinements",
    title: "Hiring Workflow Refinements",
    tagline: "Smarter AI setup, sharper applicant filtering, and a steadier archive",
    version: "2026.07",
    date: "June 30, 2026",
    category: "Improvements",
    summary:
      "This release tightens the daily hiring workflow: configure AI providers from Settings, slice applicants with advanced filters and sorting, archive and restore candidates reliably, and meet every new feature through a first-login preview that shows exactly how to try it.",
    heroAccent: "from-primary via-primary/95 to-primary/70",
    ctaHref: "/admin/settings",
    ctaLabel: "Open Settings",
    features: [
      {
        title: "AI provider settings",
        description:
          "Choose your AI provider, store its API key, and pick a model for applicant ranking from one Settings panel. Switch providers without touching code.",
        icon: Settings2,
        href: "/admin/settings",
        ctaLabel: "Open Settings",
        imageUrl:
          "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80&auto=format&fit=crop",
        imageAlt:
          "Close-up of the letters A I on a circuit-like surface, representing AI provider configuration",
        highlights: ["NVIDIA and OpenAI-compatible presets", "Test a provider before saving"],
        howToTest: [
          "Open Admin then Settings and select the AI providers tab",
          "Pick a provider preset and paste its API key",
          "Choose a model, then use Test to confirm the connection",
          "Save, then run AI Rank on Applications to see it in action",
        ],
      },
      {
        title: "Advanced applicant filtering & sorting",
        description:
          "Narrow the applications list by status, job, and score, then reorder results and flip the sort direction with a single click.",
        icon: SlidersHorizontal,
        href: "/admin/applications",
        ctaLabel: "Open Applications",
        imageUrl:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&auto=format&fit=crop",
        imageAlt:
          "Laptop screen showing analytics charts and data, representing advanced filtering and sorting",
        highlights: ["Combine multiple filters", "Sort by AI score, date, or status"],
        howToTest: [
          "Go to Admin then Candidates then Applications",
          "Open Advanced filters above the table",
          "Filter by status, job posting, or AI score",
          "Toggle the sort direction to flip the order",
        ],
      },
      {
        title: "Reliable archive & restore",
        description:
          "Archiving and restoring applications now updates instantly and stays consistent across every pipeline view, with no stale rows left behind.",
        icon: ArchiveRestore,
        href: "/admin/archived",
        ctaLabel: "View Archived",
        imageUrl:
          "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80&auto=format&fit=crop",
        imageAlt:
          "Rows of server storage racks, representing reliable archiving and restore",
        highlights: ["Instant move between active and archived", "Consistent counts everywhere"],
        howToTest: [
          "Open an application's actions menu and choose Archive",
          "Open the Archived view to confirm it moved",
          "Restore it from the Archived view",
          "Confirm it returns to the active Applications list",
        ],
      },
      {
        title: "First-login feature preview",
        description:
          "This popup. It showcases what shipped and gives you concise how-to-test steps, then sends you straight to the right page. It returns only when a newer release ships.",
        icon: Megaphone,
        href: "/admin/whats-new",
        ctaLabel: "View What's New",
        imageUrl:
          "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80&auto=format&fit=crop",
        imageAlt:
          "Hand holding a yellow megaphone, representing the first-login feature announcement",
        highlights: ["Per-feature how-to-test steps", "Appears once per release"],
        howToTest: [
          "Watch for this popup on your first login after an update",
          "Step through each feature and read its how-to-test steps",
          "Use the feature button to jump straight to the page",
          "Reopen the recap anytime from What's New",
        ],
      },
    ],
    highlights: [
      {
        title: "AI provider settings",
        description:
          "Configure provider, API key, and model for applicant ranking from one Settings panel.",
        icon: Settings2,
      },
      {
        title: "Advanced filtering & sorting",
        description:
          "Filter applicants by status, job, and score, then flip sort direction in one click.",
        icon: SlidersHorizontal,
      },
      {
        title: "Reliable archive & restore",
        description:
          "Archive and restore applications instantly with consistent counts across pipeline views.",
        icon: ArchiveRestore,
      },
      {
        title: "First-login feature preview",
        description:
          "A once-per-release popup that showcases features and shows how to try each one.",
        icon: Megaphone,
      },
    ],
    steps: [
      {
        title: "Set up your AI provider",
        description:
          "Open Settings then AI providers, add an API key and model, and test the connection before saving.",
      },
      {
        title: "Filter and sort applicants",
        description:
          "On Applications, open Advanced filters, combine filters, and toggle sort direction.",
      },
      {
        title: "Archive with confidence",
        description:
          "Archive or restore an application and watch every pipeline view stay in sync.",
      },
    ],
    capabilities: [
      "Provider presets for NVIDIA and OpenAI-compatible endpoints",
      "Per-provider API key storage and model selection",
      "Connection test before saving an AI provider",
      "Advanced applicant filters across status, job, and score",
      "One-click sort direction toggle on the applications table",
      "Instant, consistent archive and restore across pipeline views",
      "First-login feature preview with per-feature how-to-test steps",
    ],
  },
  {
    slug: "ai-applicant-ranking",
    title: "AI Applicant Ranking",
    tagline: "Score and compare candidates against the role they applied for",
    version: "2026.06",
    date: "June 22, 2026",
    category: "Hiring Intelligence",
    summary:
      "BQI admin can now rank applicants with AI using CV content and application answers. Each candidate receives a fit score, recommendation, and role-specific assessment that persists across Applications and every pipeline view.",
    heroAccent: "from-primary via-primary/95 to-primary/70",
    highlights: [
      {
        title: "AI Score column",
        description:
          "Color-coded 0–100 scores with fit labels like Strong Fit, Good Fit, or Not a Fit — visible at a glance in the applications table.",
        icon: Sparkles,
      },
      {
        title: "AI Assessment summaries",
        description:
          "Read why each candidate matches the applied role. Hover for strengths, gaps, and the full evaluation narrative.",
        icon: Brain,
      },
      {
        title: "Inline status updates",
        description:
          "Change application status directly from the eye-icon view popup without opening the separate edit modal.",
        icon: Eye,
      },
      {
        title: "Flexible ranking actions",
        description:
          "Rank the full page, selected rows, a single applicant from the table, or one candidate inside the view modal.",
        icon: MousePointerClick,
      },
    ],
    steps: [
      {
        title: "Open Applications",
        description:
          "Go to Admin → Candidates → Applications to see the new AI Score and AI Assessment columns.",
      },
      {
        title: "Run AI Rank",
        description:
          "Use AI Rank Page for the current list, AI Rank Selected for checked rows, the sparkle icon per row, or AI Rank inside a candidate popup.",
      },
      {
        title: "Review results",
        description:
          "Scores and assessments are saved on each application. Hover assessments to see strengths and gaps for the specific role.",
      },
      {
        title: "Move candidates forward",
        description:
          "Update status inline from the view popup while reviewing AI feedback — shortlist strong fits faster.",
      },
    ],
    capabilities: [
      "Batch rank up to 50 applications per request",
      "Single-candidate ranking from table actions or view modal",
      "CV text extraction from uploaded resume links",
      "Job-aware scoring using posting details and application answers",
      "Animated progress overlay during batch ranking",
      "Scores visible on Applications, Shortlisted, Interviewing, and all pipeline pages",
    ],
  },
];

export function getFeatureRelease(slug: string): FeatureRelease | undefined {
  return FEATURE_RELEASES.find((release) => release.slug === slug);
}

// FEATURE_RELEASES is maintained newest-first, mirroring the releases page order.
export function getLatestFeatureRelease(): FeatureRelease | undefined {
  return FEATURE_RELEASES[0];
}
