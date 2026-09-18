"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { SessionProvider } from "next-auth/react"
import { SettingsProvider } from "@/contexts/SettingsContext"
import { AdminPathProvider } from "@/contexts/AdminPathContext"
import { JsonLd } from '@/components/JsonLd'
import ClientLayout from "@/components/ClientLayout"
import CookieConsentBanner from '@/components/CookieConsentBanner'
import Script from 'next/script'
import Image from 'next/image'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `,
        }}
      />
      <SettingsProvider>
        <AdminPathProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
            <CookieConsentBanner />
          </SessionProvider>
          <ReactQueryDevtools initialIsOpen={false} />
          <JsonLd />
        </QueryClientProvider>
        </AdminPathProvider>
      </SettingsProvider>
    
    </>
  )
} 