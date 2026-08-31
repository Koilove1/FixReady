/**
 * The name maintenance puts on every status change. Kept on the device so a
 * phone that belongs to one person only asks once, and shared with the status
 * sheet that stamps it onto each room.
 */
const NAME_KEY = 'roomready:housekeeperName';

export function loadName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
