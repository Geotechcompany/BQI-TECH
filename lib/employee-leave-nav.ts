/** Employee Time Off (leave) sub-routes — Calamari-style labels. */

export const EMPLOYEE_LEAVE_NAV = [
  { id: "apply", name: "Apply", href: "/employee/leave/apply" },
  { id: "calendar", name: "Calendar", href: "/employee/leave/calendar" },
  { id: "requests", name: "Requests", href: "/employee/leave/requests" },
  {
    id: "entitlement",
    name: "Entitlement",
    href: "/employee/leave/entitlement",
  },
] as const;

export type EmployeeLeaveNavId = (typeof EMPLOYEE_LEAVE_NAV)[number]["id"];

export function isEmployeeLeavePath(pathname: string): boolean {
  return pathname === "/employee/leave" || pathname.startsWith("/employee/leave/");
}

export function isEmployeeLeaveNavActive(
  pathname: string,
  href: string
): boolean {
  if (href === "/employee/leave/apply") {
    return (
      pathname === "/employee/leave" ||
      pathname === "/employee/leave/" ||
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
