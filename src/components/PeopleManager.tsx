import { useState } from 'react';
import type { Person } from '../types';
import { makeId, nextColor, findByName } from '../lib/util';

interface Props {
  roster: Person[]; // everyone ever added, across the whole event
  selectedIds: string[]; // who's part of the active bill
  onRosterChange: (people: Person[]) => void;
  onSelectionChange: (ids: string[]) => void;
}

export default function PeopleManager({ roster, selectedIds, onRosterChange, onSelectionChange }: Props) {
  const [name, setName] = useState('');

  function toggle(id: string) {
    const has = selectedIds.includes(id);
    onSelectionChange(has ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  function addPerson() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = findByName(roster, trimmed);
    if (existing) {
      if (!selectedIds.includes(existing.id)) onSelectionChange([...selectedIds, existing.id]);
    } else {
      const person: Person = { id: makeId(), name: trimmed, color: nextColor(roster.length) };
      onRosterChange([...roster, person]);
      onSelectionChange([...selectedIds, person.id]);
    }
    setName('');
  }

  function deleteFromRoster(id: string, personName: string) {
    if (!confirm(`Remove ${personName} everywhere — from every bill and item they're part of?`)) return;
    onRosterChange(roster.filter((p) => p.id !== id));
  }

  return (
    <div className="people-manager">
      <div className="people-list">
        {roster.map((p) => {
          const active = selectedIds.includes(p.id);
          return (
            <span
              key={p.id}
              className={`chip person-chip ${active ? 'active' : 'inactive'}`}
              style={{ '--chip-color': p.color } as React.CSSProperties}
            >
              <button type="button" className="chip-toggle" onClick={() => toggle(p.id)}>
                <span className="chip-dot" />
                {p.name}
              </button>
              <button
                type="button"
                className="chip-remove"
                aria-label={`Remove ${p.name} from everywhere`}
                onClick={() => deleteFromRoster(p.id, p.name)}
              >
                ×
              </button>
            </span>
          );
        })}
        {roster.length === 0 && <p className="hint">Add everyone splitting this bill.</p>}
      </div>
      {roster.length > 0 && (
        <p className="hint people-hint">Tap a name to include or leave them out of this bill.</p>
      )}

      <form
        className="people-add"
        onSubmit={(e) => {
          e.preventDefault();
          addPerson();
        }}
      >
        <input
          type="text"
          placeholder="Friend's name"
          value={name}
          list="people-suggestions"
          onChange={(e) => setName(e.target.value)}
        />
        <datalist id="people-suggestions">
          {roster.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <button type="submit" className="btn">Add</button>
      </form>
    </div>
  );
}
