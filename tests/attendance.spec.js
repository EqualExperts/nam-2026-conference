import { test, expect } from '@playwright/test';
import { API, visit, momentOn, conferenceDays, clearAgendaFor, laneFor, bookableFor, ATTENDEES, failOnPageErrors, shotForPR } from './helpers.js';

/**
 * A non-keynote, non-Social session on `day` this attendee has not checked
 * into, starting at `slot` — the lane's pin, so a concurrently running seats
 * lane on the same attendee and day never lands on the same session.
 */
async function unattendedFor(request, userId, day, slot) {
  const me = await (await request.get(`${API}/users/${userId}`)).json();
  const been = new Set(me.checkIns ?? []);
  const all = await (await request.get(`${API}/sessions?day=${day}`)).json();
  return all
    .filter((s) => !s.isKeynote && s.format !== 'Social' && !been.has(s.id) && s.startsAt === slot)
    .sort((a, b) => a.id - b.id)[0];
}

/**
 * `failOnPageErrors`'s console listener also catches Chromium's own "Failed
 * to load resource: the server responded with a status of 409" log line,
 * which the browser prints for any non-2xx fetch regardless of whether the
 * app handles it. The two tests below force a 409 on purpose, so that line
 * is expected noise, not the "unhandled promise rejection" the assertion is
 * actually checking for; a `pageerror` (the real thing) is still fatal.
 */
const unexpected = (errors) => errors.filter((e) => !e.startsWith('Failed to load resource:'));

/** The first slot where this attendee can book at least two sessions with seats. */
async function busySlot(request, userId, day) {
  const bySlot = {};
  for (const s of await bookableFor(request, userId, day)) {
    if (s.seatsLeft > 2) (bySlot[s.startsAt] ??= []).push(s);
  }
  const entry = Object.entries(bySlot).find(([, v]) => v.length >= 2);
  return entry ? { startsAt: entry[0], sessions: entry[1] } : null;
}

test.describe('You cannot be in two places at once', () => {
  test('a second seat in the same slot is refused, and offers a swap', async ({ page, request }, testInfo) => {
    // A day the seed leaves empty for this attendee, so it can be cleared outright.
    const { user, day } = await laneFor('conflict.ui', testInfo);
    await clearAgendaFor(request, user, day);

    const slot = await busySlot(request, user, day);
    expect(slot, 'no slot with two available sessions').toBeTruthy();

    await visit(page, `/sessions/${slot.sessions[0].id}`, { as: user, at: await momentOn(0, '07:00') });
    await page.getByTestId('reserve-seat').click();
    await expect(page.getByTestId('reservation-confirmed')).toBeVisible();

    await page.goto(`/sessions/${slot.sessions[1].id}`);
    await page.getByTestId('reserve-seat').click();

    // refused with a dialog showing both sessions, not a disappearing toast
    const dialog = page.getByTestId('conflict-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('You are already booked at this time');
    await expect(dialog).toContainText(slot.sessions[0].title);
    await expect(dialog).toContainText(slot.sessions[1].title);

    // backing out keeps the original booking
    await dialog.getByTestId('conflict-keep').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('reserve-seat')).toBeVisible();

    await page.getByTestId('reserve-seat').click();
    await page.getByTestId('conflict-dialog').getByTestId('conflict-swap').click();
    await expect(page.getByTestId('reservation-confirmed')).toBeVisible();

    await clearAgendaFor(request, user, day);
  });

  test('the API refuses it with a 409 and names the conflict', async ({ request }, testInfo) => {
    // A seeded day: book into a free slot and release only those two.
    const { user, day } = await laneFor('conflict.api', testInfo);
    const slot = await busySlot(request, user, day);
    expect(slot, 'no slot with two available sessions').toBeTruthy();
    const [first, second] = slot.sessions.map((s) => `${API}/users/${user}/reservations/${s.id}`);

    expect((await request.put(first)).ok()).toBeTruthy();
    const res = await request.put(second);
    expect(res.status()).toBe(409);

    const body = await res.json();
    expect(body.rejected).toBe('overlap');
    expect(body.conflictsWith.id).toBe(slot.sessions[0].id);

    await request.delete(first);
    await request.delete(second);
  });
});

