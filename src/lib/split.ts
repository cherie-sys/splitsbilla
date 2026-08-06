import type { Bill, Item, Person, PersonTotal } from '../types';

export function lineTotal(item: Item): number {
  return item.price * item.qty;
}

export function subtotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function assignedSubtotal(items: Item[]): number {
  return items
    .filter((item) => item.assignedTo.length > 0)
    .reduce((sum, item) => sum + lineTotal(item), 0);
}

export function unassignedItems(items: Item[]): Item[] {
  return items.filter((item) => item.assignedTo.length === 0);
}

// How much each assigned person owes for one item. Even split by default; if
// customShares is set, those weights are used instead — scaled proportionally
// to the item's actual total so entered ratios hold even if price/qty changes
// later, and so the shares always sum to exactly the item's line total. Works
// the same whether customShares holds currency amounts or servings counts
// (customSplitMode) — either way it's just a weighted split of the total.
export function itemPersonShares(item: Item): Map<string, number> {
  const shares = new Map<string, number>();
  if (item.assignedTo.length === 0) return shares;

  const total = lineTotal(item);

  if (item.customShares) {
    const raw = item.assignedTo.map((id) => [id, Math.max(0, item.customShares?.[id] ?? 0)] as const);
    const sum = raw.reduce((s, [, v]) => s + v, 0);
    if (sum > 0) {
      for (const [id, v] of raw) shares.set(id, (v / sum) * total);
      return shares;
    }
    // no custom amounts entered yet — fall through to an even split
  }

  const even = total / item.assignedTo.length;
  for (const id of item.assignedTo) shares.set(id, even);
  return shares;
}

// Sum of whatever has actually been typed into a custom split so far (unscaled),
// so the editor can show "entered $12 of $20" (or "3 of 5 servings") before the
// shares are normalized.
export function customShareEntered(item: Item): number {
  if (!item.customShares) return 0;
  return item.assignedTo.reduce((s, id) => s + Math.max(0, item.customShares?.[id] ?? 0), 0);
}

// What the entered weights should add up to: servings count in qty mode,
// otherwise the item's currency total.
export function customShareTarget(item: Item): number {
  return item.customSplitMode === 'qty' ? item.qty : lineTotal(item);
}

export function resolveTipAmount(bill: Bill): number {
  const base = subtotal(bill.items);
  return bill.charges.tipIsPercent ? (base * bill.charges.tip) / 100 : bill.charges.tip;
}

function emptyTotal(personId: string): PersonTotal {
  return { personId, itemsTotal: 0, taxShare: 0, tipShare: 0, discountShare: 0, total: 0 };
}

export function computeTotals(bill: Bill, people: Person[]): PersonTotal[] {
  const base = assignedSubtotal(bill.items);
  const tipAmount = resolveTipAmount(bill);
  const { tax, discount } = bill.charges;

  const perPerson = new Map<string, number>();
  for (const person of people) perPerson.set(person.id, 0);

  for (const item of bill.items) {
    for (const [personId, share] of itemPersonShares(item)) {
      perPerson.set(personId, (perPerson.get(personId) ?? 0) + share);
    }
  }

  return people.map((person) => {
    const itemsTotal = perPerson.get(person.id) ?? 0;
    const ratio = base > 0 ? itemsTotal / base : 0;
    const taxShare = tax * ratio;
    const tipShare = tipAmount * ratio;
    const discountShare = discount * ratio;
    return {
      personId: person.id,
      itemsTotal,
      taxShare,
      tipShare,
      discountShare,
      total: itemsTotal + taxShare + tipShare - discountShare,
    };
  });
}

export function billTotal(bill: Bill): number {
  return subtotal(bill.items) + bill.charges.tax + resolveTipAmount(bill) - bill.charges.discount;
}

// Aggregates every bill in the event into one per-person total, so the
// group can see what's owed across the whole trip/occasion, not just one bill.
export function computeCombinedTotals(bills: Bill[], people: Person[]): PersonTotal[] {
  const totals = new Map<string, PersonTotal>();
  for (const person of people) totals.set(person.id, emptyTotal(person.id));

  for (const bill of bills) {
    for (const t of computeTotals(bill, people)) {
      const acc = totals.get(t.personId) ?? emptyTotal(t.personId);
      totals.set(t.personId, {
        personId: t.personId,
        itemsTotal: acc.itemsTotal + t.itemsTotal,
        taxShare: acc.taxShare + t.taxShare,
        tipShare: acc.tipShare + t.tipShare,
        discountShare: acc.discountShare + t.discountShare,
        total: acc.total + t.total,
      });
    }
  }

  return people.map((p) => totals.get(p.id) ?? emptyTotal(p.id));
}

export function combinedBillTotal(bills: Bill[]): number {
  return bills.reduce((sum, bill) => sum + billTotal(bill), 0);
}

// Net balance per person across every bill: what they fronted (as the payer
// of a bill) minus what they actually owe (their share of every bill).
// Positive = the group owes them; negative = they owe the group.
export function computeNetBalances(bills: Bill[], people: Person[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const person of people) balances.set(person.id, 0);

  for (const bill of bills) {
    if (!bill.paidBy) continue;
    balances.set(bill.paidBy, (balances.get(bill.paidBy) ?? 0) + billTotal(bill));
  }

  for (const t of computeCombinedTotals(bills, people)) {
    balances.set(t.personId, (balances.get(t.personId) ?? 0) - t.total);
  }

  return balances;
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}
