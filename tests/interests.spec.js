import { test, expect } from '@playwright/test';
import { visit, laneFor, momentOn, shotForPR, API } from './helpers.js';

test.describe('Your interests', () => {
  let lane;
  let seeded;
  let topics;

  test.beforeEach(async ({ request }, testInfo) => {
    lane = await laneFor('interests.modal', testInfo);
    seeded = (await (await request.get(`${API}/users/${lane.user}`)).json()).interests;
    const boot = await (await request.get(`${API}/bootstrap`)).json();
    topics = boot.tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  });

  test.afterEach(async ({ request }) => {
    await request.put(`${API}/users/${lane.user}/interests`, { data: { interests: seeded } });
  });

  async function open(page) {
    await visit(page, '/', { as: lane.user, at: await momentOn(0, '08:00') });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByTestId('open-interests').click();
    const dialog = page.getByTestId('interests-dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  const stored = async (request) => (await (await request.get(`${API}/users/${lane.user}`)).json()).interests;

  test('lists every topic as a toggle with the seeded interests pressed', async ({ page }) => {
    expect(seeded.length).toBeGreaterThan(0);
    const dialog = await open(page);
    const chips = dialog.locator('button[aria-pressed]');
    await expect(chips).toHaveCount(topics.length);
    for (const t of topics) {
      await expect(dialog.getByRole('button', { name: t, exact: true }))
        .toHaveAttribute('aria-pressed', String(seeded.includes(t)));
    }
    await shotForPR(page, 'Your interests dialog');
  });

  test('saving writes the selection and it survives a reload', async ({ page, request }) => {
    const dialog = await open(page);
    const extra = topics.find((t) => !seeded.includes(t));
    await dialog.getByRole('button', { name: extra, exact: true }).click();
    await dialog.getByTestId('interests-save').click();
    await expect(dialog).toBeHidden();
    expect(await stored(request)).toEqual(expect.arrayContaining([...seeded, extra]));
    expect(await stored(request)).toHaveLength(seeded.length + 1);

    await page.reload();
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByTestId('open-interests').click();
    await expect(page.getByTestId('interests-dialog').getByRole('button', { name: extra, exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  test('deselecting everything and saving leaves none', async ({ page, request }) => {
    const dialog = await open(page);
    for (const t of seeded) await dialog.getByRole('button', { name: t, exact: true }).click();
    await dialog.getByTestId('interests-save').click();
    await expect(dialog).toBeHidden();
    expect(await stored(request)).toEqual([]);
  });

  for (const how of ['Cancel', 'Escape', 'outside click']) {
    test(`${how} saves nothing`, async ({ page, request }) => {
      const dialog = await open(page);
      const extra = topics.find((t) => !seeded.includes(t));
      await dialog.getByRole('button', { name: extra, exact: true }).click();
      if (how === 'Cancel') await dialog.getByTestId('interests-cancel').click();
      else if (how === 'Escape') await page.keyboard.press('Escape');
      else await page.getByRole('button', { name: 'Close', exact: true }).click({ position: { x: 4, y: 4 } });
      await expect(dialog).toBeHidden();
      expect(await stored(request)).toEqual(seeded);

      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByTestId('open-interests').click();
      await expect(page.getByTestId('interests-dialog').getByRole('button', { name: extra, exact: true }))
        .toHaveAttribute('aria-pressed', 'false');
    });
  }

  test('is usable at mobile width: last topic reachable, Save visible, no sideways scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile project only');
    const dialog = await open(page);
    await dialog.getByRole('button', { name: topics[topics.length - 1], exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', { name: topics[topics.length - 1], exact: true })).toBeInViewport();
    await expect(dialog.getByTestId('interests-save')).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
