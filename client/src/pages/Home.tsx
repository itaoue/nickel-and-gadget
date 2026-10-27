import { Link } from "wouter";
import Layout, { Card, Kicker, Sidebar, usePageTitle } from "@/components/site/Layout";
import { getAllCategories } from "@/lib/articles";
import { LATEST, articleUrl, categoryUrl } from "@/lib/site";

export default function Home() {
  usePageTitle();
  const [lead, ...rest] = LATEST;
  const top = rest.slice(0, 4);
  const latest = rest.slice(4, 10);

  return (
    <Layout>
      <section className="hero">
        <article className="hero__lead">
          <Link className="hero__media" href={articleUrl(lead)}>
            <img src={lead.image} alt="" fetchPriority="high" decoding="async" />
          </Link>
          <div className="hero__body">
            <Kicker article={lead} />
            <h1 className="hero__title"><Link href={articleUrl(lead)}>{lead.title}</Link></h1>
            <p className="hero__excerpt">{lead.excerpt}</p>
            <div className="meta">
              <span>By {lead.author}</span><span>·</span><span>{lead.date}</span><span>·</span><span>{lead.readTime}</span>
            </div>
          </div>
        </article>
        <div className="hero__side">
          <h2 className="section-title section-title--sm">Top stories</h2>
          {top.map((a) => <Card key={a.id} article={a} variant="row" />)}
        </div>
      </section>

      <div className="mh-row">
        <section className="mh-content">
          <div className="section-head">
            <h2 className="section-title">Latest</h2>
            <Link className="section-more" href="/articles">All articles →</Link>
          </div>
          <div className="grid grid--3">
            {latest.map((a) => <Card key={a.id} article={a} />)}
          </div>

          <div className="cat-grid">
            {getAllCategories().map((c) => {
              const [first, ...more] = LATEST.filter((a) => a.category === c);
              if (!first) return null;
              return (
                <section className="cat-block" key={c}>
                  <div className="section-head">
                    <h2 className="section-title">{c}</h2>
                    <Link className="section-more" href={categoryUrl(c)}>More {c} →</Link>
                  </div>
                  <Card article={first} />
                  {more.slice(0, 2).map((a) => <Card key={a.id} article={a} variant="row" />)}
                </section>
              );
            })}
          </div>
        </section>
        <Sidebar />
      </div>
    </Layout>
  );
}
