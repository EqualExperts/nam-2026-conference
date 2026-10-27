import { test, expect } from '@playwright/test';
import { visit, laneFor, shotForPR, API } from './helpers.js';

test.describe('Your interests', () => {
  test('the dialog shows current interests, saves only on Save, and fits a phone', async ({ page, request }, testInfo) => {
    const lane = await laneFor('interests.dialog', testInfo);
    const { tags } = await (await request.get(`${API}/bootstrap`)).json();
    const topics = tags.filter((t) => t.kind === 'topic').map((t) => t.name);
    const stored = async () => (await (await request.get(`${API}/users/${lane.user}`)).json()).interests;
    const seeded = await stored();

    await visit(page, '/', { as: lane.user });
    const dialog = page.getByRole('dialog', { name: 'Your interests' });
    const open = async () => {
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByRole('button', { name: 'Your interests' }).click();
      await expect(dialog).toBeVisible();
    };

    try {
      await open();
      const chips = dialog.locator('button[aria-pressed]');
      await expect(chips).toHaveCount(topics.length);
      for (const name of topics) {
        await expect(dialog.getByRole('button', { name, exact: true }))
          .toHaveAttribute('aria-pressed', String(seeded.includes(name)));
      }
      await shotForPR(page, 'Your interests dialog');

      // Fits a phone: last chip reachable, Save on screen, no sideways scroll.
      await chips.last().scrollIntoViewIfNeeded();
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      // Three ways out, none saves.
      const toggle = dialog.getByRole('button', { name: topics[0], exact: true });
      const flip = async () => { await toggle.click(); };
      await flip(); await dialog.getByRole('button', { name: 'Cancel' }).click(); await expect(dialog).toBeHidden();
      await open(); await flip(); await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
      await open(); await flip();
      await dialog.getByRole('button', { name: 'Close' }).click({ position: { x: 8, y: 8 } });
      await expect(dialog).toBeHidden();
      expect(await stored()).toEqual(seeded);
      await open();
      await expect(toggle).toHaveAttribute('aria-pressed', String(seeded.includes(topics[0])));

      // Save writes, and survives a reload.
      await toggle.click();
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();
      const expected = seeded.includes(topics[0]) ? seeded.filter((t) => t !== topics[0]) : [...seeded, topics[0]];
      expect([...(await stored())].sort()).toEqual([...expected].sort());
      await page.reload();
      await open();
      await expect(toggle).toHaveAttribute('aria-pressed', String(!seeded.includes(topics[0])));
    } finally {
      await request.put(`${API}/users/${lane.user}/interests`, { data: { interests: seeded } });
    }
  });
});
