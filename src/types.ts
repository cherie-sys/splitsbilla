export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Item {
  id: string;
  serialNo?: number; // serial/line number as printed on the receipt, used for dedup
  name: string;
  price: number; // unit price per serving
  qty: number; // number of servings
  assignedTo: string[]; // person ids; split evenly among these unless customShares is set
  customShares?: Record<string, number>; // personId -> weight (amount or servings, see customSplitMode)
  customSplitMode?: 'amount' | 'qty'; // how to read customShares: currency amount, or servings count
  sourceImageId?: string; // which scanned receipt image this came from
}

export interface Charges {
  tax: number;
  tip: number;
  tipIsPercent: boolean; // if true, tip value is a percent of subtotal
  discount: number; // flat amount subtracted proportionally
}

export interface ReceiptImage {
  id: string;
  dataUrl: string;
  label: string;
  itemsAdded: number;
  duplicatesSkipped: number;
  rawText?: string; // exactly what OCR read from this photo, for diagnosing a bad parse
}

// A single bill/receipt — one "smaller event" inside the major event
// (e.g. "Day 1 Dinner" within a "Goa Trip").
export interface Bill {
  id: string;
  name: string;
  date: string; // ISO yyyy-mm-dd
  items: Item[];
  charges: Charges;
  receiptImages: ReceiptImage[];
  peopleIds: string[]; // subset of AppState.people who are part of this bill
  paidBy?: string; // person id who fronted the money for this bill
  scannedTotal?: number; // the total as printed on the receipt (OCR-detected or typed in), for reconciliation
  settledAmounts?: Record<string, number>; // debtor personId -> amount already paid back to paidBy, for this bill
}

// The major event that groups several bills together (e.g. a trip or weekend).
export interface EventInfo {
  name: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd; same as startDate for a single-day event
}

export interface AppState {
  people: Person[]; // the roster of everyone ever added, across all bills — gives each bill's "add person" suggestions
  currency: string; // ISO 4217 code, e.g. "USD"
  event: EventInfo;
  bills: Bill[];
  activeBillId: string;
}

export interface PersonTotal {
  personId: string;
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  discountShare: number;
  total: number;
}
