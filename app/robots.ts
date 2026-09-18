import { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://bqitech.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/manage/*",
          "/api/*",
          "/dashboard/*",
          "/*.json",
          "/*.xml",
          "/private/*",
          "/temp/*",
          "/draft/*",
        ],
      },
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}