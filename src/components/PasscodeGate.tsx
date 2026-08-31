import { useEffect, useState, type FormEvent } from 'react';

const STORAGE_KEY = 'roomready:unlocked';
/**
 * Lockout state outlives the tab -- sessionStorage would hand a fresh set of
 * attempts to anyone who closed the tab and reopened it.
 */
const LOCKOUT_KEY = 'roomready:lockout';

const MAX_ATTEMPTS = 5;

/**
 * Each lockout is longer than the last, so a technician who fat-fingers the
 * code waits half a minute while someone working through the 10,000 possible
 * codes stalls out. The last step repeats forever.
 */
const LOCKOUT_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

interface LockoutState {
  /** Wrong attempts since the last lockout or successful unlock. */
  fails: number;
  /** Lockouts served, which is the index into LOCKOUT_STEPS_MS. */
  strikes: number;
  /** Epoch ms the current lockout ends; 0 when not locked out. */
  until: number;
}

const EMPTY: LockoutState = { fails: 0, strikes: 0, until: 0 };

function readLockout(): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    return {
      fails: Number(parsed.fails) || 0,
      strikes: Number(parsed.strikes) || 0,
      until: Number(parsed.until) || 0,
    };
  } catch {
    return EMPTY;
  }
}

function writeLockout(state: LockoutState) {
  try {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
  } catch {
    // Private browsing can refuse writes; the in-memory state still applies
    // for this tab.
  }
}

/** "45s" reads better than "0:45"; past a minute, a clock is clearer. */
function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function isUnlocked(): boolean {
  const configured = import.meta.env.VITE_APP_PASSCODE;
  if (!configured) return true;
  return sessionStorage.getItem(STORAGE_KEY) === configured;
}

export function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [lockout, setLockout] = useState(readLockout);
  const [now, setNow] = useState(() => Date.now());

  const remaining = lockout.until - now;
  const lockedOut = remaining > 0;

  // Only run a timer while it can change something on screen.
  useEffect(() => {
    if (!lockedOut) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedOut]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lockedOut) return;

    const configured = import.meta.env.VITE_APP_PASSCODE;
    if (value === configured) {
      sessionStorage.setItem(STORAGE_KEY, value);
      // A correct code clears the record, so yesterday's typos don't count
      // toward tomorrow's lockout.
      writeLockout(EMPTY);
      onUnlock();
      return;
    }

    const fails = lockout.fails + 1;
    const next: LockoutState =
      fails >= MAX_ATTEMPTS
        ? {
            fails: 0,
            strikes: lockout.strikes + 1,
            until:
              Date.now() +
              LOCKOUT_STEPS_MS[Math.min(lockout.strikes, LOCKOUT_STEPS_MS.length - 1)],
          }
        : { ...lockout, fails };

    writeLockout(next);
    setLockout(next);
    setNow(Date.now());
    setError(true);
    setValue('');
  }

  const attemptsLeft = MAX_ATTEMPTS - lockout.fails;

  return (
    <div className="screen-center">
      <form className="passcode-card" onSubmit={handleSubmit}>
        <h1>FixReady</h1>
        <p>Enter the staff passcode to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          disabled={lockedOut}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder={lockedOut ? 'Locked' : 'Passcode'}
        />
        {lockedOut ? (
          <p className="error-text">
            Too many incorrect attempts. Try again in {formatRemaining(remaining)}.
          </p>
        ) : (
          error && (
            <p className="error-text">
              Incorrect passcode.
              {attemptsLeft <= 3 && ` ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`}
            </p>
          )
        )}
        <button type="submit" disabled={lockedOut}>
          {lockedOut ? `Locked (${formatRemaining(remaining)})` : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
