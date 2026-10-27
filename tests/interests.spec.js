import { test, expect } from '@playwright/test';
import { visit, laneFor, shotForPR, API } from './helpers.js';

test('an attendee picks their interests from the menu, and only Save writes them', async ({ page, request }, testInfo) => {
  const { user } = await laneFor('interests.dialog', testInfo);
  const stored = async () => (await (await request.get(`${API}/users/${user}`)).json()).interests;
  const before = await stored();
  const topics = (await (await request.get(`${API}/bootstrap`)).json()).tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  const toggle = (name) => page.getByRole('button', { name, exact: true });
  const open = async () => {
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('button', { name: 'Your interests' }).click();
    await expect(page.getByRole('dialog', { name: 'Your interests' })).toBeVisible();
  };

  try {
    await visit(page, '/', { as: user });
    await open();
    const dialog = page.getByRole('dialog', { name: 'Your interests' });
    await expect(dialog.locator('button[aria-pressed]')).toHaveCount(topics.length);
    for (const name of topics) {
      await expect(toggle(name)).toHaveAttribute('aria-pressed', String(before.includes(name)));
    }

    // Fits the screen: Save in view, no sideways scroll, last topic reachable.
    await expect(page.getByRole('button', { name: 'Save' })).toBeInViewport();
    await toggle(topics.at(-1)).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await shotForPR(page, 'Your interests dialog');

    // Cancel, Escape and an outside click each discard a change.
    const flip = topics.find((t) => !before.includes(t));
    for (const close of [
      () => page.getByRole('button', { name: 'Cancel' }).click(),
      () => page.keyboard.press('Escape'),
      () => page.getByRole('button', { name: 'Close', exact: true }).click({ position: { x: 5, y: 5 }, force: true }),
    ]) {
      await toggle(flip).click();
      await close();
      await expect(dialog).toBeHidden();
      expect(await stored()).toEqual(before);
      await open();
      await expect(toggle(flip)).toHaveAttribute('aria-pressed', 'false');
    }

    // Save writes, and it survives a reload.
    await toggle(flip).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    expect((await stored()).sort()).toEqual([...before, flip].sort());
    await page.reload();
    await open();
    await expect(toggle(flip)).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await request.put(`${API}/users/${user}/interests`, { data: { interests: before } });
  }
});
