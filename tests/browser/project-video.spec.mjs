import { expect, test } from '@playwright/test';

const projects = [
  'ai-news-digest-system', 'cfp-radar-system', 'hwp-editor-public', 'licheerv-nano-fido2',
  'mudplot', 'mwc25-drl-beamforming', 'mwc26-ai-ran-beamforming', 'niri-desktop-suite', 'rusty-note',
];

function trackDemoRequests(page, slug) {
  const files = new Set();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith(`/assets/media/${slug}`)) files.add(path);
  });
  return files;
}

async function expectVariant(page, slug, theme, startupRequests) {
  const video = page.locator('video');
  const base = `/assets/media/${slug}${theme === 'dark' ? '-dark' : ''}`;
  const src = `${base}.mp4`;
  const poster = `${base}-poster.png`;
  await expect(video).toHaveJSProperty('poster', new URL(poster, page.url()).href);
  await expect.poll(() => video.evaluate((v) => v.duration)).toBeGreaterThan(0);
  // A never-played video can report HAVE_ENOUGH_DATA while showing only its poster.
  await video.evaluate((v) => { if (v.paused && v.currentTime === 0) v.currentTime = 0.25; });
  await expect.poll(() => video.evaluate((v) => {
    if (v.seeking || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    // Sample the neutral header in the decoded frame, not the poster or URL.
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.drawImage(v, 5, 15, 1, 1, 0, 0, 1, 1);
    const [red, green, blue, alpha] = ctx.getImageData(0, 0, 1, 1).data;
    if (!alpha) return null;
    return Math.max(red, green, blue) < 64 ? 'dark' : 'light';
  })).toBe(theme);
  if (startupRequests) {
    await expect.poll(() => [...startupRequests].sort()).toEqual([poster, src].sort());
  }
  return video;
}

for (const slug of projects) {
  test(`${slug} initially loads only system-dark media, then switches both assets to light`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const requests = trackDemoRequests(page, slug);
    await page.goto(`/posts/${slug}/`);
    const video = await expectVariant(page, slug, 'dark', requests);
    for (const property of ['controls', 'loop', 'muted', 'playsInline', 'paused']) {
      await expect(video).toHaveJSProperty(property, true);
    }
    await page.locator('[data-theme-toggle]').click();
    await expectVariant(page, slug, 'light');
  });
}

test('stored theme wins on startup; storage and OS changes reload only a different variant', async ({ page, context }) => {
  const settings = await context.newPage();
  await settings.goto('/');
  await settings.evaluate(() => localStorage.setItem('mud-blog-theme', 'light'));
  await page.emulateMedia({ colorScheme: 'dark' });
  const requests = trackDemoRequests(page, 'mudplot');
  await page.goto('/posts/mudplot/');
  const video = await expectVariant(page, 'mudplot', 'light', requests);

  // Removing the override while the OS is light changes the setting, not the media resource.
  await video.evaluate((v) => {
    window.mediaEmptied = 0;
    v.addEventListener('emptied', () => window.mediaEmptied++);
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await settings.evaluate(() => localStorage.removeItem('mud-blog-theme'));
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', 'system-light');
  expect(await page.evaluate(() => window.mediaEmptied)).toBe(0);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectVariant(page, 'mudplot', 'dark');
  await settings.evaluate(() => localStorage.setItem('mud-blog-theme', 'light'));
  await expectVariant(page, 'mudplot', 'light');
});

test('native playback retains a paused seek and resumes at speed after rapid toggles', async ({ page }) => {
  // Serve the real file as a complete 200 even if a native media URL requests bytes.
  await page.route('**/assets/media/*.mp4', async (route) => {
    const headers = { ...route.request().headers() };
    if (!headers.range) return route.continue();
    delete headers.range;
    const full = await route.fetch({ headers });
    await route.fulfill({ response: full, headers: { ...full.headers(), 'accept-ranges': 'none' } });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/posts/mudplot/');
  const video = await expectVariant(page, 'mudplot', 'light');
  await video.evaluate((v) => new Promise((resolve) => {
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.playbackRate = 1.5;
    v.currentTime = 12;
  }));
  await expect(video).toHaveJSProperty('currentTime', 12);

  const toggle = page.locator('[data-theme-toggle]');
  await toggle.click();
  await expectVariant(page, 'mudplot', 'dark');
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('playbackRate', 1.5);
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeCloseTo(12, 2);

  await video.evaluate((v) => v.play());
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(12);
  const from = await video.evaluate((v) => v.currentTime);
  // The same task cannot receive new metadata between switches.
  await toggle.evaluate((button) => { button.click(); button.click(); button.click(); });
  await expectVariant(page, 'mudplot', 'light');
  await expect(video).toHaveJSProperty('paused', false);
  await expect(video).toHaveJSProperty('playbackRate', 1.5);
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(from);
  const resumed = await video.evaluate((v) => v.currentTime);
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(resumed + 0.25);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the project demo remains playable using native controls', async ({ page }) => {
    await page.goto('/posts/mudplot/');
    const video = page.locator('video');
    await expect(video).toHaveJSProperty('poster', new URL('/assets/media/mudplot-poster.png', page.url()).href);
    await expect(video).toHaveJSProperty('currentSrc', new URL('/assets/media/mudplot.mp4', page.url()).href);
    await expect(video).toBeVisible();
    await expect(video).toHaveJSProperty('controls', true);
    await video.evaluate((v) => v.play());
    await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(0);
  });
});
