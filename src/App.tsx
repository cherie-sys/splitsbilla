import { useState } from 'react';
import './App.css';
import EventManager from './components/EventManager';
import PeopleManager from './components/PeopleManager';
import ReceiptScanner from './components/ReceiptScanner';
import ReceiptGallery from './components/ReceiptGallery';
import ItemsEditor from './components/ItemsEditor';
import ChargesEditor from './components/ChargesEditor';
import SummaryPanel from './components/SummaryPanel';
import CombinedSummary from './components/CombinedSummary';
import ExportPanel from './components/ExportPanel';
import CurrencySelector from './components/CurrencySelector';
import SharedView from './components/SharedView';
import ConfirmDialog from './components/ConfirmDialog';
import { useAppState, newBill } from './hooks/useAppState';
import { makeId } from './lib/util';
import { billTotal, subtotal } from './lib/split';
import { mergeParsedItems } from './lib/dedupe';
import { decodeShareFromLocation } from './lib/share';
import type { Bill, Person } from './types';
import type { ParsedReceipt } from './lib/parseReceipt';

const STEPS = ['Event', 'People', 'Scan & Items', 'Summary'] as const;

function App() {
  const [state, setState] = useAppState();
  const [step, setStep] = useState<number>(0);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [confirmClearScans, setConfirmClearScans] = useState(false);
  const [sharedSnapshot] = useState(() => decodeShareFromLocation());

  // A #s=... link opens straight into a read-only view of that snapshot —
  // it never touches this browser's own bills/people/localStorage.
  if (sharedSnapshot) {
    return <SharedView snapshot={sharedSnapshot} />;
  }

  const activeBill = state.bills.find((b) => b.id === state.activeBillId) ?? state.bills[0];
  const billPeople = state.people.filter((p) => activeBill.peopleIds.includes(p.id));
  const involvedPeople = state.people.filter((p) => state.bills.some((b) => b.peopleIds.includes(p.id)));

  function updateActiveBill(patch: Partial<Bill> | ((bill: Bill) => Partial<Bill>)) {
    setState((s) => ({
      ...s,
      bills: s.bills.map((b) => {
        if (b.id !== s.activeBillId) return b;
        const delta = typeof patch === 'function' ? patch(b) : patch;
        return { ...b, ...delta };
      }),
    }));
  }

  // Deleting someone from the roster removes them everywhere: every bill's
  // people list, whoever they were assigned items in, and "paid by" if it was them.
  function handleRosterChange(newRoster: Person[]) {
    setState((s) => {
      const removedIds = s.people.filter((p) => !newRoster.some((np) => np.id === p.id)).map((p) => p.id);
      if (removedIds.length === 0) return { ...s, people: newRoster };

      const removed = new Set(removedIds);
      const bills = s.bills.map((b) => ({
        ...b,
        peopleIds: b.peopleIds.filter((id) => !removed.has(id)),
        paidBy: b.paidBy && removed.has(b.paidBy) ? undefined : b.paidBy,
        items: b.items.map((it) => ({
          ...it,
          assignedTo: it.assignedTo.filter((id) => !removed.has(id)),
        })),
      }));
      return { ...s, people: newRoster, bills };
    });
  }

  // Un-checking someone from this bill (without deleting them from the roster) must also
  // drop their share of any item and clear "paid by" if it was them — otherwise their
  // slice of the cost quietly disappears from the total instead of being reassigned.
  function handleBillPeopleChange(peopleIds: string[]) {
    updateActiveBill((bill) => {
      const removed = bill.peopleIds.filter((id) => !peopleIds.includes(id));
      if (removed.length === 0) return { peopleIds };
      const removedSet = new Set(removed);
      return {
        peopleIds,
        paidBy: bill.paidBy && removedSet.has(bill.paidBy) ? undefined : bill.paidBy,
        items: bill.items.map((it) => ({
          ...it,
          assignedTo: it.assignedTo.filter((id) => !removedSet.has(id)),
        })),
      };
    });
  }

  function handleScanned(parsed: ParsedReceipt, imageDataUrl: string) {
    setScanMessage(null);
    setState((s) => {
      const bill = s.bills.find((b) => b.id === s.activeBillId)!;
      const { itemsToAdd, duplicateCount, overlapCount } = mergeParsedItems(bill.items, parsed.items);
      const imageId = makeId();

      const newItems = itemsToAdd.map((i) => ({
        id: makeId(),
        serialNo: i.serialNo,
        name: i.name,
        price: i.unitPrice,
        qty: i.qty,
        assignedTo: [],
        sourceImageId: imageId,
      }));

      const label = `Receipt ${bill.receiptImages.length + 1}`;
      const messageParts = [`Added ${itemsToAdd.length} item${itemsToAdd.length === 1 ? '' : 's'}`];
      if (duplicateCount > 0) {
        messageParts.push(
          `skipped ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}${
            overlapCount > 0 ? ' (overlap with a previous scan detected)' : ''
          }`,
        );
      }
      setScanMessage(messageParts.join(' · ') + '.');

      const updatedBill: Bill = {
        ...bill,
        items: [...bill.items, ...newItems],
        receiptImages: [
          ...bill.receiptImages,
          {
            id: imageId,
            dataUrl: imageDataUrl,
            label,
            itemsAdded: itemsToAdd.length,
            duplicatesSkipped: duplicateCount,
            rawText: parsed.rawText,
          },
        ],
        charges: {
          ...bill.charges,
          tax: parsed.suggestedTax ?? bill.charges.tax,
          tip: parsed.suggestedTip !== undefined ? parsed.suggestedTip : bill.charges.tip,
          tipIsPercent: parsed.suggestedTip !== undefined ? false : bill.charges.tipIsPercent,
        },
        scannedTotal: parsed.suggestedTotal ?? bill.scannedTotal,
      };

      return { ...s, bills: s.bills.map((b) => (b.id === bill.id ? updatedBill : b)) };
    });
  }

  function handleClearScans() {
    if (activeBill.receiptImages.length === 0 && activeBill.items.every((it) => !it.sourceImageId)) {
      return;
    }
    setConfirmClearScans(true);
  }

  function doClearScans() {
    setConfirmClearScans(false);
    setScanMessage(null);
    updateActiveBill((bill) => ({
      items: bill.items.filter((it) => !it.sourceImageId),
      receiptImages: [],
    }));
  }

  function handleAddBill() {
    // start the new bill with the same crowd as whichever bill is active — easy to adjust from there
    const bill = newBill(state.bills.length, activeBill.peopleIds);
    setState((s) => ({ ...s, bills: [...s.bills, bill], activeBillId: bill.id }));
    setScanMessage(null);
  }

  function handleDeleteBill(id: string) {
    setState((s) => {
      const remaining = s.bills.filter((b) => b.id !== id);
      const bills = remaining.length > 0 ? remaining : [newBill(0)];
      const activeBillId = bills.some((b) => b.id === s.activeBillId) ? s.activeBillId : bills[0].id;
      return { ...s, bills, activeBillId };
    });
  }

  const hasScanData = activeBill.receiptImages.length > 0 || activeBill.items.some((it) => it.sourceImageId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>SplitsBilla</h1>
        <p className="tagline">Scan a receipt, split it your way.</p>
        <CurrencySelector
          currency={state.currency}
          onChange={(currency) => setState((s) => ({ ...s, currency }))}
        />
      </header>

      <nav className="steps-nav">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`step-btn ${i === step ? 'active' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="step-index">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {step === 0 && (
          <section className="panel">
            <h2>Your event</h2>
            <EventManager
              event={state.event}
              onEventChange={(event) => setState((s) => ({ ...s, event }))}
              bills={state.bills}
              activeBillId={state.activeBillId}
              currency={state.currency}
              onSelectBill={(activeBillId) => setState((s) => ({ ...s, activeBillId }))}
              onAddBill={handleAddBill}
              onRenameBill={(id, name) =>
                setState((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, name } : b)) }))
              }
              onDateBill={(id, date) =>
                setState((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, date } : b)) }))
              }
              onDeleteBill={handleDeleteBill}
            />
          </section>
        )}

        {step === 1 && (
          <section className="panel">
            <h2>Who's splitting — {activeBill.name}?</h2>
            <PeopleManager
              roster={state.people}
              selectedIds={activeBill.peopleIds}
              onRosterChange={handleRosterChange}
              onSelectionChange={handleBillPeopleChange}
            />
          </section>
        )}

        {step === 2 && (
          <section className="panel">
            <h2>Scan your receipt — {activeBill.name}</h2>
            <ReceiptScanner onScanned={handleScanned} />
            {scanMessage && <p className="scan-message">{scanMessage}</p>}
            <ReceiptGallery images={activeBill.receiptImages} />
            {hasScanData && (
              <button type="button" className="btn danger-outline" onClick={handleClearScans}>
                Start afresh — clear scanned receipts
              </button>
            )}
            {confirmClearScans && (
              <ConfirmDialog
                message="Start afresh: remove all scanned receipt photos and the items they added? Manually added items are kept."
                confirmLabel="Start afresh"
                onConfirm={doClearScans}
                onCancel={() => setConfirmClearScans(false)}
              />
            )}
            <h2 className="items-heading">Items</h2>
            <ItemsEditor
              items={activeBill.items}
              people={billPeople}
              currency={state.currency}
              onChange={(items) => updateActiveBill({ items })}
            />
            <h2 className="items-heading">Paid by & charges</h2>
            <ChargesEditor
              charges={activeBill.charges}
              subtotal={subtotal(activeBill.items)}
              computedTotal={billTotal(activeBill)}
              currency={state.currency}
              people={billPeople}
              paidBy={activeBill.paidBy}
              scannedTotal={activeBill.scannedTotal}
              onChange={(charges) => updateActiveBill({ charges })}
              onPaidByChange={(paidBy) => updateActiveBill({ paidBy })}
              onScannedTotalChange={(scannedTotal) => updateActiveBill({ scannedTotal })}
            />
          </section>
        )}

        {step === 3 && (
          <section className="panel">
            <h2>Who owes what — {activeBill.name}</h2>
            <SummaryPanel bill={activeBill} people={billPeople} currency={state.currency} />
            <CombinedSummary bills={state.bills} people={involvedPeople} currency={state.currency} />
            <ExportPanel
              state={state}
              bill={activeBill}
              people={billPeople}
              onOwnerContactChange={(ownerContact) => setState((s) => ({ ...s, ownerContact }))}
            />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <button
          type="button"
          className="btn"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        >
          Next
        </button>
      </footer>
    </div>
  );
}

export default App;
