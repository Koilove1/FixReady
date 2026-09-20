/**
 * Demo mode: everything the app would keep in Firestore, kept in this
 * browser's localStorage instead. Nothing syncs between devices — it's here so
 * the app is usable before a Firebase project exists.
 */
import type { Ticket, TicketPhoto } from './types';
import { normalizeStatus } from './types';
import { readStored, writeStored, removeStored } from './storage';

const TICKETS_KEY = 'demoTickets';
/** Photos live under one key per ticket, so opening a ticket reads only its own. */
const photosKey = (ticketId: string) => `demoPhotos:${ticketId}`;

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * localStorage is capped at around 5MB, and inline photos are what will reach
 * it. Say so plainly rather than letting the write fail silently.
 */
function write(key: string, value: string): void {
  try {
    writeStored(key, value);
  } catch {
    throw new Error(
      'This device is out of demo storage space. Connect Firebase to keep adding photos.',
    );
  }
}

export function loadTickets(): Ticket[] {
  return parse<Ticket[]>(readStored(TICKETS_KEY), []).map((t) => ({
    ...t,
    status: normalizeStatus(t.status),
    fix: t.fix ?? null,
    materials: t.materials ?? null,
    completedAt: t.completedAt ?? null,
    photoCount: t.photoCount ?? 0,
  }));
}

export function saveTickets(tickets: Ticket[]): void {
  write(TICKETS_KEY, JSON.stringify(tickets));
}

export function loadPhotos(ticketId: string): TicketPhoto[] {
  return parse<TicketPhoto[]>(readStored(photosKey(ticketId)), []);
}

export function savePhotos(ticketId: string, photos: TicketPhoto[]): void {
  if (photos.length === 0) {
    removeStored(photosKey(ticketId));
    return;
  }
  write(photosKey(ticketId), JSON.stringify(photos));
}
