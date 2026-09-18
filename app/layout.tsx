import "@fontsource/inter/latin.css";
import type { Viewport } from "next";
import { ReactNode } from "react";
import { AppToaster } from "@/components/ui/app-toaster";
import ClientWrapper from "./ClientWrapper";
import "./globals.css";
import { Providers } from "./providers";
import ThinkStackScriptLoader from "./ThinkStackScriptLoader";

export { metadata } from "./metadata";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#272156" },
    { media: "(prefers-color-scheme: dark)", color: "#272156" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

const interFontFamily =
  "'Inter', system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ fontFamily: interFontFamily }} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#272156" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BQI Tech" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <ThinkStackScriptLoader />
          <ClientWrapper>{children}</ClientWrapper>
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
