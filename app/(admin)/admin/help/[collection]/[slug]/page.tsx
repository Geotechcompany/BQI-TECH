import { notFound } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { HelpArticleView } from "@/components/admin/help/HelpArticleView";
import { HelpCenterHeader } from "@/components/admin/help/HelpCenterHeader";
import { getAllArticles, getArticle } from "@/lib/help";

interface HelpArticlePageProps {
  params: { collection: string; slug: string };
}

export function generateStaticParams() {
  return getAllArticles().map((article) => ({
    collection: article.collection,
    slug: article.slug,
  }));
}

export function generateMetadata({ params }: HelpArticlePageProps) {
  const article = getArticle(params.collection, params.slug);
  if (!article) {
    return { title: "Article not found | BQI HR Help" };
  }
  return {
    title: `${article.title} | BQI HR Help`,
    description: article.summary,
  };
}

export default function HelpArticlePage({ params }: HelpArticlePageProps) {
  const article = getArticle(params.collection, params.slug);
  if (!article) notFound();

  return (
    <AdminPageLayout title="Help" showSearch={false}>
      <div className="mx-auto max-w-5xl pb-16">
        <HelpCenterHeader />
        <HelpArticleView article={article} />
      </div>
    </AdminPageLayout>
  );
}
