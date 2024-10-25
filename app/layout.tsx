"use client";

import { usePathname } from 'next/navigation';
import localFont from "next/font/local";
import "./globals.css";
import "./clerk-overrides.css"; // Add this line
import ClientLayout from "@/components/ClientLayout";
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { ClerkProvider } from '@clerk/nextjs';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const isDashboardRoute = pathname?.startsWith('/dashboard');

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <ClerkProvider>
        {isAdminRoute || isDashboardRoute ? (
          <body>{children}</body>
        ) : (
          <ClientLayout>
            {children}
            <CookieConsentBanner />
          </ClientLayout>
        )}
      </ClerkProvider>
    </html>
  );
}
