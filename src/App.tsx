import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { ensureSignedIn, isFirebaseConfigured } from './firebase';
import { useRooms, describeError } from './hooks/useRooms';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RoomCard } from './components/RoomCard';
import { StatusSheet } from './components/StatusSheet';
import { NameGate } from './components/NameGate';
import { FloorSection } from './components/FloorSection';
import { RolePicker, ROLE_LABEL, loadRole, saveRole, clearRole } from './components/RolePicker';
import type { Role } from './components/RolePicker';
import { loadName, saveName } from './staffName';
import { exportLogToXlsx } from './exportXlsx';
import { STATUS_ORDER, STATUS_LABEL, FLOOR_IDS, floorOf } from './types';
import type { Room, RoomStatus, RoomDetails } from './types';

type Filter = 'all' | RoomStatus;

export default function App() {
  /** The opening screen shows on every launch, ahead of the role and name gates. */
  const [started, setStarted] = useState(false);
  const [role, setRole] = useState<Role | null>(loadRole);
  const [name, setName] = useState(loadName);
  /** Set when maintenance is picked, so choosing the role always asks who's holding the phone. */
  const [askName, setAskName] = useState(false);
  const { rooms, loading, error, slow, retry, setRoomStatus, loadRoomHistory, loadAllHistory } =
    useRooms();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [openFloors, setOpenFloors] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void ensureSignedIn();
  }, []);

  const counts = useMemo(() => {
    const c: Record<RoomStatus, number> = { clean: 0, dirty: 0, out_of_order: 0 };
    for (const r of rooms) c[r.status] += 1;
    return c;
  }, [rooms]);

  // Only digits matter in a room number, so ignore anything else that's typed.
  const query = search.replace(/\D/g, '');
  const narrowed = query.length > 0 || filter !== 'all';

  const visibleRooms = useMemo(
    () =>
      rooms.filter(
        (r) => (filter === 'all' || r.status === filter) && (!query || r.name.includes(query)),
      ),
    [rooms, filter, query],
  );

  const floors = useMemo(() => {
    const byFloor = new Map<string, Room[]>();
    for (const r of visibleRooms) {
      const f = floorOf(r.name);
      const list = byFloor.get(f);
      if (list) list.push(r);
      else byFloor.set(f, [r]);
    }
    return FLOOR_IDS.filter((f) => byFloor.has(f)).map((f) => ({
      id: f,
      rooms: byFloor.get(f) as Room[],
    }));
  }, [visibleRooms]);

  const selectedRoom = rooms.find((r) => r.id === selectedId) ?? null;

  if (!started) {
    return <WelcomeScreen onStart={() => setStarted(true)} />;
  }

  if (!role) {
    return (
      <RolePicker
        onPick={(picked) => {
          saveRole(picked);
          setRole(picked);
          if (picked === 'maintenance') setAskName(true);
        }}
      />
    );
  }

  // Maintenance writes to the board, so it signs in with a name before seeing it.
  if (role === 'maintenance' && (askName || !name)) {
    return (
      <NameGate
        initial={name}
        onSubmit={(entered) => {
          saveName(entered);
          setName(entered);
          setAskName(false);
        }}
        // There's no board to go back to until a name has been set at least once.
        onCancel={name ? () => setAskName(false) : undefined}
      />
    );
  }

  const canEdit = role === 'maintenance';

  /**
   * A write that never reaches Firestore still shows locally, so warn if it
   * hasn't confirmed — otherwise a lost change looks exactly like a saved one.
   */
  function saveStatus(room: Room, status: RoomStatus, details: RoomDetails) {
    setSaveError(null);
    let settled = false;
    const pending = setTimeout(() => {
      if (!settled) {
        setSaveError(`Room ${room.name} hasn't synced yet — keep the app open until it does.`);
      }
    }, 6000);
    setRoomStatus(room.id, status, name, details)
      .then(() => {
        settled = true;
        clearTimeout(pending);
        setSaveError(null);
      })
      .catch((err: unknown) => {
        settled = true;
        clearTimeout(pending);
        console.error('Failed to save room status', err);
        setSaveError(`Couldn't save Room ${room.name}. ${describeError(err)}`);
      });
  }

  /** Pull the full maintenance history and download it as an .xlsx. */
  async function handleExport() {
    setExporting(true);
    setSaveError(null);
    try {
      const entries = await loadAllHistory();
      if (entries.length === 0) {
        setSaveError('No maintenance history to export yet.');
        return;
      }
      await exportLogToXlsx(entries);
    } catch (err) {
      console.error('Export failed', err);
      setSaveError(`Couldn't build the spreadsheet. ${describeError(err)}`);
    } finally {
      setExporting(false);
    }
  }

  /** Tapping the active count clears the filter, so the pills double as a toggle. */
  function toggleFilter(status: RoomStatus) {
    setFilter((prev) => (prev === status ? 'all' : status));
    setOpenFloors({});
  }

  function switchRole() {
    clearRole();
    setRole(null);
    setSelectedId(null);
    setFilter('all');
    setSearch('');
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div className="header-title">
            <h1>FixReady</h1>
            <span className="role-tag">{ROLE_LABEL[role]}</span>
            {canEdit && (
              <button className="name-chip" onClick={() => setAskName(true)}>
                {name}
              </button>
            )}
          </div>
          <div className="header-actions">
            <button className="bell-btn" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button className="bell-btn" onClick={switchRole}>
              Switch
            </button>
          </div>
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
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            inputMode="numeric"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpenFloors({});
            }}
            placeholder="Search room number"
            aria-label="Search room number"
          />
          {search && (
            <button
              className="search-clear"
              onClick={() => {
                setSearch('');
                setOpenFloors({});
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <p className="role-hint">
          {filter === 'all'
            ? canEdit
              ? 'Tap a count to filter, or a room to change its status.'
              : 'Tap a count above to see just those rooms.'
            : `Showing ${STATUS_LABEL[filter]} only — tap it again to show all rooms.`}
        </p>
      </header>

      {saveError && (
        <div className="alert warning">
          <span>{saveError}</span>
          <button className="link-btn" onClick={() => setSaveError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <main className="room-list">
        {loading && !slow && <p className="muted">Loading rooms…</p>}
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
        {!loading && !error && floors.length === 0 && (
          <p className="muted">
            {query ? `No room matching "${query}".` : 'No rooms with this status.'}
          </p>
        )}
        {floors.map(({ id, rooms: floorRooms }) => (
          <FloorSection
            key={id}
            label={`Floor ${id}`}
            rooms={floorRooms}
            // Floors start closed, but a search or status filter opens them so
            // matches are never hidden behind a collapsed section.
            open={openFloors[id] ?? narrowed}
            onToggle={() => setOpenFloors((prev) => ({ ...prev, [id]: !(prev[id] ?? narrowed) }))}
          >
            {floorRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onTap={canEdit ? () => setSelectedId(room.id) : undefined}
              />
            ))}
          </FloorSection>
        ))}
      </main>

      {canEdit && selectedRoom && (
        <StatusSheet
          room={selectedRoom}
          name={name}
          onClose={() => setSelectedId(null)}
          onSave={(status, details) => saveStatus(selectedRoom, status, details)}
          loadHistory={loadRoomHistory}
        />
      )}
    </div>
  );
}
