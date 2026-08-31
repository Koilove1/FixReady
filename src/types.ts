export type RoomStatus = 'clean' | 'dirty' | 'out_of_order';

export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  /** What was wrong with the room. */
  issue: string | null;
  /** What material or part was used in the repair. */
  material: string | null;
  /** How the issue was fixed. */
  fix: string | null;
  updatedBy: string | null;
  updatedAt: number | null;
  createdAt: number;
}

/** The free-text maintenance details captured when a room is updated. */
export interface RoomDetails {
  issue: string;
  material: string;
  fix: string;
}

export const STATUS_LABEL: Record<RoomStatus, string> = {
  clean: 'Operational',
  dirty: 'Needs Repair',
  out_of_order: 'Out of Service',
};

export const STATUS_ORDER: RoomStatus[] = ['dirty', 'out_of_order', 'clean'];

/** The property is a fixed 62 rooms: 100-113, 200-222, 300-323 and 325 (there is no 324). */
export const ROOM_NUMBERS: string[] = [
  ...Array.from({ length: 14 }, (_, i) => String(100 + i)),
  ...Array.from({ length: 23 }, (_, i) => String(200 + i)),
  ...Array.from({ length: 24 }, (_, i) => String(300 + i)),
  '325',
];

/** Room numbers are floor-prefixed, so the first digit is the floor. */
export function floorOf(roomName: string): string {
  return roomName.slice(0, 1);
}

export const FLOOR_IDS: string[] = [...new Set(ROOM_NUMBERS.map(floorOf))];

/** Rooms saved before `in_progress` was replaced by `out_of_order`. */
export function normalizeStatus(status: unknown): RoomStatus {
  if (status === 'clean' || status === 'dirty' || status === 'out_of_order') return status;
  return 'dirty';
}
