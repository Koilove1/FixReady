/** Compact date for a ticket card, e.g. "Sep 20, 2:14 PM". */
export function formatShort(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Full date for the ticket detail and the spreadsheet. */
export function formatFull(ms: number | null): string {
  return ms ? new Date(ms).toLocaleString() : '';
}
