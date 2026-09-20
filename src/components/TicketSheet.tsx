import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { STATUS_LABEL } from '../types';
import type { Ticket, TicketWork, TicketPhoto } from '../types';
import { formatFull } from '../format';
import { compressPhoto } from '../photos';
import { describeError } from '../hooks/useTickets';

export function TicketSheet({
  ticket,
  onClose,
  onSave,
  onComplete,
  onReopen,
  fetchPhotos,
  addPhoto,
  removePhoto,
}: {
  ticket: Ticket;
  onClose: () => void;
  onSave: (work: TicketWork) => void;
  onComplete: (work: TicketWork) => void;
  onReopen: () => void;
  fetchPhotos: (ticketId: string) => Promise<TicketPhoto[]>;
  addPhoto: (ticketId: string, dataUrl: string) => { photo: TicketPhoto; saved: Promise<unknown> };
  removePhoto: (ticketId: string, photoId: string) => Promise<unknown>;
}) {
  const [fix, setFix] = useState(ticket.fix ?? '');
  const [materials, setMaterials] = useState(ticket.materials ?? '');

  const [photos, setPhotos] = useState<TicketPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** The photo opened full-screen, if any. */
  const [viewing, setViewing] = useState<TicketPhoto | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const done = ticket.status === 'complete';
  const work: TicketWork = { fix, materials };
  const dirty = fix !== (ticket.fix ?? '') || materials !== (ticket.materials ?? '');
  const canComplete = fix.trim().length > 0 && !busy;

  useEffect(() => {
    let active = true;
    setLoadingPhotos(true);
    fetchPhotos(ticket.id)
      .then((found) => {
        if (active) setPhotos(found);
      })
      .catch((err) => {
        console.error('Failed to load photos', err);
        if (active) setPhotoError(describeError(err));
      })
      .finally(() => {
        if (active) setLoadingPhotos(false);
      });
    return () => {
      active = false;
    };
  }, [ticket.id, fetchPhotos]);

  /** Typed notes are only in component state, so warn before dropping them. */
  function tryClose() {
    if (dirty && !window.confirm('Close without saving what you typed?')) return;
    onClose();
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Clear the input so picking the same photo twice still fires a change.
    e.target.value = '';
    if (files.length === 0) return;

    setBusy(true);
    setPhotoError(null);
    try {
      // One at a time: a phone camera photo is large before compression, and
      // decoding several at once is what makes an older handset run out of memory.
      for (const file of files) {
        const dataUrl = await compressPhoto(file);
        // Show the thumbnail as soon as the image is in hand. The write is not
        // awaited — offline it wouldn't settle until the phone found signal.
        const { photo, saved } = addPhoto(ticket.id, dataUrl);
        setPhotos((prev) => [...prev, photo]);
        saved.catch((err: unknown) => {
          console.error('Failed to store photo', err);
          // It was never stored, so take the thumbnail back rather than let it
          // stand for a photo that isn't there.
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          setPhotoError(describeError(err));
        });
      }
    } catch (err) {
      console.error('Failed to read photo', err);
      setPhotoError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(photo: TicketPhoto) {
    if (!window.confirm('Remove this photo?')) return;
    setPhotoError(null);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    removePhoto(ticket.id, photo.id).catch((err: unknown) => {
      console.error('Failed to remove photo', err);
      // Still there after all — put it back where it was.
      setPhotos((prev) =>
        [...prev, photo].sort((a, b) => a.createdAt - b.createdAt),
      );
      setPhotoError(describeError(err));
    });
  }

  return (
    <div className="sheet-backdrop" onClick={tryClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="ticket-head">
          <h2>Room {ticket.room}</h2>
          <span className={`ticket-chip status-${ticket.status}`}>
            {done ? '✓ ' : ''}
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>

        <div className="report-block">
          <p className="field-label">Reported {formatFull(ticket.reportedAt)}</p>
          <p className="report-problem">{ticket.problem}</p>
        </div>
        {done && ticket.completedAt && (
          <p className="completed-note">Completed {formatFull(ticket.completedAt)}</p>
        )}

        <div className="photos-block">
          <p className="field-label">Photos</p>
          {loadingPhotos ? (
            <p className="history-empty">Loading…</p>
          ) : (
            <div className="photo-grid">
              {photos.map((photo) => (
                <div key={photo.id} className="photo-thumb">
                  <img src={photo.dataUrl} alt="Repair photo" onClick={() => setViewing(photo)} />
                  <button
                    type="button"
                    className="photo-remove"
                    onClick={() => handleRemove(photo)}
                    disabled={busy}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="photo-add"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                {busy ? '…' : '+'}
                <span>{busy ? 'Working' : 'Add photo'}</span>
              </button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFiles}
          />
        </div>
        {photoError && <p className="field-error">{photoError}</p>}

        <label className="field-label" htmlFor="fix">
          What did you do to fix it?
        </label>
        <textarea
          id="fix"
          rows={3}
          value={fix}
          onChange={(e) => setFix(e.target.value)}
          placeholder="e.g. Replaced the cartridge and resealed the joint"
        />

        <label className="field-label" htmlFor="materials">
          What tools and materials did you use?
        </label>
        <textarea
          id="materials"
          rows={2}
          value={materials}
          onChange={(e) => setMaterials(e.target.value)}
          placeholder="e.g. New faucet cartridge, plumber's tape, basin wrench"
        />

        {done ? (
          <>
            <button type="button" className="sheet-primary" onClick={() => onSave(work)}>
              Save changes
            </button>
            <button type="button" className="link-btn" onClick={onReopen}>
              Reopen this ticket
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="sheet-primary"
              disabled={!canComplete}
              onClick={() => onComplete(work)}
            >
              Mark complete
            </button>
            {!canComplete && !busy && (
              <p className="field-hint">Add what you did before marking this complete.</p>
            )}
            <button type="button" className="sheet-secondary" onClick={() => onSave(work)}>
              Save for later
            </button>
          </>
        )}
        <button type="button" className="link-btn" onClick={tryClose}>
          Close
        </button>

        {viewing && (
          <div className="lightbox" onClick={() => setViewing(null)}>
            <img src={viewing.dataUrl} alt="Repair photo" />
          </div>
        )}
      </div>
    </div>
  );
}
