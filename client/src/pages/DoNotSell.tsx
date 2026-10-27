/*
 * Do Not Sell My Personal Information — Nickel And Gadget
 * CCPA / Privacy rights opt-out page
 */

import { useState } from "react";
import { Link } from "wouter";
import Layout, { Sidebar, usePageTitle } from "@/components/site/Layout";

const RIGHTS = [
  { right: "Right to Know", desc: "You can request disclosure of the categories and specific pieces of personal information we have collected about you." },
  { right: "Right to Delete", desc: "You can request deletion of personal information we have collected from you, subject to certain exceptions." },
  { right: "Right to Opt Out", desc: "You can direct us to not sell or share your personal information with third parties." },
  { right: "Right to Correct", desc: "You can request correction of inaccurate personal information we maintain about you." },
  { right: "Right to Non-Discrimination", desc: "We will not discriminate against you for exercising any of your privacy rights." },
];

const REQUEST_TYPES = [
  { value: "opt-out", label: "Opt out of sale/sharing of my personal information" },
  { value: "know", label: "Request to know what personal information you have collected" },
  { value: "delete", label: "Request deletion of my personal information" },
  { value: "correct", label: "Request correction of my personal information" },
];

export default function DoNotSell() {
  usePageTitle("Do Not Sell My Personal Information");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", state: "", request: "opt-out" });
  const [submitted, setSubmitted] = useState(false);

  return (
    <Layout>
      <div className="mh-row">
        <article className="mh-content static-page">
          <nav className="mh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span className="sep" aria-hidden="true">›</span>
            <span>Do Not Sell My Information</span>
          </nav>
          <h1 className="entry-title">Do Not Sell My Personal Information</h1>
          <p>
            Under the California Consumer Privacy Act (CCPA) and similar state privacy laws, you have the right to opt out
            of the sale of your personal information. Use the form below to submit your request.
          </p>

          <div className="summary-box">
            <strong>Our commitment:</strong> Nickel And Gadget does not sell your personal information to third parties
            for their own marketing or commercial purposes. We share data only with service providers who help us operate
            our website and deliver our newsletter, and only under strict data processing agreements. We do not sell your
            email address or browsing data, and we do not share data with advertisers.
          </div>

          <h2>Your Rights Under CCPA and State Privacy Laws</h2>
          <p>
            If you are a California resident, the California Consumer Privacy Act (CCPA) grants you specific rights regarding
            your personal information. Similar rights may apply to residents of Virginia (VCDPA), Colorado (CPA), Connecticut
            (CTDPA), and other states with comprehensive privacy laws.
          </p>
          <ul>
            {RIGHTS.map((r) => (
              <li key={r.right}><strong>{r.right}:</strong> {r.desc}</li>
            ))}
          </ul>

          <h2>Submit a Privacy Request</h2>
          <p>We will process your request within 45 days. You may be asked to verify your identity before we fulfill your request.</p>
          <div className="card-box">
            {submitted ? (
              <p className="alert alert--ok" style={{ margin: 0 }}>
                We have received your privacy request and will respond within 45 days at <strong>{form.email}</strong>.
              </p>
            ) : (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
              >
                <div className="form-row">
                  <label>First name<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
                  <label>Last name<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
                </div>
                <label>Email address *<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label>
                  State of residence
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    <option value="">Select your state</option>
                    <option value="CA">California</option>
                    <option value="VA">Virginia</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                    <option value="NY">New York</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
                  <legend style={{ fontSize: 13, fontWeight: 700, color: "#555", marginBottom: 8 }}>Request type *</legend>
                  {REQUEST_TYPES.map((o) => (
                    <label key={o.value} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400, marginBottom: 6 }}>
                      <input
                        type="radio"
                        name="request"
                        value={o.value}
                        checked={form.request === o.value}
                        onChange={(e) => setForm({ ...form, request: e.target.value })}
                        style={{ width: "auto", marginTop: 4 }}
                      />
                      {o.label}
                    </label>
                  ))}
                </fieldset>
                <button className="btn" type="submit">Submit privacy request</button>
                <p style={{ fontSize: 12, color: "#8a9190", margin: "12px 0 0" }}>
                  By submitting this form, you confirm that you are the consumer whose information is the subject of this
                  request, or an authorized agent acting on their behalf.
                </p>
              </form>
            )}
          </div>

          <p style={{ marginTop: 20 }}>
            <strong>Prefer to contact us directly?</strong> Email{" "}
            <a href="mailto:privacy@nickelandgadget.com">privacy@nickelandgadget.com</a> with your full name, email
            address, state of residence, and the nature of your request. See also our <Link href="/privacy-policy">Privacy Policy</Link>.
          </p>
        </article>
        <Sidebar />
      </div>
    </Layout>
  );
}
