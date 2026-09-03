import { ROOM_NUMBERS, normalizeStatus } from './types';
import type { Room, LogEntry } from './types';
import { readStored, writeStored } from './storage';

const KEY = 'demoRooms';
const LOG_KEY = 'demoLog';

function blank(name: string, i: number): Room {
  return {
    id: `demo-${name}`,
    name,
    status: 'clean',
    issue: null,
    material: null,
    fix: null,
    updatedBy: null,
    updatedAt: null,
    createdAt: Date.now() + i,
  };
}

/**
 * The room list is fixed, so anything stored is only a source of *statuses* —
 * the set of rooms always comes from ROOM_NUMBERS.
 */
function reconcile(stored: Room[]): Room[] {
  const byName = new Map(stored.map((r) => [r.name, r]));
  return ROOM_NUMBERS.map((name, i) => {
    const existing = byName.get(name);
    if (!existing) return blank(name, i);
    return {
      ...existing,
      id: `demo-${name}`,
      status: normalizeStatus(existing.status),
      // Rooms saved before these fields existed have them as undefined.
      issue: existing.issue ?? null,
      material: existing.material ?? null,
      fix: existing.fix ?? null,
    };
  });
}

export function loadRooms(): Room[] {
  const raw = readStored(KEY);
  let stored: Room[] = [];
  if (raw) {
    try {
      stored = JSON.parse(raw) as Room[];
    } catch {
      stored = [];
    }
  }
  const rooms = reconcile(stored);
  saveRooms(rooms);
  return rooms;
}

export function saveRooms(rooms: Room[]): void {
  writeStored(KEY, JSON.stringify(rooms));
}

/** The demo-mode maintenance history — the counterpart to the Firestore log. */
export function loadLog(): LogEntry[] {
  const raw = readStored(LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

export function appendLog(entry: LogEntry): void {
  const all = loadLog();
  all.push(entry);
  writeStored(LOG_KEY, JSON.stringify(all));
}
