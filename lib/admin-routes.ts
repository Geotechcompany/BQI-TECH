export function isAdminLoginRoute(pathname: string | null): boolean {
  return Boolean(pathname?.includes("/login"));
}

export function isJobWizardAdminRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/job-postings/wizard") ||
    /\/job-postings\/[^/]+\/wizard/.test(pathname)
  );
}

export function isEmployeeWizardAdminRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/employees/new") ||
    pathname.includes("/employees/wizard")
  );
}

export function isBlogWizardAdminRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/blog-management/wizard") ||
    /\/blog-management\/[^/]+\/wizard/.test(pathname)
  );
}

export function isCandidateProfileAdminRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /\/admin\/jobs\/[^/]+\/candidates\/[^/]+$/.test(pathname);
}

/** Login only — no admin chrome and no app providers. */
export function isBareFullscreenAdminRoute(pathname: string | null): boolean {
  return isAdminLoginRoute(pathname);
}

export function isFullscreenAdminRoute(pathname: string | null): boolean {
  return (
    isBareFullscreenAdminRoute(pathname) ||
    isJobWizardAdminRoute(pathname) ||
    isBlogWizardAdminRoute(pathname) ||
    isEmployeeWizardAdminRoute(pathname) ||
    isCandidateProfileAdminRoute(pathname)
  );
}
