import { useEffect } from 'react';
import { STATUS_ORDER } from '../types';
import { readStored, writeStored } from '../storage';
import { loadRole } from './RolePicker';

const SEEN_KEY = 'seenWelcome';

/**
 * The welcome screen introduces the app, so it earns its place once and then
 * gets out of the way -- a phone that lives on a maintenance cart opens this
 * board dozens of times a shift. A device that already has a role picked has
 * plainly been through the introduction, so it skips it too rather than being
 * shown the splash one last time.
 */
export function hasOpenedBefore(): boolean {
  return readStored(SEEN_KEY) === 'yes' || loadRole() !== null;
}

export function markOpened(): void {
  writeStored(SEEN_KEY, 'yes');
}

/**
 * The screen the app opens on. Everything past here is a gate, so this is the
 * one place the app gets to introduce itself. The mark is the three room
 * statuses, which is the whole vocabulary of the board behind it.
 */
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  /*
   * Pinning .welcome keeps its own content still, but the document behind it
   * can be dragged anyway -- browsers bounce the page past its edges even
   * when nothing overflows. Clamping the root while this screen is mounted is
   * the only thing that stops it, and the cleanup hands scrolling back to the
   * board.
   */
  useEffect(() => {
    document.documentElement.classList.add('no-scroll');
    return () => document.documentElement.classList.remove('no-scroll');
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-body">
        <div className="welcome-mark" aria-hidden="true">
          {STATUS_ORDER.map((status) => (
            <span key={status} className={`welcome-dot status-${status}`} />
          ))}
        </div>
        <h1 className="welcome-title">FixReady</h1>
        <p className="welcome-tagline">Room maintenance, live on every phone.</p>
        <button className="welcome-btn" onClick={onStart}>
          Get Started
        </button>
      </div>
      <footer className="welcome-footer">&copy; 2026 Matthew Banda</footer>
    </div>
  );
}
