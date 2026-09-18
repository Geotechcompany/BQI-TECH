import { employeeDocumentsTour } from "./employee-documents-tour";
import { employeeLeaveTour } from "./employee-leave-tour";
import { employeeOverviewTour } from "./employee-overview-tour";
import { employeeProfileTour } from "./employee-profile-tour";
import { employeeSettingsTour } from "./employee-settings-tour";
import type { TourDefinition } from "@/lib/admin-tours/types";

export const EMPLOYEE_TOURS: Record<string, TourDefinition> = {
  [employeeOverviewTour.id]: employeeOverviewTour,
  [employeeProfileTour.id]: employeeProfileTour,
  [employeeLeaveTour.id]: employeeLeaveTour,
  [employeeDocumentsTour.id]: employeeDocumentsTour,
  [employeeSettingsTour.id]: employeeSettingsTour,
};

export function getEmployeeTourById(
  tourId: string
): TourDefinition | undefined {
  return EMPLOYEE_TOURS[tourId];
}

export function getAllEmployeeTours(): TourDefinition[] {
  return Object.values(EMPLOYEE_TOURS);
}

/** Map employee portal pathname to a tour id. */
export function getEmployeeTourIdForPath(pathname: string): string | undefined {
  if (pathname.startsWith("/employee/profile")) return "employee-profile";
  if (pathname.startsWith("/employee/leave")) return "employee-leave";
  if (pathname.startsWith("/employee/documents")) return "employee-documents";
  if (pathname.startsWith("/employee/settings")) return "employee-settings";
  if (pathname === "/employee" || pathname === "/employee/") {
    return "employee-overview";
  }
  return undefined;
}

export type { TourDefinition } from "@/lib/admin-tours/types";
