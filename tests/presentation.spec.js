import { test, expect } from '@playwright/test';
import { failOnPageErrors, shotForPR } from './helpers.js';

/**
 * /engineering-presentation â the engineering harness talk. It books nothing and reads no
 * attendee state, so no data lane and no pinned clock are needed.
 */

const counter = (page) => page.getByTestId('presentation-counter');

/** "6 / 43" â { at: 6, total: 43 } */
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
 * /product-presentation â the product harness talk, which ends by handing over
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

  test('every beat renders without errors, leads with its heading and never mentions live listening or the winnow setup', async ({ page }) => {
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
      await expect(page.getByText(/listen-to-meeting|setup-winnow|live listening/i)).toHaveCount(0);
      // a title slide sets its heading large, mid-stage; every other caption sits at the bottom
      const size = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      if (size > 80) heroes.push(await heading.innerText());
    }
    await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText(new RegExp(`^${total} /`));
    await expect(caption).toHaveCount(0);
    // the caption sets each word in its own box, so compare without the spaces
    expect(heroes.map((h) => h.replace(/\s/g, ''))).toEqual(['Asampleimplementation', 'Theprojectcontext']);
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
 * The product talk's workflow rail (#299): Information â Distil â Remember Â· Raise,
 * drawn by Deck over the scenes, one node lit per chapter.
 */
const NAMES = ['The product harness', 'Where tickets come from', 'One way in', 'The two-fold trick', 'Context and tasks', 'A sample implementation', 'The project context', 'One way to do it', 'create-tasks', 'update-context', 'winnow', 'Distil', 'The whole flow', 'Live demo', 'Over to the engineering harness'];
const ALL = 'distil remember raise';
// [chapter, lit, commands shown] for each of the 22 beats, in order
const RAIL = [
  ['The product harness', '', false],
  ['Where tickets come from', 'information', false], ['Where tickets come from', 'information', false],
  ['One way in', '', false],
  ['The two-fold trick', 'remember', false], ['The two-fold trick', 'remember', false],
  ['Context and tasks', 'raise', false], ['Context and tasks', 'remember raise', false],
  ['A sample implementation', ALL, true],
  ['The project context', 'remember', true], ['The project context', 'remember', true], ['The project context', 'remember', true],
  ['One way to do it', ALL, true], ['One way to do it', ALL, true],
  ['create-tasks', 'raise', true],
  ['update-context', 'remember', true],
  ['winnow', 'distil', true], ['winnow', 'distil', true],
  ['Distil', 'distil', true],
  ['The whole flow', '', false],
  ['Live demo', ALL, true],
  ['Over to the engineering harness', '', false],
];

test.describe('The product talk rail', () => {
  test('chapters run problem, flow, implementation, in the order of the plan', async ({ page }) => {
    await page.goto('/product-presentation');
    const chapterButtons = page.getByRole('navigation', { name: 'Chapters' }).getByRole('button');
    await expect(chapterButtons).toHaveCount(NAMES.length); // the deck renders after load; reading earlier gives []
    const labels = await chapterButtons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace(/^Chapter \d+: /, '')));
    expect(labels).toEqual(NAMES);
    expect((await readCounter(page)).total).toBe(RAIL.length);
  });

  test('one node is lit per chapter, commands from the sample implementation on, and no kicker is numbered', async ({ page }) => {
    test.slow();
    await page.goto('/product-presentation');
    const rail = page.getByTestId('presentation-rail');
    for (let i = 0; i < RAIL.length; i++) {
      if (i) await page.keyboard.press('ArrowRight');
      const [name, lit, commands] = RAIL[i];
      const where = `beat ${i + 1} (${name})`;
      await expect(counter(page), where).toHaveText(new RegExp(`^${i + 1} /`));
      await expect(page.getByTestId('presentation-chapter'), where).toHaveText(name);
      await expect(rail, where).toHaveAttribute('data-lit', lit);
      if (lit) {
        await expect(rail, where).toBeVisible();
        const text = await rail.textContent();
        for (const n of ['Information', 'Distil', 'Remember', 'Raise']) expect(text, where).toContain(n);
        for (const cmd of ['/winnow', 'update-context', 'create-tasks']) {
          if (commands) expect(text, where).toContain(cmd); else expect(text, where).not.toContain(cmd);
        }
      } else {
        await expect(rail, where).toBeHidden();
      }
      const kickers = await page.locator('[data-testid="presentation-caption"] [data-eyebrow]').allInnerTexts();
      for (const k of kickers) expect(k.trim(), `${where} kicker`).not.toMatch(/^\d/);
    }
  });

  test('the rail sits clear of the scene under it', async ({ page }, testInfo) => {
    // 1600Ã900 on desktop, the phone viewport on mobile
    if (testInfo.project.name !== 'mobile') await page.setViewportSize({ width: 1600, height: 900 });
    for (const beat of [2, 7, 9, 11, 13, 15, 21]) {
      await page.goto(`/product-presentation?beat=${beat}`);
      const rail = page.getByTestId('presentation-rail');
      await expect(rail).toBeVisible();
      await expect.poll(async () => {
        const railBottom = (await rail.boundingBox()).y + (await rail.boundingBox()).height;
        const tops = await page.evaluate(() => [...document.querySelectorAll('[data-state="current"] > div > *')]
          .filter((el) => el.getAttribute('aria-hidden') !== 'true')
          .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => r.top));
        return tops.length ? Math.min(...tops) - railBottom : 1;
      }, { message: `beat ${beat}: the rail covers the scene`, timeout: 8000 }).toBeGreaterThanOrEqual(0);
      // and below the top bar (ORBIT ’26 / chapter name), which sits outside the stage
      const bar = await page.getByTestId('presentation-chapter').boundingBox();
      const railBox = await rail.boundingBox();
      expect(railBox.y, `beat ${beat}: the rail sits on the top bar`).toBeGreaterThanOrEqual(bar.y + bar.height);
    }
    await page.goto('/product-presentation?beat=9');
    await expect(page.getByTestId('presentation-rail')).toHaveAttribute('data-lit', ALL);
    await page.waitForTimeout(process.env.PR_SHOTS ? 2500 : 0);
    await shotForPR(page, 'product talk rail on A sample implementation');
  });
});

