export interface ParsedLineItem {
  serialNo?: number;
  name: string;
  unitPrice: number; // price of a single serving
  qty: number; // number of servings
  total: number; // unitPrice * qty, as printed (or derived) on the receipt
}

export interface ParsedReceipt {
  items: ParsedLineItem[];
  suggestedTax?: number;
  suggestedTip?: number;
  suggestedTotal?: number;
  rawText: string;
}

interface MoneyMatch {
  0: string;
  index: number;
}

// e.g. "12. Cheeseburger" / "12) Cheeseburger" / "12 - Cheeseburger"
const SERIAL_RE = /^(\d{1,3})\s*[.)\-:]\s+(?=\S)/;
// e.g. "2x Cheeseburger 18.00" — quantity written before the item name
const LEADING_QTY_RE = /^(\d{1,3})\s*[xX]\s+(?=\S)/;
// e.g. "Cheeseburger 2 x 9.00  18.00" — quantity written right before the price
const PREPRICE_QTY_RE = /(\d{1,3})\s*[xX@]\s*$/;
// prices with minor units, e.g. "9.00" or "9,00"
const DECIMAL_MONEY_RE = /\d{1,6}[.,]\d{2}/g;
// a whole-number price at the very end of a line — used as a fallback for currencies
// (like INR, JPY) whose receipts commonly print amounts with no decimal at all.
// Not preceded by another digit (so "4521" isn't split), and only a genuine
// currency-ish suffix after it is allowed — "/-", "Rs", "INR", "₹", trailing
// punctuation, or nothing at all ("Rs.50" has no space before the number).
// Crucially this does NOT allow arbitrary letters after the number: a wrapped
// item-name continuation line like "White 150ml[sf]" (from "...White 150ml[sf]"
// wrapping under a long dish name) must NOT read "150" as a price just because
// "ml[sf]" happens to follow it — that's a unit of measure, not currency.
const WHOLE_MONEY_TRAILING_RE = /(?<!\d)(\d{2,6})(?:\s*(?:\/-|rs\.?|inr|usd|₹|\$))?[.,\s)\]]*$/i;

