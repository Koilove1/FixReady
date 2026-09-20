import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { ensureSignedIn, isFirebaseConfigured } from './firebase';
import { useTickets, describeError } from './hooks/useTickets';
import { WelcomeScreen, hasOpenedBefore, markOpened } from './components/WelcomeScreen';
import { TicketCard } from './components/TicketCard';
import { NewTicketSheet } from './components/NewTicketSheet';
import { TicketSheet } from './components/TicketSheet';
import { exportTicketsToXlsx } from './exportXlsx';
import { STATUS_ORDER, STATUS_LABEL } from './types';
import type { TicketStatus, TicketWork } from './types';

type Filter = 'all' | TicketStatus;

/** How long a write may stay unconfirmed before the app says so. */
const SYNC_WARN_MS = 6000;

export default function App() {
  /** The opening screen is a first-run introduction; later launches skip it. */
  const [started, setStarted] = useState(hasOpenedBefore);
  const {
    tickets,
    loading,
    error,
    slow,
    retry,
    createTicket,
    saveWork,
    completeTicket,
    reopenTicket,
    fetchPhotos,
    addPhoto,
    removePhoto,
  } = useTickets();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void ensureSignedIn();
  }, []);

  const counts = useMemo(() => {
    const c: Record<TicketStatus, number> = { open: 0, complete: 0 };
    for (const t of tickets) c[t.status] += 1;
    return c;
  }, [tickets]);

  /**
   * Open jobs come first whatever the sort — the list exists to show what
   * still needs doing. Inside each group the newest is on top, which for a
   * finished job means the day it was finished, not the day it was reported.
   */
  const visible = useMemo(() => {
    const shown = tickets.filter((t) => filter === 'all' || t.status === filter);
    return shown.slice().sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      if (a.status === 'complete') return (b.completedAt ?? 0) - (a.completedAt ?? 0);
      return b.reportedAt - a.reportedAt;
    });
  }, [tickets, filter]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  if (!started) {
    return (
      <WelcomeScreen
        onStart={() => {
          markOpened();
          setStarted(true);
        }}
      />
    );
  }

  /**
   * Every write goes through here so a failure is reported the same way. A
   * write that never reaches Firestore still shows on this phone, so a write
   * that hasn't confirmed gets called out — otherwise a lost change looks
   * exactly like a saved one.
   */
  function run(action: Promise<unknown>, subject: string) {
    setSaveError(null);
    let settled = false;
    const pending = setTimeout(() => {
      if (!settled) {
        setSaveError(`${subject} hasn't synced yet — keep the app open until it does.`);
      }
    }, SYNC_WARN_MS);
    action
      .then(() => {
        settled = true;
        clearTimeout(pending);
        setSaveError(null);
      })
      .catch((err: unknown) => {
        settled = true;
        clearTimeout(pending);
        console.error(`Write failed for ${subject}`, err);
        setSaveError(`Couldn't save ${subject}. ${describeError(err)}`);
      });
  }

  /**
   * The sheet closes straight away rather than waiting on the write. Firestore
   * only settles that promise once the server has it, so waiting would hang
   * the form offline — which is where half this property's dead spots are.
   * The report is already in the local cache, so it shows up in the list
   * immediately either way, and `run` warns if it never reaches the server.
   */
  function handleCreate(room: string, problem: string) {
    setComposing(false);
    run(createTicket(room, problem), `Room ${room}`);
  }

  function handleSave(work: TicketWork) {
    if (!selected) return;
    run(saveWork(selected.id, work), `Room ${selected.room}`);
    setSelectedId(null);
  }

  function handleComplete(work: TicketWork) {
    if (!selected) return;
    run(completeTicket(selected.id, work), `Room ${selected.room}`);
    setSelectedId(null);
  }

  function handleReopen() {
    if (!selected) return;
    run(reopenTicket(selected.id), `Room ${selected.room}`);
    setSelectedId(null);
  }

  /** Build the spreadsheet from what the listener already holds. */
  async function handleExport() {
    setExporting(true);
    setSaveError(null);
    try {
      if (tickets.length === 0) {
        setSaveError('No maintenance reports to export yet.');
        return;
      }
      await exportTicketsToXlsx(tickets);
    } catch (err) {
      console.error('Export failed', err);
      setSaveError(`Couldn't build the spreadsheet. ${describeError(err)}`);
    } finally {
      setExporting(false);
    }
  }

  /** Tapping the active count clears the filter, so the pills double as a toggle. */
  function toggleFilter(status: TicketStatus) {
    setFilter((prev) => (prev === status ? 'all' : status));
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <h1>FixReady</h1>
          <button className="bell-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
        {!isFirebaseConfigured && (
          <p className="demo-banner">
            Demo mode — data stays on this device. Add Firebase config to sync across phones.
          </p>
        )}
        <div className="summary">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              className={`summary-pill status-${s} ${filter === s ? 'active' : ''}`}
              onClick={() => toggleFilter(s)}
              aria-pressed={filter === s}
            >
              <span className="summary-count">{counts[s]}</span>
              <span className="summary-label">{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>
      </header>

      {saveError && (
        <div className="alert warning">
          <span>{saveError}</span>
          <button className="link-btn" onClick={() => setSaveError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <main className="ticket-list">
        {loading && !slow && <p className="muted">Loading reports…</p>}
        {loading && slow && (
          <div className="alert">
            <span>Still waiting on the database. You may be offline.</span>
            <button className="link-btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {!loading && error && (
          <div className="alert">
            <span>{error}</span>
            <button className="link-btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <p className="muted">
            {filter === 'all'
              ? 'No maintenance reports yet. Tap + to add the first one.'
              : `No ${STATUS_LABEL[filter].toLowerCase()} reports.`}
          </p>
        )}
        {visible.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onTap={() => setSelectedId(ticket.id)} />
        ))}
      </main>

      <button className="fab" onClick={() => setComposing(true)} aria-label="New maintenance report">
        +
      </button>

      {composing && <NewTicketSheet onClose={() => setComposing(false)} onCreate={handleCreate} />}

      {selected && (
        <TicketSheet
          ticket={selected}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
          onComplete={handleComplete}
          onReopen={handleReopen}
          fetchPhotos={fetchPhotos}
          addPhoto={addPhoto}
          removePhoto={removePhoto}
        />
      )}
    </div>
  );
}
