import { useEffect, useState } from 'react';
import type { AppState, Bill, Charges, EventInfo } from '../types';
import { makeId, today } from '../lib/util';

const STORAGE_KEY = 'billsplit-state-v1';

function defaultCharges(): Charges {
  return { tax: 0, tip: 0, tipIsPercent: true, discount: 0 };
}

function defaultBill(name = 'Bill 1', peopleIds: string[] = []): Bill {
  return {
    id: makeId(),
    name,
    date: today(),
    items: [],
    charges: defaultCharges(),
    receiptImages: [],
    peopleIds,
    paidBy: undefined,
    scannedTotal: undefined,
    settledAmounts: undefined,
  };
}

function defaultEvent(): EventInfo {
  const d = today();
  return { name: 'New event', startDate: d, endDate: d };
}

function freshState(): AppState {
  const bill = defaultBill();
  return {
    people: [],
    currency: 'USD',
    event: defaultEvent(),
    bills: [bill],
    activeBillId: bill.id,
  };
}

// Migrates the flat single-bill shape used by earlier versions of this app
// (top-level items/charges/receiptImages, no event/bills) into the current shape.
function migrateLegacy(parsed: Record<string, unknown>): AppState {
  const people = Array.isArray(parsed.people) ? (parsed.people as AppState['people']) : [];
  const bill: Bill = {
    id: makeId(),
    name: typeof parsed.billName === 'string' ? parsed.billName : 'Bill 1',
    date: today(),
    items: Array.isArray(parsed.items) ? (parsed.items as Bill['items']) : [],
    charges: { ...defaultCharges(), ...(parsed.charges as Partial<Charges>) },
    receiptImages: Array.isArray(parsed.receiptImages)
      ? (parsed.receiptImages as Bill['receiptImages'])
      : [],
    // bills didn't have their own people list before this version — everyone in the
    // roster was implicitly part of the one bill that existed, so carry that forward
    peopleIds: people.map((p) => p.id),
    paidBy: undefined,
    scannedTotal: undefined,
    settledAmounts: undefined,
  };
  return {
    people,
    currency: typeof parsed.currency === 'string' ? parsed.currency : 'USD',
    event: defaultEvent(),
    bills: [bill],
    activeBillId: bill.id,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (Array.isArray(parsed.bills) && parsed.bills.length > 0) {
      const people = Array.isArray(parsed.people) ? (parsed.people as AppState['people']) : [];
      const bills: Bill[] = (parsed.bills as Array<Record<string, unknown>>).map((b) => ({
        id: typeof b.id === 'string' ? b.id : makeId(),
        name: typeof b.name === 'string' ? b.name : 'Bill',
        date: typeof b.date === 'string' ? b.date : today(),
        items: Array.isArray(b.items) ? (b.items as Bill['items']) : [],
        charges: { ...defaultCharges(), ...(b.charges as Partial<Charges>) },
        receiptImages: Array.isArray(b.receiptImages) ? (b.receiptImages as Bill['receiptImages']) : [],
        // bills from before per-bill people existed had no peopleIds — default to the
        // whole roster so previously-split bills keep showing the same people
        peopleIds: Array.isArray(b.peopleIds) ? (b.peopleIds as string[]) : people.map((p) => p.id),
        paidBy: typeof b.paidBy === 'string' ? b.paidBy : undefined,
        scannedTotal: typeof b.scannedTotal === 'number' ? b.scannedTotal : undefined,
        settledAmounts:
          b.settledAmounts && typeof b.settledAmounts === 'object'
            ? (b.settledAmounts as Record<string, number>)
            : undefined,
      }));
      const activeBillId = bills.some((b) => b.id === parsed.activeBillId)
        ? (parsed.activeBillId as string)
        : bills[0].id;
      // `date` is the old single-day field from before ranges existed; fall back to it
      // for either end so events saved before this change still show something sensible.
      const eventInfo = parsed.event as (Partial<EventInfo> & { date?: string }) | undefined;
      const startDate = eventInfo?.startDate || eventInfo?.date || today();
      const endDate = eventInfo?.endDate || eventInfo?.date || startDate;
      return {
        people,
        currency: typeof parsed.currency === 'string' ? parsed.currency : 'USD',
        event: { name: eventInfo?.name || 'New event', startDate, endDate },
        bills,
        activeBillId,
      };
    }

    if (Array.isArray(parsed.items)) {
      return migrateLegacy(parsed);
    }

    return freshState();
  } catch {
    return freshState();
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage quota exceeded (large receipt photos) — state still lives in memory for this session
    }
  }, [state]);

  return [state, setState] as const;
}

export function newBill(existingCount: number, peopleIds: string[] = []): Bill {
  return defaultBill(`Bill ${existingCount + 1}`, peopleIds);
}
