import { useEffect, useState, type FormEvent } from 'react';
import { STATUS_LABEL, STATUS_ORDER } from '../types';
import type { Room, RoomStatus, RoomDetails, LogEntry } from '../types';

function formatDate(ms: number): string {
  return ms ? new Date(ms).toLocaleString() : '';
}

/** The name is collected once by the name gate, so the sheet only confirms it. */
export function StatusSheet({
  room,
  name,
  onClose,
  onSave,
  loadHistory,
}: {
  room: Room;
  name: string;
  onClose: () => void;
  onSave: (status: RoomStatus, details: RoomDetails) => void;
  loadHistory: (roomId: string) => Promise<LogEntry[]>;
}) {
  // Prefill from the room so reopening it shows the last log, not a blank form.
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [issue, setIssue] = useState(room.issue ?? '');
  const [material, setMaterial] = useState(room.material ?? '');
  const [fix, setFix] = useState(room.fix ?? '');

  const [history, setHistory] = useState<LogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load this room's past entries when the sheet opens.
  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    loadHistory(room.id)
      .then((entries) => {
        if (active) setHistory(entries);
      })
      .catch((err) => {
        console.error('Failed to load room history', err);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [room.id, loadHistory]);

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
        <button type="submit">Save entry</button>
        <button type="button" className="link-btn" onClick={onClose}>
          Cancel
        </button>

        <div className="history">
          <p className="field-label">History</p>
          {loadingHistory ? (
            <p className="history-empty">Loading…</p>
          ) : history.length === 0 ? (
            <p className="history-empty">No past entries for this room yet.</p>
          ) : (
            <ul className="history-list">
              {history.map((entry) => (
                <li key={entry.id} className="history-item">
                  <div className="history-head">
                    <span className={`history-status status-${entry.status}`}>
                      {STATUS_LABEL[entry.status]}
                    </span>
                    <span className="history-date">{formatDate(entry.createdAt)}</span>
                  </div>
                  {entry.issue && (
                    <p className="history-line">
                      <b>Issue:</b> {entry.issue}
                    </p>
                  )}
                  {entry.material && (
                    <p className="history-line">
                      <b>Material:</b> {entry.material}
                    </p>
                  )}
                  {entry.fix && (
                    <p className="history-line">
                      <b>Fix:</b> {entry.fix}
                    </p>
                  )}
                  {entry.updatedBy && <p className="history-by">— {entry.updatedBy}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </div>
  );
}
