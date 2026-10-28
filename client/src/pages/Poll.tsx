import { useEffect, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import Layout, { Card, Sidebar, usePageTitle } from "@/components/site/Layout";
import { LATEST } from "@/lib/site";

interface Result {
  index: number;
  label: string;
  votes: number;
  pct: number;
}
interface PollData {
  question: string;
  total: number;
  results: Result[];
}

function myVote(campaign: string): number | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)pv_${campaign}=(\\d+)`));
  return m ? Number(m[1]) : null;
}

/** /poll/:campaign — results of a newsletter reader poll (votes arrive via /poll/:campaign/vote/:n on the server). */
export default function PollPage() {
  const { campaign } = useParams<{ campaign: string }>();
  const justVoted = new URLSearchParams(useSearch()).has("voted");
  const [poll, setPoll] = useState<PollData | null>(null);
  const [failed, setFailed] = useState(false);
  usePageTitle(poll ? `Poll: ${poll.question}` : "Reader poll");

  useEffect(() => {
    fetch(`/api/polls/${encodeURIComponent(campaign)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setPoll)
      .catch(() => setFailed(true));
  }, [campaign]);

  const mine = typeof document !== "undefined" ? myVote(campaign) : null;

  return (
    <Layout>
      <div className="mh-row">
        <section className="mh-content poll">
          <nav className="mh-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span className="sep" aria-hidden="true">›</span>
            <span>Reader poll</span>
          </nav>
          {justVoted && <p className="alert alert--ok">Thank you for taking the poll. Your answer has been counted.</p>}
          {failed && <p className="empty">This poll could not be loaded. It may have ended.</p>}
          {!poll && !failed && <p className="empty">Loading results…</p>}
          {poll && (
            <>
              <span className="kicker">Reader poll</span>
              <h1 className="entry-title">{poll.question}</h1>
              <div className="poll__results">
                {poll.results.map((r) => (
                  <div key={r.index} className={`poll__row${mine === r.index ? " is-mine" : ""}`}>
                    <div className="poll__label">
                      <span>{r.label}{mine === r.index && <em> ✓ your answer</em>}</span>
                      <strong>{r.pct}%</strong>
                    </div>
                    <div className="poll__bar"><div style={{ width: `${r.pct}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="poll__total">{poll.total.toLocaleString()} vote{poll.total === 1 ? "" : "s"} so far.</p>
              {mine === null && (
                <div className="poll__vote">
                  <p><strong>Haven’t answered yet?</strong></p>
                  {poll.results.map((r) => (
                    <a key={r.index} className="btn" href={`/poll/${campaign}/vote/${r.index}`}>{r.label}</a>
                  ))}
                </div>
              )}
              <p className="disclaimer">Reader polls are informal and anonymous. They are not scientific surveys or product reviews.</p>
            </>
          )}
          <section style={{ marginTop: 30 }}>
            <h2 className="mh-widget-title">Latest guides</h2>
            <div className="grid grid--2">
              {LATEST.slice(0, 4).map((a) => <Card key={a.id} article={a} />)}
            </div>
          </section>
        </section>
        <Sidebar />
      </div>
    </Layout>
  );
}
