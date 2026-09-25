import { publicAdminHref } from "@/lib/admin-path"
export const FINISH_SETUP_SKIPPED_KEY = "admin_finish_setup_skipped_v1";
export const FINISH_SETUP_MINIMIZED_KEY = "admin_finish_setup_minimized_v1";

export type FinishSetupTaskId = "add-position" | "invite-team" | "careers-site";

export interface FinishSetupTask {
  id: FinishSetupTaskId;
  title: string;
  description: string;
  href: string;
}

/** First-run hiring setup steps (no intro video). */
export const FINISH_SETUP_TASKS: FinishSetupTask[] = [
  {
    id: "add-position",
    title: "Add a Position",
    description: "You're here to hire someone right?",
    href: publicAdminHref("/manage/job-postings/wizard"),
  },
  {
    id: "invite-team",
    title: "Invite your Team",
    description: "Hiring is a team sport.",
    href: publicAdminHref("/manage/user-management"),
  },
  {
    id: "careers-site",
    title: "Setup your Careers Site",
    description: "Share your brand & culture.",
    href: publicAdminHref("/manage/job-postings"),
  },
];

export interface FinishSetupCompletion {
  "add-position": boolean;
  "invite-team": boolean;
  "careers-site": boolean;
}

export const EMPTY_FINISH_SETUP_COMPLETION: FinishSetupCompletion = {
  "add-position": false,
  "invite-team": false,
  "careers-site": false,
};

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable
  }
}

export function isFinishSetupSkipped(): boolean {
  return readFlag(FINISH_SETUP_SKIPPED_KEY);
}

export function skipFinishSetup(): void {
  writeFlag(FINISH_SETUP_SKIPPED_KEY, true);
}

export function isFinishSetupMinimized(): boolean {
  return readFlag(FINISH_SETUP_MINIMIZED_KEY);
}

export function setFinishSetupMinimized(minimized: boolean): void {
  writeFlag(FINISH_SETUP_MINIMIZED_KEY, minimized);
}

export function allFinishSetupTasksComplete(
  completion: FinishSetupCompletion
): boolean {
  return FINISH_SETUP_TASKS.every((task) => completion[task.id]);
}
