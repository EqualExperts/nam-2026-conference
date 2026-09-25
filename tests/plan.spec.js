import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, conferenceDays, ATTENDEES } from './helpers.js';


test.describe('My Agenda', () => {
  test('adding a session from the schedule puts it on the agenda', async ({ page, request }, testInfo) => {
    const lane = await laneFor('agenda.add', testInfo);
    const target = (await bookableFor(request, lane.user, lane.day)).find((s) => s.seatsLeft > 3);
    expect(target, 'nothing this attendee can add').toBeTruthy();

    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: await momentOn(0, '07:00') });
    await expect(page.getByTestId('result-count')).not.toHaveText(/Loading/);

    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: target.title, exact: true }) });
    const seat = card.getByRole('button', { name: /agenda|waitlist/i });
    await expect(seat).toHaveAttribute('aria-pressed', 'false');
    await seat.click();
    await expect(seat).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/my-agenda');
    await expect(page.getByText(target.title, { exact: false }).first()).toBeVisible();

    // release only what this test booked — the rest of the day is seeded
    await request.delete(`${API}/users/${lane.user}/reservations/${target.id}`);
  });

  test('the hours tile totals the hours shown on each day', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.sofia });

    const perDay = await page.getByText(/^\d+h of content$/).allTextContents();
    expect(perDay.length, 'needs a plan spanning several days to be worth summing').toBeGreaterThan(1);
    const sum = perDay.reduce((n, text) => n + Number(text.match(/^(\d+)h/)[1]), 0);

    await expect(page.getByTestId('stat-hours-booked')).toHaveText(String(sum));
  });

  test('each attendee sees their own plan', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.sofia });
    await expect(page.getByRole('heading', { name: /Sofia’s agenda/ })).toBeVisible();

    await visit(page, '/my-agenda', { as: ATTENDEES.kenji });
    await expect(page.getByRole('heading', { name: /Kenji’s agenda/ })).toBeVisible();
  });

  test('the switcher counts what is on an agenda, not what was "saved"', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.sofia });
    await page.getByRole('button', { name: /Switch attendee/ }).click();

    const option = page.getByRole('option', { name: /Sofia/ });
    await expect(option).toContainText(/[1-9]\d* on agenda/);
    await expect(option).not.toContainText(/saved/i);
  });

  test('switching attendee in the header changes the plan', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.jonas });
    await expect(page.getByRole('heading', { name: /Jonas’s agenda/ })).toBeVisible();

    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('option', { name: /Kenji Nakamura/ }).click();
    await expect(page.getByRole('heading', { name: /Kenji’s agenda/ })).toBeVisible();
  });
});

test.describe('Speaker view', () => {
  test('a speaking attendee sees their own sessions', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.amara });
    const panel = page.getByTestId('speaking-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('You are speaking');
    await expect(panel.getByRole('link')).not.toHaveCount(0);
  });

  test('a non-speaking attendee sees no speaker panel', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.kenji });
    await expect(page.getByTestId('speaking-panel')).toHaveCount(0);
  });
});

test.describe('Right now card', () => {
  const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  // Read-only against the seed: Amara is queued on Day 1 sessions in slots
  // where she holds no seat. Pick one whose moment we can pin without a
  // confirmed session of hers getting in the way of the assertion.
  async function waitlistedOnDayOne(request, fits) {
    const [day] = await conferenceDays();
    const res = await request.get(`${API}/users/${ATTENDEES.amara}/schedule`);
    const sessions = (await res.json()).days.find((d) => d.date === day)?.sessions ?? [];
    const confirmed = sessions.filter((s) => s.reservation === 'confirmed');
    return sessions.find((s) => s.reservation === 'waitlisted' && fits(s, confirmed));
  }

  test('the Right now card ignores a waitlisted session in the current slot', async ({ page, request }) => {
    const target = await waitlistedOnDayOne(request, (w, confirmed) => {
      const mid = Math.floor((minutes(w.startsAt) + minutes(w.endsAt)) / 2);
      return !confirmed.some((c) => minutes(c.startsAt) <= mid && mid < minutes(c.endsAt));
    });
    expect(target, 'the seed should queue Amara on a Day 1 session she holds no seat against').toBeTruthy();
    const mid = Math.floor((minutes(target.startsAt) + minutes(target.endsAt)) / 2);

    await visit(page, '/my-agenda', { as: ATTENDEES.amara, at: await momentOn(0, hhmm(mid)) });
    const card = page.getByTestId('next-up');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(target.title);
    await expect(card).toContainText(/Nothing on right now\.|Nothing booked today\.|Nothing else booked today\./);
  });

  test('the Right now card ignores a waitlisted session as the next session', async ({ page, request }) => {
    const target = await waitlistedOnDayOne(request, (w, confirmed) => {
      const at = minutes(w.startsAt) - 15;
      // nothing confirmed starts between the pinned moment and the waitlisted one
      return !confirmed.some((c) => minutes(c.startsAt) > at && minutes(c.startsAt) <= minutes(w.startsAt));
    });
    expect(target, 'the seed should queue Amara on a Day 1 session').toBeTruthy();

    await visit(page, '/my-agenda', { as: ATTENDEES.amara, at: await momentOn(0, hhmm(minutes(target.startsAt) - 15)) });
    const card = page.getByTestId('next-up');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(target.title);
  });
});
