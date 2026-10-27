import { useState } from "react";
import { Link } from "wouter";
import Layout, { Sidebar, usePageTitle } from "@/components/site/Layout";
import { CONTACT_EMAIL } from "@/lib/site";

export default function Contact() {
  usePageTitle("Contact Us");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  return (
    <Layout>
      <div className="mh-row">
        <article className="mh-content static-page">
          <nav className="mh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span className="sep" aria-hidden="true">›</span>
            <span>Contact Us</span>
          </nav>
          <h1 className="entry-title">Contact Us</h1>
          <div className="contact-grid">
            <div>
              <p>
                Have a question, story idea, or want to collaborate? We’d love to hear from you. Our team typically
                responds within 48 hours.
              </p>
              <p>
                <strong>Email</strong><br />
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
              <p>
                <strong>Content inquiries</strong><br />
                Article submissions &amp; partnerships
              </p>
            </div>
            <div className="card-box">
              {sent ? (
                <p className="alert alert--ok" style={{ margin: 0 }}>
                  Thank you for reaching out. We’ll get back to you within 48 hours.
                </p>
              ) : (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSent(true);
                  }}
                >
                  <div className="form-row">
                    <label>First name<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
                    <label>Last name<input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
                  </div>
                  <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                  <label>Message<textarea rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
                  <button className="btn" type="submit">Send message</button>
                </form>
              )}
            </div>
          </div>
        </article>
        <Sidebar />
      </div>
    </Layout>
  );
}
