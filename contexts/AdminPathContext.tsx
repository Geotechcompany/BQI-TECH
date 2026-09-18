"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi } from "@/lib/api-backend";
import {
  ADMIN_PATH_COOKIE,
  DEFAULT_ADMIN_BASE,
  INTERNAL_ADMIN_BASE,
  adminHref as buildAdminHref,
  clearAdminBasePathCookie,
  getPublicAdminBasePath,
  isInternalAdminPath,
  isPublicAdminPath,
  isValidAdminPathSlug,
  normalizeAdminPathSlug,
  readAdminBasePathCookie,
  toCanonicalAdminPath,
  toInternalAdminPath,
  writeAdminBasePathCookie,
  type AdminPathConfig,
} from "@/lib/admin-path";

type AdminPathContextValue = {
  basePath: string;
  isHidden: boolean;
  slug: string | null;
  isLoading: boolean;
  adminHref: (path?: string) => string;
  toInternal: (pathname: string) => string;
  toCanonical: (pathname: string) => string;
  refresh: () => Promise<void>;
  applyConfig: (config: Partial<AdminPathConfig>) => void;
};

const AdminPathContext = createContext<AdminPathContextValue | undefined>(
  undefined
);

function configFromPayload(payload: any): AdminPathConfig {
  return {
    admin_path_hidden: Boolean(payload?.admin_path_hidden),
    admin_path_slug: normalizeAdminPathSlug(payload?.admin_path_slug),
  };
}

export function AdminPathProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [config, setConfig] = useState<AdminPathConfig>(() => {
    const cookieBase = readAdminBasePathCookie();
    if (cookieBase && cookieBase !== DEFAULT_ADMIN_BASE) {
      const slug = cookieBase.slice(1);
      if (isValidAdminPathSlug(slug)) {
        return { admin_path_hidden: true, admin_path_slug: slug };
      }
    }
    return { admin_path_hidden: false, admin_path_slug: null };
  });
  const [isLoading, setIsLoading] = useState(false);

  const basePath = useMemo(() => getPublicAdminBasePath(config), [config]);
  const isHidden = basePath !== DEFAULT_ADMIN_BASE;
  const slug = isHidden ? normalizeAdminPathSlug(config.admin_path_slug) : null;

  const applyConfig = useCallback((next: Partial<AdminPathConfig>) => {
    setConfig((prev) => {
      const merged: AdminPathConfig = {
        admin_path_hidden:
          next.admin_path_hidden !== undefined
            ? Boolean(next.admin_path_hidden)
            : prev.admin_path_hidden,
        admin_path_slug:
          next.admin_path_slug !== undefined
            ? normalizeAdminPathSlug(next.admin_path_slug)
            : prev.admin_path_slug,
      };
      const publicBase = getPublicAdminBasePath(merged);
      if (publicBase === DEFAULT_ADMIN_BASE) {
        clearAdminBasePathCookie();
      } else {
        writeAdminBasePathCookie(publicBase);
      }
      return merged;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return;
    setIsLoading(true);
    try {
      const response = await adminApi.getSettings();
      const payload = (response as any)?.settings ?? response;
      applyConfig(configFromPayload(payload));
    } catch (error) {
      console.error("Failed to load admin path settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [applyConfig, isAdmin, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      void refresh();
    }
  }, [isAuthenticated, isAdmin, refresh]);

  // Infer base from the current URL when middleware rewrote a custom slug.
  useEffect(() => {
    if (!pathname) return;
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0];
    const internalSeg = INTERNAL_ADMIN_BASE.replace(/^\//, "");
    const defaultSeg = DEFAULT_ADMIN_BASE.replace(/^\//, "");
    if (
      first &&
      first !== internalSeg &&
      first !== defaultSeg &&
      isValidAdminPathSlug(first) &&
      (pathname.includes("/login") ||
        pathname.includes("/overview") ||
        pathname.includes("/settings") ||
        document.cookie.includes(ADMIN_PATH_COOKIE))
    ) {
      // Only promote inferred slug when cookie already marks a custom base,
      // or we are clearly on an admin surface under a non-reserved first segment
      // that middleware allowed (cookie set by middleware on rewrite).
      const cookieBase = readAdminBasePathCookie();
      if (cookieBase === `/${first}`) {
        applyConfig({ admin_path_hidden: true, admin_path_slug: first });
      }
    }
  }, [pathname, applyConfig]);

  const adminHref = useCallback(
    (path: string = "") => buildAdminHref(path, basePath),
    [basePath]
  );

  const toInternal = useCallback(
    (path: string) => toInternalAdminPath(path, basePath),
    [basePath]
  );

  const toCanonical = useCallback(
    (path: string) => toCanonicalAdminPath(path, basePath),
    [basePath]
  );

  // Remap stale /admin (internal) or /manage links when the live public base differs.
  useEffect(() => {
    if (basePath === DEFAULT_ADMIN_BASE && !isHidden) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("http") || hrefAttr.startsWith("//")) {
        return;
      }

      try {
        const url = new URL(hrefAttr, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const isStaleInternal = isInternalAdminPath(url.pathname);
        const isStaleDefault =
          basePath !== DEFAULT_ADMIN_BASE &&
          isPublicAdminPath(url.pathname, DEFAULT_ADMIN_BASE);
        if (!isStaleInternal && !isStaleDefault) return;
        if (isPublicAdminPath(url.pathname, basePath)) return;

        event.preventDefault();
        const nextPath = buildAdminHref(url.pathname, basePath);
        const next = `${nextPath}${url.search}${url.hash}`;
        router.push(next);
      } catch {
        // ignore invalid hrefs
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [basePath, isHidden, router]);

  const value = useMemo<AdminPathContextValue>(
    () => ({
      basePath,
      isHidden,
      slug,
      isLoading,
      adminHref,
      toInternal,
      toCanonical,
      refresh,
      applyConfig,
    }),
    [
      adminHref,
      applyConfig,
      basePath,
      isHidden,
      isLoading,
      refresh,
      slug,
      toCanonical,
      toInternal,
    ]
  );

  return (
    <AdminPathContext.Provider value={value}>
      {children}
    </AdminPathContext.Provider>
  );
}

export function useAdminPath() {
  const ctx = useContext(AdminPathContext);
  if (!ctx) {
    // Safe fallback when provider is missing (e.g. isolated stories).
    const fallbackBase = readAdminBasePathCookie() || DEFAULT_ADMIN_BASE;
    return {
      basePath: fallbackBase,
      isHidden: false,
      slug: null,
      isLoading: false,
      adminHref: (path: string = "") => buildAdminHref(path, fallbackBase),
      toInternal: (path: string) =>
        toInternalAdminPath(path, fallbackBase),
      toCanonical: (path: string) =>
        toCanonicalAdminPath(path, fallbackBase),
      refresh: async () => {},
      applyConfig: () => {},
    } satisfies AdminPathContextValue;
  }
  return ctx;
}
