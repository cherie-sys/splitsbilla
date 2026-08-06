export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function today(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const PERSON_COLORS = [
  '#e6634b',
  '#4b9ce6',
  '#4be69c',
  '#e6c14b',
  '#a04be6',
  '#e64b9c',
  '#4be6d4',
  '#e69c4b',
  '#7ce64b',
  '#4b62e6',
];

export function nextColor(existingCount: number): string {
  return PERSON_COLORS[existingCount % PERSON_COLORS.length];
}

export function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const target = name.trim().toLowerCase();
  return list.find((p) => p.name.trim().toLowerCase() === target);
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
];
