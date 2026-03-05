import { MetadataRoute } from "next";
import { APP_URL, BACKEND_URL } from "@/lib/config";

type BlogSitemapPost = {
  slug?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = APP_URL;

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/about",
    "/services",
    "/contact-us",
    "/blog",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }));

  const blogRoutes: MetadataRoute.Sitemap = [];

  try {
    const pageSize = 100;
    let fetched = 0;
    let total = 0;
    let page = 0;

    do {
      const skip = page * pageSize;
      const response = await fetch(
        `${BACKEND_URL}/api/blog?limit=${pageSize}&skip=${skip}`,
        {
          // Cache sitemap data but keep it reasonably fresh
          next: { revalidate: 60 * 10 },
        }
      );

      if (!response.ok) {
        break;
      }

      const data: {
        posts: BlogSitemapPost[];
        total?: number;
      } = await response.json();

      const posts = data.posts ?? [];
      total = data.total ?? posts.length;
      fetched += posts.length;

      for (const post of posts) {
        if (!post.slug) continue;

        const lastModified =
          post.updatedAt || post.publishedAt || post.createdAt;

        blogRoutes.push({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: lastModified ? new Date(lastModified) : new Date(),
        });
      }

      if (!posts.length) {
        break;
      }

      page += 1;
    } while (fetched < total);
  } catch {
    // Fail silently – static routes will still be served
  }

  return [...staticRoutes, ...blogRoutes];
}

