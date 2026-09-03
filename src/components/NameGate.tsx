import { useState, type FormEvent } from 'react';

/**
 * Maintenance says who it is once, when the role is picked, so every room
 * afterwards is attributed without asking again card by card. Prefilled from
 * the last name used on this device, so the usual case is one tap.
 */
export function NameGate({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div className="screen-center">
      <form className="name-card" onSubmit={handleSubmit}>
        <h1>Maintenance</h1>
        <p>Your name goes on every room you update, so the front desk knows who to ask.</p>
        <label className="field-label" htmlFor="staff-name">
          Your name
        </label>
        <input
          id="staff-name"
          autoFocus
          autoComplete="name"
          autoCapitalize="words"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Maria"
        />
        <button type="submit" disabled={!trimmed}>
          Continue
        </button>
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
