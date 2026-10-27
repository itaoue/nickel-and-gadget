import { Link } from "wouter";
import Layout, { Sidebar, usePageTitle } from "@/components/site/Layout";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <Layout>
      <div className="mh-row">
        <section className="mh-content">
          <header className="archive-head">
            <h1>Page not found</h1>
            <p>Sorry, the page you are looking for doesn’t exist. It may have been moved or deleted.</p>
          </header>
          <p>
            <Link className="btn" href="/">Go to the homepage</Link>{" "}
            <Link className="btn btn--ghost" href="/articles">Browse all articles</Link>
          </p>
        </section>
        <Sidebar />
      </div>
    </Layout>
  );
}
