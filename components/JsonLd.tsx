"use client";

import { usePathname } from "next/navigation";

interface JsonLdProps {
  organizationData?: boolean;
  websiteData?: boolean;
  pageData?: boolean;
}

export function JsonLd({
  organizationData = true,
  websiteData = true,
  pageData = true,
}: JsonLdProps) {
  const pathname = usePathname();
  const baseUrl = "https://bqitech.com";

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BQI Tech",
    url: baseUrl,
    logo: `${baseUrl}/bqilogo.png`,
    sameAs: [
      "https://www.linkedin.com/company/bqi-technologies",
      // Add other social media URLs
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+254-11-229-5287",
      contactType: "customer service",
      email: "hr@bqitech.com",
      areaServed: "KE",
      availableLanguage: ["en"],
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BQI Tech",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target:
        "https://www.google.com/search?q=site:bqitech.com%20{search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const page = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "BQI Tech",
    description:
      "BQI Tech provides innovative solutions across industries to improve quality of life worldwide.",
    url: `${baseUrl}${pathname}`,
  };

  const partnership = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "BQI Tech Partnership Program",
    provider: {
      "@type": "Organization",
      name: "BQI Tech",
    },
    description:
      "Technology partnership program for government digital transformation solutions.",
    url: `${baseUrl}/about/backlinks`,
    areaServed: {
      "@type": "Country",
      name: "Kenya",
    },
  };

  // Derive BreadcrumbList from the current pathname
  const breadcrumb = (() => {
    const segments = (pathname || "/").split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const toTitle = (s: string) =>
      decodeURIComponent(s)
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const items = segments.map((seg, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: toTitle(seg),
      item: `${baseUrl}/${segments.slice(0, idx + 1).join("/")}`,
    }));
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    };
  })();

  return (
    <>
      {organizationData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
      )}
      {websiteData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
        />
      )}
      {pageData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(page) }}
        />
      )}
      {breadcrumb && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        />
      )}
      {pathname === "/about/backlinks" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(partnership) }}
        />
      )}
    </>
  );
}
