"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Exclude header/footer from auth / portal shells (match user login full-bleed look)
  const isAuthPage = [
    "/login",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/auth/verify-email",
    "/employee",
  ].some((path) => pathname?.startsWith(path));
  const isAdminPage = pathname?.startsWith("/admin");
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
