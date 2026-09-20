import { STATUS_LABEL } from '../types';
import type { Ticket } from '../types';
import { formatShort } from '../format';

export function TicketCard({ ticket, onTap }: { ticket: Ticket; onTap: () => void }) {
  const done = ticket.status === 'complete';
  return (
    <button className={`ticket-card status-${ticket.status}`} onClick={onTap}>
      <div className="ticket-head">
        <span className="ticket-room">Room {ticket.room}</span>
        <span className={`ticket-chip status-${ticket.status}`}>
          {done ? '✓ ' : ''}
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>
      <p className="ticket-problem">{ticket.problem}</p>
      <div className="ticket-meta">
        <span>{formatShort(done ? ticket.completedAt : ticket.reportedAt)}</span>
        {ticket.photoCount > 0 && (
          <span className="ticket-photos">
            {ticket.photoCount} photo{ticket.photoCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </button>
  );
}
