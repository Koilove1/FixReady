import type { Ticket } from './types';
import { STATUS_LABEL } from './types';

/**
 * Sortable and readable at once: text in this shape sorts correctly in Excel
 * without depending on the sheet being read back as real date cells.
 */
function sheetDate(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

const COLUMNS = [
  { header: 'Room', width: 8 },
  { header: 'Reported', width: 18 },
  { header: 'Problem', width: 40 },
  { header: 'Fix', width: 40 },
  { header: 'Materials Used', width: 34 },
  { header: 'Completed', width: 18 },
  { header: 'Status', width: 11 },
  { header: 'Photos', width: 8 },
];

/**
 * Build a real .xlsx from every maintenance report and hand it to the browser
 * as a download. `xlsx` is imported on demand so it stays out of the initial
 * bundle — the library is only pulled in when someone actually exports.
 *
 * Photos are counted rather than embedded: they live in the app, and the
 * spreadsheet is the written record of what was done.
 */
export async function exportTicketsToXlsx(tickets: Ticket[]): Promise<void> {
  const XLSX = await import('xlsx');

  const rows = tickets
    .slice()
    // Group by room, then oldest-to-newest within each room, so the sheet
    // reads like a logbook for the property.
    .sort((a, b) => a.room.localeCompare(b.room) || a.reportedAt - b.reportedAt)
    .map((t) => ({
      // A number, so Excel sorts and filters the column numerically.
      Room: Number(t.room),
      Reported: sheetDate(t.reportedAt),
      Problem: t.problem,
      Fix: t.fix ?? '',
      'Materials Used': t.materials ?? '',
      Completed: sheetDate(t.completedAt),
      Status: STATUS_LABEL[t.status],
      Photos: t.photoCount,
    }));

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: COLUMNS.map((c) => c.header),
  });
  sheet['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
  // Header row plus one row per report, so the filter covers the whole table.
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: COLUMNS.length - 1 },
    }),
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Maintenance');

  const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fixready-maintenance-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
