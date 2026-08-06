import type { Charges, Person } from '../types';
import { formatCurrency } from '../lib/split';
import { CURRENCIES } from '../lib/util';

interface Props {
  charges: Charges;
  subtotal: number;
  computedTotal: number;
  currency: string;
  people: Person[];
  paidBy?: string;
  scannedTotal?: number;
  onChange: (charges: Charges) => void;
  onPaidByChange: (personId: string | undefined) => void;
  onScannedTotalChange: (value: number | undefined) => void;
}

const TIP_PRESETS = [15, 18, 20];
const TOLERANCE = 0.01;

export default function ChargesEditor({
  charges,
  subtotal,
  computedTotal,
  currency,
  people,
  paidBy,
  scannedTotal,
  onChange,
  onPaidByChange,
  onScannedTotalChange,
}: Props) {
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  const diff = scannedTotal !== undefined ? computedTotal - scannedTotal : null;
  const mismatched = diff !== null && Math.abs(diff) > TOLERANCE;

  return (
    <div className="charges-editor">
      {people.length > 0 && (
        <label className="charge-field">
          <span>Paid by</span>
          <select
            className="paid-by-select"
            value={paidBy ?? ''}
            onChange={(e) => onPaidByChange(e.target.value || undefined)}
          >
            <option value="">Not set yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="charge-field">
        <span>Tax</span>
        <div className="charge-input">
          <span className="prefix">{symbol}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={charges.tax || ''}
            placeholder="0.00"
            onChange={(e) => onChange({ ...charges, tax: Number(e.target.value) || 0 })}
          />
        </div>
      </label>

      <label className="charge-field">
        <span>Tip</span>
        <div className="charge-input">
          {charges.tipIsPercent && <span className="prefix" />}
          <input
            type="number"
            min={0}
            step={charges.tipIsPercent ? 1 : 0.01}
            value={charges.tip || ''}
            placeholder="0"
            onChange={(e) => onChange({ ...charges, tip: Number(e.target.value) || 0 })}
          />
          <span className="suffix">{charges.tipIsPercent ? '%' : '$'}</span>
          <button
            type="button"
            className="unit-toggle"
            onClick={() => onChange({ ...charges, tipIsPercent: !charges.tipIsPercent })}
          >
            {charges.tipIsPercent ? 'use $' : 'use %'}
          </button>
        </div>
        {charges.tipIsPercent && (
          <div className="tip-presets">
            {TIP_PRESETS.map((pct) => (
              <button
                type="button"
                key={pct}
                className={`tip-preset ${charges.tip === pct ? 'active' : ''}`}
                onClick={() => onChange({ ...charges, tip: pct })}
              >
                {pct}%
              </button>
            ))}
          </div>
        )}
      </label>

      <label className="charge-field">
        <span>Discount</span>
        <div className="charge-input">
          <span className="prefix">{symbol}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={charges.discount || ''}
            placeholder="0.00"
            onChange={(e) => onChange({ ...charges, discount: Number(e.target.value) || 0 })}
          />
        </div>
      </label>

      <label className="charge-field">
        <span>Receipt total (optional)</span>
        <div className="charge-input">
          <span className="prefix">{symbol}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={scannedTotal ?? ''}
            placeholder="what the receipt says"
            onChange={(e) => {
              const raw = e.target.value;
              onScannedTotalChange(raw === '' ? undefined : Number(raw));
            }}
          />
        </div>
      </label>

      <p className="hint subtotal-hint">Items subtotal: {formatCurrency(subtotal, currency)}</p>

      {mismatched && (
        <p className="discrepancy-warning">
          ⚠ Doesn't tally: items + charges come to {formatCurrency(computedTotal, currency)}, but the
          receipt total is {formatCurrency(scannedTotal!, currency)} —{' '}
          {diff! > 0 ? 'over' : 'short'} by {formatCurrency(Math.abs(diff!), currency)}. Check for a
          missed item or a wrong tax/tip.
        </p>
      )}
      {scannedTotal !== undefined && !mismatched && (
        <p className="discrepancy-ok">✓ Matches the receipt total.</p>
      )}
    </div>
  );
}
