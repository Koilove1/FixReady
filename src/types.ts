/**
 * A ticket is one maintenance job on one room: reported with a problem, then
 * worked and closed with a description of the fix and the materials it took.
 * Rooms have no state of their own any more — the record is the list of jobs.
 */
export type TicketStatus = 'open' | 'complete';

export interface Ticket {
  id: string;
  /** Room number, e.g. "214". Always one of ROOM_NUMBERS. */
  room: string;
  /** What's wrong — filled in when the ticket is created. */
  problem: string;
  reportedAt: number;
  status: TicketStatus;
  /** What was done about it. Filled in while the job is worked. */
  fix: string | null;
  /** Parts, materials and tools the repair took. */
  materials: string | null;
  completedAt: number | null;
  /**
   * Denormalised so the list can show a photo badge without reading the
   * photos subcollection for every ticket on screen.
   */
  photoCount: number;
}

/** The work written back to a ticket — saved on its own or alongside closing it. */
export interface TicketWork {
  fix: string;
  materials: string;
}

/**
 * One photo attached to a ticket. `dataUrl` is a compressed JPEG held inline
 * rather than in Cloud Storage, which keeps the app on Firebase's free plan —
 * see `compressPhoto` for the size budget that makes that safe.
 */
export interface TicketPhoto {
  id: string;
  dataUrl: string;
  createdAt: number;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  complete: 'Complete',
};

/** Open first: the whole point of the list is what still needs doing. */
export const STATUS_ORDER: TicketStatus[] = ['open', 'complete'];

/** The property is a fixed 62 rooms: 100-113, 200-222, 300-323 and 325 (there is no 324). */
export const ROOM_NUMBERS: string[] = [
  ...Array.from({ length: 14 }, (_, i) => String(100 + i)),
  ...Array.from({ length: 23 }, (_, i) => String(200 + i)),
  ...Array.from({ length: 24 }, (_, i) => String(300 + i)),
  '325',
];

const ROOM_SET = new Set(ROOM_NUMBERS);

export function isRoom(value: string): boolean {
  return ROOM_SET.has(value);
}

/** Tickets written before a field existed read back as undefined. */
export function normalizeStatus(status: unknown): TicketStatus {
  return status === 'complete' ? 'complete' : 'open';
}
