"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAdminPath } from "@/contexts/AdminPathContext";
import {
  DEFAULT_ADMIN_BASE,
  isPublicAdminPath,
} from "@/lib/admin-path";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { basePath: publicAdminBase } = useAdminPath();

  // Exclude header/footer from auth / portal shells (match user login full-bleed look)
  const isAuthPage = [
    "/login",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/auth/verify-email",
    "/employee",
  ].some((path) => pathname?.startsWith(path));
  // Browser URL may be `/admin/...` or a rewritten custom slug (e.g. `/manage/...`)
  const isAdminPage = Boolean(
    pathname &&
      (isPublicAdminPath(pathname, DEFAULT_ADMIN_BASE) ||
        isPublicAdminPath(pathname, publicAdminBase))
  );
  const isDashboardPage = pathname?.startsWith("/dashboard");
  const shouldHideHeaderFooter = isAuthPage || isAdminPage || isDashboardPage;

  return (
    <div className="min-h-screen flex flex-col">
      {shouldHideHeaderFooter ? null : <Header />}
      <main className="flex-grow">{children}</main>
      {shouldHideHeaderFooter ? null : <Footer />}
    </div>
  );
}
