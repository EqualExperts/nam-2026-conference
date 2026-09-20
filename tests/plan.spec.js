import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, ATTENDEES } from './helpers.js';


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

  /*
   * Read-only, so it needs no lane: the tile and the day headings are rendered
   * from one fetch, so they agree whatever another test books in the meantime.
   */
  test('the hours booked tile totals the per-day headings', async ({ page }) => {
    await visit(page, '/my-agenda', { as: ATTENDEES.sofia });

    const headings = await page.locator('[data-testid^="plan-day-"]')
      .getByText(/^\d+h of content$/).allInnerTexts();
    expect(headings.length, 'this attendee should be booked on several days').toBeGreaterThan(1);
    const expected = headings.reduce((n, t) => n + Number(t.match(/\d+/)[0]), 0);

    const tile = page.getByTestId('stat-hours-booked');
    await expect(tile).toContainText('Hours booked');
    await expect(tile.locator('div').first()).toHaveText(String(expected));
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
