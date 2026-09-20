import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  setDoc,
  writeBatch,
  increment,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { loadTickets, saveTickets, loadPhotos, savePhotos } from '../localStore';
import { normalizeStatus } from '../types';
import type { Ticket, TicketWork, TicketPhoto } from '../types';

/** How long to wait before telling the user the database isn't answering. */
const SLOW_MS = 8000;

/** Firestore error codes are terse; say what someone can actually act on. */
export function describeError(err: unknown): string {
  // A thrown Error with our own message (photo too big, storage full) is
  // already written for a person — pass it straight through.
  if (err instanceof Error && !('code' in err)) return err.message;
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
    case 'invalid-argument':
      return 'That photo was too large to save.';
    default:
      return 'Something went wrong talking to the database.';
  }
}

function newId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapTicket(d: QueryDocumentSnapshot): Ticket {
  const data = d.data();
  return {
    id: d.id,
    room: String(data.room ?? ''),
    problem: String(data.problem ?? ''),
    reportedAt: Number(data.reportedAt ?? 0),
    status: normalizeStatus(data.status),
    fix: data.fix ?? null,
    materials: data.materials ?? null,
    completedAt: data.completedAt ?? null,
    // A count can only drift downwards through a failed write; never show < 0.
    photoCount: Math.max(0, Number(data.photoCount ?? 0)),
  };
}

/** Empty notes are stored as null, not "". */
const clean = (s: string) => s.trim() || null;

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True while still loading past SLOW_MS: offline listeners never call back. */
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!db) {
      setTickets(loadTickets());
      setLoading(false);
      return;
    }
    // Times are written by the client rather than the server. serverTimestamp()
    // reads back null until the write confirms, which would drop a just-created
    // ticket to the bottom of this ordering on the phone that made it.
    const q = query(collection(db, 'tickets'), orderBy('reportedAt', 'desc'));

    // Firestore stays silent when the device is offline — no snapshot and no
    // error — so a timer is the only way out of an endless "Loading…".
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);

    const unsub = onSnapshot(
      q,
      (snap) => {
        clearTimeout(slowTimer);
        setSlow(false);
        setError(null);
        setTickets(snap.docs.map(mapTicket));
        setLoading(false);
      },
      (err) => {
        console.error('Ticket listener failed', err);
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
  const retry = useCallback(() => {
    setError(null);
    setSlow(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  /** In demo mode, apply a change to the stored list and re-render from it. */
  const patchLocal = useCallback((id: string, changes: Partial<Ticket>) => {
    const next = loadTickets().map((t) => (t.id === id ? { ...t, ...changes } : t));
    saveTickets(next);
    setTickets(next);
  }, []);

  const createTicket = useCallback(async (room: string, problem: string) => {
    const ticket: Ticket = {
      id: newId(),
      room,
      problem: problem.trim(),
      reportedAt: Date.now(),
      status: 'open',
      fix: null,
      materials: null,
      completedAt: null,
      photoCount: 0,
    };
    if (!isFirebaseConfigured || !db) {
      const next = [ticket, ...loadTickets()];
      saveTickets(next);
      setTickets(next);
      return ticket.id;
    }
    const { id, ...fields } = ticket;
    await setDoc(doc(db, 'tickets', id), fields);
    return id;
  }, []);

  /** Record the work so far without closing the ticket. */
  const saveWork = useCallback(
    async (id: string, work: TicketWork) => {
      const changes = { fix: clean(work.fix), materials: clean(work.materials) };
      if (!isFirebaseConfigured || !db) {
        patchLocal(id, changes);
        return;
      }
      await updateDoc(doc(db, 'tickets', id), changes);
    },
    [patchLocal],
  );

  const completeTicket = useCallback(
    async (id: string, work: TicketWork) => {
      const changes = {
        fix: clean(work.fix),
        materials: clean(work.materials),
        status: 'complete' as const,
        completedAt: Date.now(),
      };
      if (!isFirebaseConfigured || !db) {
        patchLocal(id, changes);
        return;
      }
      await updateDoc(doc(db, 'tickets', id), changes);
    },
    [patchLocal],
  );

  /** Closed by mistake, or the problem came back. */
  const reopenTicket = useCallback(
    async (id: string) => {
      const changes = { status: 'open' as const, completedAt: null };
      if (!isFirebaseConfigured || !db) {
        patchLocal(id, changes);
        return;
      }
      await updateDoc(doc(db, 'tickets', id), changes);
    },
    [patchLocal],
  );

  /** A ticket's photos, oldest first — loaded only when its sheet opens. */
  const fetchPhotos = useCallback(async (ticketId: string): Promise<TicketPhoto[]> => {
    if (!isFirebaseConfigured || !db) {
      return loadPhotos(ticketId).sort((a, b) => a.createdAt - b.createdAt);
    }
    const snap = await getDocs(collection(db, 'tickets', ticketId, 'photos'));
    return snap.docs
      .map((d) => ({
        id: d.id,
        dataUrl: String(d.data().dataUrl ?? ''),
        createdAt: Number(d.data().createdAt ?? 0),
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, []);

  /**
   * `dataUrl` is already compressed by the caller — see photos.ts.
   *
   * Returns the new photo straight away and the write separately, rather than
   * resolving once it lands. Firestore only settles a write when the server
   * has it, so awaiting one offline would leave the thumbnail missing and the
   * sheet stuck mid-upload, even though the photo is safely in the local cache.
   */
  const addPhoto = useCallback(
    (ticketId: string, dataUrl: string): { photo: TicketPhoto; saved: Promise<unknown> } => {
      const photo: TicketPhoto = { id: newId(), dataUrl, createdAt: Date.now() };
      if (!isFirebaseConfigured || !db) {
        try {
          const photos = [...loadPhotos(ticketId), photo];
          savePhotos(ticketId, photos);
          patchLocal(ticketId, { photoCount: photos.length });
          return { photo, saved: Promise.resolve() };
        } catch (err) {
          // Demo storage is full — hand the caller a rejection to report.
          return { photo, saved: Promise.reject(err) };
        }
      }
      // The photo and the count it feeds have to move together, or the list
      // badge stops matching what the ticket actually holds.
      const batch = writeBatch(db);
      batch.set(doc(db, 'tickets', ticketId, 'photos', photo.id), {
        dataUrl: photo.dataUrl,
        createdAt: photo.createdAt,
      });
      batch.update(doc(db, 'tickets', ticketId), { photoCount: increment(1) });
      return { photo, saved: batch.commit() };
    },
    [patchLocal],
  );

  /** Fires the deletes and returns without waiting, for the same reason. */
  const removePhoto = useCallback(
    (ticketId: string, photoId: string): Promise<unknown> => {
      if (!isFirebaseConfigured || !db) {
        try {
          const photos = loadPhotos(ticketId).filter((p) => p.id !== photoId);
          savePhotos(ticketId, photos);
          patchLocal(ticketId, { photoCount: photos.length });
          return Promise.resolve();
        } catch (err) {
          return Promise.reject(err);
        }
      }
      // Rules forbid updating a photo but allow deleting one, so this can't be
      // a batch with the counter — delete first, then correct the count.
      const database = db;
      return deleteDoc(doc(database, 'tickets', ticketId, 'photos', photoId)).then(() =>
        updateDoc(doc(database, 'tickets', ticketId), { photoCount: increment(-1) }),
      );
    },
    [patchLocal],
  );

  return {
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
  };
}
