import { test, expect } from '@playwright/test';
import { visit, momentOn, laneFor, bookableFor, ATTENDEES } from './helpers.js';

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
