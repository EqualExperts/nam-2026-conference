import { test, expect } from '@playwright/test';
import { failOnPageErrors } from './helpers.js';

/**
 * /presentation — the engineering harness talk. It books nothing and reads no
 * attendee state, so no data lane and no pinned clock are needed.
 */

const counter = (page) => page.getByTestId('presentation-counter');

/** "6 / 43" → { at: 6, total: 43 } */
async function readCounter(page) {
  const [at, total] = (await counter(page).innerText()).split('/').map((n) => Number(n.trim()));
  return { at, total };
}

test.describe('The harness presentation', () => {
  test('opens full screen on its title, with no app chrome', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await page.goto('/presentation');

    await expect(page.getByRole('heading', { level: 1, name: /The engineering harness/i })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(counter(page)).toHaveText(/^1 \/ \d+$/);
    await expect(page).toHaveTitle(/The engineering harness/);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the presentation scrolls horizontally').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('arrow keys step forward and back, and the URL follows', async ({ page }) => {
    await page.goto('/presentation');
    await expect(counter(page)).toHaveText(/^1 \//);

    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(/^2 \//);
    await expect(page).toHaveURL(/[?&]beat=2\b/);

    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(/^3 \//);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(counter(page)).toHaveText(/^1 \//);
    await expect(page).not.toHaveURL(/beat=/);

    // and back on the first beat stays there
    await page.keyboard.press('ArrowLeft');
    await expect(counter(page)).toHaveText(/^1 \//);
  });

  test('?beat= opens on that beat, and End and Home jump to the ends', async ({ page }) => {
    await page.goto('/presentation?beat=6');
    await expect(counter(page)).toHaveText(/^6 \//);
    await expect(page.getByTestId('presentation-caption')).toBeVisible();

    await page.keyboard.press('End');
    const { at, total } = await readCounter(page);
    expect(at).toBe(total);
    await expect(page.getByTestId('presentation-next')).toBeDisabled();

    await page.keyboard.press('Home');
    await expect(counter(page)).toHaveText(/^1 \//);
    await expect(page.getByTestId('presentation-prev')).toBeDisabled();
  });

  test('a beat out of range opens the first one', async ({ page }) => {
    await page.goto('/presentation?beat=9999');
    await expect(counter(page)).toHaveText(/^1 \//);
  });

  test('the next and previous buttons work without a keyboard', async ({ page }) => {
    await page.goto('/presentation');
    await page.getByTestId('presentation-next').click();
    await expect(counter(page)).toHaveText(/^2 \//);
    await page.getByTestId('presentation-prev').click();
    await expect(counter(page)).toHaveText(/^1 \//);
  });

  test('each chapter in the progress bar jumps to its first beat', async ({ page }) => {
    await page.goto('/presentation');
    const first = await page.getByTestId('presentation-chapter').innerText();
    const chapters = page.getByRole('navigation', { name: 'Chapters' }).getByRole('button');
    await chapters.nth(1).click();
    await expect(page.getByTestId('presentation-chapter')).not.toHaveText(first);
    await expect(chapters.nth(1)).toHaveAttribute('aria-current', 'step');
    await expect(counter(page)).not.toHaveText(/^1 \//);
  });

  test('with reduced motion every caption still shows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/presentation?beat=2');
    const caption = page.getByTestId('presentation-caption');
    await expect(caption).toBeVisible();
    await expect(caption.getByRole('heading', { level: 2 })).toHaveText(/\S/);
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(/^3 \//);
    await expect(caption.getByRole('heading', { level: 2 })).toBeVisible();
  });
});
