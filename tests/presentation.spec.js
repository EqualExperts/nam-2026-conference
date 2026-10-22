import { test, expect } from '@playwright/test';
import { failOnPageErrors } from './helpers.js';

/**
 * /engineering-presentation — the engineering harness talk. It books nothing and reads no
 * attendee state, so no data lane and no pinned clock are needed.
 */

const counter = (page) => page.getByTestId('presentation-counter');

/** "6 / 43" → { at: 6, total: 43 } */
async function readCounter(page) {
  const [at, total] = (await counter(page).innerText()).split('/').map((n) => Number(n.trim()));
  return { at, total };
}

/**
 * Freeze the page's timers (needs `page.clock.install()` before `goto`), so the
 * hand-off's 900 ms setTimeout fires only when a test runs the clock on.
 */
async function pauseTimers(page) {
  await page.clock.pauseAt(Date.now() + 60_000);
}

test.describe('The harness presentation', () => {
  test('opens full screen on its title, with no app chrome', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await page.goto('/engineering-presentation');

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
    await page.goto('/engineering-presentation');
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
    await page.goto('/engineering-presentation?beat=6');
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
    await page.goto('/engineering-presentation?beat=9999');
    await expect(counter(page)).toHaveText(/^1 \//);
  });

  test('the next and previous buttons work without a keyboard', async ({ page }) => {
    await page.goto('/engineering-presentation');
    await page.getByTestId('presentation-next').click();
    await expect(counter(page)).toHaveText(/^2 \//);
    await page.getByTestId('presentation-prev').click();
    await expect(counter(page)).toHaveText(/^1 \//);
  });

  test('each chapter in the progress bar jumps to its first beat', async ({ page }) => {
    await page.goto('/engineering-presentation');
    const first = await page.getByTestId('presentation-chapter').innerText();
    const chapters = page.getByRole('navigation', { name: 'Chapters' }).getByRole('button');
    await chapters.nth(1).click();
    await expect(page.getByTestId('presentation-chapter')).not.toHaveText(first);
    await expect(chapters.nth(1)).toHaveAttribute('aria-current', 'step');
    await expect(counter(page)).not.toHaveText(/^1 \//);
  });

  test('Space still advances after clicking a chapter or the full-screen button', async ({ page }) => {
    await page.goto('/engineering-presentation');
    const chapters = page.getByRole('navigation', { name: 'Chapters' }).getByRole('button');
    await chapters.nth(2).click();
    const { at } = await readCounter(page);

    // a clicked chrome button must not keep focus and swallow the clicker's Space
    await page.keyboard.press(' ');
    await expect(counter(page)).toHaveText(new RegExp(`^${at + 1} /`));
    await page.keyboard.press('Enter');
    await expect(counter(page)).toHaveText(new RegExp(`^${at + 2} /`));

    await page.getByRole('button', { name: /full screen/i }).click();
    await page.keyboard.press(' ');
    await expect(counter(page)).toHaveText(new RegExp(`^${at + 3} /`));
  });

  test('with reduced motion every caption still shows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/engineering-presentation?beat=2');
    const caption = page.getByTestId('presentation-caption');
    await expect(caption).toBeVisible();
    await expect(caption.getByRole('heading', { level: 2 })).toHaveText(/\S/);
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(/^3 \//);
    await expect(caption.getByRole('heading', { level: 2 })).toBeVisible();
  });
});

/**
 * /product-presentation — the product harness talk, which ends by handing over
 * to the engineering one. Like it, it touches no attendee state.
 */
test.describe('The product presentation', () => {
  test('opens full screen on its title and hands over to the engineering talk', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await page.goto('/product-presentation');

    await expect(page.getByRole('heading', { level: 1, name: /The product harness/i })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(counter(page)).toHaveText(/^1 \/ \d+$/);
    await expect(page).toHaveTitle(/The product harness/);

    await page.keyboard.press('End');
    const { at, total } = await readCounter(page);
    expect(at).toBe(total);
    // past the last beat the next button is the hand-off, not disabled
    await expect(page.getByTestId('presentation-next')).toBeEnabled();

    await page.getByRole('button', { name: /^Continue to the engineering harness/ }).click();
    await expect(page).toHaveURL(/\/engineering-presentation$/);
    await expect(page.getByRole('heading', { level: 1, name: /The engineering harness/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('with reduced motion the hand-off navigates at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/product-presentation');
    // keys pressed before the deck mounts go nowhere: wait for it, then for End to land
    await expect(counter(page)).toHaveText(/^1 \//);
    await page.keyboard.press('End');
    await expect(counter(page)).not.toHaveText(/^1 \//);
    // with timers paused the delayed hand-off can never fire: only "at once" gets there
    await pauseTimers(page);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\/engineering-presentation$/);
  });

  test('every beat renders without errors', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await page.goto('/product-presentation');
    const { total } = await readCounter(page);
    const caption = page.getByTestId('presentation-caption');

    // the title frame and the hand-off frame are bare; every beat between them is captioned
    await expect(caption).toHaveCount(0);
    for (let at = 2; at < total; at++) {
      await page.keyboard.press('ArrowRight');
      await expect(counter(page)).toHaveText(new RegExp(`^${at} /`));
      await expect(caption.getByRole('heading', { level: 2 }), `beat ${at} has no caption`).toHaveText(/\S/);
    }
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(new RegExp(`^${total} /`));
    await expect(caption).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('clicking the stage on the last beat hands over', async ({ page }) => {
    await page.goto('/product-presentation');
    await expect(counter(page)).toHaveText(/^1 \//);
    await page.keyboard.press('End');
    await expect(counter(page)).not.toHaveText(/^1 \//);
    const { at, total } = await readCounter(page);
    expect(at).toBe(total);

    // the stage's bottom-left corner: empty, clear of every button (the stage is letterboxed on a phone)
    const stage = await page.locator('[data-testid="presentation"] > div.cursor-pointer').boundingBox();
    await page.mouse.click(stage.x + 8, stage.y + stage.height - 8);
    await expect(page).toHaveURL(/\/engineering-presentation$/);
  });

  test('with reduced motion the flags still show', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/product-presentation?beat=8');
    await expect(page.getByText('Possible conflict')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(/^9 \//);
    await expect(page.getByText('Possible gap')).toBeVisible();
  });

  test('going back during the hand-off cancels it', async ({ page }) => {
    await page.clock.install();
    await page.goto('/product-presentation');
    await expect(counter(page)).toHaveText(/^1 \//);
    await page.keyboard.press('End');
    await expect(counter(page)).not.toHaveText(/^1 \//);
    const { total } = await readCounter(page);

    // the hand-off waits 900 ms for the stars to warp; with time paused, back is
    // always inside that window, however slow the runner
    await pauseTimers(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect(counter(page)).toHaveText(new RegExp(`^${total - 1} /`));
    await page.clock.runFor(2000);
    await expect(page).toHaveURL(/\/product-presentation/);
  });
});

test.describe('Reaching the talks from the app', () => {
  test('the attendee menu links to both talks from any page', async ({ page }) => {
    for (const [title, path] of [['The product harness', '/product-presentation'], ['The engineering harness', '/engineering-presentation']]) {
      await page.goto('/speakers');
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByTestId('talk-links').getByRole('link', { name: new RegExp(title) }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(title, 'i') })).toBeVisible();
    }
  });
});
