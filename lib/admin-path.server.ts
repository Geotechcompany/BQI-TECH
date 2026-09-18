import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_PATH_COOKIE,
  DEFAULT_ADMIN_BASE,
  adminHref,
  parseAdminBaseCookieValue,
} from "@/lib/admin-path";

/** Active public admin base from the `bqi_admin_base` cookie (App Router). */
export function getServerPublicAdminBase(): string {
  const raw = cookies().get(ADMIN_PATH_COOKIE)?.value;
  return parseAdminBaseCookieValue(raw) ?? DEFAULT_ADMIN_BASE;
}

/** Server redirect to a path under the active public admin base. */
export function redirectAdmin(path: string): never {
  redirect(adminHref(path, getServerPublicAdminBase()));
}
