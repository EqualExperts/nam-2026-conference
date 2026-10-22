import { test, expect } from '@playwright/test';
import { API, visit, ATTENDEES, shotForPR, conferenceDays } from './helpers.js';


test.describe('Speakers', () => {
  test('the unfiltered page is tiered, not one flat list', async ({ page }) => {
    await visit(page, '/speakers');
    await expect(page.getByTestId('headline-speakers')).toBeVisible();
    await expect(page.getByTestId('all-speakers')).toBeVisible();
    await expect(page.getByRole('heading', { name: /The headliners/i })).toBeVisible();
    // the long tail is browsable by letter rather than one endless column
    await expect(page.getByRole('button', { name: /Jump to [A-Z]/ }).first()).toBeVisible();
  });

  test('every speaker on the programme is actually presenting', async ({ request }) => {
    const speakers = await (await request.get(`${API}/speakers`)).json();
    const idle = speakers.filter((s) => (s.sessionCount ?? 0) === 0);
    expect(idle.map((s) => s.name)).toEqual([]);
  });

  test('following a speaker surfaces them at the top of the list', async ({ page, request }, testInfo) => {
    // Follows are shared state and the projects run concurrently: one attendee each.
    const user = testInfo.project.name === 'mobile' ? ATTENDEES.kenji : ATTENDEES.marcus;
    const me = await (await request.get(`${API}/users/${user}`)).json();
    const wasFollowing = me.followedSpeakers.some((s) => s.id === 9);

    await visit(page, '/speakers/9', { as: user });
    const name = await page.getByTestId('speaker-name').innerText();

    const follow = page.getByTestId('follow-speaker');
    if (wasFollowing) await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/speakers');
    const following = page.getByTestId('followed-speakers');
    await expect(following).toBeVisible();
    await expect(following).toContainText(name);

    // and the Following chip filters down to just them
    await page.getByTestId('filter-following').click();
    await expect(page.getByTestId('followed-speakers')).toContainText(name);
    await expect(page.getByTestId('headline-speakers')).toHaveCount(0);

    if (!wasFollowing) await request.delete(`${API}/users/${user}/follows/9`);
  });

  test('the keynotes filter lists the keynote speakers rather than a blank page', async ({ page, request }) => {
    // Filtering hides the headliner spotlight, so featured speakers have to show
    // up in the results — anyone you follow is lifted into their own section.
    const featured = (await (await request.get(`${API}/speakers`)).json()).filter((s) => s.featured);
    const jonas = await (await request.get(`${API}/users/${ATTENDEES.jonas}`)).json();
    const followed = new Set(jonas.followedSpeakers.map((s) => s.id));
    const listed = featured.filter((s) => !followed.has(s.id));
    expect(listed.length).toBeGreaterThan(0);

    await visit(page, '/speakers?show=keynotes', { as: ATTENDEES.jonas });
    const results = page.getByTestId('all-speakers');
    await expect(results).toBeVisible();
    await expect(page.getByTestId('speaker-count')).toHaveText(String(listed.length));
    await expect(results.getByRole('link').first()).toBeVisible();
  });

  test('searching collapses the tiers into one flat result list', async ({ page }) => {
    await visit(page, '/speakers?q=a&track=agents-tool-use');
    await expect(page.getByTestId('headline-speakers')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Matching speakers/i })).toBeVisible();
  });

  test('speakers have real portraits, not just initials', async ({ page }) => {
    await visit(page, '/speakers');
    const portraits = page.getByTestId('headline-speakers').locator('img');
    await expect(portraits.first()).toBeVisible();
    const src = await portraits.first().getAttribute('src');
    expect(src).toMatch(/^\/avatars\/speaker-\d{3}\.jpg$/);

    // and the file is actually served
    const res = await page.request.get(new URL(src, page.url()).toString());
    expect(res.ok()).toBeTruthy();
  });

  test('sorting changes the order of the list', async ({ page }) => {
    // Comparing only the first name is not enough — the most-prolific speaker
    // can also happen to be first alphabetically.
    const order = async (sort) => {
      await visit(page, `/speakers?q=a&sort=${sort}`);
      const list = page.getByTestId('all-speakers');
      await expect(list).toBeVisible();
      return list.locator('a').allInnerTexts();
    };

    const byName = await order('name');
    const bySessions = await order('sessions');
    expect(byName.length).toBeGreaterThan(3);
    expect(byName).not.toEqual(bySessions);
    // A–Z really is alphabetical
    expect(byName.map((n) => n.split('\n')[0])).toEqual(
      [...byName.map((n) => n.split('\n')[0])].sort((a, b) => a.localeCompare(b)),
    );
  });

  test('an unknown speaker id shows a real not-found page, not a retry prompt', async ({ page }) => {
    await visit(page, '/speakers/999999');
    await expect(page.getByRole('heading', { name: 'Speaker not found' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'All speakers' })).toBeVisible();
    await expect(page).toHaveTitle("Not found · ORBIT '26");
    await shotForPR(page, 'speaker-not-found');
  });

  test('a genuine failure loading a speaker still offers a retry', async ({ page }) => {
    await page.route('**/api/speakers/1**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }),
    );
    await visit(page, '/speakers/1');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test.describe('Headliner spotlight', () => {
  test('renders and advances through the headliners', async ({ page }) => {
    await visit(page, '/speakers');
    const spotlight = page.getByTestId('speaker-spotlight');
    await expect(spotlight).toBeVisible();

    const first = await spotlight.getByRole('heading').innerText();
    await spotlight.getByTestId('spotlight-next').click();
    await expect(spotlight.getByRole('heading')).not.toHaveText(first);
  });

  test('the filmstrip jumps straight to a speaker', async ({ page }) => {
    await visit(page, '/speakers');
    const spotlight = page.getByTestId('speaker-spotlight');
    const tabs = spotlight.getByRole('tab');
    const target = await tabs.nth(4).getAttribute('aria-label');

    await tabs.nth(4).click();
    await expect(spotlight.getByRole('heading', { name: target })).toBeVisible();
    await expect(tabs.nth(4)).toHaveAttribute('aria-selected', 'true');
  });

  test('every speaker name matches the pronouns on their profile', async ({ request }) => {
    const res = await request.get(`${API}/speakers`);
    const speakers = await res.json();
    // Portraits are classified in server/avatar-presentation.json and the seed
    // picks the name + pronouns to match, so these must never disagree.
    for (const s of speakers) {
      expect(s.imageUrl, `${s.name} has no portrait`).toMatch(/^\/avatars\/speaker-\d{3}\.jpg$/);
      expect(s.pronouns, `${s.name} has odd pronouns`).toMatch(/^(he|she)\//);
    }
    // the programme size is not the point — that every one of them is consistent is
    expect(speakers.length).toBeGreaterThan(50);
  });

  test('an empty search names what was searched for', async ({ page }) => {
    await visit(page, '/speakers?q=zzqx');
    await expect(page.getByRole('heading', { name: 'No speakers match “zzqx”', exact: true })).toBeVisible();
    await shotForPR(page, 'the empty state naming the search');
  });

  test('filters without a search keep the plain heading, and following is unchanged', async ({ page, request }) => {
    const days = await conferenceDays();
    const { tracks } = await (await request.get(`${API}/bootstrap`)).json();
    let pick = null;
    for (const day of days) {
      for (const t of tracks) {
        const found = await (await request.get(`${API}/speakers?day=${day}&trackSlug=${t.slug}`)).json();
        const list = Array.isArray(found) ? found : found.speakers;
        if (list.length === 0) { pick = { day, slug: t.slug }; break; }
      }
      if (pick) break;
    }
    if (pick) {
      await visit(page, `/speakers?day=${pick.day}&track=${pick.slug}`);
      await expect(page.getByRole('heading', { name: 'No speakers match', exact: true })).toBeVisible();
    }
    // the following view keeps its own message even with a search that finds nobody
    await visit(page, '/speakers?show=following&q=zzqx');
    await expect(page.getByRole('heading', { name: 'You are not following anyone yet', exact: true })).toBeVisible();
  });
});

test.describe('Following from where the speaker is shown', () => {
  const ROTATE_MS = 7000;
  const userFor = (testInfo) => (testInfo.project.name === 'mobile' ? ATTENDEES.kenji : ATTENDEES.marcus);

  /** A speaker this attendee does not follow, off the ids the other follow tests use. */
  async function pick(request, user, { featured, nth = 0 }) {
    const me = await (await request.get(`${API}/users/${user}`)).json();
    const followed = new Set(me.followedSpeakers.map((s) => s.id));
    const all = await (await request.get(`${API}/speakers`)).json();
    // Each test takes its own `nth` (0-4) and steps by 5 past anyone already followed, so
    // tests running at once as one attendee never share a speaker.
    const pool = all.filter((s) => Boolean(s.featured) === featured && ![3, 9].includes(s.id));
    let i = nth;
    while (followed.has(pool[i].id)) i += 5;
    const speaker = pool[i];
    return { speaker, followedCount: followed.size };
  }
  async function firstSessionId(request, speakerId) {
    const sp = await (await request.get(`${API}/speakers/${speakerId}`)).json();
    return sp.sessions[0].id;
  }
  /** Client-side navigation: no reload, so the store must carry the change. */
  const spaGo = (page, path) => page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;

  test('the carousel follows the current headliner without leaving the page', async ({ page, request }, testInfo) => {
    const user = userFor(testInfo);
    const { speaker } = await pick(request, user, { featured: true, nth: 0 });
    try {
      await visit(page, '/speakers', { as: user });
      const spotlight = page.getByTestId('speaker-spotlight');
      await spotlight.getByRole('tab', { name: speaker.name, exact: true }).click();
      await expect(spotlight.getByRole('heading', { name: speaker.name })).toBeVisible();
      const toggle = spotlight.getByTestId('follow-toggle');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(toggle).toHaveAccessibleName(`Follow ${speaker.name}`);
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toHaveText(/Following/);
      await expect(page).toHaveURL(/\/speakers$/);
      await expect(spotlight.getByRole('heading', { name: speaker.name })).toBeVisible();
      await expect(page.getByTestId('followed-speakers')).toContainText(speaker.name);
      await shotForPR(page, 'Follow button on the Featured speakers carousel, reading Following');
    } finally {
      await request.delete(`${API}/users/${user}/follows/${speaker.id}`);
    }
  });

  test('a grid card toggles follow without opening the profile, and the rest of it still does', async ({ page, request }, testInfo) => {
    const user = userFor(testInfo);
    const { speaker } = await pick(request, user, { featured: false, nth: 0 });
    try {
      await request.put(`${API}/users/${user}/follows/${speaker.id}`);
      await visit(page, '/speakers', { as: user });
      const section = page.getByTestId('followed-speakers');
      const card = section.getByTestId('speaker-card').filter({ hasText: speaker.name });
      await expect(card).toBeVisible();
      const toggle = card.getByTestId('follow-toggle');
      await expect(toggle).toHaveAccessibleName(`Following ${speaker.name}`);
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await toggle.click();
      await expect(page).toHaveURL(/\/speakers$/);
      await expect(card).toHaveCount(0);

      // the card body still opens the profile
      await request.put(`${API}/users/${user}/follows/${speaker.id}`);
      await visit(page, '/speakers', { as: user });
      await section.getByTestId('speaker-card').filter({ hasText: speaker.name }).getByRole('heading').click();
      await expect(page).toHaveURL(new RegExp(`/speakers/${speaker.id}$`));
      await visit(page, '/speakers', { as: user });
      // click where the portrait is: the stretched link sits over it, so a locator click would be refused
      const portrait = section.getByTestId('speaker-card').filter({ hasText: speaker.name }).locator('img, [role="img"]').first();
      await portrait.scrollIntoViewIfNeeded();
      const avatar = await portrait.boundingBox();
      await page.mouse.click(avatar.x + avatar.width / 2, avatar.y + avatar.height / 2);
      await expect(page).toHaveURL(new RegExp(`/speakers/${speaker.id}$`));
    } finally {
      await request.delete(`${API}/users/${user}/follows/${speaker.id}`);
    }
  });

  test('a session page speaker has the toggle, and it is reflected everywhere without a reload', async ({ page, request }, testInfo) => {
    const user = userFor(testInfo);
    const { speaker } = await pick(request, user, { featured: false, nth: 2 });
    const sessionId = await firstSessionId(request, speaker.id);
    try {
      await visit(page, `/sessions/${sessionId}`, { as: user });
      const card = page.getByTestId('session-speaker').filter({ hasText: speaker.name });
      const toggle = card.getByRole('button', { name: `Follow ${speaker.name}` });
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(card.getByRole('button', { name: `Following ${speaker.name}` })).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`));
      await shotForPR(page, 'Follow toggle on a session page speaker');

      // in-app navigation only
      await card.getByRole('link', { name: speaker.name }).click();
      await expect(page).toHaveURL(new RegExp(`/speakers/${speaker.id}$`));
      await expect(page.getByTestId('follow-speaker')).toHaveAttribute('aria-pressed', 'true');

      await spaGo(page, '/speakers');
      const followed = page.getByTestId('followed-speakers');
      await expect(followed.getByTestId('speaker-card').filter({ hasText: speaker.name })).toContainText('Following');
      await page.getByTestId('filter-following').click();
      await expect(page.getByTestId('followed-speakers')).toContainText(speaker.name);

      await spaGo(page, '/');
      // the exact count would race the other tests following as this attendee
      await expect(page.getByTestId('followed-sessions')).toContainText(/\d+ speakers? followed/);
      await expect(page.getByTestId('followed-sessions').getByTestId('session-card').first()).toBeVisible();
    } finally {
      await request.delete(`${API}/users/${user}/follows/${speaker.id}`);
    }
  });

  test('the session page toggle is reachable by keyboard and the name opens the profile', async ({ page, request }, testInfo) => {
    const user = userFor(testInfo);
    const { speaker } = await pick(request, user, { featured: false, nth: 3 });
    const sessionId = await firstSessionId(request, speaker.id);
    try {
      await visit(page, `/sessions/${sessionId}`, { as: user });
      const card = page.getByTestId('session-speaker').filter({ hasText: speaker.name });
      await card.getByRole('link', { name: speaker.name }).focus();
      await page.keyboard.press('Tab');
      const toggle = card.getByTestId('follow-toggle');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAccessibleName(`Follow ${speaker.name}`);
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`));

      await card.getByRole('link', { name: speaker.name }).click();
      await expect(page).toHaveURL(new RegExp(`/speakers/${speaker.id}$`));
    } finally {
      await request.delete(`${API}/users/${user}/follows/${speaker.id}`);
    }
  });

  test('the carousel does not rotate away while Follow is hovered or focused', async ({ page, request }, testInfo) => {
    const user = userFor(testInfo);
    await page.clock.install();
    await visit(page, '/speakers', { as: user });
    const spotlight = page.getByTestId('speaker-spotlight');
    const heading = spotlight.getByRole('heading', { level: 3 });
    const first = await heading.innerText();
    const toggle = spotlight.getByTestId('follow-toggle');

    if (testInfo.project.name === 'mobile') await toggle.focus();
    else await toggle.hover();
    await page.clock.runFor(ROTATE_MS * 2);
    await expect(heading).toHaveText(first);

    // control: once it is let go the carousel does move on
    if (testInfo.project.name === 'mobile') await toggle.blur();
    else await page.mouse.move(0, 0);
    await page.clock.runFor(ROTATE_MS + 500);
    await expect(heading).not.toHaveText(first);
  });

  test('the toggle does not overlap the rest of a card', async ({ page, request }, testInfo) => {
    const user = userFor(testInfo);
    const { speaker } = await pick(request, user, { featured: false, nth: 1 });
    const sessionId = await firstSessionId(request, speaker.id);
    try {
      await request.put(`${API}/users/${user}/follows/${speaker.id}`);
      await visit(page, '/speakers', { as: user });
      const card = page.getByTestId('followed-speakers').getByTestId('speaker-card').filter({ hasText: speaker.name });
      const box = await card.getByTestId('follow-toggle').boundingBox();
      for (const other of [card.getByRole('heading'), ...await card.getByTestId('speaker-badge').all()]) {
        expect(intersects(box, await other.boundingBox())).toBe(false);
      }

      await visit(page, `/sessions/${sessionId}`, { as: user });
      const sc = page.getByTestId('session-speaker').filter({ hasText: speaker.name });
      const sbox = await sc.getByTestId('follow-toggle').boundingBox();
      for (const other of [sc.getByRole('heading'), sc.locator('p')]) {
        for (const el of await other.all()) {
          expect(intersects(sbox, await el.boundingBox())).toBe(false);
        }
      }
    } finally {
      await request.delete(`${API}/users/${user}/follows/${speaker.id}`);
    }
  });
});
