import { useMemo, useState, type FormEvent } from 'react';
import { ROOM_NUMBERS, isRoom } from '../types';

/** Enough suggestions to be useful without pushing the form off screen. */
const MAX_SUGGESTIONS = 8;

export function NewTicketSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (room: string, problem: string) => void;
}) {
  const [room, setRoom] = useState('');
  const [problem, setProblem] = useState('');

  // Only digits matter in a room number, so ignore anything else that's typed.
  const digits = room.replace(/\D/g, '');
  const valid = isRoom(digits);

  // Matching anywhere in the number means "08" finds 108, 208 and 308 — the
  // same shorthand the old room board used.
  const suggestions = useMemo(() => {
    if (!digits || valid) return [];
    return ROOM_NUMBERS.filter((r) => r.includes(digits)).slice(0, MAX_SUGGESTIONS);
  }, [digits, valid]);

  const ready = valid && problem.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    onCreate(digits, problem);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <h2>New maintenance report</h2>

        <label className="field-label" htmlFor="room">
          Room number
        </label>
        <input
          id="room"
          inputMode="numeric"
          autoComplete="off"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g. 214"
          autoFocus
        />
        {suggestions.length > 0 && (
          <div className="room-suggestions">
            {suggestions.map((r) => (
              <button type="button" key={r} className="room-chip" onClick={() => setRoom(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
        {digits.length > 0 && !valid && suggestions.length === 0 && (
          <p className="field-error">No room {digits} on this property.</p>
        )}

        <label className="field-label" htmlFor="problem">
          What's wrong?
        </label>
        <textarea
          id="problem"
          rows={3}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="e.g. Bathroom faucet is leaking at the base"
        />

        <button type="submit" disabled={!ready}>
          Create report
        </button>
        <button type="button" className="link-btn" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
