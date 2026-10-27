import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { getAllCategories, type Article } from "@/lib/articles";
import {
  CONTACT_EMAIL,
  EDITOR_PICKS,
  LATEST,
  SITE_NAME,
  SITE_TAGLINE,
  articleUrl,
  categoryUrl,
} from "@/lib/site";

export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Senior-Friendly Gadgets, Explained`;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    window.scrollTo(0, 0);
  }, [title, description]);
}

function Logo() {
  return (
    <Link href="/" className="mh-logo" aria-label={`${SITE_NAME} home`}>
      <span className="mh-logo__mark" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M10 18h4" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <span className="mh-logo__text">
        <span className="mh-logo__name">
          Nickel <em>&amp;</em> Gadget
        </span>
        <span className="mh-logo__tag">{SITE_TAGLINE}</span>
      </span>
    </Link>
  );
}

function Ticker() {
  const items = LATEST.slice(0, 6);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  return (
    <div className="mh-ticker-items" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {items.map((a, n) => (
        <div key={a.id} className={`mh-ticker-item${n === i ? " is-visible" : ""}`}>
          <span className="mh-ticker-date">[ {a.date} ]</span>
          <Link href={articleUrl(a)}>{a.title}</Link>
          <span className="mh-ticker-sep" aria-hidden="true">▸</span>
          <Link className="mh-ticker-cat" href={categoryUrl(a.category)}>{a.category}</Link>
        </div>
      ))}
    </div>
  );
}

function Header() {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => setOpen(false), [location]);

  const nav = [
    { label: "Home", href: "/" },
    ...getAllCategories().map((c) => ({ label: c, href: categoryUrl(c) })),
    { label: "About", href: "/about" },
  ];
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="mh-header">
      <div className="mh-site-logo">
        <Logo />
      </div>
      <nav className="mh-main-nav" aria-label="Primary">
        <button className="mh-nav-toggle" aria-expanded={open} aria-controls="siteNav" onClick={() => setOpen(!open)}>
          <span className="mh-nav-toggle__bars"><span /><span /><span /></span> Menu
        </button>
        <ul id="siteNav" className={open ? "is-open" : undefined}>
          {nav.map((n) => (
            <li key={n.href} className={location === n.href ? "is-active" : undefined}>
              <Link href={n.href}>{n.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mh-ticker">
        <Link className="mh-ticker-title" href="/articles">
          Latest Guides <span aria-hidden="true">›</span>
        </Link>
        <Ticker />
        <form className="mh-search" role="search" onSubmit={onSearch}>
          <input type="search" placeholder="Search …" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" aria-label="Search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}

export function SubscribeForm({ cta = "Subscribe" }: { cta?: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: hidden from people, filled in by bots
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  if (state === "done") return <p className="subscribe-form__msg">You’re on the list. Watch your inbox for our next issue.</p>;
  return (
    <form
      className="subscribe-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError("");
        try {
          const r = await fetch("/api/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, website }),
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.ok) return setState("done");
          setError(j.error || "Something went wrong. Please try again.");
        } catch {
          setError("Network error. Please try again.");
        }
        setState("idle");
      }}
    >
      <input type="email" required placeholder="Your email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button className="subscribe-form__btn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Subscribing…" : cta}</button>
      {error && <p className="subscribe-form__msg" role="alert">{error}</p>}
    </form>
  );
}

function Footer() {
  return (
    <footer className="mh-footer">
      <div className="mh-footer-widgets">
        <div className="mh-footer-widget">
          <h4 className="mh-widget-title mh-footer-widget-title">About {SITE_NAME}</h4>
          <p>
            Plain-English guides to senior-friendly gadgets: what they do, who they suit, what they cost and how
            to set them up. Some links earn us a commission at no cost to you.
          </p>
          <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </div>
        <div className="mh-footer-widget">
          <h4 className="mh-widget-title mh-footer-widget-title">Topics</h4>
          <ul>
            <li><Link href="/articles">Latest Articles</Link></li>
            {getAllCategories().map((c) => (
              <li key={c}><Link href={categoryUrl(c)}>{c}</Link></li>
            ))}
          </ul>
        </div>
        <div className="mh-footer-widget" id="newsletter">
          <h4 className="mh-widget-title mh-footer-widget-title">One gadget a day</h4>
          <p>Our free daily email: one useful, easy-to-use gadget explained, plus deals worth knowing about.</p>
          <SubscribeForm />
        </div>
      </div>
      <div className="mh-copyright-wrap">
        <ul className="mh-footer-nav">
          <li><Link href="/about">About Us</Link></li>
          <li><Link href="/contact">Contact Us</Link></li>
          <li><Link href="/terms">Terms &amp; Conditions</Link></li>
          <li><Link href="/privacy-policy">Privacy Policy</Link></li>
          <li><Link href="/do-not-sell">Do Not Sell My Information</Link></li>
        </ul>
        <p className="mh-copyright">
          © {new Date().getFullYear()} | <Link href="/">nickelandgadget.com</Link> | Reader-supported: we may earn from qualifying purchases.
        </p>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="uw">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="mh-container">
        <Header />
        <main id="main" className="mh-wrapper">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

/* ─── Shared building blocks ─────────────────────────────────── */

export function Kicker({ article }: { article: Article }) {
  return <Link className="kicker" href={categoryUrl(article.category)}>{article.category}</Link>;
}

export function Card({ article, variant = "grid" }: { article: Article; variant?: "grid" | "row" }) {
  const url = articleUrl(article);
  return (
    <article className={`card card--${variant}`}>
      <Link className="card__media" href={url} tabIndex={-1} aria-hidden="true">
        <img src={article.image} alt="" loading="lazy" decoding="async" />
      </Link>
      <div className="card__body">
        <Kicker article={article} />
        <h3 className="card__title"><Link href={url}>{article.title}</Link></h3>
        <p className="card__excerpt">{article.excerpt}</p>
        <div className="meta">
          <span>{article.date}</span><span>·</span><span>{article.readTime}</span>
        </div>
      </div>
    </article>
  );
}

export function Sidebar({ exclude }: { exclude?: string }) {
  const recent = LATEST.filter((a) => a.id !== exclude).slice(0, 5);
  return (
    <aside className="mh-sidebar">
      <section className="mh-widget">
        <h2 className="mh-widget-title">Stay Informed</h2>
        <div className="sidebar-form">
          <p className="sidebar-form__label">Get the free Nickel And Gadget newsletter</p>
          <p className="sidebar-form__sub">One easy gadget a day. Free, unsubscribe anytime.</p>
          <SubscribeForm />
        </div>
      </section>
      <section className="mh-widget">
        <h2 className="mh-widget-title">Recent Posts</h2>
        <ul className="recent-list">
          {recent.map((a) => (
            <li key={a.id}><Link href={articleUrl(a)}>{a.title}</Link></li>
          ))}
        </ul>
      </section>
      <section className="mh-widget">
        <h2 className="mh-widget-title">Buying Guides</h2>
        <ol className="ranked">
          {EDITOR_PICKS.map((a, n) => (
            <li key={a.id}>
              <span className="ranked__num">{n + 1}</span>
              <Link className="ranked__title" href={articleUrl(a)}>{a.title}</Link>
            </li>
          ))}
        </ol>
      </section>
      <section className="mh-widget">
        <h2 className="mh-widget-title">Topics</h2>
        <ul className="topic-list">
          {getAllCategories().map((c) => (
            <li key={c}><Link href={categoryUrl(c)}>{c}</Link></li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