test.describe('Check in and rate', () => {
  test('check-in is closed before the doors open', async ({ request }) => {
    const days = await conferenceDays();
    const day = days[1];
    const all = await (await request.get(`${API}/sessions?day=${day}`)).json();
    const target = all.find((s) => s.startsAt === '14:45');
    test.skip(!target, 'no afternoon session');

    const res = await request.put(`${API}/users/${ATTENDEES.kenji}/checkins/${target.id}`, {
      data: { day, time: '09:00' },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).rejected).toBe('future');
  });

  test('checking in unlocks rating, and rating moves the session average', async ({ request }, testInfo) => {
    const days = await conferenceDays();
    // Check-in state is shared and the projects run concurrently, so each one
    // uses a different attendee and a different day.
    // Rate a session on day 1 that has genuinely finished — rating something in
    // the future would leave the database asserting a thing that has not
    // happened, which a smoke test now forbids.
    const mobile = testInfo.project.name === 'mobile';
    const user = mobile ? ATTENDEES.priya : ATTENDEES.sofia;
    const day = days[0];

    // Check-ins persist between runs and there is deliberately no way to undo
    // one, so pick a session this attendee has not already been to.
    const me = await (await request.get(`${API}/users/${user}`)).json();
    const been = new Set(me.checkIns ?? []);
    const all = await (await request.get(`${API}/sessions?day=${day}`)).json();
    // Ratings are shared state and the rating count is asserted exactly, so the
    // projects draw from disjoint sessions (odd ids and even ids).
    const target = all
      .filter((s) => !s.isKeynote && s.format !== 'Social' && !been.has(s.id) && s.id % 2 === (mobile ? 1 : 0))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    test.skip(!target, 'no un-attended session left on this day');

    // cannot rate without being there
    const early = await request.put(`${API}/users/${user}/ratings/${target.id}`, {
      data: { stars: 5, day, time: '23:59' },
    });
    expect(early.status()).toBe(409);
    expect((await early.json()).rejected).toBe('not-checked-in');

    // check in during the session
    const checked = await request.put(`${API}/users/${user}/checkins/${target.id}`, {
      data: { day, time: target.startsAt },
    });
    expect((await checked.json()).checkedIn).toBeTruthy();

    // still cannot rate while it is running
    const running = await request.put(`${API}/users/${user}/ratings/${target.id}`, {
      data: { stars: 4, day, time: target.startsAt },
    });
    expect((await running.json()).rejected).toBe('too-early');

    // after it ends, the rating lands and rolls up onto the session
    const before = await (await request.get(`${API}/sessions/${target.id}`)).json();
    const rated = await request.put(`${API}/users/${user}/ratings/${target.id}`, {
      data: { stars: 5, comment: 'Worth the walk.', day, time: '23:59' },
    });
    expect(rated.ok()).toBeTruthy();

    const after = await (await request.get(`${API}/sessions/${target.id}`)).json();
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    expect(after.reviews.some((r) => r.comment === 'Worth the walk.')).toBeTruthy();
  });

  test('editing a rating moves the stars, and the change sticks', async ({ page, request }, testInfo) => {
    // Each project edits a different attendee's seeded rating, and puts it back.
    const user = testInfo.project.name === 'mobile' ? ATTENDEES.marcus : ATTENDEES.jonas;
    const days = await conferenceDays();
    const me = await (await request.get(`${API}/users/${user}`)).json();
    const sessionId = me.ratings[0]?.sessionId;
    expect(sessionId, 'the seed gives this attendee a rating').toBeTruthy();
    const { myRating: original } = await (await request.get(
      `${API}/users/${user}/attendance/${sessionId}?day=${days[0]}&time=23:00`)).json();
    const changed = original.stars === 2 ? 3 : 2;
    const star = (n) => page.getByTestId('rating-form')
      .getByRole('radio', { name: `${n} star${n > 1 ? 's' : ''}`, exact: true });

    await visit(page, `/sessions/${sessionId}`, { as: user, at: await momentOn(0, '23:00') });
    await expect(star(original.stars)).toHaveAttribute('aria-checked', 'true');

    await star(changed).click();
    await expect(star(changed)).toHaveAttribute('aria-checked', 'true');
    const saved = page.waitForResponse((r) => r.url().includes('/ratings/') && r.request().method() === 'PUT');
    await page.getByTestId('submit-rating').click();
    expect((await saved).ok()).toBeTruthy();

    await page.reload();
    await expect(star(changed)).toHaveAttribute('aria-checked', 'true');
    await expect(star(original.stars)).toHaveAttribute('aria-checked', 'false');

    await request.put(`${API}/users/${user}/ratings/${sessionId}`, {
      data: { stars: original.stars, comment: original.comment, day: days[0], time: '23:00' },
    });
  });

  test('stars must be 1 to 5', async ({ request }) => {
    const days = await conferenceDays();
    const res = await request.put(`${API}/users/${ATTENDEES.jonas}/ratings/1`, {
      data: { stars: 11, day: days[0], time: '23:59' },
    });
    expect(res.status()).toBe(400);
  });

  test('checking in toasts a confirmation, and a rejected check-in toasts instead of throwing', async ({ page, request }, testInfo) => {
    const { user, day, slot } = await laneFor('attendance.checkin-toast', testInfo);
    const target = await unattendedFor(request, user, day, slot);
    test.skip(!target, 'no un-attended session left on this day');

    const errors = failOnPageErrors(page);
    await visit(page, `/sessions/${target.id}`, { as: user, at: `${day}T${target.startsAt}` });

    // Fulfilled once, so the click after it hits the real route and succeeds.
    await page.route(`**/api/users/${user}/checkins/${target.id}`, (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ rejected: 'future' }) }),
    { times: 1 });

    await page.getByTestId('check-in').click();
    await expect(page.getByTestId('toaster')).toContainText('Check-in has not opened yet');
    await expect(page.getByTestId('check-in')).toHaveText('Check in');

    await page.getByTestId('check-in').click();
    await expect(page.getByTestId('toaster')).toContainText('Checked in');
    await expect(page.getByTestId('checked-in')).toBeVisible();
    await shotForPR(page, 'check-in-toast');

    expect(unexpected(errors)).toEqual([]);
  });

  test('rating toasts Rating saved, then Rating updated, and a rejection toasts too', async ({ page, request }, testInfo) => {
    const { user, day, slot } = await laneFor('attendance.rating-toast', testInfo);
    const target = await unattendedFor(request, user, day, slot);
    test.skip(!target, 'no un-attended session left on this day');

    await request.put(`${API}/users/${user}/checkins/${target.id}`, {
      data: { day, time: target.startsAt },
    });

    const errors = failOnPageErrors(page);
    await visit(page, `/sessions/${target.id}`, { as: user, at: `${day}T23:59` });

    const star = (n) => page.getByTestId('rating-form')
      .getByRole('radio', { name: `${n} star${n > 1 ? 's' : ''}`, exact: true });

    await star(4).click();
    await page.getByTestId('submit-rating').click();
    await expect(page.getByTestId('toaster')).toContainText('Rating saved');

    await star(2).click();
    await page.getByTestId('submit-rating').click();
    await expect(page.getByTestId('toaster')).toContainText('Rating updated');

    await page.route(`**/api/users/${user}/ratings/${target.id}`, (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ rejected: 'not-checked-in' }) }),
    { times: 1 });
    await page.getByTestId('submit-rating').click();
    await expect(page.getByTestId('toaster')).toContainText('You need to check in before you can rate this');
    await expect(page.getByTestId('submit-rating')).toHaveText('Update rating');

    expect(unexpected(errors)).toEqual([]);
  });
});

test.describe('Calendar export', () => {
  test('an agenda downloads as a valid calendar', async ({ request }) => {
    const res = await request.get(`${API}/users/${ATTENDEES.jonas}/agenda.ics`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('text/calendar');

    const ics = await res.text();
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBeTruthy();
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBeTruthy();
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);          // exactly 6 time digits
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}\r\n/);        // local venue time
    expect(ics.match(/BEGIN:VEVENT/g).length).toBeGreaterThan(0);
    // every line folded to spec
    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  // Through the dev server, as a browser fetches it: the proxy rewrites Host,
  // so without forwarding it the link named the API's own localhost port.
  test('an exported link points at the address the attendee used', async ({ request, baseURL }) => {
    const res = await request.get('/api/sessions/1.ics');
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toContain(`URL:${baseURL}/sessions/1\r\n`);
  });

  test('a single session downloads too', async ({ request }) => {
    const res = await request.get(`${API}/sessions/1.ics`);
    expect(res.ok()).toBeTruthy();
    const ics = await res.text();
    expect(ics.match(/BEGIN:VEVENT/g).length).toBe(1);
  });
});
