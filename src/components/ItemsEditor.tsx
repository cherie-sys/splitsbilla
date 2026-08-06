import type { Item, Person } from '../types';
import { makeId } from '../lib/util';
import { customShareEntered, customShareTarget, formatCurrency, lineTotal } from '../lib/split';

interface Props {
  items: Item[];
  people: Person[];
  currency: string;
  onChange: (items: Item[]) => void;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function ItemsEditor({ items, people, currency, onChange }: Props) {
  function updateItem(id: string, patch: Partial<Item>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }

  function duplicateItem(item: Item) {
    const copy: Item = { ...item, id: makeId(), serialNo: undefined };
    const index = items.findIndex((it) => it.id === item.id);
    onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
  }

  function addItem() {
    onChange([...items, { id: makeId(), name: '', price: 0, qty: 1, assignedTo: [] }]);
  }

  function toggleAssignee(item: Item, personId: string) {
    const has = item.assignedTo.includes(personId);
    const assignedTo = has
      ? item.assignedTo.filter((id) => id !== personId)
      : [...item.assignedTo, personId];

    // drop a removed person's custom share too, so it doesn't linger unused
    let customShares = item.customShares;
    if (has && customShares && personId in customShares) {
      customShares = { ...customShares };
      delete customShares[personId];
    }
    updateItem(item.id, { assignedTo, customShares });
  }

  function useEvenSplit(item: Item) {
    updateItem(item.id, { customShares: undefined, customSplitMode: undefined });
  }

  // Seeds a fresh, balanced starting point for the chosen mode — amounts or
  // servings both split evenly in decimal (e.g. 5 fries between 2 people
  // seeds 2.5 each), which is then editable down to whole or partial units.
  function useCustomSplit(item: Item, mode: 'amount' | 'qty') {
    if (item.customShares && item.customSplitMode === mode) return;
    const n = item.assignedTo.length;
    const seeded: Record<string, number> = {};
    const raw = mode === 'qty' ? item.qty : lineTotal(item);
    const even = Math.round((raw / n) * 100) / 100;
    for (const id of item.assignedTo) seeded[id] = even;
    updateItem(item.id, { customShares: seeded, customSplitMode: mode });
  }

  function setCustomShare(item: Item, personId: string, value: number) {
    const rounded = Math.round(value * 100) / 100;
    updateItem(item.id, { customShares: { ...(item.customShares ?? {}), [personId]: rounded } });
  }

  return (
    <div className="items-editor">
      {items.length === 0 && (
        <p className="hint">No items yet. Scan a receipt or add items manually.</p>
      )}

      {items.length > 0 && (
        <div className="item-row-labels">
          <span>Item</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Total</span>
        </div>
      )}

      {items.map((item) => {
        const isQtyMode = item.customSplitMode === 'qty';
        const entered = customShareEntered(item);
        const target = customShareTarget(item);
        const balanced = Math.abs(entered - target) <= 0.01;

        return (
          <div className="item-row" key={item.id}>
            <div className="item-row-main">
              <div className="item-name-wrap">
                {item.serialNo !== undefined && <span className="serial-badge">#{item.serialNo}</span>}
                <input
                  type="text"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  className="item-name"
                />
              </div>
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => updateItem(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                className="item-qty"
                title="Number of servings"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.price || ''}
                placeholder="0.00"
                onChange={(e) => updateItem(item.id, { price: Number(e.target.value) || 0 })}
                className="item-price"
                title="Price per serving"
              />
              <span className="item-line-total">{formatCurrency(lineTotal(item), currency)}</span>
              <button
                type="button"
                className="icon-btn duplicate-btn"
                aria-label="Duplicate item"
                title="Duplicate item"
                onClick={() => duplicateItem(item)}
              >
                ⎘
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove item"
                onClick={() => removeItem(item.id)}
              >
                ×
              </button>
            </div>

            {people.length > 0 && (
              <div className="item-assignees">
                {people.map((p) => {
                  const active = item.assignedTo.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`assignee-toggle ${active ? 'active' : ''}`}
                      style={{ '--chip-color': p.color } as React.CSSProperties}
                      onClick={() => toggleAssignee(item, p.id)}
                    >
                      {p.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="assignee-toggle ghost"
                  onClick={() => updateItem(item.id, { assignedTo: people.map((p) => p.id) })}
                >
                  Split all
                </button>
                {item.assignedTo.length > 0 && (
                  <button
                    type="button"
                    className="assignee-toggle ghost"
                    onClick={() =>
                      updateItem(item.id, { assignedTo: [], customShares: undefined, customSplitMode: undefined })
                    }
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {item.assignedTo.length >= 2 && (
              <div className="split-mode-row">
                <button
                  type="button"
                  className={`split-mode-btn ${!item.customShares ? 'active' : ''}`}
                  onClick={() => useEvenSplit(item)}
                >
                  Split evenly
                </button>
                <button
                  type="button"
                  className={`split-mode-btn ${item.customShares && !isQtyMode ? 'active' : ''}`}
                  onClick={() => useCustomSplit(item, 'amount')}
                >
                  Customize split
                </button>
                {item.qty >= 2 && (
                  <button
                    type="button"
                    className={`split-mode-btn ${isQtyMode ? 'active' : ''}`}
                    onClick={() => useCustomSplit(item, 'qty')}
                  >
                    By quantity
                  </button>
                )}
              </div>
            )}

            {item.customShares && item.assignedTo.length >= 2 && (
              <div className="custom-split-fields">
                {item.assignedTo.map((personId) => {
                  const person = people.find((p) => p.id === personId);
                  if (!person) return null;
                  return (
                    <label key={personId} className="custom-share-field">
                      <span
                        className="chip-dot"
                        style={{ '--chip-color': person.color } as React.CSSProperties}
                      />
                      <span className="custom-share-name">{person.name}</span>
                      <input
                        type="number"
                        min={0}
                        step={isQtyMode ? 0.1 : 0.01}
                        value={item.customShares?.[personId] ?? ''}
                        placeholder={isQtyMode ? '0' : '0.00'}
                        onChange={(e) => setCustomShare(item, personId, Number(e.target.value) || 0)}
                      />
                      {isQtyMode && <span className="custom-share-unit">servings</span>}
                    </label>
                  );
                })}
                <p className={`hint custom-split-hint ${balanced ? '' : 'mismatch'}`}>
                  {isQtyMode
                    ? `Entered ${round2(entered)} of ${round2(target)} serving${target === 1 ? '' : 's'}`
                    : `Entered ${formatCurrency(entered, currency)} of ${formatCurrency(target, currency)}`}
                  {!balanced && ' — shares will be scaled proportionally to match'}
                </p>
              </div>
            )}

            {item.assignedTo.length === 0 && (
              <p className="item-warning">Unassigned — won't be included in anyone's total.</p>
            )}
          </div>
        );
      })}

      <button type="button" className="btn" onClick={addItem}>
        + Add item
      </button>
    </div>
  );
}
