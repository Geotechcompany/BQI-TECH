const STORAGE_PREFIX = "bqi-tour";
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function getTourStorageKey(
  tourId: string,
  type: "dismissed" | "snoozed"
): string {
  return `${STORAGE_PREFIX}-${tourId}-${type}`;
}

export function dismissTour(tourId: string): void {
  try {
    localStorage.setItem(getTourStorageKey(tourId, "dismissed"), "true");
    localStorage.removeItem(getTourStorageKey(tourId, "snoozed"));
  } catch {
    // localStorage may be unavailable
  }
}

export function snoozeTour(tourId: string): void {
  try {
    localStorage.setItem(
      getTourStorageKey(tourId, "snoozed"),
      String(Date.now())
    );
  } catch {
    // localStorage may be unavailable
  }
}

export function isTourDismissed(tourId: string): boolean {
  try {
    return localStorage.getItem(getTourStorageKey(tourId, "dismissed")) === "true";
  } catch {
    return false;
  }
}

export function isTourSnoozed(tourId: string): boolean {
  try {
    const raw = localStorage.getItem(getTourStorageKey(tourId, "snoozed"));
    if (!raw) return false;

    const snoozedAt = Number(raw);
    if (Number.isNaN(snoozedAt)) return false;

    if (Date.now() - snoozedAt >= SNOOZE_DURATION_MS) {
      localStorage.removeItem(getTourStorageKey(tourId, "snoozed"));
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function clearTourPreferences(tourId: string): void {
  try {
    localStorage.removeItem(getTourStorageKey(tourId, "dismissed"));
    localStorage.removeItem(getTourStorageKey(tourId, "snoozed"));
  } catch {
    // localStorage may be unavailable
  }
}
