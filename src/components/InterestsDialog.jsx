import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConference } from '../lib/store.jsx';
import { Button, cx } from './ui.jsx';

/**
 * Choose the topics you care about. Edits a local draft; only Save writes it,
 * so Cancel, Escape and an outside click leave the attendee's interests alone.
 * Portalled to <body>: the header is `glass`, which would trap a fixed overlay.
 */
export function InterestsDialog({ onClose }) {
  const { tags = [], currentUser, saveInterests } = useConference();
  const topics = tags.filter((t) => t.kind === 'topic');
  const [draft, setDraft] = useState(() => new Set(currentUser?.interests ?? []));
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

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

  const toggle = (name) => setDraft((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const save = async () => {
    setBusy(true);
    try {
      await saveInterests(topics.map((t) => t.name).filter((n) => draft.has(n)));
      onClose();
    } catch {
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
        data-testid="interests-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="glass relative flex max-h-[85dvh] w-full max-w-lg animate-rise flex-col overflow-hidden rounded-t-2xl border border-hairline shadow-2xl shadow-black/70 focus:outline-none sm:rounded-2xl"
      >
        <div className="p-6 pb-3">
          <h2 id="interests-title" className="font-display text-xl leading-tight">Your interests</h2>
          <p className="mt-1 text-[13px] text-muted">Pick the topics you want more of.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const on = draft.has(t.name);
              return (
                <button
                  key={t.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.name)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    on ? 'border-violet-400/60 bg-violet-500/20 text-violet-200' : 'border-hairline bg-raised text-muted hover:text-ink',
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-hairline p-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
