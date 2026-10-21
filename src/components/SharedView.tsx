import { useState } from 'react';
import type { SharedSnapshot } from '../lib/share';

interface Props {
  snapshot: SharedSnapshot;
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

// Opens the viewer's own email app with a pre-filled draft — nothing is sent
// automatically, they still have to hit send themselves. No accounts, no
// backend: this is as close to "raise a dispute" as a static link can get.
function buildDisputeMailto(snapshot: SharedSnapshot, name: string, message: string): string {
  const to = (snapshot.ownerContact ?? '').trim();
  const subject = `Dispute — ${snapshot.title}`;
  const bodyLines = [
    name.trim() ? `From: ${name.trim()}` : null,
    '',
    message.trim() || '(no message written)',
    '',
    `Reference: ${window.location.href}`,
    '',
    '— sent via SplitsBilla',
  ].filter((l): l is string => l !== null);
  const body = bodyLines.join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function SharedView({ snapshot }: Props) {
  const { currency, people, payments } = snapshot;
  const [me, setMe] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeName, setDisputeName] = useState<string | null>(null);
  const [disputeMessage, setDisputeMessage] = useState('');

  const myPerson = people.find((p) => p.name === me);
  const myItems =
    snapshot.kind === 'bill' && me
      ? snapshot.items.flatMap((item) => {
          const mine = item.people.find((p) => p.name === me);
          return mine ? [{ name: item.name, share: mine.share }] : [];
        })
      : [];
  const myCharges = myPerson ? myPerson.total - myItems.reduce((sum, i) => sum + i.share, 0) : 0;
  const iOwe = payments?.filter((p) => p.from === me) ?? [];
  const owedToMe = payments?.filter((p) => p.to === me) ?? [];
  const peopleTotal = people.reduce((sum, p) => sum + p.total, 0) || 1;
  const nameForDispute = disputeName ?? me ?? '';

  return (
    <div className="app-shell share-shell">
      <header className="share-hero">
        <p className="share-eyebrow">
          {snapshot.kind === 'event' ? 'Event' : 'Bill'}
          {snapshot.subtitle ? ` · ${snapshot.subtitle}` : ''}
        </p>
        <h1 className="share-title">{snapshot.title}</h1>
        <p className="share-total">{money(snapshot.total, currency)}</p>
        <p className="share-sub">
          split between {people.length} {people.length === 1 ? 'person' : 'people'}
        </p>
      </header>

      <main className="app-main share-main">
        <section className="share-card">
          <h2 className="share-h">Who are you?</h2>
          <div className="share-who">
            {people.map((p) => (
              <button
                type="button"
                key={p.name}
                aria-pressed={me === p.name}
                className={`share-who-btn ${me === p.name ? 'active' : ''}`}
                style={{ '--chip-color': p.color } as React.CSSProperties}
                onClick={() => setMe(me === p.name ? null : p.name)}
              >
                <span className="chip-dot" />
                {p.name}
              </button>
            ))}
          </div>

          {myPerson ? (
            <div className="share-me">
              <p className="share-me-label">Your share</p>
              <p className="share-me-amount">{money(myPerson.total, currency)}</p>
              {myPerson.statusLabel && <p className="share-me-status">{myPerson.statusLabel}</p>}

              {iOwe.map((p) => (
                <p className="share-me-action owe" key={`${p.from}-${p.to}`}>
                  Pay {p.to} <strong>{money(p.amount, currency)}</strong>
                </p>
              ))}
              {owedToMe.map((p) => (
                <p className="share-me-action owed" key={`${p.from}-${p.to}`}>
                  {p.from} owes you <strong>{money(p.amount, currency)}</strong>
                </p>
              ))}
              {payments && iOwe.length === 0 && owedToMe.length === 0 && (
                <p className="share-me-action settled">You're all settled up.</p>
              )}

              {myItems.length > 0 && (
                <ul className="share-me-items">
                  {myItems.map((item, i) => (
                    <li key={i}>
                      <span>{item.name}</span>
                      <span>{money(item.share, currency)}</span>
                    </li>
                  ))}
                  {Math.abs(myCharges) > 0.005 && (
                    <li>
                      <span>Tax &amp; charges</span>
                      <span>{money(myCharges, currency)}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : (
            <p className="hint">Tap your name to see just your part.</p>
          )}
        </section>

        <section className="share-card">
          <h2 className="share-h">Everyone's share</h2>
          <ul className="share-people">
            {people.map((p) => (
              <li key={p.name} className={`share-person ${me === p.name ? 'me' : ''}`}>
                <span
                  className="share-avatar"
                  style={{ '--chip-color': p.color } as React.CSSProperties}
                  aria-hidden="true"
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <div className="share-person-main">
                  <div className="share-person-top">
                    <span className="share-person-name">{p.name}</span>
                    <span className="share-person-amount">{money(p.total, currency)}</span>
                  </div>
                  <div className="share-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.max(2, (p.total / peopleTotal) * 100)}%`,
                        '--chip-color': p.color,
                      } as React.CSSProperties}
                    />
                  </div>
                  {p.statusLabel && <span className="share-person-status">{p.statusLabel}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {payments && (
          <section className="share-card">
            <h2 className="share-h">Settle up</h2>
            {payments.length === 0 ? (
              <p className="hint">Nothing to pay — everyone's even.</p>
            ) : (
              <ul className="share-payments">
                {payments.map((p) => (
                  <li key={`${p.from}-${p.to}`} className={p.from === me || p.to === me ? 'me' : ''}>
                    <span>
                      <strong>{p.from}</strong> pays <strong>{p.to}</strong>
                    </span>
                    <span className="share-payment-amount">{money(p.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <details className="share-card share-details">
          <summary>
            {snapshot.kind === 'event'
              ? `Bills in this event (${snapshot.bills.length})`
              : `What's on the bill (${snapshot.items.length})`}
          </summary>
          <ul className="share-lines">
            {snapshot.kind === 'bill'
              ? snapshot.items.map((item, i) => (
                  <li key={i}>
                    <div className="share-line-top">
                      <span>{item.name}</span>
                      <span>{money(item.total, currency)}</span>
                    </div>
                    <span className="share-line-who">
                      {item.people.length === 0
                        ? 'Unassigned'
                        : item.people
                            .map((p) => (item.people.length > 1 ? `${p.name} (${money(p.share, currency)})` : p.name))
                            .join(', ')}
                    </span>
                  </li>
                ))
              : snapshot.bills.map((bill, i) => (
                  <li key={i}>
                    <div className="share-line-top">
                      <span>{bill.name}</span>
                      <span>{money(bill.total, currency)}</span>
                    </div>
                    {bill.date && <span className="share-line-who">{bill.date}</span>}
                  </li>
                ))}
          </ul>
        </details>

        <section className="share-footer">
          {!showDisputeForm ? (
            <button type="button" className="btn" onClick={() => setShowDisputeForm(true)}>
              Something look off? Raise a dispute
            </button>
          ) : (
            <div className="dispute-form">
              <h3 className="share-h">Raise a dispute</h3>
              <p className="hint">
                This opens a draft in your own email app, addressed to whoever shared this — nothing is
                sent until you hit send there.
              </p>
              {!snapshot.ownerContact && (
                <p className="hint">
                  They didn't add a contact email, so you'll need to fill in the recipient yourself.
                </p>
              )}
              <label className="owner-contact-label">
                Your name
                <input
                  type="text"
                  className="owner-contact-input"
                  value={nameForDispute}
                  onChange={(e) => setDisputeName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="owner-contact-label">
                What's the issue?
                <textarea
                  className="dispute-message-input"
                  value={disputeMessage}
                  onChange={(e) => setDisputeMessage(e.target.value)}
                  placeholder="e.g. I think I was charged for an item I didn't have"
                  rows={4}
                />
              </label>
              <div className="export-actions">
                <a className="btn primary" href={buildDisputeMailto(snapshot, nameForDispute, disputeMessage)}>
                  Open email to send
                </a>
                <button type="button" className="btn" onClick={() => setShowDisputeForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <p className="hint share-note">
            A snapshot from when the link was made — it won't update if the bill changes afterward.
          </p>
          <p className="share-brand">Split with SplitsBilla</p>
        </section>
      </main>
    </div>
  );
}
