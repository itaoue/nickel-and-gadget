/* ============================================================
   ARTICLES DATA — Nickel And Gadget
   Hand-written articles live in ../content/seed-articles.json; the daily
   pipeline (tools/write_articles.py) adds one JSON file per article to
   ../content/articles/.
   ============================================================ */
import SEED from "../content/seed-articles.json";

export type Category = "Health & Safety" | "Smart Home" | "Phones & Tablets" | "Hearing & Vision" | "Home & Kitchen" | "Gift Ideas";

export interface ArticleSection {
  type: "paragraph" | "heading" | "subheading" | "quote" | "callout" | "list" | "divider" | "products";
  content?: string;
  items?: string[];
  label?: string; // for callout
}

/** A gadget named in a guide; rendered as a pick card where the article has a {"type": "products"} block. */
export interface Product {
  name: string;
  maker: string;
  /** As published by the seller, with its date, e.g. "About $199 (list price, October 2026)". */
  price: string;
  url: string;
  blurb: string;
}

export interface Article {
  id: string;
  slug: string;
  category: Category;
  title: string;
  subtitle: string;
  excerpt: string;
  author: string;
  authorRole: string;
  date: string;
  readTime: string;
  image: string;
  tags: string[];
  sections: ArticleSection[];
  relatedIds: string[];
  /** ISO timestamp; when set, same-day stories sort newest first. */
  publishedAt?: string;
  sources?: { label: string; url: string }[];
  products?: Product[];
}

const PIPELINE_ARTICLES = Object.values(
  import.meta.glob<Article>("../content/articles/*.json", { eager: true, import: "default" }),
);

export const ARTICLES: Article[] = [...(SEED as Article[]), ...PIPELINE_ARTICLES];

// ─── Helper Functions ─────────────────────────────────────────

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getArticlesByCategory(category: Category): Article[] {
  return ARTICLES.filter((a) => a.category === category);
}

export function getRelatedArticles(article: Article): Article[] {
  return article.relatedIds
    .map((id) => ARTICLES.find((a) => a.id === id))
    .filter(Boolean) as Article[];
}

export function getAllCategories(): Category[] {
  return ["Health & Safety", "Smart Home", "Phones & Tablets", "Hearing & Vision", "Home & Kitchen", "Gift Ideas"];
}
