import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConference } from '../lib/store.jsx';
import { useToast } from './Toaster.jsx';
import { Button, cx } from './ui.jsx';

/**
 * Pick the topics you care about. Cancel, Escape and the backdrop all close
 * without saving; only Save writes. Portalled to `document.body` because it is
 * opened from the header, whose backdrop filter would otherwise contain it.
 */
export function InterestsDialog({ onClose }) {
  const { tags = [], currentUser, saveInterests } = useConference();
  const toast = useToast();
  const topics = tags.filter((t) => t.kind === 'topic');
  const [picked, setPicked] = useState(() => new Set(currentUser?.interests ?? []));
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = busy ? () => {} : onClose;

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  const toggle = (name) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });

  const save = async () => {
    setBusy(true);
    try {
      await saveInterests(topics.map((t) => t.name).filter((n) => picked.has(n)));
      toast({ message: 'Interests saved', icon: 'check' });
      onClose();
    } catch (err) {
      toast({ message: `Could not save your interests: ${err.message}`, icon: 'alert' });
      setBusy(false);
    }
  };

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
        ref={panelRef}
        tabIndex={-1}
        className="glass relative flex max-h-[85dvh] w-full max-w-lg animate-rise flex-col rounded-t-2xl border border-hairline shadow-2xl shadow-black/70 focus:outline-none sm:rounded-2xl"
      >
        <div className="px-6 pb-3 pt-6">
          <h2 id="interests-title" className="font-display text-xl leading-tight">Your interests</h2>
          <p className="mt-1 text-xs text-muted">Pick the topics you want more of.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const on = picked.has(t.name);
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
        <div className="flex justify-end gap-2 border-t border-hairline px-6 py-4">
          <Button type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="primary" onClick={save} disabled={busy}>Save</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
