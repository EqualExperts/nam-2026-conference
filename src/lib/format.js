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
 * What pressing the seat button will do, in words — the icon-only button's
 * accessible name *and* the tooltip it shows, from one place so the two can
 * never drift. `title` gives the long form the grid's cells are named with.
 *
 * A seat you already hold can be given back after the session has ended, so
 * `ended` only speaks for a session you hold nothing in.
 */
export const seatActionLabel = ({ status, ended = false, full = false, title = null }) => {
  if (status === 'waitlisted') return title ? `Leave the waitlist for ${title}` : 'Leave the waitlist';
  if (status) return title ? `Remove ${title} from my agenda` : 'Remove from my agenda';
  if (ended) return title ? `${title} has ended` : 'Session ended';
  if (full) return title ? `Join the waitlist for ${title}` : 'Join the waitlist';
  return title ? `Add ${title} to my agenda` : 'Add to my agenda';
};
