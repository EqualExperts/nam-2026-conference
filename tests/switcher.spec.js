import { test, expect } from '@playwright/test';
import { visit, momentOn, laneFor, bookableFor, shotForPR, ATTENDEES } from './helpers.js';

test.describe('Attendee switcher', () => {
  test('the switcher counts what is on an agenda, not what was "saved"', async ({ page }) => {
    await visit(page, '/', { as: ATTENDEES.sofia });
    await page.getByRole('button', { name: /Switch attendee/ }).click();

    const option = page.getByRole('option', { name: /Sofia/ });
    await expect(option).toContainText(/[1-9]\d* on agenda/);
    await expect(option).not.toContainText(/saved/i);
  });

  test('the switcher\'s own row updates after booking or releasing a seat, without a reload', async ({ page, request }, testInfo) => {
    const lane = await laneFor('switcher.live-count', testInfo);
    const target = (await bookableFor(request, lane.user, lane.day)).find((s) => s.seatsLeft > 3);
    expect(target, 'nothing bookable in this lane').toBeTruthy();

    // Pin the clock: this lane books on day index 0, the live conference day, so
    // an unpinned clock projects the real time of day onto it — late enough and
    // the picked session already "ended", and reserveSeat 409s instead of
    // confirming. Every other booking test in this file pins for the same reason.
    await visit(page, `/sessions/${target.id}`, { as: lane.user, at: await momentOn(0, '07:00') });

    const digitOf = async (locator) => Number((await locator.textContent()).match(/(\d+) on agenda/)[1]);

    await page.getByRole('button', { name: /Switch attendee/ }).click();
    const ownRow = page.getByRole('option', { selected: true });
    const otherRow = page.getByRole('option', { selected: false }).first();
    const before = await digitOf(ownRow);
    const otherBefore = await digitOf(otherRow);
    await page.keyboard.press('Escape');

    await page.getByTestId('reserve-seat').click();
    await expect(page.getByTestId('reservation-confirmed')).toBeVisible();

    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(ownRow).toContainText(`${before + 1} on agenda`);
    await expect(otherRow).toContainText(`${otherBefore} on agenda`);
    await page.keyboard.press('Escape');

    await page.getByTestId('release-seat').click();
    await expect(page.getByTestId('reserve-seat')).toBeVisible();

    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(ownRow).toContainText(`${before} on agenda`);
    await expect(otherRow).toContainText(`${otherBefore} on agenda`);
  });

  test('choosing an attendee in the switcher signs in as them', async ({ page }) => {
    await visit(page, '/', { as: ATTENDEES.jonas });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('option', { name: /Andy Vays/ }).click();

    await expect(page.getByRole('button', { name: /Viewing as Andy Vays/ })).toBeVisible();
    // the menu now offers what only a speaker gets
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(page.getByTestId('own-speaker-profile')).toBeVisible();
  });

  test('the switcher offers only the three hosts, plus whoever is already selected', async ({ page }) => {
    await visit(page, '/', { as: ATTENDEES.jonas });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(page.getByRole('option')).toHaveText([/Jonas Claesson/, /Andy Vays/, /Abraham Marín Pérez/]);
    await page.keyboard.press('Escape');

    // Another seeded attendee, selected through localStorage as the tests do,
    // stays listed and selected so it can be switched away from.
    await visit(page, '/', { as: ATTENDEES.kenji });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(page.getByRole('option')).toHaveText([/Jonas Claesson/, /Andy Vays/, /Kenji Nakamura/, /Abraham Marín Pérez/]);
    await expect(page.getByRole('option', { selected: true })).toContainText('Kenji Nakamura');
  });

});