/**
 * /opening-presentation â the talk that opens the day, handing over to the
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
 * The NAM 2026 look (#293): every beat of every deck wears the frame and the tab,
 * has an eyebrow and a title, uses no violet, and sets text in Lexend. Text
 * colour is measured per beat over the card fill (colour only: ancestor
 * opacity is the entrance animation, which is settled by then).
 */
const DECKS = [
  { path: '/opening-presentation', name: 'opening' },
  { path: '/product-presentation', name: 'product' },
  { path: '/engineering-presentation', name: 'engineering' },
];


/** Every text on the stage under AA against what it sits on (the card fill when nothing else is behind it). */
async function worstContrast(page) {
  return page.evaluate(() => {
    // any CSS colour (Tailwind's palette computes to oklch, its /90 to color(srgb â¦)) as [r, g, b, a], via a canvas pixel
    const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const parse = (c) => {
      px.clearRect(0, 0, 1, 1);
      px.fillStyle = '#000';
      px.fillStyle = c;
      px.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const card = [7, 19, 34];
    const fails = [];
    const walker = document.createTreeWalker(document.querySelector('[data-testid="presentation"] > div.cursor-pointer'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      if (!t) continue;
      const el = n.parentElement;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      // the nearest filled ancestor is what the text sits on; the card fill when there is none
      let bg = card;
      for (let p = el; p && p.tagName !== 'BODY'; p = p.parentElement) {
        const [pr, pg, pb, pa = 1] = parse(getComputedStyle(p).backgroundColor);
        if (pa > 0.5) { bg = [pr, pg, pb]; break; }
      }
      const [r, g, b, a = 1] = parse(cs.color);
      if (cs.backgroundClip === 'text' || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue; // gradient text
      const mix = [r, g, b].map((c, i) => c * a + bg[i] * (1 - a));
      const l1 = L(...mix), l2 = L(...bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(cs.fontSize);
      const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) fails.push(`${t.slice(0, 30)} (${ratio.toFixed(2)}:1, ${px}px, ${el.tagName}.${String(el.getAttribute('class')).slice(0, 50)})`);
    }
    return fails;
  });
}

for (const deck of DECKS) {
  test.describe(`The ${deck.name} deck's NAM 2026 look`, () => {
    test('every beat has the tab, an eyebrow and a title, in Lexend, with no violet and AA text', async ({ page }) => {
      test.slow();
      const errors = failOnPageErrors(page);
      await page.goto(deck.path);
      const { total } = await readCounter(page);
      const problems = [];
      for (let at = 1; at <= total; at++) {
        if (at > 1) await page.keyboard.press('ArrowRight');
        await expect(counter(page)).toHaveText(new RegExp(`^${at} /`));
        const where = `${deck.name} beat ${at}`;
        await expect(page.getByTestId('deck-tab'), where).toBeVisible();
        if (!await page.locator('[data-eyebrow]').count()) problems.push(`${where}: no eyebrow`);
        if (!await page.locator('h1, h2, [data-deck-title]').count()) problems.push(`${where}: no title`);
        const bad = await page.evaluate(() => {
          const stage = document.querySelector('[data-testid="presentation"]');
          const violet = [...stage.querySelectorAll('*')].filter((el) => /(violet|fuchsia|purple)/.test(el.getAttribute('class') || '') || /#(8b5cf6|a78bfa|c4b5fd|6d28d9)|139, ?92, ?246/i.test(el.getAttribute('style') || '')).length;
          const fonts = [...stage.querySelectorAll('*')].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !/^"?Lexend/.test(getComputedStyle(el).fontFamily)).map((el) => `${el.tagName}.${String(el.getAttribute('class')).slice(0, 40)} ${getComputedStyle(el).fontFamily}`);
          return { violet, fonts };
        });
        if (bad.violet) problems.push(`${where}: still uses violet`);
        for (const f of bad.fonts) problems.push(`${where}: text outside Lexend ${f}`);
        for (const f of await worstContrast(page)) problems.push(`${where}: under AA ${f}`);
      }
      expect([...new Set(problems)]).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('the closing slide has no bridge, no frame bar and no slide number in the tab', async ({ page }) => {
      await page.goto(deck.path);
      await expect(counter(page)).toHaveText(/^1 \//);
      await page.keyboard.press('End');
      await expect(page.getByTestId('deck-bridge')).toHaveCount(0);
      await expect(page.getByTestId('deck-frame')).toHaveCount(0);
      await expect(page.getByTestId('deck-tab')).toHaveText('');
      if (process.env.PR_SHOTS) await page.waitForTimeout(2500); // let the entrance finish
      await shotForPR(page, `${deck.name} closing slide`);
    });

    test('a content slide sits in a card on the table colours', async ({ page }) => {
      await page.goto(`${deck.path}?beat=3`);
      await expect(page.getByTestId('deck-tab')).toBeVisible();
      const css = await page.evaluate(() => {
        const bg = (id) => getComputedStyle(document.querySelector(`[data-testid="${id}"]`)).backgroundColor;
        return { tab: bg('deck-tab'), ground: getComputedStyle(document.querySelector('[data-testid="presentation"]')).backgroundColor };
      });
      expect(css.tab).toBe('rgb(23, 149, 212)');
      expect(css.ground).toBe('rgb(33, 33, 33)');
      if (process.env.PR_SHOTS) await page.waitForTimeout(2500);
      await shotForPR(page, `${deck.name} content slide`);
    });
  });
}

test.describe('The opening title slide', () => {
  test('shows the white Equal Experts logo, big enough, and no bridge', async ({ page }) => {
    await page.goto('/opening-presentation');
    const logo = page.getByTestId('deck-logo');
    await expect(page.getByTestId('deck-bridge')).toHaveCount(0);
    await expect(logo).toBeVisible();
    // the stage is scaled to the window: the 100px rule is the logo's size on the 1600px stage
    const stage = await page.locator('[data-testid="presentation"] > div.cursor-pointer').boundingBox();
    expect((await logo.boundingBox()).width / (stage.width / 1600)).toBeGreaterThanOrEqual(100);
    const l = await logo.boundingBox();
    // the logo sits clear of the day list above it
    const day = await page.getByTestId('opening-day').boundingBox();
    expect(l.y).toBeGreaterThanOrEqual(day.y + day.height);
    await expect.poll(() => logo.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    if (process.env.PR_SHOTS) await page.waitForTimeout(2500);
    await shotForPR(page, 'opening title slide');
  });
});

test.describe('Outside the decks', () => {
  test('the app keeps its own font and ground', async ({ page }) => {
    await page.goto('/');
    const look = await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontFamily,
      ground: getComputedStyle(document.documentElement).getPropertyValue('--color-ground').trim(),
    }));
    expect(look.font).toMatch(/Inter/);
    expect(look.ground).toBe('#14161e');
  });
});
