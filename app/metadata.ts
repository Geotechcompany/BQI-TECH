import { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL('https://bqitech.com'),
  title: 'BQI Tech | Government IT Solutions & Software Development',
  description:
    'BQI Tech delivers secure software, enterprise platforms, and IT consulting for government and the public sector.',
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