const SKIP_NOISE_RE =
  /\b(cash|change|visa|mastercard|amex|discover|debit|credit|card ending|approval|auth code|thank you|receipt|table|server|host|guest|order\s*#|check\s*#|xxxx|items sold|qty|www\.|http|date|time|phone|tel|ph\.?\s*no|bill\s*no|invoice|token|covers?|pax|gstin|fssai|kot|dine\s*in|round\s*-?\s*off|rounding)\b/i;

// CGST/SGST/IGST are India's split GST tax lines; VAT covers several other countries
const TAX_RE = /\btax\b|\b[csi]?gst\b|\bvat\b/i;
const TIP_RE = /\b(tip|gratuity|service\s*charge)\b/i;
const SUBTOTAL_RE = /\bsub\s*-?\s*total\b/i;
// "Total Qty: 11" marks the end of the itemized list on most POS receipts —
// it's excluded from TOTAL_RE (below) specifically so it doesn't get read as
// a money total, but it's still useful as a boundary marker.
const TOTAL_QTY_RE = /\btotal\s*qty\b/i;
// several receipts never print the word "total" alone — "balance due" and
// "amount due" mean the same thing and were previously (wrongly) filtered as noise
// negative lookahead excludes "Total Qty: 77" style lines — that's a count, not money
const TOTAL_RE = /\btotal\b(?!\s*qty)|\bamount\s*due\b|\bbalance\s*due\b|\bnet\s*payable\b/i;

function toNumber(token: string): number {
  return parseFloat(token.replace(',', '.'));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// e.g. "Item          Qty.  Price  Amount" — the column header row printed
// just above the item list on most POS receipts. When one is found, it's an
// unambiguous boundary: nothing above it (address, date, bill/token/GST
// numbers) is ever an item, no matter how item-shaped it looks.
function isItemHeaderLine(line: string): boolean {
  return /\bitems?\b/i.test(line) && /\b(qty|price|amount|rate)\b/i.test(line);
}

function stripTrailingSeparators(s: string): string {
  // strip trailing punctuation, then a trailing currency word/symbol left over from
  // something like "Masala Papad Rs." once the price itself has been split off
  return s
    .replace(/[-–_.:]+$/, '')
    .trim()
    .replace(/\b(rs|inr|₹|\$|usd)\.?$/i, '')
    .replace(/[-–_.:]+$/, '')
    .trim();
}

// Decimal-formatted prices are unambiguous, so prefer those. Only fall back to a
// bare whole number (at the line's end) when no decimal price was found — this
// keeps the common $12.34 case exact while still catching "Pizza 250" style lines.
function findMoneyMatches(line: string): MoneyMatch[] {
  const decimals = [...line.matchAll(DECIMAL_MONEY_RE)] as MoneyMatch[];
  if (decimals.length > 0) return decimals;

  const whole = line.match(WHOLE_MONEY_TRAILING_RE);
  if (!whole || whole.index === undefined) return [];
  const start = line.lastIndexOf(whole[1], whole.index + whole[0].length);
  return [{ 0: whole[1], index: start }];
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedLineItem[] = [];
  let suggestedTax: number | undefined;
  let suggestedTip: number | undefined;
  let suggestedTotal: number | undefined;
  // Once we hit the first subtotal/tax/tip/total-style line, the itemized
  // section is over. Nothing below that point — round-off adjustments,
  // payment/change lines, footers — is ever a real item, no matter how much
  // a stray number on that line makes it look like one.
  let pastItemsSection = false;
  // Symmetric guard for the top of the receipt: if there's a recognizable
  // "Item / Qty / Price" column header anywhere, nothing before it (address,
  // date, bill/token/GST numbers) can be an item either. Receipts that don't
  // print such a header never set this — items are then read from the top as
  // before, so this only ever adds a restriction, never removes coverage.
  const hasItemHeader = lines.some(isItemHeaderLine);
  let itemsSectionStarted = !hasItemHeader;

  for (const rawLine of lines) {
    if (!itemsSectionStarted) {
      if (isItemHeaderLine(rawLine)) itemsSectionStarted = true;
      continue;
    }

    let line = rawLine;

    let serialNo: number | undefined;
    const serialMatch = line.match(SERIAL_RE);
    if (serialMatch) {
      serialNo = parseInt(serialMatch[1], 10);
      line = line.slice(serialMatch[0].length).trim();
    }

    let leadingQty: number | undefined;
    const leadingQtyMatch = line.match(LEADING_QTY_RE);
    if (leadingQtyMatch) {
      leadingQty = parseInt(leadingQtyMatch[1], 10);
      line = line.slice(leadingQtyMatch[0].length).trim();
    }

    const moneyMatches = findMoneyMatches(line);
    if (moneyMatches.length === 0) continue;

    if (SUBTOTAL_RE.test(line)) {
      pastItemsSection = true;
      continue;
    }
    if (TOTAL_QTY_RE.test(line)) {
      pastItemsSection = true;
      continue;
    }
    if (TAX_RE.test(line)) {
      // sum rather than overwrite — receipts often split tax across two lines
      // (e.g. India's CGST + SGST), and each should add to the total, not replace it
      pastItemsSection = true;
      suggestedTax = (suggestedTax ?? 0) + toNumber(moneyMatches[moneyMatches.length - 1][0]);
      continue;
    }
    if (TIP_RE.test(line)) {
      pastItemsSection = true;
      suggestedTip = (suggestedTip ?? 0) + toNumber(moneyMatches[moneyMatches.length - 1][0]);
      continue;
    }
    if (TOTAL_RE.test(line)) {
      pastItemsSection = true;
      suggestedTotal = toNumber(moneyMatches[moneyMatches.length - 1][0]);
      continue;
    }
    if (SKIP_NOISE_RE.test(line)) continue;
    // anything past the summary section is never an item, however item-shaped it looks
    // (e.g. "Round off +0.50" has letters, a plausible price, and no keyword match)
    if (pastItemsSection) continue;

    const lastMoney = moneyMatches[moneyMatches.length - 1];
    // a genuine price sits at the end of the line, maybe followed by a currency
    // symbol/code ("Rs.", "INR", "/-"); reject only if more DIGITS follow, which
    // means this number wasn't actually the line's trailing price (e.g. a date)
    const trailing = line.slice(lastMoney.index + lastMoney[0].length);
    if (/\d/.test(trailing)) continue;

    const firstMoney = moneyMatches[0];
    const beforeFirst = line.slice(0, firstMoney.index);

    let qty = leadingQty ?? 1;
    let qtyMarkerLength = 0;
    if (leadingQty === undefined) {
      const preMatch = beforeFirst.match(PREPRICE_QTY_RE);
      if (preMatch) {
        qty = parseInt(preMatch[1], 10);
        qtyMarkerLength = preMatch[0].length;
      }
    }

    let total: number;
    if (moneyMatches.length >= 2 && firstMoney.index !== lastMoney.index) {
      const first = toNumber(firstMoney[0]);
      const last = toNumber(lastMoney[0]);
      if (qtyMarkerLength > 0 || leadingQty !== undefined) {
        total = last;
      } else {
        // no explicit "x"/"@" marker — this may be a plain "Qty  Price  Amount" column
        // layout (common on POS-printed receipts). First see if a bare 1-2 digit number
        // sits right before the price — if it cleanly explains unitPrice * qty = total,
        // that's our column-based quantity (this also covers qty === 1, where the two
        // money values are simply equal and no other marker would ever catch it).
        const trimmedBefore = beforeFirst.replace(/\s+$/, '');
        const bareQtyMatch = trimmedBefore.match(/(?<!\d)(\d{1,2})$/);
        const candidateQty = bareQtyMatch ? parseInt(bareQtyMatch[1], 10) : 0;

        let inferredQty = 0;
        if (candidateQty > 0 && Math.abs(first * candidateQty - last) < 0.02) {
          inferredQty = candidateQty;
        } else {
          for (let q = 2; q <= 50; q++) {
            if (Math.abs(first * q - last) < 0.02) {
              inferredQty = q;
              break;
            }
          }
        }

        if (inferredQty > 0) {
          qty = inferredQty;
          // strip the bare qty number from the name too, same as an explicit marker would be
          if (bareQtyMatch && candidateQty === inferredQty) {
            qtyMarkerLength = beforeFirst.length - trimmedBefore.length + bareQtyMatch[1].length;
          }
        }
        total = last;
      }
    } else {
      total = toNumber(firstMoney[0]);
    }

    const namePart = beforeFirst.slice(0, beforeFirst.length - qtyMarkerLength);
    const name = stripTrailingSeparators(namePart);
    if (!name || name.length < 2) continue;
    // a real item name has letters in it — this rejects stray number lists (a wrapped
    // token-number line, a bare timestamp like "23:38") that otherwise look plausible
    if (!/[a-zA-Z]/.test(name)) continue;
    if (total <= 0 || total > 20000) continue;
    if (qty <= 0 || qty > 50) qty = 1;

    items.push({
      serialNo,
      name,
      qty,
      total: round2(total),
      unitPrice: round2(total / qty),
    });
  }

  return { items, suggestedTax, suggestedTip, suggestedTotal, rawText };
}
