export type HelpBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; id: string; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "callout"; title?: string; text: string }
  | {
      type: "rich";
      parts: Array<
        | { kind: "text"; text: string }
        | { kind: "link"; href: string; label: string }
        | { kind: "code"; text: string }
      >;
    };

export interface HelpArticleMeta {
  slug: string;
  collection: string;
  title: string;
  summary: string;
  author: string;
  updatedAt: string;
  /** Friendly path for Learn More links */
  path: string;
}

export interface HelpArticle extends HelpArticleMeta {
  intro: string;
  blocks: HelpBlock[];
}

export interface HelpCollection {
  slug: string;
  title: string;
  description: string;
  articleSlugs: string[];
}

export interface HelpTocItem {
  id: string;
  text: string;
}
