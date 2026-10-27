import { ARTICLES, getAllCategories, type Article, type Category } from "./articles";

export const SITE_NAME = "Nickel And Gadget";
export const SITE_TAGLINE = "Senior-friendly gadgets, explained";
export const CONTACT_EMAIL = "hello@nickelandgadget.com";

export const categorySlug = (c: Category) => c.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-");
export const categoryUrl = (c: Category) => `/category/${categorySlug(c)}`;
export const categoryFromSlug = (slug: string): Category | undefined =>
  getAllCategories().find((c) => categorySlug(c) === slug);
export const articleUrl = (a: Article) => `/articles/${a.slug}`;

/** Newest first. */
const ts = (a: Article) => Date.parse(a.publishedAt ?? a.date);
export const LATEST: Article[] = [...ARTICLES].sort((a, b) => ts(b) - ts(a));

/** Sidebar picks: the newest buying guide in each category. */
export const EDITOR_PICKS: Article[] = getAllCategories()
  .map((c) => LATEST.find((a) => a.category === c && a.products?.length))
  .filter(Boolean)
  .slice(0, 5) as Article[];

/** Amazon links carry the Associates tag when VITE_AMAZON_TAG is set at build time; other links are left alone. */
const AMAZON_TAG = import.meta.env.VITE_AMAZON_TAG as string | undefined;
export function productUrl(url: string): string {
  if (!AMAZON_TAG || !/^https:\/\/(www\.)?amazon\.com\//.test(url)) return url;
  const u = new URL(url);
  u.searchParams.set("tag", AMAZON_TAG);
  return u.toString();
}

export function searchArticles(q: string): Article[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return LATEST.filter((a) => {
    const hay = [a.title, a.subtitle, a.excerpt, a.category, a.author, ...a.tags].join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
