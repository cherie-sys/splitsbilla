# SplitsBilla

Scan a receipt, split it your way.

SplitsBilla is a bill-splitting app: scan a receipt (client-side OCR, no
account or API key needed), and it breaks the bill down item by item so each
item can be kept for one person or split evenly across several. Group
multiple bills — say, every receipt from a trip — under one event with a
combined summary of who owes what overall.

## Features

- **Receipt scanning** — photograph or upload a receipt; OCR runs entirely
  in the browser via Tesseract.js.
- **Per-item splitting** — assign each item to one person or split it across
  several; unassigned items are flagged.
- **Servings-aware parsing** — extracts unit price, quantity, and line total
  separately from the receipt text.
- **Duplicate/overlap detection** — rescanning the same receipt (or a second
  overlapping photo of a long receipt) won't double-add items; matched by
  the receipt's serial number where available, otherwise by name and price.
- **Multi-currency** — pick from a dropdown; every total formats accordingly.
- **Receipt viewer** — every scanned photo is kept and viewable later so you
  can double-check the parse against the original.
- **Events with multiple bills** — group several bills (e.g. each meal on a
  trip) under one event, each with its own date, and see a combined
  per-person total across the whole event.
- **Start afresh** — clear a bill's scanned photos and scan-derived items
  without touching anything you added by hand.

## Development

```bash
npm install
npm run dev
```

Built with React, TypeScript, and Vite.
