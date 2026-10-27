import type { ReactNode } from "react";
import { Link } from "wouter";
import Layout, { usePageTitle } from "./Layout";

export interface LegalSection {
  id: string;
  title: string;
  content: string;
  list?: string[];
  extra?: string;
}

/** Legal / policy page in the MH frame: breadcrumb + body on the left, contents list on the right. */
export default function LegalPage({
  title,
  dates,
  summary,
  sections,
}: {
  title: string;
  dates: ReactNode;
  summary: ReactNode;
  sections: LegalSection[];
}) {
  usePageTitle(title);
  return (
    <Layout>
      <div className="mh-row">
        <article className="mh-content static-page">
          <nav className="mh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span className="sep" aria-hidden="true">›</span>
            <span>{title}</span>
          </nav>
          <h1 className="entry-title">{title}</h1>
          <div className="mh-meta">{dates}</div>
          <div className="summary-box">{summary}</div>
          {sections.map((s) => (
            <section key={s.id} id={s.id} style={{ scrollMarginTop: 16 }}>
              <h2>{s.title}</h2>
              <p style={{ whiteSpace: "pre-line" }}>{s.content}</p>
              {s.list && <ul>{s.list.map((item, j) => <li key={j}>{item}</li>)}</ul>}
              {s.extra && <p>{s.extra}</p>}
            </section>
          ))}
        </article>
        <aside className="mh-sidebar">
          <section className="mh-widget">
            <h2 className="mh-widget-title">Contents</h2>
            <ul className="toc">
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
              ))}
            </ul>
          </section>
          <section className="mh-widget">
            <h2 className="mh-widget-title">Legal</h2>
            <ul className="recent-list">
              <li><Link href="/terms">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy-policy">Privacy Policy</Link></li>
              <li><Link href="/do-not-sell">Do Not Sell My Information</Link></li>
            </ul>
          </section>
        </aside>
      </div>
    </Layout>
  );
}
