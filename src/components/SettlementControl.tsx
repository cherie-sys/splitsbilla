import { formatCurrency } from '../lib/split';

interface Props {
  amount: number; // full amount owed
  settled: number; // amount already recorded as paid back
  currency: string;
  onChange: (settled: number) => void;
}

const TOLERANCE = 0.005;

export default function SettlementControl({ amount, settled, currency, onChange }: Props) {
  const remaining = Math.max(0, amount - settled);
  const isFullySettled = remaining <= TOLERANCE;

  return (
    <div className="settlement-control">
      <div className="settlement-status">
        {isFullySettled ? (
          <span className="settled-badge">✓ Settled</span>
        ) : (
          <>
            <span className="remaining-amount">{formatCurrency(remaining, currency)} left to pay</span>
            {settled > TOLERANCE && (
              <span className="hint settled-so-far">
                {formatCurrency(settled, currency)} already paid
              </span>
            )}
          </>
        )}
      </div>
      <div className="settlement-actions">
        <input
          type="number"
          min={0}
          max={amount}
          step="0.01"
          value={settled || ''}
          placeholder="0.00"
          aria-label="Amount settled"
          onChange={(e) => onChange(Math.min(amount, Math.max(0, Number(e.target.value) || 0)))}
        />
        {isFullySettled ? (
          <button type="button" className="btn" onClick={() => onChange(0)}>
            Undo
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => onChange(amount)}>
            Mark fully paid
          </button>
        )}
      </div>
    </div>
  );
}
