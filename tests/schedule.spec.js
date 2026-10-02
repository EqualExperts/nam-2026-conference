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

/**
 * The seat button is icon-only, so what it will do has to be legible before
 * you press it. These cover the five phrases through the views the ticket
 * names — a list card and both of the grid's own buttons.
 */
test.describe('Seat button tooltip', () => {
  const TIP = 'seat-tooltip';
  /** The one aria-pressed control on a card or a grid cell. */
  const seatIn = (scope) => scope.locator('button[aria-pressed]');

  test('hovering names the action, and the text follows the click', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'hover needs a mouse; the touch path has its own test');
    // Books, so it runs in its own lane and inside its pinned slot only.
    const lane = await laneFor('seat.tooltip', testInfo);
    const target = (await bookableFor(request, lane.user, lane.day))
      .find((s) => s.startsAt === lane.slot && s.seatsLeft > 3);
    expect(target, 'nothing this attendee can add in its slot').toBeTruthy();

    // Day 1 at 07:00, so nothing on any day has ended and the button is live.
    await visit(page, `/schedule?view=list&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    const card = page.getByTestId('session-card').filter({ hasText: target.title }).first();
    const seat = seatIn(card);
    const tip = page.getByTestId(TIP);
    const url = page.url();

    await expect(tip).toHaveCount(0);
    await seat.hover();
    await expect(tip).toHaveText('Add to my agenda');
    await shotForPR(page, 'seat button tooltip');

    // Announced once: the phrase is the button's name, and the tooltip itself
    // is hidden from the tree and referenced by nothing, so the button has no
    // second voice (an aria-describedby or a title would give it one).
    await expect(tip).toHaveAttribute('aria-hidden', 'true');
    await expect(card.getByRole('button', { name: 'Add to my agenda', exact: true })).toHaveCount(1);
    await expect(card.getByRole('button', { name: 'Add to my agenda', exact: true, description: /./ })).toHaveCount(0);

    await seat.click();
    await expect(tip).toHaveText('Remove from my agenda');
    await expect(seat).toHaveAttribute('aria-pressed', 'true');
    await expect(card.getByRole('button', { name: 'Remove from my agenda', exact: true, description: /./ })).toHaveCount(0);

    await seat.click();
    await expect(tip).toHaveText('Add to my agenda');
    await expect(seat).toHaveAttribute('aria-pressed', 'false');
    expect(page.url(), 'the card is a link; the seat button must not navigate').toBe(url);

    await request.delete(`${API}/users/${lane.user}/reservations/${target.id}`);
  });

  test('focus shows it; blur, mouse out and Escape all take it away', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'needs a mouse pointer as well as a keyboard');
    // Read-only: it hovers and focuses, and books nothing.
    const lane = await laneFor('schedule.seats', testInfo);
    await visit(page, `/schedule?view=list&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    const seat = seatIn(page.getByTestId('session-card').first());
    const tip = page.getByTestId(TIP);

    await seat.focus();
    await expect(tip).toHaveCount(1);
    await seat.blur();
    await expect(tip).toHaveCount(0);

    await seat.hover();
    await expect(tip).toHaveCount(1);
    await page.mouse.move(2, 2);
    await expect(tip).toHaveCount(0);

    // Opened by hover, so focus is still on the body — Escape must reach it anyway.
    await seat.hover();
    await expect(tip).toHaveCount(1);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
  });

  test('a focus that scrolls the button into view still shows the tooltip', async ({ page }, testInfo) => {
    // Read-only: it focuses, and books nothing.
    const lane = await laneFor('schedule.seats', testInfo);
    await visit(page, `/schedule?view=list&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    // The last card is thousands of pixels below the fold, so focusing its seat
    // button scrolls the page itself — smoothly, per index.css. The tooltip has
    // to survive the scroll its own focus caused, or a keyboard user only ever
    // sees a tooltip on the buttons that happened to be on screen already.
    const seat = seatIn(page.getByTestId('session-card').last());
    const tip = page.getByTestId(TIP);
    const box = await seat.boundingBox();
    expect(box.y, 'the last card should start below the fold').toBeGreaterThan(page.viewportSize().height);

    await seat.focus();
    await expect(tip).toHaveCount(1);
    // A scroll that has started and then held still for a frame has finished.
    await page.waitForFunction(() => {
      const y = window.scrollY;
      const settled = y > 0 && window.__lastY === y;
      window.__lastY = y;
      return settled;
    });

    // Still open once the scroll stops, and on its button rather than left
    // where the button used to be.
    await expect(tip).toHaveCount(1);
    const [b, t] = [await seat.boundingBox(), await tip.boundingBox()];
    expect(b.y, 'the focus should have brought the button into view').toBeLessThan(page.viewportSize().height);
    // Still spanning its button horizontally (centred on it, give or take the
    // clamp that keeps a wide tooltip inside a narrow viewport)...
    expect(t.x).toBeLessThanOrEqual(b.x + b.width);
    expect(t.x + t.width).toBeGreaterThanOrEqual(b.x);
    // ...and sitting against it, above or below.
    const gap = Math.min(Math.abs(b.y - (t.y + t.height)), Math.abs(t.y - (b.y + b.height)));
    expect(gap, 'the tooltip should sit against its button').toBeLessThan(10);
  });

  test('a sold-out grid cell says the click will join the waitlist', async ({ page, request }, testInfo) => {
    // Read-only: the tooltip is only read, no waitlist place is taken.
    const lane = await laneFor('schedule.seats', testInfo);
    const me = await (await request.get(`${API}/users/${lane.user}`)).json();
    const held = new Set(me.reservations.map((r) => r.sessionId));
    const all = await (await request.get(`${API}/sessions?day=${lane.day}`)).json();
    const full = all.find((s) => s.isFull && !s.isKeynote && s.format !== 'Social' && !held.has(s.id));
    expect(full, 'no sold-out room in the grid on this day').toBeTruthy();

    await visit(page, `/schedule?view=grid&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    const grid = page.getByTestId('schedule-grid');
    await expect(grid).toBeVisible();
    // The cell's own name carries the same correction the tooltip does.
    const seat = grid.getByRole('button', { name: `Join the waitlist for ${full.title}`, exact: true });
    await seat.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100); // let the smooth scroll settle before hovering a moving target
    const tip = page.getByTestId(TIP);

    if (testInfo.project.name === 'desktop') await seat.hover();
    else await seat.focus();
    await expect(tip).toHaveText('Join the waitlist');
    await shotForPR(page, 'sold out grid cell tooltip');
  });

  test('an ended session still says why, from a disabled button', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'a disabled button cannot be focused, so this is hover only');
    // Read-only: nothing here can reach the API, so no lane is needed.
    const days = await conferenceDays();
    await visit(page, `/schedule?view=list&day=${days[0]}`, { as: ATTENDEES.marcus, at: await momentOn(1, '10:00') });
    await waitForResults(page);
    const ended = page.getByTestId('session-card').getByRole('button', { name: 'Session ended', exact: true }).first();
    await expect(ended).toBeDisabled();
    // A disabled button fires no mouse events of its own, which is why the
    // wrapper owns them; force past Playwright's enabled check to prove it.
    await ended.hover({ force: true });
    await expect(page.getByTestId(TIP)).toHaveText('Session ended');
  });

  test('nothing clips it and it stays inside the viewport', async ({ page }, testInfo) => {
    // Read-only: hover and focus only.
    const lane = await laneFor('schedule.seats', testInfo);
    const tip = page.getByTestId(TIP);

    if (testInfo.project.name === 'desktop') {
      // The grid's rightmost room column, inside two overflow-hidden ancestors,
      // an overflow-x-auto scroller and a cell that lifts on hover.
      await visit(page, `/schedule?view=grid&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
      const grid = page.getByTestId('schedule-grid');
      await expect(grid).toBeVisible();
      const cells = grid.locator('[role="cell"] button[aria-pressed]');
      const xs = await cells.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
      expect(xs.length).toBeGreaterThan(0);
      await cells.nth(xs.indexOf(Math.max(...xs))).hover();
    } else {
      await visit(page, `/schedule?view=list&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
      await waitForResults(page);
      await seatIn(page.getByTestId('session-card').first()).focus();
    }

    await expect(tip).toHaveCount(1);
    const box = await tip.boundingBox();
    const view = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    // The portal is the proof: no overflow-hidden or transformed ancestor is
    // left to clip it, which toBeVisible() would never have noticed.
    expect(await tip.evaluate((el) => el.parentElement === document.body)).toBe(true);
  });

  test('it rises like the rest of the app, and not at all under reduced motion', async ({ page }, testInfo) => {
    // Read-only: focus only.
    const lane = await laneFor('schedule.seats', testInfo);
    await visit(page, `/schedule?view=list&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    const seat = seatIn(page.getByTestId('session-card').first());
    const tip = page.getByTestId(TIP);

    await seat.focus();
    await expect(tip).toHaveClass(/animate-rise/);
    await expect(tip).toHaveClass(/glass/);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seat.blur();
    await seat.focus();
    await expect(tip).toHaveCount(1);
    const ms = await tip.evaluate((el) => {
      const d = getComputedStyle(el).animationDuration;
      return d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000;
    });
    expect(ms).toBeLessThan(1);
  });

  test('a tap toggles the seat straight away and opens no tooltip', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the touch path is the mobile project');
    // Books, so it runs in its own lane and inside its pinned slot only.
    const lane = await laneFor('seat.tooltip', testInfo);
    const target = (await bookableFor(request, lane.user, lane.day))
      .find((s) => s.startsAt === lane.slot && s.seatsLeft > 3);
    expect(target, 'nothing this attendee can add in its slot').toBeTruthy();

    await visit(page, `/schedule?view=list&day=${lane.day}`, { as: lane.user, at: await momentOn(0, '07:00') });
    await waitForResults(page);
    const seat = seatIn(page.getByTestId('session-card').filter({ hasText: target.title }).first());

    try {
      await seat.tap();
      await expect(seat).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId(TIP)).toHaveCount(0);
    } finally {
      // Released even on a failure: the lane's next run would otherwise find
      // its slot already taken and fail somewhere else entirely.
      await request.delete(`${API}/users/${lane.user}/reservations/${target.id}`);
    }
  });
});
