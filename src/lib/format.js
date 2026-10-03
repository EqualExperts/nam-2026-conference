/** Shared display helpers. Keep formatting out of components. */

export const time = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

export const timeRange = (start, end) => `${time(start)} – ${time(end)}`;

export const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

export const shortDay = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', timeZone: 'UTC',
  });

/**
 * "12m ago" measured against the conference clock, not the browser's.
 * Seeded timestamps are conference-local wall time with a Z suffix, so the
 * clock is compared on that same basis.
 */
export const relativeDate = (iso, clock) => {
  const d = new Date(iso);
  const diff = (new Date(`${clock.day}T${clock.time}:00Z`).getTime() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The schedule rail's "N sessions · M today"/"M on Day 1" line. `dayPhrase` is the caller's job. */
export const agendaSummary = (total, bookedOnDay, dayPhrase) =>
  `${total === 1 ? 'session' : 'sessions'} · ${bookedOnDay} ${dayPhrase}`;

/**
 * What the seat button's next click will do, for its tooltip and `aria-label`.
 * A seat already held (confirmed or waitlisted) can always be given back, even
 * once the session has ended — only a seat not yet taken is foreclosed by
 * `ended`, checked before `full` since there is nothing to join once it is over.
 */
export const seatAction = (status, { ended = false, full = false } = {}) => {
  if (status === 'confirmed') return 'Remove from my agenda';
  if (status === 'waitlisted') return 'Leave the waitlist';
  if (ended) return 'Session ended';
  if (full) return 'Join the waitlist';
  return 'Add to my agenda';
};
