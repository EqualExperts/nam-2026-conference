import { test, expect } from '@playwright/test';
import { failOnPageErrors, shotForPR } from './helpers.js';

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

  test('every beat renders without errors, leads with its heading and never mentions live listening', async ({ page }) => {
    test.slow(); // walks every beat once: a second walk made the suite CPU-bound and every spec near its 30s limit
    const errors = failOnPageErrors(page);
    await page.goto('/product-presentation');
    const { total } = await readCounter(page);
    const caption = page.getByTestId('presentation-caption');

    // the title frame and the hand-off frame are bare; every beat between them is captioned
    await expect(caption).toHaveCount(0);
    const heroes = [];
    for (let at = 2; at < total; at++) {
      await page.keyboard.press('ArrowRight');
      await expect(counter(page)).toHaveText(new RegExp(`^${at} /`));
      const heading = caption.getByRole('heading', { level: 2 });
      await expect(heading, `beat ${at} has no caption`).toHaveText(/\S/);
      await expect(page.getByText(/listen-to-meeting|live listening/i)).toHaveCount(0);
      // a title slide sets its heading large, mid-stage; every other caption sits at the bottom
      const size = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      if (size > 80) heroes.push(await heading.innerText());
    }
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(new RegExp(`^${total} /`));
    await expect(caption).toHaveCount(0);
    // the caption sets each word in its own box, so compare without the spaces
    expect(heroes.map((h) => h.replace(/\s/g, ''))).toEqual(['Theprojectcontext', 'Asampleimplementation']);
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

/**
 * /opening-presentation — the talk that opens the day, handing over to the
 * product one. It touches no attendee state either.
 */
test.describe('The opening presentation', () => {
  test('opens full screen on its title and hands over to the product talk', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await page.goto('/opening-presentation');

    await expect(page.getByRole('heading', { level: 1, name: /Welcome to NAM 2026/i })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(counter(page)).toHaveText(/^1 \/ \d+$/);
    await expect(page).toHaveTitle(/Welcome to NAM 2026/);

    await page.keyboard.press('End');
    const { at, total } = await readCounter(page);
    expect(at).toBe(total);
    await expect(page.getByTestId('presentation-next')).toBeEnabled();

    await page.getByRole('button', { name: /^Continue to the product harness/ }).click();
    await expect(page).toHaveURL(/\/product-presentation$/);
    await expect(page.getByRole('heading', { level: 1, name: /The product harness/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every beat renders without errors', async ({ page }) => {
    const errors = failOnPageErrors(page);
    await page.goto('/opening-presentation');
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
});

test.describe('Reaching the talks from the app', () => {
  test('the attendee menu links to all three talks from any page', async ({ page }) => {
    for (const [title, path] of [['Welcome to NAM 2026', '/opening-presentation'], ['The product harness', '/product-presentation'], ['The engineering harness', '/engineering-presentation']]) {
      await page.goto('/speakers');
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByTestId('talk-links').getByRole('link', { name: new RegExp(title) }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(title, 'i') })).toBeVisible();
    }
  });
});

/**
 * The NAM 2026 look, on every beat of every deck. One walk per deck checks the
 * frame, the ground, the font and the contrast as it goes.
 */
const DECKS = [
  ['/opening-presentation', 'opening'],
  ['/product-presentation', 'product'],
  ['/engineering-presentation', 'engineering'],
];

/** Runs in the page: what is wrong with the current beat, as a list of strings. */
function auditBeat() {
  const problems = [];
  const lum = ([r, g, b]) => {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  // rgb()/rgba(), or the color(srgb r g b / a) Tailwind's opacity modifiers compute to
  const parse = (css) => {
    const n = (css.match(/[\d.]+/g) || []).map(Number);
    return css.startsWith('color(') ? [n[0] * 255, n[1] * 255, n[2] * 255, ...n.slice(3)] : n;
  };
  const root = document.querySelector('[data-testid="presentation"]');
  const ground = parse(getComputedStyle(root).backgroundColor);
  if (ground.slice(0, 3).join() !== '33,33,33') problems.push(`ground is ${getComputedStyle(root).backgroundColor}`);
  if (document.querySelector('canvas')) problems.push('a starfield canvas is drawn');
  for (const id of ['deck-frame', 'deck-tab']) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el || el.getBoundingClientRect().width === 0) problems.push(`${id} missing`);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (seen.has(el) || el.closest('[aria-hidden="true"], .sr-only, svg')) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    // a mock of GitHub or Claude on a light panel keeps its own look: only deck-styled text is held to ours
    if (el.closest('[data-mock]')) continue;
    if (!/^"?Lexend/.test(cs.fontFamily)) problems.push(`font ${cs.fontFamily.slice(0, 30)} on "${n.nodeValue.trim().slice(0, 24)}"`);
    // the text colour (its alpha laid over the fill behind it) against that fill. The fill is the
    // nearest ancestors' backgrounds composited down to the ground; a gradient or image behind the
    // text cannot be measured, so that text is skipped.
    const fg = parse(cs.color);
    // Held to AA here: the caption, the tab and the chrome, whose fill is the ground or a flat colour.
    // Scene text sits on mock panels and gradients we cannot measure from the DOM; the token pairs
    // those scenes draw from are proved in tests/unit/presentation-style.test.js.
    const flat = el.closest('[data-testid="presentation-caption"], [data-testid="deck-tab"], [data-testid="presentation-chapter"]');
    if (flat && fg.length >= 3 && cs.backgroundClip !== 'text') {
      let under = ground.slice(0, 3);
      const stack = [];
      let measurable = true;
      for (let e = el; e && e !== root; e = e.parentElement) {
        const st = getComputedStyle(e);
        if (st.backgroundImage !== 'none') { measurable = false; break; }
        const bg = parse(st.backgroundColor);
        if (bg.length >= 3 && (bg.length === 3 || bg[3] > 0)) stack.push(bg);
      }
      if (measurable) {
        for (const bg of stack.reverse()) {
          const al = bg.length > 3 ? bg[3] : 1;
          under = [0, 1, 2].map((i) => bg[i] * al + under[i] * (1 - al));
        }
        const a = fg.length > 3 ? fg[3] : 1;
        const mixed = [0, 1, 2].map((i) => fg[i] * a + under[i] * (1 - a));
        const hi = Math.max(lum(mixed), lum(under)); const lo = Math.min(lum(mixed), lum(under));
        const ratio = (hi + 0.05) / (lo + 0.05);
        const px = parseFloat(cs.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) problems.push(`contrast ${ratio.toFixed(1)} on "${n.nodeValue.trim().slice(0, 24)}"`);
      }
    }
  }
  return problems;
}

for (const [path, name] of DECKS) {
  test(`the ${name} deck wears the NAM 2026 look on every beat`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await expect(counter(page)).toHaveText(/^1 \//);
    const { total } = await readCounter(page);
    const bad = [];
    for (let beat = 1; beat <= total; beat += 1) {
      await expect(counter(page)).toHaveText(new RegExp(`^${beat} /`));
      await expect(page.getByTestId('deck-tab')).toContainText(`${beat} / ${total}`);
      const problems = await page.evaluate(auditBeat);
      if (problems.length) bad.push(`beat ${beat}: ${[...new Set(problems)].slice(0, 3).join('; ')}`);

      if (name === 'opening' && beat === 1) {
        // the title slide: the bridge on the right, the white logo bottom-left, neither stretched
        for (const [id, side] of [['deck-bridge', 'right'], ['deck-logo', 'left']]) {
          const img = page.getByTestId(id);
          await expect(img).toBeVisible();
          const m = await img.evaluate((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, nw: el.naturalWidth, nh: el.naturalHeight, x: el.getBoundingClientRect().x }));
          expect(Math.abs(m.w / m.h - m.nw / m.nh), `${id} is distorted`).toBeLessThan(0.02);
          // the stage scales to the screen, so the logo's own width is what the rule is about
          if (id === 'deck-logo') expect(await img.evaluate((el) => el.offsetWidth)).toBeGreaterThanOrEqual(100);
          const mid = (await page.viewportSize()).width / 2;
          expect(side === 'right' ? m.x > mid : m.x < mid, `${id} is on the ${side}`).toBe(true);
        }
        await shotForPR(page, 'opening title slide');
      }
      if (beat === 4 && name === 'product') await shotForPR(page, 'a content slide');
      if (beat === total) {
        await expect(page.getByTestId('deck-bridge')).toBeVisible();
        // a row of three numbered cards beside it
        await expect(page.getByTestId('deck-closing-cards').locator(':scope > div')).toHaveCount(3);
        await shotForPR(page, `${name} closing slide`);
      } else {
        await page.keyboard.press('ArrowRight');
      }
    }
    expect(bad).toEqual([]);
  });
}

test('the rest of the app keeps its own look', async ({ page }) => {
  for (const path of ['/', '/sessions/1']) {
    await page.goto(path);
    await expect(page.getByTestId('deck-frame')).toHaveCount(0);
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toMatch(/^"?Inter/);
  }
});
