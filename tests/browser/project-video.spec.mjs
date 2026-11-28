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

async function expectVariant(page, slug, theme, { compact = false, startupRequests } = {}) {
  const video = page.locator('video');
  const base = `/assets/media/${slug}${compact ? '-compact' : ''}${theme === 'dark' ? '-dark' : ''}`;
  const src = `${base}.mp4`;
  const poster = `${base}-poster.png`;
  await expect.poll(() => video.evaluate((v) => v.poster && new URL(v.poster).pathname)).toBe(poster);
  await expect.poll(() => video.evaluate((v) => v.videoWidth / v.videoHeight)).toBeCloseTo(compact ? 1 : 16 / 9, 3);
  // A never-played video can report HAVE_ENOUGH_DATA while showing only its poster.
  await video.evaluate((v) => { if (v.paused && v.currentTime === 0) v.currentTime = 0.25; });
  await expect.poll(() => video.evaluate((v) => {
    if (v.seeking || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    // Sample the edge of the decoded canvas, not the poster or URL.
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
    const video = await expectVariant(page, slug, 'dark', { startupRequests: requests });
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
  const video = await expectVariant(page, 'mudplot', 'light', { startupRequests: requests });

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
  await page.route(/\/assets\/media\/[^/]+\.mp4(?:\?|$)/, async (route) => {
    const headers = { ...route.request().headers() };
    if (!headers.range) return route.continue();
    delete headers.range;
    const full = await route.fetch({ headers });
    await route.fulfill({ response: full, headers: { ...full.headers(), 'accept-ranges': 'none' } });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/posts/mudplot/');
  const video = await expectVariant(page, 'mudplot', 'light');
  const seekTime = await video.evaluate((v) => Math.floor(v.duration / 2));
  await video.evaluate((v, t) => new Promise((resolve) => {
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.playbackRate = 1.5;
    v.currentTime = t;
  }), seekTime);
  await expect(video).toHaveJSProperty('currentTime', seekTime);

  const toggle = page.locator('[data-theme-toggle]');
  await toggle.click();
  await expectVariant(page, 'mudplot', 'dark');
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('playbackRate', 1.5);
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeCloseTo(seekTime, 2);

  await video.evaluate((v) => v.play());
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(seekTime);
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

test('the phone downloads only its square cut and keeps its paused frame on rotation', async ({ page }) => {
  const slug = 'cfp-radar-system';
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const requests = trackDemoRequests(page, slug);
  await page.goto(`/posts/${slug}/`);
  const video = await expectVariant(page, slug, 'dark', { compact: true, startupRequests: requests });
  const box = await video.boundingBox();
  expect(box.width).toBeCloseTo(box.height, 0);
  expect(box.width).toBeGreaterThan(280);

  await video.evaluate((v) => { v.playbackRate = 1.5; v.currentTime = 3.25; });
  await expect.poll(() => video.evaluate((v) => v.seeking)).toBe(false);
  await page.locator('[data-theme-toggle]').click();
  await expectVariant(page, slug, 'light', { compact: true });
  await page.setViewportSize({ width: 780, height: 360 });
  await expectVariant(page, slug, 'light');
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeCloseTo(3.25, 2);
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('playbackRate', 1.5);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const { name, width, theme, suffix } of [
    { name: 'wide light', width: 1080, theme: 'light', suffix: '' },
    { name: 'narrow dark', width: 320, theme: 'dark', suffix: '-compact-dark' },
  ]) {
    test(`native controls play the ${name} version`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/posts/mudplot/');
      const video = page.locator('video');
      await expect.poll(() => video.evaluate((v) => v.currentSrc && new URL(v.currentSrc).pathname)).toBe(`/assets/media/mudplot${suffix}.mp4`);
      await expect(video).toHaveJSProperty('controls', true);
      await video.focus();
      await video.press('Space');
      await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(0.1);
    });
  }
});
