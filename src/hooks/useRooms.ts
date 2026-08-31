import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { loadRooms, saveRooms, loadLog, appendLog } from '../localStore';
import { ROOM_NUMBERS, normalizeStatus } from '../types';
import type { Room, RoomStatus, RoomDetails, LogEntry } from '../types';

/** Turn a Firestore log document into the LogEntry the app and export use. */
function mapLogDoc(d: QueryDocumentSnapshot): LogEntry {
  const data = d.data();
  return {
    id: d.id,
    roomName: String(data.roomName ?? ''),
    status: normalizeStatus(data.status),
    issue: data.issue ?? null,
    material: data.material ?? null,
    fix: data.fix ?? null,
    updatedBy: data.updatedBy ?? null,
    createdAt: (data.createdAt as Timestamp | null)?.toMillis?.() ?? 0,
  };
}

/** How long to wait before telling the user the database isn't answering. */
const SLOW_MS = 8000;

/** Firestore error codes are terse; say what a staff member can act on. */
export function describeError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'permission-denied':
    case 'unauthenticated':
      return 'The database refused the request. Check that Anonymous sign-in is still enabled in Firebase.';
    case 'unavailable':
    case 'deadline-exceeded':
      return "Can't reach the database — check your connection.";
    case 'failed-precondition':
    case 'not-found':
      return 'The Firestore database for this project is missing.';
    default:
      return 'Something went wrong talking to the database.';
  }
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True while still loading past SLOW_MS: offline listeners never call back. */
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const seeded = useRef(false);

  useEffect(() => {
    if (!db) {
      setRooms(loadRooms());
      setLoading(false);
      return;
    }
    const database = db;
    const q = query(collection(database, 'rooms'), orderBy('name'));

    // Firestore stays silent when the device is offline — no snapshot and no
    // error — so a timer is the only way out of an endless "Loading rooms…".
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Room[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name),
              status: normalizeStatus(data.status),
              issue: data.issue ?? null,
              material: data.material ?? null,
              fix: data.fix ?? null,
              updatedBy: data.updatedBy ?? null,
              updatedAt: (data.updatedAt as Timestamp | null)?.toMillis?.() ?? null,
              createdAt: (data.createdAt as Timestamp | null)?.toMillis?.() ?? 0,
            };
          })
          // The property has a fixed room list; ignore anything else in the collection.
          .filter((r) => ROOM_NUMBERS.includes(r.name));

        // Create any of the 62 rooms that don't exist yet (first run on a new project).
        if (!seeded.current) {
          seeded.current = true;
          const present = new Set(next.map((r) => r.name));
          const missing = ROOM_NUMBERS.filter((name) => !present.has(name));
          if (missing.length > 0) {
            const batch = writeBatch(database);
            for (const name of missing) {
              batch.set(doc(database, 'rooms', name), {
                name,
                status: 'clean',
                issue: null,
                material: null,
                fix: null,
                updatedBy: null,
                updatedAt: null,
                createdAt: serverTimestamp(),
              });
            }
            batch.commit().catch((err) => {
              console.error('Failed to create the room list', err);
              seeded.current = false;
              setError(describeError(err));
            });
          }
        }

        clearTimeout(slowTimer);
        setSlow(false);
        setError(null);
        setRooms(next);
        setLoading(false);
      },
      (err) => {
        console.error('Room listener failed', err);
        clearTimeout(slowTimer);
        setSlow(false);
        setError(describeError(err));
        setLoading(false);
      },
    );

    return () => {
      clearTimeout(slowTimer);
      unsub();
    };
  }, [attempt]);

  /** Tear down the listener and start a fresh one. */
  function retry() {
    seeded.current = false;
    setError(null);
    setSlow(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }

  /** Rejects if the change didn't reach the database, so callers can say so. */
  async function setRoomStatus(
    roomId: string,
    status: RoomStatus,
    updatedBy: string,
    details: RoomDetails,
  ) {
    // Keep empty notes out of the document — store null, not "".
    const issue = details.issue.trim() || null;
    const material = details.material.trim() || null;
    const fix = details.fix.trim() || null;

    if (!isFirebaseConfigured || !db) {
      const room = rooms.find((r) => r.id === roomId);
      const now = Date.now();
      const next = rooms.map((r) =>
        r.id === roomId
          ? { ...r, status, issue, material, fix, updatedBy, updatedAt: now }
          : r,
      );
      saveRooms(next);
      setRooms(next);
      if (room) {
        appendLog({
          id: `demo-${now}`,
          roomName: room.name,
          status,
          issue,
          material,
          fix,
          updatedBy,
          createdAt: now,
        });
      }
      return;
    }

    // The room doc keeps the latest state for the board; the log subcollection
    // keeps every change. Writing both in one batch keeps them consistent.
    const batch = writeBatch(db);
    batch.update(doc(db, 'rooms', roomId), {
      status,
      issue,
      material,
      fix,
      updatedBy,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, 'rooms', roomId, 'log')), {
      roomName: roomId,
      status,
      issue,
      material,
      fix,
      updatedBy,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  }

  /** A single room's history, newest first — loaded when its sheet opens. */
  const loadRoomHistory = useCallback(async (roomId: string): Promise<LogEntry[]> => {
    if (!isFirebaseConfigured || !db) {
      const name = roomId.startsWith('demo-') ? roomId.slice(5) : roomId;
      return loadLog()
        .filter((e) => e.roomName === name)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    const snap = await getDocs(collection(db, 'rooms', roomId, 'log'));
    return snap.docs.map(mapLogDoc).sort((a, b) => b.createdAt - a.createdAt);
  }, []);

  /** Every room's history, newest first — the source for the Excel export. */
  const loadAllHistory = useCallback(async (): Promise<LogEntry[]> => {
    if (!isFirebaseConfigured || !db) {
      return loadLog().sort((a, b) => b.createdAt - a.createdAt);
    }
    const snap = await getDocs(collectionGroup(db, 'log'));
    return snap.docs.map(mapLogDoc).sort((a, b) => b.createdAt - a.createdAt);
  }, []);

  return { rooms, loading, error, slow, retry, setRoomStatus, loadRoomHistory, loadAllHistory };
}
