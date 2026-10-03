import { test, expect } from '@playwright/test';
import { API, visit, momentOn, waitForResults, conferenceDays, laneFor, bookableFor, MID_SESSION_TIME, ATTENDEES, shotForPR } from './helpers.js';

/** The user's own holds on `day`, so a tooltip test can pick a session it does not already hold. */
async function unheldOn(request, userId, day) {
  const [all, me] = await Promise.all([
    (await request.get(`${API}/sessions?day=${day}`)).json(),
    (await request.get(`${API}/users/${userId}`)).json(),
  ]);
  const mine = new Set(me.reservations.map((r) => r.sessionId));
  return all.filter((s) => !s.isKeynote && !mine.has(s.id));
}


test.describe('Schedule', () => {
  test('lists sessions for the selected day', async ({ page }) => {
    await visit(page, '/schedule?view=list');
    await waitForResults(page);
    await expect(page.getByTestId('result-count')).toContainText(/\d+ sessions/);
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('the agenda line names the selected day instead of assuming today', async ({ page }) => {
    const days = await conferenceDays();
    const rail = page.getByTestId('starred-count').locator('..');

    await visit(page, '/schedule', { at: await momentOn(0, MID_SESSION_TIME) });
    await expect(rail).toContainText('today');

    await visit(page, `/schedule?day=${days[1]}`, { at: await momentOn(0, MID_SESSION_TIME) });
    await expect(rail).toContainText('on Day 2');
    await expect(rail).not.toContainText('today');
  });

  test('switching day changes the results', async ({ page }) => {
    await visit(page, '/schedule?view=list');
    await waitForResults(page);
    const first = await page.getByTestId('result-count').textContent();

    // the filter rail is collapsed on narrow viewports
    const filters = page.getByRole('button', { name: /^Filters/ });
    if (await filters.isVisible()) await filters.click();
    const days = await conferenceDays();
    await page.getByTestId(`tab-${days[2]}`).click();
    await waitForResults(page);
    await expect(page).toHaveURL(new RegExp(`day=${days[2]}`));
    await expect(page.getByTestId('result-count')).not.toHaveText(first);
  });

  test('search narrows the list and survives a reload', async ({ page }) => {
    await visit(page, '/schedule?view=list');
    await waitForResults(page);

    const filtersBtn = page.getByRole('button', { name: /^Filters/ });
    if (await filtersBtn.isVisible()) await filtersBtn.click();
    await page.getByTestId('search-input').fill('agents');
    await waitForResults(page);
    const count = await page.getByTestId('result-count').textContent();
    expect(count).not.toContain('Loading');

    await expect(page).toHaveURL(/q=agents/);
    await page.reload();
    const reopened = page.getByRole('button', { name: /^Filters/ });
    if (await reopened.isVisible()) await reopened.click();
    await expect(page.getByTestId('search-input')).toHaveValue('agents');
  });

  test('filtering by venue only returns that venue', async ({ page }) => {
    await visit(page, '/schedule?venue=2&view=list');
    await waitForResults(page);
    // Everything at the Foundry carries the cross-town chip.
    const cards = page.locator('article');
    await expect(cards.first()).toContainText('Foundry');
  });

  test('an impossible filter combination shows the empty state', async ({ page }) => {
    await visit(page, '/schedule?q=zzzznotathing&view=list');
    await expect(page.getByRole('heading', { name: /No sessions match/i })).toBeVisible();
  });

  test('an empty search names what was searched for', async ({ page }) => {
    await visit(page, '/schedule?q=zzqx&view=list');
    await expect(page.getByRole('heading', { name: 'No sessions match “zzqx”', exact: true })).toBeVisible();
    await shotForPR(page, 'the empty state naming the search');
  });

  test('filters without a search keep the plain empty-state heading', async ({ page, request }) => {
    const days = await conferenceDays();
    const { tracks } = await (await request.get(`${API}/bootstrap`)).json();
    let pick = null;
    for (const day of days) {
      for (const t of tracks) {
        const found = await (await request.get(`${API}/sessions?day=${day}&trackSlug=${t.slug}`)).json();
        const list = Array.isArray(found) ? found : found.sessions;
        if (list.length === 0) { pick = { day, slug: t.slug }; break; }
      }
      if (pick) break;
    }
    test.skip(!pick, 'every track has sessions on every day');
    await visit(page, `/schedule?day=${pick.day}&track=${pick.slug}&view=list`);
    await expect(page.getByRole('heading', { name: 'No sessions match', exact: true })).toBeVisible();
  });

  test('Clear filters clears the search and brings sessions back', async ({ page }) => {
    await visit(page, '/schedule?q=zzqx&view=list');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.locator('article').first()).toBeVisible();
  });
});

test.describe('Schedule grid', () => {
  test('the grid lays sessions out by time and room', async ({ page }) => {
    await visit(page, '/schedule?view=grid');
    const grid = page.getByTestId('schedule-grid');
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('columnheader').first()).toBeVisible();
    // the keynote is not in a room column — it spans the whole width
    await expect(grid.getByText('Keynote').first()).toBeVisible();
  });

  test('switching view swaps the layout and stays in the URL', async ({ page }) => {
    await visit(page, '/schedule?view=grid');
    await expect(page.getByTestId('schedule-grid')).toBeVisible();

    await page.getByTestId('view-list').click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page.getByTestId('schedule-grid')).toHaveCount(0);
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('adding from a grid cell updates the agenda count', async ({ page, request }, testInfo) => {
    // Seat state is shared and everything runs concurrently, so this books in
    // its own lane and releases only the session it added.
    const lane = await laneFor('schedule.grid', testInfo);
    const target = (await bookableFor(request, lane.user, lane.day)).find((s) => s.seatsLeft > 3);
    expect(target, 'nothing this attendee can add').toBeTruthy();

    await visit(page, `/schedule?view=grid&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    const count = page.getByTestId('starred-count');
    await expect(page.getByTestId('schedule-grid')).toBeVisible();
    const before = Number(await count.innerText());

    await page.getByTestId('schedule-grid')
      .getByRole('button', { name: `Add ${target.title} to my agenda`, exact: true }).click();
    await expect(count).toHaveText(String(before + 1));

    await request.delete(`${API}/users/${lane.user}/reservations/${target.id}`);
  });

  test('a card shows the seats left, and a full one says Full instead', async ({ page, request }, testInfo) => {
    // Read-only: it books nothing, so it needs no cleanup. Seat counts are
    // global though, so it asserts the shape of the count and not a number
    // another lane is free to move while this runs.
    const lane = await laneFor('schedule.seats', testInfo);
    const all = await (await request.get(`${API}/sessions?day=${lane.day}`)).json();
    const roomy = all.find((s) => !s.isKeynote && s.seatsLeft > 50);
    const full = all.find((s) => !s.isKeynote && s.isFull);
    expect(roomy, 'no session with room to spare').toBeTruthy();
    expect(full, 'no sold-out session on this day').toBeTruthy();

    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user });
    await waitForResults(page);
    const cardFor = (title) => page.locator('article').filter({ hasText: title }).first();

    await expect(cardFor(roomy.title).getByTestId('card-seats')).toHaveText(/^\d+ seats left$/);
    await expect(cardFor(full.title).getByTestId('card-seats')).toContainText('Full');
  });
});

test.describe('Seat tooltip', () => {
  // Read-only, same pairs as 'schedule.seats' — fine since both are readOnly.
  test('hover names the action within about 300ms, and a full room reads Join the waitlist', async ({ page, request }, testInfo) => {
    const lane = await laneFor('schedule.tooltip', testInfo);
    const unheld = await unheldOn(request, lane.user, lane.day);
    const roomy = unheld.find((s) => s.seatsLeft > 50);
    const full = unheld.find((s) => s.isFull);
    expect(roomy, 'no unheld session with room to spare').toBeTruthy();
    expect(full, 'no unheld, sold-out session on this day').toBeTruthy();

    // Pinned before the day's first session, or whichever card `.first()` lands
    // on elsewhere here could already read done depending on the hour this runs.
    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: `${lane.day}T07:00` });
    await waitForResults(page);
    const cardFor = (title) => page.locator('article').filter({ hasText: title }).first();
    const tooltip = page.getByTestId('seat-tooltip');

    await cardFor(roomy.title).getByRole('button', { name: 'Add to my agenda' }).hover();
    await expect(tooltip).toBeVisible({ timeout: 600 });
    await expect(tooltip).toHaveText('Add to my agenda');
    await shotForPR(page, 'seat-tooltip-add-to-my-agenda');

    // move away: the tooltip follows the mouse off the button
    await page.mouse.move(2, 2);
    await expect(tooltip).toHaveCount(0);

    await cardFor(full.title).getByRole('button', { name: 'Join the waitlist' }).hover();
    await expect(tooltip).toBeVisible({ timeout: 600 });
    await expect(tooltip).toHaveText('Join the waitlist');
  });

  test('opens on keyboard focus, and closes on blur and Escape', async ({ page }, testInfo) => {
    const lane = await laneFor('schedule.tooltip', testInfo);
    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: `${lane.day}T07:00` });
    await waitForResults(page);
    const seat = page.locator('article').first().getByRole('button', { name: /agenda|waitlist/i }).first();
    const tooltip = page.getByTestId('seat-tooltip');

    await seat.focus();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);

    // Escape closed it without moving focus off the button, so a genuine new
    // focus event needs a real round trip: tab off, then back with Shift+Tab.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(seat).toBeFocused();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Tab'); // moves focus off the button — blur
    await expect(tooltip).toHaveCount(0);
  });

  test('keeps its accessible name and links the open tooltip once, with no title attribute', async ({ page }, testInfo) => {
    const lane = await laneFor('schedule.tooltip', testInfo);
    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: `${lane.day}T07:00` });
    await waitForResults(page);
    const seat = page.locator('article').first().getByRole('button', { name: /agenda|waitlist/i }).first();
    await expect(seat).not.toHaveAttribute('title');
    const label = await seat.getAttribute('aria-label');

    await seat.focus();
    const tooltip = page.getByTestId('seat-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(label);
    await expect(seat).toHaveAccessibleName(label);
    await expect(seat).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id'));
  });

  test('only one tooltip is open at a time (#105)', async ({ page }, testInfo) => {
    const lane = await laneFor('schedule.tooltip', testInfo);
    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: `${lane.day}T07:00` });
    await waitForResults(page);
    const seats = page.getByRole('button', { name: /agenda|waitlist/i });
    const tooltip = page.getByTestId('seat-tooltip');

    await seats.nth(0).focus();
    await expect(tooltip).toBeVisible();
    await seats.nth(1).hover();
    await expect(tooltip).toBeVisible({ timeout: 600 });
    await expect(tooltip).toHaveCount(1);
  });

  test('shows no animation under prefers-reduced-motion', async ({ page }, testInfo) => {
    const lane = await laneFor('schedule.tooltip', testInfo);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: `${lane.day}T07:00` });
    await waitForResults(page);
    const seat = page.locator('article').first().getByRole('button', { name: /agenda|waitlist/i }).first();
    const tooltip = page.getByTestId('seat-tooltip');

    await seat.hover();
    await expect(tooltip).toBeVisible({ timeout: 600 });
    await expect(tooltip).toHaveClass(/animate-rise/);
    const duration = await tooltip.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe('1e-05s');
  });

  test('stays inside the viewport, including the grid\'s rightmost column on desktop', async ({ page }, testInfo) => {
    const lane = await laneFor('schedule.tooltip', testInfo);
    const tooltip = page.getByTestId('seat-tooltip');
    const viewport = page.viewportSize();

    if (testInfo.project.name === 'desktop') {
      await visit(page, `/schedule?day=${lane.day}&view=grid`, { as: lane.user, at: `${lane.day}T07:00` });
      const grid = page.getByTestId('schedule-grid');
      await expect(grid).toBeVisible();
      // The last cell in each room row is the rightmost column; only one with
      // a session (not an empty "—" slot) actually has a button to hover.
      const rightmostFilled = grid.locator('[role="row"] > [role="cell"]:last-child')
        .filter({ has: page.getByRole('button') });
      await rightmostFilled.last().getByRole('button').hover();
    } else {
      await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: `${lane.day}T07:00` });
      await waitForResults(page);
      await page.locator('article').first().getByRole('button', { name: /agenda|waitlist/i }).first().focus();
    }

    await expect(tooltip).toBeVisible({ timeout: 600 });
    const box = await tooltip.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(overflow).toBe(true);
  });
});

test.describe('Ended sessions', () => {
  test('a past day\'s cards cannot be booked and read as done', async ({ page }) => {
    // Read-only: nothing here can reach the API, so no lane is needed.
    const days = await conferenceDays();
    const at = await momentOn(1, '10:00');
    const reservationCalls = [];
    page.on('request', (req) => { if (req.url().includes('/reservations')) reservationCalls.push(req.url()); });

    await visit(page, `/schedule?view=list&day=${days[0]}`, { as: ATTENDEES.marcus, at });
    await waitForResults(page);
    const cards = page.getByTestId('session-card');
    await expect(cards.first()).toBeVisible();

    const ended = cards.getByRole('button', { name: /ended/i }).first();
    await expect(ended).toBeVisible();
    await expect(ended).toBeDisabled();
    await ended.click({ force: true });
    await page.waitForTimeout(300);
    expect(reservationCalls).toEqual([]);
    await expect(page.getByTestId('toaster')).toHaveText('');

    const done = await cards.evaluateAll((els) => els.map((el) => el.dataset.done));
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((d) => d === 'true')).toBe(true);
    await shotForPR(page, 'ended-cards');

    await visit(page, `/schedule?view=list&day=${days[2]}`, { as: ATTENDEES.marcus, at });
    await waitForResults(page);
    await expect(page.getByTestId('session-card').first()).toHaveAttribute('data-done', 'false');
  });

  test('the grid disables the banner and cell seat buttons for ended sessions', async ({ page }) => {
    // Read-only: nothing here can reach the API, so no lane is needed.
    const days = await conferenceDays();
    const at = await momentOn(1, '10:00');
    const reservationCalls = [];
    page.on('request', (req) => { if (req.url().includes('/reservations')) reservationCalls.push(req.url()); });

    await visit(page, `/schedule?view=grid&day=${days[0]}`, { as: ATTENDEES.marcus, at });
    const grid = page.getByTestId('schedule-grid');
    await expect(grid).toBeVisible();

    const banner = grid.getByRole('button', { name: 'Session ended' }).first();
    await expect(banner).toBeVisible();
    await expect(banner).toBeDisabled();
    await banner.click({ force: true });

    const cell = grid.getByRole('button', { name: /has ended$/i }).first();
    await expect(cell).toBeVisible();
    await expect(cell).toBeDisabled();
    await cell.click({ force: true });

    await page.waitForTimeout(300);
    expect(reservationCalls).toEqual([]);
    await expect(page.getByTestId('toaster')).toHaveText('');
  });
});