test.describe('Your speaker profile', () => {
  test('a speaking attendee is linked to their own profile, which says it is them', async ({ page }) => {
    await visit(page, '/', { as: ATTENDEES.andy });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByTestId('own-speaker-profile').click();

    await expect(page.getByTestId('speaker-name')).toHaveText('Andy Vays');
    await expect(page.getByTestId('speaker-is-you')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Speaking/ })).toBeVisible();
  });

  test('nobody else is told a profile is theirs', async ({ page }) => {
    // Abraham is a speaker too, but this is not his profile.
    await visit(page, '/', { as: ATTENDEES.abraham });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByTestId('own-speaker-profile').click();
    await expect(page.getByTestId('speaker-is-you')).toBeVisible();
    const own = page.url();

    await visit(page, '/', { as: ATTENDEES.andy });
    await page.goto(own);
    await expect(page.getByTestId('speaker-name')).toHaveText(/Abraham/);
    await expect(page.getByTestId('speaker-is-you')).toHaveCount(0);

    await visit(page, '/', { as: ATTENDEES.kenji });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(page.getByTestId('own-speaker-profile')).toHaveCount(0);
  });
});

test.describe('Your interests', () => {
  // Desktop and mobile run side by side, each on its own attendee; both put the
  // saved interests back, so nothing here leaks into another spec.
  const who = (testInfo) => (testInfo.project.name === 'mobile' ? ATTENDEES.marcus : ATTENDEES.kenji);
  const read = async (request, id) => (await (await request.get(`/api/users/${id}`)).json()).interests;
  const restore = (request, id, interests) => request.put(`/api/users/${id}/interests`, { data: { interests } });
  const open = async (page) => {
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('button', { name: 'Your interests' }).click();
    const dialog = page.getByRole('dialog', { name: 'Your interests' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  test('lists every topic as a toggle, saves the choice, and keeps it after a reload', async ({ page, request }, testInfo) => {
    const id = who(testInfo);
    const original = await read(request, id);
    const boot = await (await request.get('/api/bootstrap')).json();
    const topics = boot.tags.filter((t) => t.kind === 'topic').map((t) => t.name);
    try {
      await visit(page, '/', { as: id });
      const dialog = await open(page);
      const toggles = dialog.locator('button[aria-pressed]');
      await expect(toggles).toHaveCount(topics.length);
      for (const name of topics) {
        await expect(dialog.getByRole('button', { name, exact: true }))
          .toHaveAttribute('aria-pressed', String(original.includes(name)));
      }

      // Flip the first topic and save; only that one changes.
      const flip = topics[0];
      await dialog.getByRole('button', { name: flip, exact: true }).click();
      await shotForPR(page, 'The interests dialog with a topic toggled');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      const expected = original.includes(flip) ? original.filter((n) => n !== flip) : [...original, flip];
      expect([...(await read(request, id))].sort()).toEqual([...expected].sort());

      await page.reload();
      const again = await open(page);
      await expect(again.getByRole('button', { name: flip, exact: true }))
        .toHaveAttribute('aria-pressed', String(!original.includes(flip)));
    } finally {
      await restore(request, id, original);
    }
  });

  test('saving with nothing selected leaves no interests', async ({ page, request }, testInfo) => {
    const id = who(testInfo);
    const original = await read(request, id);
    try {
      await visit(page, '/', { as: id });
      const dialog = await open(page);
      for (const btn of await dialog.locator('button[aria-pressed="true"]').all()) await btn.click();
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      expect(await read(request, id)).toEqual([]);
    } finally {
      await restore(request, id, original);
    }
  });

  test('Cancel, Escape and an outside click save nothing', async ({ page, request }, testInfo) => {
    const id = who(testInfo);
    const original = await read(request, id);
    await visit(page, '/', { as: id });
    for (const close of [
      (d) => d.getByRole('button', { name: 'Cancel' }).click(),
      () => page.keyboard.press('Escape'),
      () => page.getByRole('button', { name: 'Close', exact: true }).click(),
    ]) {
      const dialog = await open(page);
      await dialog.locator('button[aria-pressed]').first().click();
      await close(dialog);
      await expect(dialog).toBeHidden();
      expect(await read(request, id)).toEqual(original);
    }
    // The rest of the app still answers, and a reopened dialog starts clean.
    const dialog = await open(page);
    expect(await dialog.locator('button[aria-pressed="true"]').count()).toBe(original.length);
  });

  test('at mobile width every topic is reachable and Save is visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile layout');
    await visit(page, '/', { as: ATTENDEES.marcus });
    const dialog = await open(page);
    await dialog.locator('button[aria-pressed]').last().scrollIntoViewIfNeeded();
    await expect(dialog.locator('button[aria-pressed]').last()).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
