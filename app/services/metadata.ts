import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enterprise Platform Solutions, IT Consulting for Government | BQI Tech Kenya & USA',
  description: 'Explore BQI Tech’s government focused IT consulting, software development in Kenya and the U.S., and enterprise platform solutions. Reliable, scalable, and secure digital transformation for the public sector.',
  keywords: ['professional services', 'software development', 'implementation services', 'digital transformation', 'IT consulting'],
  openGraph: {
    title: 'Professional Services & Solutions | BQI Tech',
    description: 'Discover BQI Tech\'s comprehensive range of professional services including software development, implementation services, and digital transformation solutions.',
    images: [
      {
        // Using a professional stock image URL that represents tech services
        url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&h=630',
        width: 1200,
        height: 630,
        alt: 'BQI Tech Professional Services - Digital Transformation Solutions',
      },
    ],
    siteName: 'BQI Tech',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Professional Services & Solutions | BQI Tech',
    description: 'Discover BQI Tech\'s comprehensive range of professional services including software development, implementation services, and digital transformation solutions.',
    images: ['https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&h=630'],
    creator: '@BQITech',
  },
  alternates: {
    canonical: '<link rel= "canonical" href= "https://bqitech.com/services" />',
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
  },
};