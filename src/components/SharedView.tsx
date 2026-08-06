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

export default function SharedView({ snapshot }: Props) {
  const { currency } = snapshot;

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
        </section>
      </main>
    </div>
  );
}
