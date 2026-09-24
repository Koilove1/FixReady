import { useMemo, useState } from 'react';
import type { Ticket } from '../types';
import { TicketCard } from './TicketCard';

/** Enough to scroll through without building thousands of cards at once. */
const MAX_RESULTS = 200;

/** The date a ticket is filed under: when it was finished, or else when it was reported. */
function ticketDate(t: Ticket): number {
  return t.status === 'complete' && t.completedAt ? t.completedAt : t.reportedAt;
}

/** Local calendar day as "YYYY-MM-DD" — the format a date input gives back. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Every ticket ever logged, newest first and grouped by month. Recent and open
 * jobs are included too, so a search for a room never misses last week's visit
 * just because it still shows on the main list.
 */
export function HistoryScreen({
  tickets,
  onBack,
  onSelect,
}: {
  tickets: Ticket[];
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const [room, setRoom] = useState('');
  const [incident, setIncident] = useState('');
  const [date, setDate] = useState('');

  const roomDigits = room.replace(/\D/g, '');
  const incidentQuery = incident.trim().toLowerCase();
  const searching = roomDigits !== '' || incidentQuery !== '' || date !== '';

  const matches = useMemo(() => {
    // Every word has to appear, in any order: "leak sink" finds "sink is leaking".
    const words = incidentQuery.split(/\s+/).filter(Boolean);
    return tickets
      .filter((t) => {
        // Starts-with, so "2" narrows to the second floor and "214" to one room.
        if (roomDigits && !t.room.startsWith(roomDigits)) return false;
        if (words.length > 0) {
          const text = [t.problem, t.fix, t.materials].join(' ').toLowerCase();
          if (!words.every((w) => text.includes(w))) return false;
        }
        // A job matches a day if it was reported or finished on it.
        if (date && dayKey(t.reportedAt) !== date && (!t.completedAt || dayKey(t.completedAt) !== date)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => ticketDate(b) - ticketDate(a));
  }, [tickets, roomDigits, incidentQuery, date]);

  const groups = useMemo(() => {
    const out: { label: string; tickets: Ticket[] }[] = [];
    for (const t of matches.slice(0, MAX_RESULTS)) {
      const label = monthLabel(ticketDate(t));
      const last = out[out.length - 1];
      if (last && last.label === label) last.tickets.push(t);
      else out.push({ label, tickets: [t] });
    }
    return out;
  }, [matches]);

  function clear() {
    setRoom('');
    setIncident('');
    setDate('');
  }

  return (
    <>
      <header className="app-header">
        <div className="header-row">
          <button className="back-btn" onClick={onBack}>
            ‹ Back
          </button>
          <h1>History</h1>
          <span className="header-spacer" />
        </div>
        <div className="history-search">
          <input
            className="search-room"
            inputMode="numeric"
            autoComplete="off"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Room"
            aria-label="Room number"
          />
          <input
            className="search-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
          />
          <input
            className="search-incident"
            type="search"
            autoComplete="off"
            value={incident}
            onChange={(e) => setIncident(e.target.value)}
            placeholder="Incident, e.g. faucet"
            aria-label="Incident"
          />
        </div>
        <div className="history-status">
          <span>
            {matches.length} {matches.length === 1 ? 'report' : 'reports'}
            {searching ? ' found' : ''}
          </span>
          {searching && (
            <button className="link-btn" onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </header>

      <main className="ticket-list">
        {matches.length === 0 && (
          <p className="muted">
            {searching ? 'No reports match that search.' : 'No maintenance reports yet.'}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.label} className="history-group">
            <h2 className="history-month">{g.label}</h2>
            {g.tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onTap={() => onSelect(t.id)} />
            ))}
          </section>
        ))}
        {matches.length > MAX_RESULTS && (
          <p className="muted">
            Showing the newest {MAX_RESULTS}. Search by room, incident or date to find older ones.
          </p>
        )}
      </main>
    </>
  );
}
