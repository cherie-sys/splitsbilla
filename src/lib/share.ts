import type { AppState, Bill, Person } from '../types';
import { formatDate } from './util';
import {
  billTotal,
  combinedBillTotal,
  combinedPairDebts,
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

export interface SharedPayment {
  from: string;
  to: string;
  amount: number;
}

export interface SharedBillSnapshot {
  kind: 'bill';
  title: string;
  subtitle: string;
  currency: string;
  items: SharedItem[];
  people: SharedPerson[];
  payments?: SharedPayment[];
  total: number;
  ownerContact?: string; // email to raise a dispute to, if the owner set one
}

export interface SharedEventSnapshot {
  kind: 'event';
  title: string;
  subtitle: string;
  currency: string;
  bills: { name: string; date: string; total: number }[];
  people: SharedPerson[];
  payments?: SharedPayment[];
  total: number;
  ownerContact?: string; // email to raise a dispute to, if the owner set one
}

export type SharedSnapshot = SharedBillSnapshot | SharedEventSnapshot;

export function buildBillSnapshot(
  bill: Bill,
  people: Person[],
  currency: string,
  ownerContact?: string,
): SharedBillSnapshot {
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
    payments: payer
      ? totals
          .filter((t) => t.personId !== payer.id && t.total > 0.005)
          .map((t) => ({
            from: people.find((p) => p.id === t.personId)?.name ?? 'Unknown',
            to: payer.name,
            amount: t.total,
          }))
      : undefined,
    total,
    ownerContact: ownerContact || undefined,
  };
}

export function buildEventSnapshot(state: AppState): SharedEventSnapshot {
  const { event, bills, people, currency, ownerContact } = state;
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
    payments: combinedPairDebts(bills, involved).map((d) => ({
      from: involved.find((p) => p.id === d.debtorId)?.name ?? 'Unknown',
      to: involved.find((p) => p.id === d.creditorId)?.name ?? 'Unknown',
      amount: d.amount,
    })),
    total: combinedBillTotal(bills),
    ownerContact: ownerContact || undefined,
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
//
// New links are deflate-compressed ("#z=") — a typical 20-item bill drops from
// ~6,000 characters to roughly a third of that, which survives messaging apps
// that truncate long URLs. Links made before compression ("#s=", plain
// base64 JSON) still open.

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64: string): Uint8Array {
  const padLength = (4 - (b64.length % 4)) % 4;
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function buildShareUrl(snapshot: SharedSnapshot): Promise<string> {
  // amounts are only ever shown to the cent, so trim float noise (834.2727272727275) from the link
  const json = new TextEncoder().encode(
    JSON.stringify(snapshot, (_key, value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value)),
  );
  const base = `${window.location.origin}${window.location.pathname}`;
  if (!canCompress) return `${base}#s=${bytesToBase64Url(json)}`;
  const packed = await pipeBytes(json, new CompressionStream('deflate-raw'));
  return `${base}#z=${bytesToBase64Url(packed)}`;
}

function isSnapshot(parsed: unknown): parsed is SharedSnapshot {
  const kind = (parsed as { kind?: unknown } | null)?.kind;
  return kind === 'bill' || kind === 'event';
}

export async function decodeShareFromLocation(): Promise<SharedSnapshot | null> {
  const match = window.location.hash.match(/^#([sz])=(.+)$/);
  if (!match) return null;
  try {
    let bytes = base64UrlToBytes(match[2]);
    if (match[1] === 'z') bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
