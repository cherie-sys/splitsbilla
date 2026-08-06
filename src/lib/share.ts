import type { AppState, Bill, Person } from '../types';
import { formatDate } from './util';
import {
  billTotal,
  combinedBillTotal,
  computeCombinedTotals,
  computeNetBalances,
  computeTotals,
  itemPersonShares,
  lineTotal,
} from './split';

// A frozen, minimal snapshot for a read-only shareable link — just names and
// amounts, no internal ids, no receipt photos. It's a point-in-time picture,
// not a live view: reopening the link later won't reflect later edits.

export interface SharedItem {
  name: string;
  total: number;
  people: { name: string; share: number }[];
}

export interface SharedPerson {
  name: string;
  color: string;
  total: number;
  statusLabel: string; // e.g. "paid, gets back $6.18" / "owes Ana" / "is owed $6.18" / "settled up"
}

export interface SharedBillSnapshot {
  kind: 'bill';
  title: string;
  subtitle: string;
  currency: string;
  items: SharedItem[];
  people: SharedPerson[];
  total: number;
}

export interface SharedEventSnapshot {
  kind: 'event';
  title: string;
  subtitle: string;
  currency: string;
  bills: { name: string; date: string; total: number }[];
  people: SharedPerson[];
  total: number;
}

export type SharedSnapshot = SharedBillSnapshot | SharedEventSnapshot;

export function buildBillSnapshot(bill: Bill, people: Person[], currency: string): SharedBillSnapshot {
  const payer = people.find((p) => p.id === bill.paidBy);
  const total = billTotal(bill);
  const totals = computeTotals(bill, people);

  return {
    kind: 'bill',
    title: bill.name,
    subtitle: bill.date ? formatDate(bill.date) : '',
    currency,
    items: bill.items.map((item) => ({
      name: item.name,
      total: lineTotal(item),
      people: item.assignedTo.map((id) => ({
        name: people.find((p) => p.id === id)?.name ?? 'Unknown',
        share: itemPersonShares(item).get(id) ?? 0,
      })),
    })),
    people: totals.map((t) => {
      const person = people.find((p) => p.id === t.personId);
      let statusLabel = '';
      if (payer) {
        statusLabel =
          payer.id === t.personId ? `paid, gets back ${money(total - t.total, currency)}` : `owes ${payer.name}`;
      }
      return {
        name: person?.name ?? 'Unknown',
        color: person?.color ?? '#888',
        total: t.total,
        statusLabel,
      };
    }),
    total,
  };
}

export function buildEventSnapshot(state: AppState): SharedEventSnapshot {
  const { event, bills, people, currency } = state;
  const involved = people.filter((p) => bills.some((b) => b.peopleIds.includes(p.id)));
  const combined = computeCombinedTotals(bills, involved);
  const balances = computeNetBalances(bills, involved);

  const dateRange =
    event.startDate === event.endDate
      ? formatDate(event.startDate)
      : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;

  return {
    kind: 'event',
    title: event.name,
    subtitle: dateRange,
    currency,
    bills: bills.map((b) => ({ name: b.name, date: formatDate(b.date), total: billTotal(b) })),
    people: combined.map((t) => {
      const person = involved.find((p) => p.id === t.personId);
      const balance = balances.get(t.personId) ?? 0;
      const statusLabel =
        balance > 0.005
          ? `is owed ${money(balance, currency)}`
          : balance < -0.005
            ? `owes ${money(-balance, currency)}`
            : 'settled up';
      return {
        name: person?.name ?? 'Unknown',
        color: person?.color ?? '#888',
        total: t.total,
        statusLabel,
      };
    }),
    total: combinedBillTotal(bills),
  };
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

// --- URL-safe encoding (UTF-8 safe, no padding) ---

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const padLength = (4 - (b64.length % 4)) % 4;
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShareData(snapshot: SharedSnapshot): string {
  return toBase64Url(JSON.stringify(snapshot));
}

export function buildShareUrl(snapshot: SharedSnapshot): string {
  const encoded = encodeShareData(snapshot);
  return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
}

export function decodeShareFromLocation(): SharedSnapshot | null {
  const match = window.location.hash.match(/^#s=(.+)$/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(match[1]));
    if (parsed && (parsed.kind === 'bill' || parsed.kind === 'event')) {
      return parsed as SharedSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}
