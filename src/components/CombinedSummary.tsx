import type { Bill, Person } from '../types';
import {
  combinedBillTotal,
  combinedPairDebts,
  computeCombinedTotals,
  computeNetBalances,
  formatCurrency,
  perBillDebts,
} from '../lib/split';

interface Props {
  bills: Bill[];
  people: Person[];
  currency: string;
}

export default function CombinedSummary({ bills, people, currency }: Props) {
  if (people.length === 0 || bills.length < 2) return null;

  const totals = computeCombinedTotals(bills, people);
  const total = combinedBillTotal(bills);
  const anyPaidBySet = bills.some((b) => b.paidBy);
  const balances = anyPaidBySet ? computeNetBalances(bills, people) : null;
  const debts = perBillDebts(bills, people); // every bill with a payer set is covered here
  const pairDebts = combinedPairDebts(bills, people);

  return (
    <div className="combined-summary">
      <h3>Whole event ({bills.length} bills combined)</h3>

      {pairDebts.length > 0 && (
        <div className="event-debts">
          <h4>Who owes who — combined, all events</h4>
          <ul className="debts-list">
            {pairDebts.map((d) => {
              const debtor = people.find((p) => p.id === d.debtorId);
              const creditor = people.find((p) => p.id === d.creditorId);
              return (
                <li key={`${d.debtorId}-${d.creditorId}`}>
                  <span>
                    <strong>{debtor?.name}</strong> owes <strong>{creditor?.name}</strong>{' '}
                    {formatCurrency(d.amount, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {debts.length > 0 && (
        <div className="event-debts">
          <h4>Who owes who, per event</h4>
          <ul className="debts-list">
            {debts.map((d) => {
              const debtor = people.find((p) => p.id === d.debtorId);
              const creditor = people.find((p) => p.id === d.creditorId);
              return (
                <li key={`${d.billId}-${d.debtorId}`}>
                  <div className="debt-row-top">
                    <span>
                      <strong>{debtor?.name}</strong> owes <strong>{creditor?.name}</strong>{' '}
                      {formatCurrency(d.amount, currency)}
                    </span>
                    <span className="debt-bill-tag">{d.billName}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="summary-list">
        {totals.map((t) => {
          const person = people.find((p) => p.id === t.personId)!;
          const balance = balances?.get(t.personId) ?? 0;
          return (
            <div className="summary-row" key={t.personId}>
              <div className="summary-name-col">
                <div className="summary-name">
                  <span className="chip-dot" style={{ '--chip-color': person.color } as React.CSSProperties} />
                  {person.name}
                </div>
                {balances && (
                  <span className="owes-line">
                    {balance > 0.005
                      ? `is owed ${formatCurrency(balance, currency)}`
                      : balance < -0.005
                        ? `owes ${formatCurrency(-balance, currency)}`
                        : 'settled up'}
                  </span>
                )}
              </div>
              <div className="summary-total">{formatCurrency(t.total, currency)}</div>
            </div>
          );
        })}
      </div>
      <div className="summary-footer">
        <span>Event total</span>
        <strong>{formatCurrency(total, currency)}</strong>
      </div>
    </div>
  );
}
