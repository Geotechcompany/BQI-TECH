export function formatAdminRoleLabel(role?: string): string {
  const upper = String(role || "USER")
    .trim()
    .toUpperCase();
  if (upper === "SUPER_ADMIN") return "Super Admin";
  if (upper === "ADMIN") return "Administrator";
  return "User";
}

export function isAdminRoleLabel(role?: string): boolean {
  const upper = String(role || "")
    .trim()
    .toUpperCase();
  return upper === "ADMIN" || upper === "SUPER_ADMIN";
}
