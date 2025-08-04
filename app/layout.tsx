"use client";
import { Inter } from "next/font/google"
import ClientWrapper from './ClientWrapper'
import "./globals.css"
import { ReactNode, useEffect } from 'react'
import { metadata } from './metadata'
import { usePathname } from 'next/navigation'
import { Toaster } from "react-hot-toast"
import { Toaster as SonnerToaster } from 'sonner'
import { Providers } from './providers'
import Script from 'next/script'

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  useEffect(() => {
    // Dynamically load ThinkStack AI script
    const loadThinkStackScript = () => {
      return new Promise<void>((resolve, reject) => {
        // Check if script is already loaded
        if (document.querySelector('script[src="https://app.thinkstack.ai/bot/thinkstackai-loader.min.js"]')) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://app.thinkstack.ai/bot/thinkstackai-loader.min.js';
        script.setAttribute('chatbot_id', '67334193bde936bef06b2d4a');
        script.setAttribute('data-type', 'default');
        script.async = true;
        
        script.onload = () => {
          // Attempt to initialize the chatbot
          try {
            // @ts-ignore
            if (window.ThinkStackAI) {
              // @ts-ignore
              window.ThinkStackAI.init({
                chatbotId: '67334193bde936bef06b2d4a'
              });
            }
          } catch (initError) {
            console.error('Failed to initialize ThinkStack AI', initError);
          }
          
          resolve();
        };
        
        script.onerror = (error) => {
          console.error('Failed to load ThinkStack AI script', error);
          reject(error);
        };

        document.head.appendChild(script);
      });
    };

    // Attempt to load the script with error handling
    loadThinkStackScript().catch((error) => {
      console.warn('Could not load ThinkStack AI chatbot', error);
    });

    return () => {
      // Cleanup if necessary
      const existingScript = document.head.querySelector('script[src="https://app.thinkstack.ai/bot/thinkstackai-loader.min.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <link 
          rel="preload" 
          href="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" 
          as="script"
        />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <ClientWrapper>
            {children}
          </ClientWrapper>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}

