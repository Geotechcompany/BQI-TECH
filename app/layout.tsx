import { Inter } from "next/font/google";
import ClientWrapper from "./ClientWrapper";
import "./globals.css";
import { ReactNode } from "react";

export { metadata } from "./metadata";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import { Providers } from "./providers";
import ThinkStackScriptLoader from "./ThinkStackScriptLoader";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <ThinkStackScriptLoader />
          <ClientWrapper>{children}</ClientWrapper>
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
