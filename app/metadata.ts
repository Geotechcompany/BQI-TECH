import { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL('https://bqitech.com'),
  title: 'BQI Tech | Government IT Solutions & Software Development',
  description:
    'BQI Tech delivers secure software, enterprise platforms, and IT consulting for government and the public sector.',
  applicationName: 'BQI HR SOFTWARE',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BQI HR SOFTWARE',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1
    },
  }
}
