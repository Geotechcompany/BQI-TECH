import type { Employee, OnboardingStage, OffboardingStage } from "@/types/employee";

export function fullName(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

export function initials(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName?.[0] ?? ""}${e.lastName?.[0] ?? ""}`.toUpperCase();
}

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Whole days since a YYYY-MM-DD (or ISO) start date. */
export function daysSinceStart(startDate?: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((utcToday - start.getTime()) / 86_400_000));
}

export type PlanBucket = "day0_30" | "day31_60" | "day61_90" | "beyond";

export function planBucketForDays(days: number | null): PlanBucket {
  if (days === null || days <= 30) return "day0_30";
  if (days <= 60) return "day31_60";
  if (days <= 90) return "day61_90";
  return "beyond";
}

export const PLAN_BUCKET_LABELS: Record<PlanBucket, string> = {
  day0_30: "Days 1–30",
  day31_60: "Days 31–60",
  day61_90: "Days 61–90",
  beyond: "90+",
};

export const ONBOARDING_STAGE_ORDER: OnboardingStage[] = [
  "paperwork",
  "it_setup",
  "orientation",
  "buddy_assigned",
  "complete",
];

export const OFFBOARDING_STAGE_ORDER: OffboardingStage[] = [
  "notice",
  "knowledge_transfer",
  "asset_return",
  "exit_interview",
  "complete",
];

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  paperwork: "Paperwork",
  it_setup: "IT setup",
  orientation: "Orientation",
  buddy_assigned: "Buddy assigned",
  complete: "Complete",
};

export const OFFBOARDING_STAGE_LABELS: Record<OffboardingStage, string> = {
  notice: "Notice",
  knowledge_transfer: "Knowledge transfer",
  asset_return: "Asset return",
  exit_interview: "Exit interview",
  complete: "Complete",
};

export const ONBOARDING_CHECKLIST_ITEMS = [
  { key: "docusignOffer", label: "DocuSign offer letter" },
  { key: "sso", label: "SSO account" },
  { key: "payroll", label: "Payroll setup" },
  { key: "buddy", label: "Buddy assigned" },
  { key: "equipment", label: "Equipment" },
] as const;

export type OnboardingChecklistKey =
  (typeof ONBOARDING_CHECKLIST_ITEMS)[number]["key"];

export function onboardingChecklistProgress(
  checklist: Employee["onboardingChecklist"] | null | undefined
): { done: number; total: number } {
  const total = ONBOARDING_CHECKLIST_ITEMS.length;
  if (!checklist) return { done: 0, total };
  const done = ONBOARDING_CHECKLIST_ITEMS.filter(
    (item) => Boolean(checklist[item.key])
  ).length;
  return { done, total };
}

/** Invite statuses (or timing=later) where admins may manually resend. */
const RESENDABLE_INVITE_STATUSES = new Set([
  "deferred",
  "failed",
  "skipped",
  "later",
  "sent",
]);

export function canResendEmployeeInvite(
  employee: Pick<Employee, "invitePreferences">
): boolean {
  const prefs = employee.invitePreferences;
  if (!prefs) return false;
  const status = String(prefs.inviteStatus || "").toLowerCase();
  const timing = String(prefs.timing || "").toLowerCase();
  return RESENDABLE_INVITE_STATUSES.has(status) || timing === "later";
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
