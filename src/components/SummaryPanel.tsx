import type { Bill, Person } from '../types';
import { billCollected, billTotal, computeTotals, formatCurrency, settledAmount, unassignedItems } from '../lib/split';
import SettlementControl from './SettlementControl';

interface Props {
  bill: Bill;
  people: Person[];
  currency: string;
  onSettle: (personId: string, settled: number) => void;
}

const TOLERANCE = 0.01;

export default function SummaryPanel({ bill, people, currency, onSettle }: Props) {
  const totals = computeTotals(bill, people);
  const missing = unassignedItems(bill.items);
  const total = billTotal(bill);
  const payer = people.find((p) => p.id === bill.paidBy);
  const collected = payer ? billCollected(bill, people) : 0;
  const diff = bill.scannedTotal !== undefined ? total - bill.scannedTotal : null;
  const mismatched = diff !== null && Math.abs(diff) > TOLERANCE;

  if (people.length === 0) {
    return <p className="hint">Add friends to see the split.</p>;
  }

  return (
    <div className="summary-panel">
      {mismatched && (
        <p className="discrepancy-warning">
          ⚠ Doesn't tally with the receipt total ({formatCurrency(bill.scannedTotal!, currency)}) —{' '}
          {diff! > 0 ? 'over' : 'short'} by {formatCurrency(Math.abs(diff!), currency)}.
        </p>
      )}
      {missing.length > 0 && (
        <p className="item-warning">
          {missing.length} item{missing.length > 1 ? 's' : ''} unassigned — their cost isn't
          included below.
        </p>
      )}
      {!payer && <p className="hint">Set who paid (in Scan & Items) to see who owes whom.</p>}

      <div className="summary-list">
        {totals.map((t) => {
          const person = people.find((p) => p.id === t.personId)!;
          const isPayer = payer?.id === t.personId;
          return (
            <div className="summary-row" key={t.personId}>
              <div className="summary-name-col">
                <div className="summary-name">
                  <span className="chip-dot" style={{ '--chip-color': person.color } as React.CSSProperties} />
                  {person.name}
                </div>
                {payer &&
                  (isPayer ? (
                    <span className="owes-line">
                      paid {formatCurrency(total, currency)} · gets back{' '}
                      {formatCurrency(Math.max(0, total - t.total - collected), currency)}
                    </span>
                  ) : (
                    <>
                      <span className="owes-line">owes {payer.name}</span>
                      <SettlementControl
                        amount={t.total}
                        settled={settledAmount(bill, t.personId)}
                        currency={currency}
                        onChange={(settled) => onSettle(t.personId, settled)}
                      />
                    </>
                  ))}
              </div>
              <div className="summary-breakdown">
                <span>items {formatCurrency(t.itemsTotal, currency)}</span>
                <span>tax {formatCurrency(t.taxShare, currency)}</span>
                <span>tip {formatCurrency(t.tipShare, currency)}</span>
                {t.discountShare > 0 && <span>discount −{formatCurrency(t.discountShare, currency)}</span>}
              </div>
              <div className="summary-total">{formatCurrency(t.total, currency)}</div>
            </div>
          );
        })}
      </div>

      <div className="summary-footer">
        <span>Bill total</span>
        <strong>{formatCurrency(total, currency)}</strong>
      </div>
    </div>
  );
}
