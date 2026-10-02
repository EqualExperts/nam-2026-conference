import { test, expect } from '@playwright/test';
import { API, visit, momentOn, waitForResults, conferenceDays, laneFor, bookableFor, MID_SESSION_TIME, ATTENDEES, shotForPR } from './helpers.js';


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

test.describe('Seat button tooltip', () => {
  /**
   * Sessions on `day` this attendee holds nothing for — no seat, no waitlist
   * place — so the seat button is offering, not giving back.
   */
  async function unheldOn(request, userId, day) {
    const me = await (await request.get(`${API}/users/${userId}`)).json();
    const held = new Set(me.reservations.map((r) => r.sessionId));
    const all = await (await request.get(`${API}/sessions?day=${day}`)).json();
    return all.filter((s) => !s.isKeynote && s.format !== 'Social' && !held.has(s.id));
  }

  /** The seat button on the list card for `title`. */
  const seatOn = (page, title) => page.locator('article')
    .filter({ hasText: title }).first()
    .getByRole('button', { name: /agenda|waitlist|ended/i });

  test('hovering a seat button names the action it will take', async ({ page, request }, testInfo) => {
    // Read-only: hovering books nothing, so this shares the read-only lane.
    const lane = await laneFor('schedule.seats', testInfo);
    const free = await unheldOn(request, lane.user, lane.day);
    const roomy = free.find((s) => s.seatsLeft > 50);
    const full = free.find((s) => s.isFull);
    expect(roomy, 'no session with room to spare').toBeTruthy();
    expect(full, 'no sold-out session on this day').toBeTruthy();

    // 07:00 on Day 1: nothing anywhere has ended, so the wording is about seats.
    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    const tip = page.getByTestId('seat-tooltip');
    await expect(tip).toHaveCount(0);

    await seatOn(page, roomy.title).hover();
    await expect(tip).toHaveText('Add to my agenda', { timeout: 1_000 });
    await expect(tip).toHaveAttribute('role', 'tooltip');
    // Said once: the tooltip is the visual twin of the button's own name.
    await expect(tip).toHaveAttribute('aria-hidden', 'true');
    await expect(seatOn(page, roomy.title)).toHaveAttribute('aria-label', 'Add to my agenda');
    await expect(seatOn(page, roomy.title)).not.toHaveAttribute('aria-describedby', /.*/);
    await expect(tip).toHaveClass(/glass/);
    await expect(tip).toHaveClass(/animate-rise/);
    await shotForPR(page, 'seat button tooltip');

    // A full room queues you instead, and says so before you press it.
    await seatOn(page, full.title).hover();
    await expect(tip).toHaveText('Join the waitlist', { timeout: 1_000 });
  });

  test('an ended session says so, on hover and on keyboard focus', async ({ page, request }) => {
    // Read-only: hovering and focusing book nothing, so this needs no lane.
    const days = await conferenceDays();
    const free = await unheldOn(request, ATTENDEES.marcus, days[0]);
    const morning = free.find((s) => s.startsAt >= '09:00' && s.endsAt <= '10:00');
    expect(morning, 'no free Day 1 morning session').toBeTruthy();
    const tip = page.getByTestId('seat-tooltip');

    // Before it starts, the seat is still on offer.
    await visit(page, `/schedule?day=${days[0]}&view=list`, { as: ATTENDEES.marcus, at: await momentOn(0, '08:00') });
    await waitForResults(page);
    await seatOn(page, morning.title).hover();
    await expect(tip).toHaveText(/Add to my agenda|Join the waitlist/, { timeout: 1_000 });

    // Once it is over the same button says why pressing it does nothing — on
    // hover, and on focus, which a natively disabled button could never do.
    await visit(page, `/schedule?day=${days[0]}&view=list`, { as: ATTENDEES.marcus, at: await momentOn(0, '10:30') });
    await waitForResults(page);
    await expect(seatOn(page, morning.title)).toBeDisabled();
    await seatOn(page, morning.title).hover();
    await expect(tip).toHaveText('Session ended', { timeout: 1_000 });
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);
    await seatOn(page, morning.title).focus();
    await expect(tip).toHaveText('Session ended');
  });

  test('the tooltip leaves on blur, on mouse leave and on Escape', async ({ page, request }, testInfo) => {
    const lane = await laneFor('schedule.seats', testInfo);   // read-only
    const roomy = (await unheldOn(request, lane.user, lane.day)).find((s) => s.seatsLeft > 50);
    expect(roomy, 'no session with room to spare').toBeTruthy();

    await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    const seat = seatOn(page, roomy.title);
    const tip = page.getByTestId('seat-tooltip');

    // Hover cases first: `focus()` scrolls, and the page scrolls smoothly, so a
    // hover straight after one lands where the button no longer is.
    await seat.hover();
    await expect(tip).toBeVisible({ timeout: 1_000 });
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);

    await seat.hover();
    await expect(tip).toBeVisible({ timeout: 1_000 });
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await page.mouse.move(0, 0);

    await seat.focus();
    await expect(tip).toBeVisible();
    await seat.blur();
    await expect(tip).toHaveCount(0);
  });

  test('a sold-out grid cell offers the waitlist, by name and in the tooltip', async ({ page, request }, testInfo) => {
    const lane = await laneFor('schedule.seats', testInfo);   // read-only
    const full = (await unheldOn(request, lane.user, lane.day)).find((s) => s.isFull);
    expect(full, 'no sold-out session on this day').toBeTruthy();

    await visit(page, `/schedule?view=grid&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    const seat = page.getByTestId('schedule-grid')
      .getByRole('button', { name: `Join the waitlist for ${full.title}`, exact: true });
    await expect(seat).toBeVisible();
    await seat.hover();
    await expect(page.getByTestId('seat-tooltip')).toHaveText('Join the waitlist', { timeout: 1_000 });
  });

  test('the grid\'s rightmost seat button keeps its tooltip on screen', async ({ page }, testInfo) => {
    const lane = await laneFor('schedule.seats', testInfo);   // read-only
    await visit(page, `/schedule?view=grid&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    const grid = page.getByTestId('schedule-grid');
    await expect(grid).toBeVisible();
    await grid.locator('div').first().evaluate((el) => { el.scrollLeft = el.scrollWidth; });

    const seats = grid.getByRole('button', { name: /agenda|waitlist|ended/i });
    const rights = await seats.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(rights.length, 'no seat buttons in the grid').toBeGreaterThan(0);
    const last = rights.indexOf(Math.max(...rights));

    await seats.nth(last).hover();
    const tip = page.getByTestId('seat-tooltip');
    await expect(tip).toBeVisible({ timeout: 1_000 });
    const box = await tip.boundingBox();
    const width = page.viewportSize().width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the tooltip appears without animating', async ({ page, request }, testInfo) => {
      const lane = await laneFor('schedule.seats', testInfo);   // read-only
      const roomy = (await unheldOn(request, lane.user, lane.day)).find((s) => s.seatsLeft > 50);
      expect(roomy, 'no session with room to spare').toBeTruthy();

      await visit(page, `/schedule?day=${lane.day}&view=list`, { as: lane.user, at: await momentOn(0, '07:00') });
      await waitForResults(page);
      await seatOn(page, roomy.title).hover();
      const tip = page.getByTestId('seat-tooltip');
      await expect(tip).toBeVisible({ timeout: 1_000 });
      await expect(tip).toHaveClass(/animate-rise/);
      // The motion is switched off, not merely quick: the reduced-motion block
      // in index.css cuts every duration to a hundredth of a millisecond.
      const seconds = await tip.evaluate((el) => {
        const d = getComputedStyle(el).animationDuration;
        return d.endsWith('ms') ? parseFloat(d) / 1000 : parseFloat(d);
      });
      expect(seconds).toBeLessThan(0.001);
    });
  });
});
