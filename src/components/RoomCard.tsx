import { STATUS_LABEL } from '../types';
import type { Room } from '../types';

function timeAgo(ms: number | null): string {
  if (!ms) return '';
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

/** `onTap` is omitted for front desk, where the board is read-only. */
export function RoomCard({ room, onTap }: { room: Room; onTap?: () => void }) {
  const body = (
    <>
      <span className="room-name">{room.name}</span>
      <span className="room-status">{STATUS_LABEL[room.status]}</span>
      {room.issue && <span className="room-issue">{room.issue}</span>}
      {room.updatedBy && (
        <span className="room-meta">
          {room.updatedBy} &middot; {timeAgo(room.updatedAt)}
        </span>
      )}
    </>
  );

  const className = `room-card status-${room.status}`;

  if (!onTap) {
    return <div className={`${className} readonly`}>{body}</div>;
  }

  return (
    <button className={className} onClick={onTap}>
      {body}
    </button>
  );
}
