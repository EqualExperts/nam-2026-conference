import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConference } from '../lib/store.jsx';
import { Button, cx } from './ui.jsx';

/**
 * Pick the topics you care about. Save writes the whole selection; Cancel,
 * Escape and a click on the backdrop close without writing anything.
 * Mounted only while open, so the selection restarts from the store each time.
 */
export function InterestsDialog({ onClose }) {
  const { tags = [], currentUser, saveInterests } = useConference();
  const topics = tags.filter((t) => t.kind === 'topic');
  const [selected, setSelected] = useState(() => new Set(currentUser?.interests ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = busy ? () => {} : onClose;

  useEffect(() => {
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
  }, []);

  const toggle = (name) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveInterests(topics.map((t) => t.name).filter((n) => selected.has(n)));
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save your interests');
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
        ref={ref}
        tabIndex={-1}
        className="glass relative flex max-h-[85dvh] w-full max-w-lg animate-rise flex-col rounded-t-2xl border border-hairline shadow-2xl shadow-black/70 focus:outline-none sm:rounded-2xl"
      >
        <div className="px-6 pt-6">
          <h2 id="interests-title" className="font-display text-xl leading-tight">Your interests</h2>
          <p className="mt-1 text-[13px] text-muted">Pick the topics you care about.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const on = selected.has(t.name);
              return (
                <button
                  key={t.id}
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
        <div className="px-6 pb-6">
          {error && <p role="alert" className="mb-3 text-[13px] text-rose-300">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
