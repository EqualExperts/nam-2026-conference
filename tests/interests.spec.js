import { test, expect } from '@playwright/test';
import { visit, laneFor, momentOn, shotForPR } from './helpers.js';

const API = '/api';

test.describe('Your interests', () => {
  test('choose, save, reload, and cancel three ways', async ({ page, request }, testInfo) => {
    const lane = await laneFor('interests.save', testInfo);
    const me = `${API}/users/${lane.user}`;
    const original = (await (await request.get(me)).json()).interests;
    const topics = (await (await request.get(`${API}/bootstrap`)).json()).tags.filter((t) => t.kind === 'topic').map((t) => t.name);
    const mine = async () => (await (await request.get(me)).json()).interests;
    const toggles = page.getByTestId('interests-dialog').getByRole('button', { pressed: true });
    const open = async () => {
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByTestId('open-interests').click();
      await expect(page.getByTestId('interests-dialog')).toBeVisible();
    };

    try {
      await visit(page, '/', { as: lane.user, at: await momentOn(0, '08:00') });
      await open();
      const all = page.getByTestId('interests-dialog').locator('button[aria-pressed]');
      await expect(all).toHaveCount(topics.length);
      await expect(toggles).toHaveCount(original.length);
      for (const name of original) {
        await expect(page.getByTestId('interests-dialog').getByRole('button', { name, pressed: true })).toBeVisible();
      }
      await shotForPR(page, 'interests dialog');

      // cancel, Escape and an outside click save nothing
      const extra = topics.find((t) => !original.includes(t));
      for (const close of [
        () => page.getByRole('button', { name: 'Cancel' }).click(),
        () => page.keyboard.press('Escape'),
        () => page.getByTestId('interests-backdrop').click({ position: { x: 4, y: 4 } }),
      ]) {
        await page.getByTestId('interests-dialog').getByRole('button', { name: extra }).click();
        await close();
        await expect(page.getByTestId('interests-dialog')).toBeHidden();
        expect(await mine()).toEqual(original);
        await open();
        await expect(page.getByTestId('interests-dialog').getByRole('button', { name: extra })).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('interests-dialog')).toBeHidden();
        await open();
      }

      // save adds one, drops one
      const dropped = original[0];
      await page.getByTestId('interests-dialog').getByRole('button', { name: extra }).click();
      await page.getByTestId('interests-dialog').getByRole('button', { name: dropped }).click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('interests-dialog')).toBeHidden();
      const expected = [...original.slice(1), extra];
      expect((await mine()).sort()).toEqual(expected.sort());

      await page.reload();
      await open();
      await expect(page.getByTestId('interests-dialog').getByRole('button', { name: extra })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('interests-dialog').getByRole('button', { name: dropped })).toHaveAttribute('aria-pressed', 'false');
    } finally {
      await request.put(`${me}/interests`, { data: { interests: original } });
    }
  });

  test('is usable at phone width', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile only');
    const lane = await laneFor('interests.save', testInfo);
    await visit(page, '/', { as: lane.user, at: await momentOn(0, '08:00') });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByTestId('open-interests').click();
    const dialog = page.getByTestId('interests-dialog');
    const last = dialog.locator('button[aria-pressed]').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Save' })).toBeInViewport();
    const fits = await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
    await shotForPR(page, 'interests dialog on mobile');
  });
});
