import { readStored, writeStored, removeStored } from '../storage';

export type Role = 'frontdesk' | 'maintenance';

const ROLE_KEY = 'role';

export const ROLE_LABEL: Record<Role, string> = {
  frontdesk: 'Front Desk',
  maintenance: 'Maintenance',
};

export function loadRole(): Role | null {
  const saved = readStored(ROLE_KEY);
  return saved === 'frontdesk' || saved === 'maintenance' ? saved : null;
}

export function saveRole(role: Role): void {
  writeStored(ROLE_KEY, role);
}

export function clearRole(): void {
  removeStored(ROLE_KEY);
}

export function RolePicker({ onPick }: { onPick: (role: Role) => void }) {
  return (
    <div className="screen-center">
      <div className="role-card">
        <h1>FixReady</h1>
        <p>Who's using this device?</p>
        <button className="role-btn" onClick={() => onPick('frontdesk')}>
          <span className="role-name">Front Desk</span>
          <span className="role-desc">See which rooms need maintenance</span>
        </button>
        <button className="role-btn" onClick={() => onPick('maintenance')}>
          <span className="role-name">Maintenance</span>
          <span className="role-desc">Tap a room to update its repair status</span>
        </button>
      </div>
    </div>
  );
}
