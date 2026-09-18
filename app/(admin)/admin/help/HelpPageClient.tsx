"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { HelpCenterHeader } from "@/components/admin/help/HelpCenterHeader";
import {
  HELP_COLLECTIONS,
  getArticlesForCollection,
  searchArticles,
} from "@/lib/help";
import { publicAdminHref } from "@/lib/admin-path";

export default function HelpPageClient() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const collectionFilter = searchParams.get("collection");
  const [query, setQuery] = useState(initialQuery);

  const filteredArticles = useMemo(() => {
    const results = searchArticles(query);
    if (!collectionFilter) return results;
    return results.filter((article) => article.collection === collectionFilter);
  }, [query, collectionFilter]);

  const activeCollection = HELP_COLLECTIONS.find(
    (collection) => collection.slug === collectionFilter
  );

  return (
    <AdminPageLayout title="Help" showSearch={false}>
      <div className="mx-auto max-w-5xl space-y-8 pb-16">
        <HelpCenterHeader
          initialQuery={initialQuery}
          onSearchChange={setQuery}
        />

        {query.trim() || activeCollection ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#272055]">
                  {query.trim()
                    ? `Results for "${query.trim()}"`
                    : activeCollection?.title}
                </h2>
                <p className="mt-1 text-sm text-[#272055]/65">
                  {filteredArticles.length} article
                  {filteredArticles.length === 1 ? "" : "s"}
                </p>
              </div>
              <Link
                href={publicAdminHref("/manage/help")}className="text-sm font-medium text-[#2563eb] hover:underline"
              >
                Clear filters
              </Link>
            </div>

            {filteredArticles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#272055]/15 px-4 py-10 text-center text-sm text-[#272055]/65">
                No articles match that search.
              </p>
            ) : (
              <ul className="divide-y divide-[#272055]/08 rounded-xl border border-[#272055]/10 bg-white">
                {filteredArticles.map((article) => (
                  <li key={article.path}>
                    <Link
                      href={article.path}
                      className="block px-5 py-4 transition-colors hover:bg-[#f7f8fb]"
                    >
                      <p className="font-medium text-[#272055]">
                        {article.title}
                      </p>
                      <p className="mt-1 text-sm text-[#272055]/65">
                        {article.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-[#272055]">
                All Collections
              </h2>
              <p className="mt-1 text-sm text-[#272055]/65">
                Guides for hiring workflows in BQI HR.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {HELP_COLLECTIONS.map((collection) => {
                const articles = getArticlesForCollection(collection.slug);
                return (
                  <div
                    key={collection.slug}
                    className="rounded-xl border border-[#272055]/10 bg-white p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#31CDFF]/15 text-[#272055]">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={publicAdminHref(`/manage/help?collection=${collection.slug}`)}
                          className="text-lg font-semibold text-[#272055] hover:text-[#2563eb]"
                        >
                          {collection.title}
                        </Link>
                        <p className="mt-1 text-sm text-[#272055]/65">
                          {collection.description}
                        </p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#272055]/45">
                          {articles.length} article
                          {articles.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2 border-t border-[#272055]/08 pt-4">
                      {articles.map((article) => (
                        <li key={article.path}>
                          <Link
                            href={article.path}
                            className="text-sm font-medium text-[#2563eb] hover:underline"
                          >
                            {article.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AdminPageLayout>
  );
}
