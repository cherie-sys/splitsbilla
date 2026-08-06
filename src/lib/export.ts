import type { AppState, Bill, Person } from '../types';
import { formatDate } from './util';
import {
  billTotal,
  combinedBillTotal,
  computeCombinedTotals,
  computeNetBalances,
  computeTotals,
  formatCurrency,
  itemPersonShares,
  lineTotal,
} from './split';

function personName(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? 'Unknown';
}

// A detailed, plain-text settlement for one bill: every item, who had it (and
// their share if it wasn't split evenly), then each person's full breakdown
// and who owes whom.
export function buildBillReport(bill: Bill, people: Person[], currency: string): string {
  const lines: string[] = [];
  lines.push(`${bill.name}${bill.date ? ` — ${formatDate(bill.date)}` : ''}`);

  const payer = people.find((p) => p.id === bill.paidBy);
  if (payer) lines.push(`Paid by: ${payer.name}`);
  lines.push('');

  lines.push('Items:');
  if (bill.items.length === 0) {
    lines.push('  (none)');
  }
  for (const item of bill.items) {
    const shares = itemPersonShares(item);
    const showShares = item.assignedTo.length > 1;
    const who =
      item.assignedTo.length === 0
        ? 'unassigned'
        : item.assignedTo
            .map((id) => {
              const name = personName(people, id);
              return showShares ? `${name} (${formatCurrency(shares.get(id) ?? 0, currency)})` : name;
            })
            .join(', ');
    lines.push(`  • ${item.name} — ${formatCurrency(lineTotal(item), currency)} — ${who}`);
  }
  lines.push('');

  const totals = computeTotals(bill, people);
  const total = billTotal(bill);
  for (const t of totals) {
    const person = people.find((p) => p.id === t.personId);
    if (!person) continue;
    lines.push(`${person.name}: ${formatCurrency(t.total, currency)}`);
    for (const item of bill.items) {
      if (!item.assignedTo.includes(t.personId)) continue;
      const share = itemPersonShares(item).get(t.personId) ?? 0;
      lines.push(`    - ${item.name}: ${formatCurrency(share, currency)}`);
    }
    if (t.taxShare > 0.005) lines.push(`    - Tax: ${formatCurrency(t.taxShare, currency)}`);
    if (t.tipShare > 0.005) lines.push(`    - Tip: ${formatCurrency(t.tipShare, currency)}`);
    if (t.discountShare > 0.005) lines.push(`    - Discount: −${formatCurrency(t.discountShare, currency)}`);
    if (payer) {
      lines.push(
        payer.id === t.personId
          ? `    (paid ${formatCurrency(total, currency)}, gets back ${formatCurrency(total - t.total, currency)})`
          : `    (owes ${payer.name})`,
      );
    }
  }
  lines.push('');
  lines.push(`Bill total: ${formatCurrency(total, currency)}`);
  return lines.join('\n');
}

// Every bill in the event, one after another, plus a combined settlement at
// the end if there's more than one bill.
export function buildEventReport(state: AppState): string {
  const { event, bills, people, currency } = state;
  const involved = people.filter((p) => bills.some((b) => b.peopleIds.includes(p.id)));
  const lines: string[] = [];

  const dateRange =
    event.startDate === event.endDate
      ? formatDate(event.startDate)
      : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
  lines.push(`${event.name} (${dateRange})`);
  lines.push('='.repeat(Math.max(20, event.name.length)));
  lines.push('');

  bills.forEach((bill, i) => {
    const billPeople = people.filter((p) => bill.peopleIds.includes(p.id));
    lines.push(buildBillReport(bill, billPeople, currency));
    if (i < bills.length - 1) {
      lines.push('');
      lines.push('-'.repeat(30));
      lines.push('');
    }
  });

  if (bills.length > 1) {
    lines.push('');
    lines.push('='.repeat(30));
    lines.push(`Whole event — ${bills.length} bills combined`);
    lines.push('');
    const combined = computeCombinedTotals(bills, involved);
    const balances = computeNetBalances(bills, involved);
    for (const t of combined) {
      const person = involved.find((p) => p.id === t.personId);
      if (!person) continue;
      const balance = balances.get(t.personId) ?? 0;
      const balanceText =
        balance > 0.005
          ? `is owed ${formatCurrency(balance, currency)}`
          : balance < -0.005
            ? `owes ${formatCurrency(-balance, currency)}`
            : 'settled up';
      lines.push(`${person.name}: ${formatCurrency(t.total, currency)} (${balanceText})`);
    }
    lines.push('');
    lines.push(`Event total: ${formatCurrency(combinedBillTotal(bills), currency)}`);
  }

  return lines.join('\n');
}
