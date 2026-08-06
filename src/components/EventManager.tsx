import type { Bill, EventInfo } from '../types';
import { subtotal, formatCurrency } from '../lib/split';
import { formatDate } from '../lib/util';

interface Props {
  event: EventInfo;
  onEventChange: (event: EventInfo) => void;
  bills: Bill[];
  activeBillId: string;
  currency: string;
  onSelectBill: (id: string) => void;
  onAddBill: () => void;
  onRenameBill: (id: string, name: string) => void;
  onDateBill: (id: string, date: string) => void;
  onDeleteBill: (id: string) => void;
}

export default function EventManager({
  event,
  onEventChange,
  bills,
  activeBillId,
  currency,
  onSelectBill,
  onAddBill,
  onRenameBill,
  onDateBill,
  onDeleteBill,
}: Props) {
  return (
    <div className="event-manager">
      <div className="event-fields">
        <label className="event-field">
          <span>Event name</span>
          <input
            type="text"
            value={event.name}
            placeholder="e.g. Goa Trip"
            onChange={(e) => onEventChange({ ...event, name: e.target.value })}
          />
        </label>
        <label className="event-field">
          <span>Starts</span>
          <input
            type="date"
            value={event.startDate}
            onChange={(e) => {
              const startDate = e.target.value;
              // keep the range valid: pushing the start past the end drags the end along
              const endDate = event.endDate && event.endDate < startDate ? startDate : event.endDate;
              onEventChange({ ...event, startDate, endDate });
            }}
          />
        </label>
        <label className="event-field">
          <span>Ends</span>
          <input
            type="date"
            value={event.endDate}
            min={event.startDate}
            onChange={(e) => {
              const endDate = e.target.value;
              // and pulling the end before the start drags the start along too
              const startDate = event.startDate && event.startDate > endDate ? endDate : event.startDate;
              onEventChange({ ...event, startDate, endDate });
            }}
          />
        </label>
      </div>

      <p className="hint event-range-hint">
        {event.startDate === event.endDate
          ? formatDate(event.startDate)
          : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`}
      </p>

      <h3 className="bills-heading">Bills in this event</h3>
      <div className="bill-list">
        {bills.map((bill) => {
          const isActive = bill.id === activeBillId;
          const total = subtotal(bill.items);
          return (
            <div
              key={bill.id}
              className={`bill-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectBill(bill.id)}
            >
              <div className="bill-card-fields">
                <input
                  type="text"
                  className="bill-name-input"
                  value={bill.name}
                  placeholder="Bill name"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameBill(bill.id, e.target.value)}
                />
                <input
                  type="date"
                  className="bill-date-input"
                  value={bill.date}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onDateBill(bill.id, e.target.value)}
                />
              </div>
              <div className="bill-card-meta">
                <span>
                  {bill.items.length} item{bill.items.length === 1 ? '' : 's'} ·{' '}
                  {formatCurrency(total, currency)}
                </span>
                {bills.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete ${bill.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${bill.name}"? This removes its items and scanned receipts.`)) {
                        onDeleteBill(bill.id);
                      }
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn" onClick={onAddBill}>
        + Add smaller event
      </button>
    </div>
  );
}
