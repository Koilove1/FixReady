import { useState, type FormEvent } from 'react';
import { STATUS_LABEL, STATUS_ORDER } from '../types';
import type { Room, RoomStatus, RoomDetails } from '../types';

/** The name is collected once by the name gate, so the sheet only confirms it. */
export function StatusSheet({
  room,
  name,
  onClose,
  onSave,
}: {
  room: Room;
  name: string;
  onClose: () => void;
  onSave: (status: RoomStatus, details: RoomDetails) => void;
}) {
  // Prefill from the room so reopening it shows the last log, not a blank form.
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [issue, setIssue] = useState(room.issue ?? '');
  const [material, setMaterial] = useState(room.material ?? '');
  const [fix, setFix] = useState(room.fix ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(status, { issue, material, fix });
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <h2>Room {room.name}</h2>

        <div className="status-options">
          {STATUS_ORDER.map((option) => (
            <button
              type="button"
              key={option}
              className={`status-option status-${option} ${status === option ? 'active' : ''}`}
              onClick={() => setStatus(option)}
            >
              {STATUS_LABEL[option]}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="issue">
          What was the issue?
        </label>
        <textarea
          id="issue"
          rows={2}
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder="e.g. Leaking bathroom faucet"
        />

        <label className="field-label" htmlFor="material">
          What material was used?
        </label>
        <textarea
          id="material"
          rows={2}
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="e.g. New faucet cartridge, plumber's tape"
        />

        <label className="field-label" htmlFor="fix">
          How was it fixed?
        </label>
        <textarea
          id="fix"
          rows={2}
          value={fix}
          onChange={(e) => setFix(e.target.value)}
          placeholder="e.g. Replaced the cartridge and resealed the joint"
        />

        <p className="sheet-note">Saving as {name}</p>
        <button type="submit">Save</button>
        <button type="button" className="link-btn" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
