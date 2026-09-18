import type { Employee } from "@/types/employee";
import {
  getMissingDocumentCategories,
  getMissingProfileFields,
} from "@/lib/employee-portal-completeness";

export const EMPLOYEE_QS_SKIPPED_KEY = "employee_quick_start_skipped_v1";
export const EMPLOYEE_QS_MINIMIZED_KEY = "employee_quick_start_minimized_v1";
export const EMPLOYEE_QS_WELCOME_DISMISSED_KEY =
  "employee_quick_start_welcome_v1";
export const EMPLOYEE_QS_LEAVE_SEEN_KEY = "employee_quick_start_leave_seen_v1";
export const EMPLOYEE_QS_SETTINGS_SEEN_KEY =
  "employee_quick_start_settings_seen_v1";

export type EmployeeQuickStartTaskId =
  | "complete-profile"
  | "upload-documents"
  | "review-leave"
  | "check-settings";

export interface EmployeeQuickStartTask {
  id: EmployeeQuickStartTaskId;
  title: string;
  description: string;
  href: string;
}

/** First-run employee orientation steps. */
export const EMPLOYEE_QUICK_START_TASKS: EmployeeQuickStartTask[] = [
  {
    id: "complete-profile",
    title: "Complete your profile",
    description: "Phone, address, and emergency contact.",
    href: "/employee/profile",
  },
  {
    id: "upload-documents",
    title: "Upload missing documents",
    description: "National ID, CV, and other required files.",
    href: "/employee/documents",
  },
  {
    id: "review-leave",
    title: "Review leave balances",
    description: "See remaining days and past requests.",
    href: "/employee/leave/entitlement",
  },
  {
    id: "check-settings",
    title: "Check password settings",
    description: "Confirm you can sign in with your own password.",
    href: "/employee/settings",
  },
];

export interface EmployeeQuickStartCompletion {
  "complete-profile": boolean;
  "upload-documents": boolean;
  "review-leave": boolean;
  "check-settings": boolean;
}

export const EMPTY_EMPLOYEE_QUICK_START_COMPLETION: EmployeeQuickStartCompletion =
  {
    "complete-profile": false,
    "upload-documents": false,
    "review-leave": false,
    "check-settings": false,
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

/** Same-tab signal so the floating checklist refreshes after a visit flag flips. */
export const EMPLOYEE_QUICK_START_UPDATED_EVENT =
  "employee-quick-start-updated";

function notifyQuickStartUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EMPLOYEE_QUICK_START_UPDATED_EVENT));
}

export function isEmployeeQuickStartSkipped(): boolean {
  return readFlag(EMPLOYEE_QS_SKIPPED_KEY);
}

export function skipEmployeeQuickStart(): void {
  writeFlag(EMPLOYEE_QS_SKIPPED_KEY, true);
  notifyQuickStartUpdated();
}

export function isEmployeeQuickStartMinimized(): boolean {
  return readFlag(EMPLOYEE_QS_MINIMIZED_KEY);
}

export function setEmployeeQuickStartMinimized(minimized: boolean): void {
  writeFlag(EMPLOYEE_QS_MINIMIZED_KEY, minimized);
}

export function isEmployeeQuickStartWelcomeDismissed(): boolean {
  return readFlag(EMPLOYEE_QS_WELCOME_DISMISSED_KEY);
}

export function dismissEmployeeQuickStartWelcome(): void {
  writeFlag(EMPLOYEE_QS_WELCOME_DISMISSED_KEY, true);
}

export function markEmployeeLeaveSeen(): void {
  writeFlag(EMPLOYEE_QS_LEAVE_SEEN_KEY, true);
  notifyQuickStartUpdated();
}

export function markEmployeeSettingsSeen(): void {
  writeFlag(EMPLOYEE_QS_SETTINGS_SEEN_KEY, true);
  notifyQuickStartUpdated();
}

export function isEmployeeLeaveSeen(): boolean {
  return readFlag(EMPLOYEE_QS_LEAVE_SEEN_KEY);
}

export function isEmployeeSettingsSeen(): boolean {
  return readFlag(EMPLOYEE_QS_SETTINGS_SEEN_KEY);
}

export function getEmployeeQuickStartCompletion(
  employee: Employee
): EmployeeQuickStartCompletion {
  const docs = employee.documents || [];
  return {
    "complete-profile": getMissingProfileFields(employee).length === 0,
    "upload-documents": getMissingDocumentCategories(docs).length === 0,
    "review-leave": isEmployeeLeaveSeen(),
    "check-settings": isEmployeeSettingsSeen(),
  };
}

export function allEmployeeQuickStartTasksComplete(
  completion: EmployeeQuickStartCompletion
): boolean {
  return EMPLOYEE_QUICK_START_TASKS.every((task) => completion[task.id]);
}
