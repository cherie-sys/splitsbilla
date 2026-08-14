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
  const { currency } = snapshot;
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeName, setDisputeName] = useState('');
  const [disputeMessage, setDisputeMessage] = useState('');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>SplitsBilla</h1>
        <p className="tagline">Shared settlement — view only</p>
      </header>

      <main className="app-main">
        <section className="panel">
          <h2>{snapshot.title}</h2>
          {snapshot.subtitle && <p className="hint shared-subtitle">{snapshot.subtitle}</p>}

          {snapshot.kind === 'bill' && (
            <>
              <h3 className="bills-heading">Items</h3>
              <div className="shared-items">
                {snapshot.items.length === 0 && <p className="hint">No items on this bill.</p>}
                {snapshot.items.map((item, i) => (
                  <div className="shared-item-row" key={i}>
                    <div className="shared-item-top">
                      <span>{item.name}</span>
                      <span>{money(item.total, currency)}</span>
                    </div>
                    <p className="hint shared-item-who">
                      {item.people.length === 0
                        ? 'Unassigned'
                        : item.people
                            .map((p) => (item.people.length > 1 ? `${p.name} (${money(p.share, currency)})` : p.name))
                            .join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {snapshot.kind === 'event' && (
            <>
              <h3 className="bills-heading">Bills in this event</h3>
              <div className="shared-items">
                {snapshot.bills.map((bill, i) => (
                  <div className="shared-item-row" key={i}>
                    <div className="shared-item-top">
                      <span>{bill.name}</span>
                      <span>{money(bill.total, currency)}</span>
                    </div>
                    {bill.date && <p className="hint shared-item-who">{bill.date}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="bills-heading">Who owes what</h3>
          <div className="summary-list">
            {snapshot.people.map((p, i) => (
              <div className="summary-row" key={i}>
                <div className="summary-name-col">
                  <div className="summary-name">
                    <span className="chip-dot" style={{ '--chip-color': p.color } as React.CSSProperties} />
                    {p.name}
                  </div>
                  {p.statusLabel && <span className="owes-line">{p.statusLabel}</span>}
                </div>
                <div className="summary-total">{money(p.total, currency)}</div>
              </div>
            ))}
          </div>

          <div className="summary-footer">
            <span>{snapshot.kind === 'event' ? 'Event total' : 'Bill total'}</span>
            <strong>{money(snapshot.total, currency)}</strong>
          </div>

          <p className="hint shared-disclaimer">
            This is a snapshot from when the link was made — it won't update if the bill changes
            afterward.
          </p>

          <div className="dispute-section">
            {!showDisputeForm ? (
              <button type="button" className="btn danger-outline" onClick={() => setShowDisputeForm(true)}>
                Raise a dispute
              </button>
            ) : (
              <div className="dispute-form">
                <h3 className="bills-heading">Raise a dispute</h3>
                <p className="hint">
                  This opens a draft in your own email app, addressed to whoever shared this link —
                  nothing is sent until you hit send there.
                </p>
                {!snapshot.ownerContact && (
                  <p className="hint">
                    They didn't add a contact email to this link, so you'll need to fill in the
                    recipient yourself once your email app opens.
                  </p>
                )}
                <label className="owner-contact-label">
                  Your name (optional)
                  <input
                    type="text"
                    className="owner-contact-input"
                    value={disputeName}
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
                  <a
                    className="btn primary"
                    href={buildDisputeMailto(snapshot, disputeName, disputeMessage)}
                  >
                    Open email to send →
                  </a>
                  <button type="button" className="btn" onClick={() => setShowDisputeForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
