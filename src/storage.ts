/**
 * Every localStorage key the app owns is prefixed `fixready:`. Devices that ran
 * the app under its old RoomReady name still hold `roomready:` keys, so a read
 * falls back to the old key once and rewrites the value under the new one —
 * nobody has to pick their role or retype their name again after the rename.
 */
const PREFIX = 'fixready:';
const LEGACY_PREFIX = 'roomready:';

export function readStored(key: string): string | null {
  const current = localStorage.getItem(PREFIX + key);
  if (current !== null) return current;
  const legacy = localStorage.getItem(LEGACY_PREFIX + key);
  if (legacy === null) return null;
  localStorage.setItem(PREFIX + key, legacy);
  localStorage.removeItem(LEGACY_PREFIX + key);
  return legacy;
}

export function writeStored(key: string, value: string): void {
  localStorage.setItem(PREFIX + key, value);
}

export function removeStored(key: string): void {
  localStorage.removeItem(PREFIX + key);
  localStorage.removeItem(LEGACY_PREFIX + key);
}
