import type { LogEntry } from './types';
import { STATUS_LABEL } from './types';

function formatDate(ms: number): string {
  return ms ? new Date(ms).toLocaleString() : '';
}

/**
 * Build a real .xlsx from the maintenance history and hand it to the browser as
 * a download. `xlsx` is imported on demand so it stays out of the initial
 * bundle — the library is only pulled in when someone actually exports.
 */
export async function exportLogToXlsx(entries: LogEntry[]): Promise<void> {
  const XLSX = await import('xlsx');

  const rows = entries
    .slice()
    // Group by room, then oldest-to-newest within each room, so the sheet reads
    // like a logbook.
    .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.createdAt - b.createdAt)
    .map((e) => ({
      Room: e.roomName,
      Date: formatDate(e.createdAt),
      Status: STATUS_LABEL[e.status],
      Issue: e.issue ?? '',
      'Material Used': e.material ?? '',
      Fix: e.fix ?? '',
      'Updated By': e.updatedBy ?? '',
    }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 8 }, // Room
    { wch: 20 }, // Date
    { wch: 14 }, // Status
    { wch: 34 }, // Issue
    { wch: 34 }, // Material Used
    { wch: 34 }, // Fix
    { wch: 16 }, // Updated By
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Maintenance Log');

  const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `maintenance-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
