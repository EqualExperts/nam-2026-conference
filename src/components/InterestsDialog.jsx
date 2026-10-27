import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConference } from '../lib/store.jsx';
import { Button, cx } from './ui.jsx';

/**
 * Pick the topics you care about. Nothing is written until Save; Cancel,
 * Escape and a click outside all drop the draft.
 */
export function InterestsDialog({ open, onClose }) {
  const { tags = [], currentUser, saveInterests } = useConference();
  const [draft, setDraft] = useState([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = busy ? () => {} : onClose;

  // Start from what is saved each time the dialog opens. A seeded interest that
  // is not a topic tag (Kenji's "Edge" is a tech tag) has no chip and the route
  // would refuse it, so it is left out of the draft.
  useEffect(() => {
    if (!open) return;
    const known = new Set(tags.filter((t) => t.kind === 'topic').map((t) => t.name));
    setDraft((currentUser?.interests ?? []).filter((n) => known.has(n)));
  }, [open, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open || !currentUser) return null;
  const topics = tags.filter((t) => t.kind === 'topic');
  const toggle = (name) => setDraft((d) => (d.includes(name) ? d.filter((n) => n !== name) : [...d, name]));

  const save = async () => {
    setBusy(true);
    const ok = await saveInterests(draft);
    setBusy(false);
    if (ok) onClose();
  };

  // Portalled out of the header: its backdrop blur would otherwise become the
  // containing block for `fixed` and clip the dialog to the header's box.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interests-title"
      data-testid="interests-dialog"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="glass relative flex max-h-[90vh] w-full max-w-lg animate-rise flex-col rounded-t-2xl border border-hairline shadow-2xl shadow-black/70 focus:outline-none sm:rounded-2xl"
      >
        <div className="p-6 pb-3">
          <h2 id="interests-title" className="font-display text-xl leading-tight">Your interests</h2>
          <p className="mt-1 text-[13px] text-muted">Pick the topics you care about.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const on = draft.includes(t.name);
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.name)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
                    on ? 'border-violet-400/60 bg-violet-500/20 text-violet-100' : 'border-hairline bg-raised text-muted hover:bg-overlay',
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-hairline p-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
