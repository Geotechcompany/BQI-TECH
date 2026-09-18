import { HelpArticle } from "@/lib/help/types";
import {
  formatHelpDate,
  getArticleToc,
  getCollection,
} from "@/lib/help";
import { HelpBlockRenderer } from "@/components/admin/help/HelpBlockRenderer";
import { HelpBreadcrumbs } from "@/components/admin/help/HelpBreadcrumbs";
import { HelpHashScroll } from "@/components/admin/help/HelpHashScroll";
import { HelpToc } from "@/components/admin/help/HelpToc";

interface HelpArticleViewProps {
  article: HelpArticle;
}

export function HelpArticleView({ article }: HelpArticleViewProps) {
  const toc = getArticleToc(article);
  const collection = getCollection(article.collection);

  return (
    <div className="mt-8">
      <HelpHashScroll />
      <HelpBreadcrumbs
        items={[
          { label: "All Collections", href: "/manage/help" },
          {
            label: collection?.title ?? article.collection,
            href: `/manage/help?collection=${article.collection}`,
          },
          { label: article.title },
        ]}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-[#272055] sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-[#272055]/75">
            {article.summary}
          </p>
          <p className="mt-4 text-sm text-[#272055]/55">
            Written by {article.author}
            <span className="mx-2 text-[#272055]/25" aria-hidden>
              ·
            </span>
            Updated {formatHelpDate(article.updatedAt)}
          </p>

          <div className="mt-8 space-y-6">
            <p className="text-[15px] leading-7 text-[#272055]/90">
              {article.intro}
            </p>

            {toc.length > 0 ? (
              <div className="lg:hidden">
                <HelpToc items={toc} variant="inline" />
              </div>
            ) : null}

            <HelpBlockRenderer blocks={article.blocks} />
          </div>
        </article>

        <aside className="min-w-0">
          <HelpToc items={toc} variant="sidebar" />
        </aside>
      </div>
    </div>
  );
}
