import type { Application } from "@/types/application";
import type { AiRankRequirement } from "@/types/application";
import { getAnswerByKeywords } from "@/components/admin/utils/table-utils";

export function getApplicationAnswer(
  answers: Application["answers"],
  question: string
): string {
  if (!answers || !Array.isArray(answers)) return "";

  return (
    answers.find((entry) =>
      entry?.questionText?.toLowerCase().includes(question.toLowerCase())
    )?.answer || ""
  );
}

export function isLikelyUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    if (value.startsWith("www.")) return true;
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isResumeQuestion(text: unknown): boolean {
  const question = (typeof text === "string" ? text : "").toLowerCase();
  return (
    question.includes("upload resume") ||
    question.includes("resume/cv") ||
    question.includes("cv")
  );
}

export function getExperienceDisplay(application: Application): string {
  if (application.experience?.trim()) {
    return application.experience.trim();
  }

  const fromAnswers = getAnswerByKeywords(application.answers || [], [
    "experience",
    "years of experience",
    "work history",
    "background",
    "employment",
  ]);

  return fromAnswers.trim();
}

export function looksLikeMongoObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value.trim());
}

export function getAddedByDisplay(application: Application): string | null {
  const history = application.statusHistory;
  if (!history?.length) return null;

  const readable = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || looksLikeMongoObjectId(trimmed)) return null;
    return trimmed;
  };

  const withAuthor = history.find((entry) => readable(entry.changedBy));
  if (withAuthor?.changedBy) return readable(withAuthor.changedBy);

  const earliest = [...history]
    .filter((entry) => entry.date)
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0];

  return readable(earliest?.changedBy) || null;
}

export function aiMatchLabel(match: AiRankRequirement["match"]): string {
  const labels: Record<AiRankRequirement["match"], string> = {
    full: "Met",
    partial: "Partial",
    weak: "Weak",
    none: "Missing",
    unknown: "Not evidenced",
  };
  return labels[match] ?? match;
}

export function aiMatchBadgeClass(match: AiRankRequirement["match"]): string {
  const styles: Record<AiRankRequirement["match"], string> = {
    full: "bg-emerald-100 text-emerald-800 border-emerald-200",
    partial: "bg-amber-100 text-amber-800 border-amber-200",
    weak: "bg-orange-100 text-orange-800 border-orange-200",
    none: "bg-red-100 text-red-800 border-red-200",
    unknown: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return styles[match] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

export function sortSiblingApplications(
  applications: Application[]
): Application[] {
  return [...applications].sort((a, b) => {
    const dateA = a.appliedDate ? new Date(a.appliedDate).getTime() : 0;
    const dateB = b.appliedDate ? new Date(b.appliedDate).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return (a.id || "").localeCompare(b.id || "");
  });
}

export function getCandidateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export const CANDIDATE_NOTES_KEY = (applicationId: string) =>
  `candidate-notes-${applicationId}`;

export const CANDIDATE_QUICK_NOTE_KEY = (applicationId: string) =>
  `candidate-quick-note-${applicationId}`;
