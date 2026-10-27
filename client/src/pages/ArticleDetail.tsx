import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import Layout, { Card, Sidebar, SubscribeForm, usePageTitle } from "@/components/site/Layout";
import { getArticleBySlug, getRelatedArticles, type ArticleSection, type Product } from "@/lib/articles";
import { LATEST, articleUrl, categoryUrl, initials, productUrl } from "@/lib/site";
import NotFound from "./NotFound";

function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <div className="reading-progress" style={{ width: `${progress}%` }} />;
}

function Picks({ products }: { products: Product[] }) {
  return (
    <div className="picks">
      <h3 className="picks__title">Products in this guide</h3>
      {products.map((p, i) => (
        <div className="pick" key={p.url + i}>
          <span className="pick__num" aria-hidden="true">{i + 1}</span>
          <div>
            <span className="pick__maker">{p.maker}</span>
            <p className="pick__name">{p.name}</p>
            <p className="pick__blurb">{p.blurb}</p>
            <span className="pick__price">{p.price}</span>
          </div>
          <div className="pick__cta">
            <a className="pick__btn" href={productUrl(p.url)} target="_blank" rel="noopener sponsored nofollow">Check price</a>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionBlock({ section, products }: { section: ArticleSection; products?: Product[] }) {
  switch (section.type) {
    case "products":
      return products?.length ? <Picks products={products} /> : null;
    case "heading":
      return <h2>{section.content}</h2>;
    case "subheading":
      return <h3>{section.content}</h3>;
    case "paragraph":
      return <p>{section.content}</p>;
    case "quote":
      return <blockquote>“{section.content}”</blockquote>;
    case "callout":
      return (
        <div className="callout">
          {section.label && <span className="callout__label">{section.label}</span>}
          <p>{section.content}</p>
        </div>
      );
    case "list":
      return <ul>{section.items?.map((item, i) => <li key={i}>{item}</li>)}</ul>;
    case "divider":
      return <hr />;
    default:
      return null;
  }
}

const Icon = {
  date: (
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 4.2V8l2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ),
  author: (
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="3.2" fill="currentColor" /><path d="M2 15c0-3.4 2.7-5.4 6-5.4s6 2 6 5.4z" fill="currentColor" /></svg>
  ),
  cat: (
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5h4.2l1.4 1.6h7.4v7.9H1.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
  ),
};

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const article = getArticleBySlug(slug || "");
  usePageTitle(article?.title, article?.excerpt);
  const [copied, setCopied] = useState(false);

  if (!article) return <NotFound />;

  const idx = LATEST.findIndex((a) => a.id === article.id);
  const prev = LATEST[idx + 1]; // older
  const next = LATEST[idx - 1]; // newer
  // Hand-picked related first, topped up with the newest other stories so the 2-col grid stays even.
  const picked = getRelatedArticles(article);
  const others = LATEST.filter((a) => a.id !== article.id && !picked.includes(a));
  const related = [
    ...picked,
    ...others.filter((a) => a.category === article.category),
    ...others.filter((a) => a.category !== article.category),
  ].slice(0, 4);
  const url = typeof window !== "undefined" ? window.location.origin + articleUrl(article) : articleUrl(article);
  const enc = encodeURIComponent;

  const copy = () => {
    if (navigator.share) {
      navigator.share({ title: article.title, url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Layout>
      <ReadingProgress />
      <div className="mh-row">
        <article className="mh-content mh-single">
          <nav className="mh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span className="sep" aria-hidden="true">›</span>
            <Link href={categoryUrl(article.category)}>{article.category}</Link> <span className="sep" aria-hidden="true">›</span>
            <span>{article.title}</span>
          </nav>
          <header>
            <h1 className="entry-title">{article.title}</h1>
            <p className="entry-sub">{article.subtitle}</p>
            <div className="mh-meta">
              <span>{Icon.date}{article.date}</span>
              <span>{Icon.author}{article.author}</span>
              <span>{Icon.cat}<Link href={categoryUrl(article.category)}>{article.category}</Link></span>
              <span>{article.readTime}</span>
            </div>
          </header>
          <figure className="entry-thumbnail">
            <img src={article.image} alt="" fetchPriority="high" decoding="async" />
          </figure>
          {article.products && article.products.length > 0 && (
            <p className="affiliate-note">
              We research products from makers’ and retailers’ published information; we have not tested them hands-on.
              Some links may earn us a commission at no cost to you. Prices change, so check the seller’s page.
            </p>
          )}
          <div className="prose-uw">
            {article.sections.map((s, i) => <SectionBlock key={i} section={s} products={article.products} />)}
            {!article.sections.some((s) => s.type === "products") && article.products?.length ? (
              <Picks products={article.products} />
            ) : null}
          </div>
          {article.sources && article.sources.length > 0 && (
            <div className="mh-sources">
              <h3>Sources</h3>
              <ul>
                {article.sources.map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noopener nofollow">{s.label}</a></li>
                ))}
              </ul>
            </div>
          )}
          <p className="disclaimer">
            Product details and prices come from the sellers’ published information on the date shown and can change.
            Nothing here is medical advice; for health devices, talk to your doctor or audiologist about what fits you.
          </p>

          <div className="mh-tags">
            {article.tags.map((t) => <span key={t}>{t}</span>)}
          </div>

          <div className="mh-share">
            <span className="mh-share__label">Share</span>
            <a href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(article.title)}`} target="_blank" rel="noopener" aria-label="Share on X">X</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener" aria-label="Share on Facebook">f</a>
            <a href={`mailto:?subject=${enc(article.title)}&body=${enc(url)}`} aria-label="Share by email">✉</a>
            <button type="button" onClick={copy} aria-label="Copy link">{copied ? "✓" : "🔗"}</button>
          </div>

          <div className="mh-author">
            <div className="mh-author__avatar" aria-hidden="true">{initials(article.author)}</div>
            <div>
              <strong>{article.author}</strong>
              <span>{article.authorRole}</span>
            </div>
          </div>

          <div className="inline-signup">
            <p className="sidebar-form__label">Get Nickel And Gadget in your inbox</p>
            <p className="sidebar-form__sub">One easy-to-use gadget, explained in plain English, every day. Free.</p>
            <SubscribeForm />
          </div>

          <nav className="mh-post-nav" aria-label="More stories">
            <div className="mh-post-nav-prev">
              {prev && (<><span>‹ Previous</span><p><Link href={articleUrl(prev)}>{prev.title}</Link></p></>)}
            </div>
            <div className="mh-post-nav-next">
              {next && (<><span>Next ›</span><p><Link href={articleUrl(next)}>{next.title}</Link></p></>)}
            </div>
          </nav>

          {related.length > 0 && (
            <section>
              <h2 className="mh-widget-title">You may also like</h2>
              <div className="grid grid--2">
                {related.map((a) => <Card key={a.id} article={a} />)}
              </div>
            </section>
          )}
        </article>
        <Sidebar exclude={article.id} />
      </div>
    </Layout>
  );
}
