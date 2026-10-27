import { Link } from "wouter";
import Layout, { Sidebar, usePageTitle } from "@/components/site/Layout";

export default function About() {
  usePageTitle("About Us", "Plain-English guides to senior-friendly gadgets: health and safety, smart home, phones, hearing and vision, and the kitchen.");
  return (
    <Layout>
      <div className="mh-row">
        <article className="mh-content static-page">
          <nav className="mh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span className="sep" aria-hidden="true">›</span>
            <span>About Us</span>
          </nav>
          <h1 className="entry-title">About Nickel And Gadget</h1>
          <p>
            We believe technology should make life easier, not more confusing. Nickel And Gadget explains senior-friendly
            gadgets in plain English: what a device actually does, who it suits, what it costs (including any monthly
            fees), and what to set up before you use it or give it as a gift.
          </p>
          <p>
            Our editors cover health and safety devices, smart-home helpers, easy phones and tablets, hearing and vision
            aids, kitchen and household tools for stiff hands, and gift ideas for parents and grandparents.
          </p>
          <div className="values">
            <div><strong>Plain English</strong><span>No jargon, no tech-speak.</span></div>
            <div><strong>Honest</strong><span>Real products, sellers’ published prices, no made-up reviews.</span></div>
            <div><strong>Practical</strong><span>Setup tips and what to check before you buy.</span></div>
            <div><strong>Independent</strong><span>Sponsored content is always labeled.</span></div>
          </div>
          <h2>How we choose products</h2>
          <p>
            We research each guide from makers’ and retailers’ product pages, official sources such as the FDA, and
            reputable reviews and news coverage, and we list those sources at the end of every article. We do not test
            products hands-on, and we never publish invented customer stories or ratings. Prices are the sellers’
            published prices on the date of the article and can change.
          </p>
          <h2>Affiliate disclosure</h2>
          <p>
            Some links on this site and in our newsletter are affiliate or sponsored links: if you buy through them we may
            earn a commission at no extra cost to you. Sponsored messages in our emails are labeled “Sponsored”.
          </p>
          <h2>Get in touch</h2>
          <p>
            Questions, product suggestions or partnership inquiries? <Link href="/contact">Contact us</Link>. We typically
            respond within 48 hours.
          </p>
        </article>
        <Sidebar />
      </div>
    </Layout>
  );
}
