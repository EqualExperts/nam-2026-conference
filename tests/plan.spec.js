import { test, expect } from '@playwright/test';
import {
  API, visit, momentOn, laneFor, bookableFor, conferenceDays, ATTENDEES, MID_SESSION_TIME,
} from './helpers.js';


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

const byStart = (a, b) => a.startsAt.localeCompare(b.startsAt);

/**
 * Kenji's seeded day 1 is the fixture the Right now card needs: a confirmed
 * keynote, a queue place at 10:15, a seat at 11:30, a queue place at 13:30 and
 * a seat at 17:15.
 *
 * These two tests read it and write nothing, so they need no lane and both
 * projects can share it. The only writes any other test makes to Kenji on day 1
 * are a queue place taken and given straight back by the `seats.waitlist` lane —
 * and a queue place is exactly what this card now ignores.
 */
async function kenjiOnDayOne(request) {
  const days = await conferenceDays();
  const plan = await (await request.get(`${API}/users/${ATTENDEES.kenji}/schedule`)).json();
  const day = (plan.days ?? []).find((d) => d.date === days[0]);
  expect(day, 'the seed should give Kenji a day 1 plan').toBeTruthy();
  return day;
}

test.describe('Right now', () => {
  test('a session you are only waitlisted for is not where you are', async ({ page, request }) => {
    const day = await kenjiOnDayOne(request);
    const now = MID_SESSION_TIME;

    const inSlot = day.sessions.find((s) => s.startsAt <= now && now < s.endsAt);
    expect(inSlot?.reservation, 'fixture: queued, not seated, in this slot').toBe('waitlisted');
    const nextSeat = day.sessions.filter((s) => s.reservation === 'confirmed' && s.startsAt > now).sort(byStart)[0];
    expect(nextSeat, 'fixture: a later seat to offer instead').toBeTruthy();
    const done = day.sessions.filter((s) => s.reservation === 'confirmed' && s.endsAt <= now).length;
    expect(done, 'fixture: something finished earlier to count').toBeGreaterThan(0);

    await visit(page, '/my-agenda', { as: ATTENDEES.kenji, at: await momentOn(0, now) });

    const card = page.getByTestId('next-up');
    await expect(card).toContainText('Nothing on right now');
    await expect(card).not.toContainText(inSlot.title);
    await expect(card).toContainText(nextSeat.title);
    await expect(card).toContainText(`${done} done today`);

    // the queue place is still on the agenda — this is about where to walk next
    await expect(page.getByTestId(`plan-day-${day.date}`)).toContainText(inSlot.title);
  });

  test('a session you are only waitlisted for is never what is next', async ({ page, request }) => {
    const day = await kenjiOnDayOne(request);
    const now = '12:30'; // the gap after the 11:30 slot, before the queued afternoon one

    const upcoming = day.sessions.filter((s) => s.startsAt > now).sort(byStart);
    expect(upcoming[0]?.reservation, 'fixture: the next thing by time is a queue place').toBe('waitlisted');
    const nextSeat = upcoming.find((s) => s.reservation === 'confirmed');
    expect(nextSeat, 'fixture: a seat further down the day').toBeTruthy();

    await visit(page, '/my-agenda', { as: ATTENDEES.kenji, at: await momentOn(0, now) });

    const card = page.getByTestId('next-up');
    await expect(card).toContainText(nextSeat.title);
    await expect(card).not.toContainText(upcoming[0].title);
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
