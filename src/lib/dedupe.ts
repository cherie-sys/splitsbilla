import type { Item } from '../types';
import type { ParsedLineItem } from './parseReceipt';

interface Keyed {
  serialNo?: number;
  name: string;
  total: number;
}

export interface MergeResult {
  itemsToAdd: ParsedLineItem[];
  duplicateCount: number;
  overlapCount: number;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Same item if the serial numbers agree (when both are known), or otherwise the
// name (exactly, once normalized) and total match. Exact rather than fuzzy on
// purpose: a real receipt can have two distinct items at the same price with very
// similar short names (e.g. "STIX Ib-20" vs "STIX M-20", both ₹540) — fuzzy matching
// there silently drops a genuine item, which is worse than the visible duplicate
// (one tap to delete) that exact-only matching occasionally lets through.
function sameItem(a: Keyed, b: Keyed): boolean {
  if (a.serialNo !== undefined && b.serialNo !== undefined) {
    return a.serialNo === b.serialNo && Math.abs(a.total - b.total) < 0.01;
  }
  return normalizeName(a.name) === normalizeName(b.name) && Math.abs(a.total - b.total) < 0.01;
}

/**
 * Merges freshly-scanned line items into the existing item list, skipping
 * anything already present. Handles two overlapping receipt photos (where
 * the tail of one photo and the head of the next capture the same lines)
 * by detecting the longest matching run and dropping it from the new batch.
 */
export function mergeParsedItems(existing: Item[], incoming: ParsedLineItem[]): MergeResult {
  const existingKeyed: Keyed[] = existing.map((it) => ({
    serialNo: it.serialNo,
    name: it.name,
    total: it.price * it.qty,
  }));

  // 1. de-dup within this scan's own batch (OCR occasionally reads a line twice)
  const deduped: ParsedLineItem[] = [];
  let duplicateCount = 0;
  for (const item of incoming) {
    if (deduped.some((seen) => sameItem(seen, item))) {
      duplicateCount += 1;
    } else {
      deduped.push(item);
    }
  }

  // 2. detect a contiguous overlap between the tail of what we already have
  //    and the head of this scan (two photos of the same receipt with shared lines)
  let overlapCount = 0;
  const maxK = Math.min(existingKeyed.length, deduped.length);
  for (let k = maxK; k > 0; k--) {
    const tail = existingKeyed.slice(existingKeyed.length - k);
    const head = deduped.slice(0, k);
    if (tail.every((key, i) => sameItem(key, head[i]))) {
      overlapCount = k;
      break;
    }
  }
  const afterOverlap = deduped.slice(overlapCount);
  duplicateCount += overlapCount;

  // 3. drop any remaining items that already exist anywhere else in the list
  //    (covers non-contiguous duplicates, e.g. the same item re-scanned by mistake)
  const itemsToAdd: ParsedLineItem[] = [];
  for (const item of afterOverlap) {
    const dup =
      existingKeyed.some((ex) => sameItem(ex, item)) ||
      itemsToAdd.some((added) => sameItem(added, item));
    if (dup) {
      duplicateCount += 1;
    } else {
      itemsToAdd.push(item);
    }
  }

  return { itemsToAdd, duplicateCount, overlapCount };
}
