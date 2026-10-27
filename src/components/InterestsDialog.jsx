import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../lib/api.js';
import { useConference } from '../lib/store.jsx';
import { useToast } from './Toaster.jsx';
import { Button, cx } from './ui.jsx';

/**
 * Pick the topics you care about. The selection starts from what is stored
 * (read when the dialog opens, since the bootstrap copy is never refreshed),
 * and only Save writes it — Cancel, Escape and the backdrop discard it.
 */
export function InterestsDialog({ onClose }) {
  const { tags = [], currentUserId } = useConference();
  const toast = useToast();
  const topics = tags.filter((t) => t.kind === 'topic');
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = saving ? () => {} : onClose;

  useEffect(() => {
    let active = true;
    api.getUser(currentUserId)
      .then((u) => { if (active) setPicked(new Set(u.interests)); })
      .catch(() => { if (active) { toast({ message: 'Could not load your interests', icon: 'alert' }); closeRef.current(); } });
    return () => { active = false; };
  }, [currentUserId, toast]);

  useEffect(() => {
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []);

  const toggle = (name) => setPicked((prev) => {
    const next = new Set(prev);
    if (!next.delete(name)) next.add(name);
    return next;
  });

  async function save() {
    setSaving(true);
    try {
      await api.saveInterests(currentUserId, topics.map((t) => t.name).filter((n) => picked.has(n)));
      onClose();
    } catch (err) {
      toast({ message: `Could not save your interests: ${err.message}`, icon: 'alert' });
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Your interests">
      <button type="button" aria-label="Close" onClick={onClose} disabled={saving} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div ref={ref} tabIndex={-1} className="glass relative flex max-h-[85dvh] w-full max-w-lg animate-rise flex-col rounded-t-2xl border border-hairline p-6 shadow-2xl shadow-black/70 focus:outline-none sm:rounded-2xl">
        <h2 className="font-display text-xl leading-tight">Your interests</h2>
        <p className="mt-1 text-[13px] text-muted">Pick the topics you want more of.</p>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {picked && topics.map((t) => {
              const on = picked.has(t.name);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.name)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    on ? 'border-violet-400/60 bg-violet-500/20 text-violet-200' : 'border-hairline text-muted hover:bg-raised',
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving || !picked}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
