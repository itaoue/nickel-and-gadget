import { useState } from "react";
import { Redirect, useLocation, useParams, useSearch } from "wouter";
import Layout, { Card, Sidebar, usePageTitle } from "@/components/site/Layout";
import type { Article } from "@/lib/articles";
import { LATEST, categoryFromSlug, categorySlug, categoryUrl, searchArticles } from "@/lib/site";
import NotFound from "./NotFound";

function Archive({ title, description, items, search }: { title: string; description?: string; items: Article[]; search?: string }) {
  usePageTitle(title, description);
  const [, navigate] = useLocation();
  const [q, setQ] = useState(search ?? "");

  return (
    <Layout>
      <div className="mh-row">
        <section className="mh-content">
          <header className="archive-head">
            <h1>{title}</h1>
            {description && <p>{description}</p>}
            {search !== undefined && (
              <form
                className="search--inline"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/search?q=${encodeURIComponent(q.trim())}`);
                }}
              >
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" aria-label="Search" />
                <button className="btn" type="submit">Search</button>
              </form>
            )}
          </header>
          {items.length ? (
            <div className="list">
              {items.map((a) => <Card key={a.id} article={a} variant="row" />)}
            </div>
          ) : (
            <p className="empty">Nothing found. Try a different search.</p>
          )}
        </section>
        <Sidebar />
      </div>
    </Layout>
  );
}

/** /articles — everything, newest first. Old /articles?category=X links redirect to /category/x. */
export default function Articles() {
  const params = new URLSearchParams(useSearch());
  const legacy = params.get("category");
  if (legacy) {
    const c = categoryFromSlug(legacy.toLowerCase().replace(/\s+/g, "-"));
    if (c) return <Redirect to={categoryUrl(c)} replace />;
  }
  return <Archive title="Latest Articles" description="Every story from Nickel And Gadget, newest first." items={LATEST} />;
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const c = categoryFromSlug(slug);
  if (!c) return <NotFound />;
  if (categorySlug(c) !== slug) return <Redirect to={categoryUrl(c)} replace />;
  return (
    <Archive
      key={c}
      title={c}
      description={`Every ${c.toLowerCase()} story from Nickel And Gadget, newest first.`}
      items={LATEST.filter((a) => a.category === c)}
    />
  );
}

export function SearchPage() {
  const q = new URLSearchParams(useSearch()).get("q") ?? "";
  const results = searchArticles(q);
  return (
    <Archive
      key={q}
      title={q ? `Search: ${q}` : "Search"}
      description={q ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Search all Nickel And Gadget articles."}
      items={results}
      search={q}
    />
  );
}
