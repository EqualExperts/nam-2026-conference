import { test, expect } from '@playwright/test';
import { API, visit, failOnPageErrors, waitForResults, ATTENDEES } from './helpers.js';

/**
 * Smoke suite: every route renders, with no console errors and no horizontal
 * overflow. Runs on desktop and mobile. If a change breaks the app shell,
 * this is what catches it.
 */

const ROUTES = [
  { path: '/', name: 'Home', heading: /ORBIT/ },
  { path: '/schedule', name: 'Schedule', heading: /The schedule/i },
  { path: '/speakers', name: 'Speakers', heading: /^Speakers$/i },
  { path: '/my-agenda', name: 'My Agenda', heading: /agenda$/i },
  { path: '/venues', name: 'Venues', heading: /Venues & stages/i },
  { path: '/food', name: 'Food', heading: /Food & drink/i },
  { path: '/expo', name: 'Expo', heading: /Partners & sponsors/i },
  { path: '/code-of-conduct', name: 'Code of conduct', heading: /Code of conduct/i },
  { path: '/accessibility', name: 'Accessibility', heading: /^Accessibility$/i },
];

for (const route of ROUTES) {
  test(`${route.name} renders cleanly`, async ({ page }) => {
    const errors = failOnPageErrors(page);
    await visit(page, route.path);

    await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    // No horizontal scroll at any viewport — the app must stay responsive.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route.name} scrolls horizontally`).toBeLessThanOrEqual(1);

    expect(errors, `${route.name} logged console errors`).toEqual([]);
  });
}

test('unknown routes show the not-found page', async ({ page }) => {
  await visit(page, '/definitely-not-a-page');
  await expect(page.getByRole('heading', { name: /Nothing scheduled here/i })).toBeVisible();
});

test('the API is reachable and seeded', async ({ request }) => {
  const res = await request.get(`${API}/health`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // asserts the database is seeded, not a particular programme size
  expect(body.sessions).toBeGreaterThan(100);
});

test('every link in the footer resolves', async ({ page }) => {
  await visit(page, '/');
  const hrefs = await page.getByRole('contentinfo').getByRole('link')
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))]);

  for (const href of hrefs.filter((h) => h?.startsWith('/') && !h.startsWith('/api'))) {
    await visit(page, href);
    await expect(page.getByRole('heading', { name: /Nothing scheduled here/i })).toHaveCount(0);
  }
});

test('the venues page switches venue and shows a live room board', async ({ page }) => {
  await visit(page, '/venues');
  const venues = page.locator('[data-testid^="venue-tab-"]');
  await expect(venues).toHaveCount(2);

  const first = page.locator('[data-testid^="venue-board-"]');
  await expect(first).toBeVisible();
  const beforeId = await first.getAttribute('data-testid');

  await venues.nth(1).click();
  await expect(page.locator('[data-testid^="venue-board-"]')).not.toHaveAttribute('data-testid', beforeId);
});

test.describe('Nothing claims to be true when it is not', () => {
  test('no session in the future carries a rating', async ({ request }) => {
    const bootstrap = await (await request.get(`${API}/bootstrap`)).json();
    const today = bootstrap.days[0].date;
    const sessions = await (await request.get(`${API}/sessions`)).json();

    const liars = sessions.filter((s) => s.ratingCount > 0 && s.day > today);
    expect(liars.map((s) => `${s.day} ${s.title}`)).toEqual([]);
  });

  test('only speakers with a keynote are badged as keynote speakers', async ({ request }) => {
    const speakers = await (await request.get(`${API}/speakers`)).json();
    const sessions = await (await request.get(`${API}/sessions`)).json();
    const keynoteSpeakerIds = new Set(
      sessions.filter((s) => s.isKeynote).flatMap((s) => s.speakers.map((sp) => sp.id)));

    for (const s of speakers.filter((x) => x.keynoteCount > 0)) {
      expect(keynoteSpeakerIds.has(s.id), `${s.name} claims a keynote`).toBeTruthy();
    }
  });

  test('the app never links to a domain we invented', async ({ request }) => {
    const sessions = await (await request.get(`${API}/sessions`)).json();
    const invented = sessions.filter((s) => s.recordingUrl || s.slidesUrl || s.repoUrl);
    expect(invented.map((s) => s.title)).toEqual([]);
  });

  test('a speaker profile shows handles as text, not as links to domains that do not exist', async ({ page, request }) => {
    const speakers = await (await request.get(`${API}/speakers`)).json();
    const speaker = speakers.find((s) => s.socials?.website) ?? speakers.find((s) => s.socials?.twitter);
    expect(speaker, 'no speaker has socials to render').toBeTruthy();

    await visit(page, `/speakers/${speaker.id}`);
    const detail = page.getByTestId('speaker-detail');
    await expect(detail).toBeVisible();
    // the handle is on the page…
    await expect(detail).toContainText(
      (speaker.socials.website ?? speaker.socials.twitter).replace(/^https?:\/\//, ''));
    // …and nothing on it leaves the app
    await expect(detail.locator('a[href^="http"]')).toHaveCount(0);
  });

  test('the footer dates match the seeded conference', async ({ page }) => {
    const bootstrap = await (await page.request.get(`${API}/bootstrap`)).json();
    await visit(page, '/');
    await expect(page.getByRole('contentinfo')).toContainText(bootstrap.conference.dates);
  });
});

test('the page wears the Equal Experts brand: Lexend, the white logo beside ORBIT, the blue tab icon', async ({ page, request }) => {
  await visit(page, '/');

  // Lexend is the only text font, on body, headings and small labels, desktop and mobile.
  const families = await page.evaluate(() => {
    const fam = (el) => getComputedStyle(el).fontFamily;
    return {
      body: fam(document.body),
      heading: fam(document.querySelector('h1')),
      label: fam(document.querySelector('footer p')),
    };
  });
  for (const [where, family] of Object.entries(families)) {
    expect(family, `${where} font`).toMatch(/^"?Lexend/);
  }

  // The white logo sits beside the event name in the header and the footer, at least 100px wide.
  for (const region of ['banner', 'contentinfo']) {
    const area = page.getByRole(region);
    const logo = area.locator('img[src*="Monochrome_White"]').first();
    await expect(logo, `${region} logo`).toBeVisible();
    expect((await logo.boundingBox()).width, `${region} logo width`).toBeGreaterThanOrEqual(100);
    await expect(area.getByText(/ORBIT/).first()).toBeVisible();
  }

  const icon = await page.locator('link[rel=icon]').getAttribute('href');
  expect(icon).toContain('Blue_Circle.svg');
  expect((await request.get(new URL(icon, page.url()).href)).ok()).toBeTruthy();
});

test('tracks and cuisines are named, never told apart by colour alone', async ({ page, request }) => {
  // several tracks and cuisines share one brand colour, so the label has to carry the difference
  const sessions = await (await request.get(`${API}/sessions`)).json();
  const trackNames = [...new Set(sessions.map((x) => x.track.name))];
  await visit(page, '/schedule?view=list');
  await waitForResults(page);
  const card = await page.getByTestId('session-card').first().textContent();
  expect(trackNames.some((n) => card.includes(n)), 'the card names its track').toBeTruthy();

  await visit(page, '/food');
  await expect(page.getByTestId('vendor-count')).toBeVisible();
  const cuisine = await page.locator('article p.text-xs.text-muted').first().textContent();
  expect(cuisine).toMatch(/\S+ · \S+/);
});
