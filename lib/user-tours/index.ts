import { userApplicationsTour } from "./user-applications-tour";
import { userApplyTour } from "./user-apply-tour";
import { userJobsTour } from "./user-jobs-tour";
import { userOverviewTour } from "./user-overview-tour";
import { userSettingsTour } from "./user-settings-tour";
import type { TourDefinition } from "./types";

export const USER_TOURS: Record<string, TourDefinition> = {
  [userOverviewTour.id]: userOverviewTour,
  [userApplicationsTour.id]: userApplicationsTour,
  [userJobsTour.id]: userJobsTour,
  [userSettingsTour.id]: userSettingsTour,
  [userApplyTour.id]: userApplyTour,
};

export function getUserTourById(tourId: string): TourDefinition | undefined {
  return USER_TOURS[tourId];
}

export function getAllUserTours(): TourDefinition[] {
  return Object.values(USER_TOURS);
}

/** Map dashboard pathname to a user tour id. */
export function getUserTourIdForPath(pathname: string): string | undefined {
  if (pathname.includes("/dashboard/apply/")) return "user-apply";
  if (pathname.includes("/dashboard/applications")) return "user-applications";
  if (pathname.includes("/dashboard/jobs")) return "user-jobs";
  if (pathname.includes("/dashboard/settings")) return "user-settings";
  if (
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname.includes("/dashboard/overview")
  ) {
    return "user-overview";
  }
  return undefined;
}

export type { TourDefinition, TourStep, TourPlacement } from "./types";
