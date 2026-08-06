import { CURRENCIES } from '../lib/util';

interface Props {
  currency: string;
  onChange: (currency: string) => void;
}

export default function CurrencySelector({ currency, onChange }: Props) {
  return (
    <label className="currency-selector">
      <span>Currency</span>
      <select value={currency} onChange={(e) => onChange(e.target.value)}>
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code} — {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
