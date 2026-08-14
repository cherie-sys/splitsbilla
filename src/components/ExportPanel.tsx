import { useMemo, useState } from 'react';
import type { AppState, Bill, Person } from '../types';
import { buildBillReport, buildEventReport } from '../lib/export';
import { buildBillSnapshot, buildEventSnapshot, buildShareUrl } from '../lib/share';

interface Props {
  state: AppState;
  bill: Bill;
  people: Person[]; // bill-scoped people
  onOwnerContactChange: (ownerContact: string) => void;
}

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export default function ExportPanel({ state, bill, people, onOwnerContactChange }: Props) {
  const [scope, setScope] = useState<'bill' | 'event'>('bill');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const hasMultipleBills = state.bills.length > 1;

  const text = scope === 'event' ? buildEventReport(state) : buildBillReport(bill, people, state.currency);
  const title = scope === 'event' ? state.event.name : bill.name;

  const shareUrl = useMemo(() => {
    const snapshot =
      scope === 'event'
        ? buildEventSnapshot(state)
        : buildBillSnapshot(bill, people, state.currency, state.ownerContact);
    return buildShareUrl(snapshot);
  }, [scope, state, bill, people]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the preview below is still selectable.
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore — the link is still selectable from the input below
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ text, title });
    } catch {
      // user cancelled the share sheet, or share isn't supported for text — no-op
    }
  }

  return (
    <div className="export-panel">
      <h3>Export settlement</h3>

      {hasMultipleBills && (
        <div className="split-mode-row">
          <button
            type="button"
            className={`split-mode-btn ${scope === 'bill' ? 'active' : ''}`}
            onClick={() => setScope('bill')}
          >
            This bill
          </button>
          <button
            type="button"
            className={`split-mode-btn ${scope === 'event' ? 'active' : ''}`}
            onClick={() => setScope('event')}
          >
            Whole event
          </button>
        </div>
      )}

      <pre className="export-preview">{text}</pre>

      <div className="export-actions">
        <button type="button" className="btn primary" onClick={handleCopy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        {canShare && (
          <button type="button" className="btn" onClick={handleShare}>
            Share
          </button>
        )}
      </div>

      <div className="share-link-section">
        <h3>Shareable link</h3>
        <p className="hint">
          Anyone with this link can view the settlement above — no login needed. It's a snapshot
          from right now, not a live view: it won't update if you change the bill later.
        </p>
        <label className="owner-contact-label">
          Your email (optional) — lets viewers raise a dispute straight to you
          <input
            type="email"
            className="owner-contact-input"
            placeholder="you@example.com"
            value={state.ownerContact ?? ''}
            onChange={(e) => onOwnerContactChange(e.target.value)}
          />
        </label>
        <div className="share-link-row">
          <input
            type="text"
            readOnly
            className="share-link-input"
            value={shareUrl}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="btn" onClick={handleCopyLink}>
            {linkCopied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
