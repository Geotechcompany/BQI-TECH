import { adminApiArticle } from "@/lib/help/articles/admin-api";
import { applicationFormsArticle } from "@/lib/help/articles/application-forms";
import { positionPipelineArticle } from "@/lib/help/articles/position-pipeline";
import { questionnairesArticle } from "@/lib/help/articles/questionnaires";
import {
  HelpArticle,
  HelpCollection,
  HelpTocItem,
} from "@/lib/help/types";

export { HELP_PATHS } from "@/lib/help/urls";
export type { HelpPathKey } from "@/lib/help/urls";
export type {
  HelpArticle,
  HelpBlock,
  HelpCollection,
  HelpTocItem,
} from "@/lib/help/types";

export const HELP_COLLECTIONS: HelpCollection[] = [
  {
    slug: "questionnaires",
    title: "Questionnaires",
    description:
      "Build custom questions, sections, branching, and email templates.",
    articleSlugs: ["questionnaires", "application-forms"],
  },
  {
    slug: "pipelines",
    title: "Pipelines",
    description: "Position stages, stage actions, and email sender settings.",
    articleSlugs: ["position-pipeline"],
  },
  {
    slug: "developers",
    title: "Developers",
    description: "Admin API reference for integrations.",
    articleSlugs: ["admin-api"],
  },
];

const ARTICLES: HelpArticle[] = [
  questionnairesArticle,
  applicationFormsArticle,
  positionPipelineArticle,
  adminApiArticle,
];

const articleByKey = new Map(
  ARTICLES.map((article) => [`${article.collection}/${article.slug}`, article])
);

export function getAllArticles(): HelpArticle[] {
  return ARTICLES;
}

export function getArticle(
  collection: string,
  slug: string
): HelpArticle | undefined {
  return articleByKey.get(`${collection}/${slug}`);
}

export function getCollection(slug: string): HelpCollection | undefined {
  return HELP_COLLECTIONS.find((collection) => collection.slug === slug);
}

export function getArticlesForCollection(slug: string): HelpArticle[] {
  const collection = getCollection(slug);
  if (!collection) return [];
  return collection.articleSlugs
    .map((articleSlug) => getArticle(slug, articleSlug))
    .filter((article): article is HelpArticle => Boolean(article));
}

export function searchArticles(query: string): HelpArticle[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ARTICLES;
  return ARTICLES.filter((article) => {
    const haystack = `${article.title} ${article.summary} ${article.intro}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function getArticleToc(article: HelpArticle): HelpTocItem[] {
  return article.blocks
    .filter(
      (block): block is Extract<(typeof article.blocks)[number], { type: "heading" }> =>
        block.type === "heading"
    )
    .map((block) => ({ id: block.id, text: block.text }));
}

export function formatHelpDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
