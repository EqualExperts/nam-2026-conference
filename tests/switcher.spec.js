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
  test('the menu opens a topic picker; it saves, survives a reload, and closing saves nothing', async ({ page, request }, testInfo) => {
    const lane = await laneFor('switcher.interests', testInfo);
    const api = async (path, init) => (await request.fetch(`/api${path}`, init)).json();
    const original = (await api(`/users/${lane.user}`)).interests;
    const topics = (await api('/meta/bootstrap')).tags.filter((t) => t.kind === 'topic').map((t) => t.name);

    await visit(page, '/', { as: lane.user, at: await momentOn(0, '10:30') });
    const dialog = page.getByRole('dialog', { name: 'Your interests' });
    const open = async () => {
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByRole('button', { name: 'Your interests' }).click();
      await expect(dialog).toBeVisible();
    };
    const chip = (name) => dialog.getByRole('button', { name, exact: true });

    try {
      await open();
      // every topic is a toggle, the attendee's own already pressed
      await expect(dialog.locator('button[aria-pressed]')).toHaveCount(topics.length);
      for (const t of topics) {
        await expect(chip(t)).toHaveAttribute('aria-pressed', original.includes(t) ? 'true' : 'false');
      }
      await shotForPR(page, 'Your interests dialog');

      // fits the phone: Save on screen, last topic reachable, no sideways scroll
      await chip(topics.at(-1)).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      // three ways out, none of which saves
      const flip = topics.find((t) => !original.includes(t));
      await chip(flip).click();
      await expect(chip(flip)).toHaveAttribute('aria-pressed', 'true');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await open();
      await expect(chip(flip)).toHaveAttribute('aria-pressed', 'false');
      await chip(flip).click();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await open();
      await expect(chip(flip)).toHaveAttribute('aria-pressed', 'false');
      await chip(flip).click();
      await dialog.getByRole('button', { name: 'Close' }).click({ position: { x: 8, y: 8 } });
      await expect(dialog).toBeHidden();
      expect((await api(`/users/${lane.user}`)).interests).toEqual(original);

      // save one more topic, then reload
      await open();
      await chip(flip).click();
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      expect((await api(`/users/${lane.user}`)).interests).toContain(flip);
      await page.reload();
      await open();
      await expect(chip(flip)).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await request.put(`/api/users/${lane.user}/interests`, { data: { interests: original } });
    }
  });
});
