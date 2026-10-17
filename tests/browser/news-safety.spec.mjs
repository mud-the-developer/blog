import { test, expect } from '@playwright/test';

const candidate = {
  title: 'Review source',
  url: 'https://example.test/review',
  source: 'Review wire',
  summary: 'A fixture.',
  type: 'paper',
  thumbnail: '/assets/news/thumb-paper.svg',
};

async function submit(page, query) {
  await page.locator('[name="query"]').fill(query);
  await page.locator('[data-news-search-form] button[type="submit"]').click();
}

test('unsafe draft links stay inert and PDF uses an isolated print frame, not an HTML download', async ({ page }) => {
  await page.addInitScript(() => {
    window.__printedHtml = '';
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        if (!this.hasAttribute('data-news-print-frame')) return descriptor.get.call(this);
        return {
          document: { fonts: { ready: Promise.resolve() } },
          focus() {},
          addEventListener() {},
          print: () => {
            window.__printedHtml = this.srcdoc;
          },
        };
      },
    });
  });
  await page.route('**/api/news-search', (route) =>
    route.fulfill({ json: { ok: true, candidates: [candidate], keywords: ['review'], searched: ['fixture'] } }),
  );
  await page.route('**/api/focused-issue', (route) =>
    route.fulfill({
      json: {
        ok: true,
        usedGemma: true,
        issue: {
          title: 'Review draft',
          summary: 'Safe rendering test',
          markdown:
            "## Evidence\n[Unsafe link](javascript:document.body.dataset.executed='yes';void 0)\n[Safe link](https://example.test/paper)",
        },
        sources: [{ ...candidate, url: "javascript:document.body.dataset.executed='yes';void 0", thumbnail: 'javascript:alert(1)' }],
      },
    }),
  );
  await page.goto('/news/search/');
  await submit(page, 'review');
  await expect(page.locator('[data-draft-selected-news]')).toBeEnabled();
  await page.locator('[data-draft-selected-news]').click();
  await expect(page.locator('.generated-news-body')).toContainText('Unsafe link');
  await expect(page.locator('.generated-news-body a')).toHaveCount(1);
  await page.locator('.generated-news-body').getByText('Unsafe link', { exact: true }).click();
  expect(await page.evaluate(() => document.body.dataset.executed)).toBeUndefined();
  await expect(page.locator('.generated-news-source')).not.toHaveAttribute('href');
  await expect(page.locator('.generated-news-thumbnail')).toHaveAttribute('src', /\/assets\/news\//);
  const downloads = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.locator('[data-download-draft="pdf"]').click();
  await expect.poll(() => page.evaluate(() => window.__printedHtml)).toContain('Review draft');
  await expect(page.locator('[data-news-print-frame]')).toHaveAttribute('sandbox', 'allow-same-origin allow-modals');
  expect(
    await page.evaluate(() => {
      const doc = new DOMParser().parseFromString(window.__printedHtml, 'text/html');
      return [...doc.querySelectorAll('a')].some((link) => link.getAttribute('href')?.startsWith('javascript:'));
    }),
  ).toBe(false);
  expect(downloads).toEqual([]);
});

test('older searches cannot overwrite the latest search even if transport ignores cancellation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, init = {}) => original(url, { ...init, signal: undefined });
  });
  let release;
  let firstReceived;
  const arrived = new Promise((resolve) => {
    firstReceived = resolve;
  });
  await page.route('**/api/news-search', async (route) => {
    const { query } = route.request().postDataJSON();
    if (query === 'first-query') {
      firstReceived();
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    await route.fulfill({ json: { ok: true, candidates: [{ ...candidate, title: query }], searched: ['fixture'] } });
  });
  await page.goto('/news/search/');
  await submit(page, 'first-query');
  await arrived;
  await submit(page, 'second-query');
  await expect(page.locator('.news-candidate-body strong')).toHaveText('second-query');
  const response = page.waitForResponse(
    (response) => response.url().endsWith('/api/news-search') && response.request().postDataJSON().query === 'first-query',
  );
  release();
  await response;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.news-candidate-body strong')).toHaveText('second-query');
  await expect(page.locator('[name="query"]')).toHaveValue('second-query');
});

test('unknown pages and assets return 404, and wiki heading targets exist', async ({ page }) => {
  for (const path of ['/missing-review-page/', '/posts/missing-review-post/', '/assets/missing-review-script.js']) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(404);
  }
  await page.goto('/posts/second-brain/#second-brain-architecture');
  await expect(page.locator('#second-brain-architecture')).toHaveText('Second Brain Architecture');
  await page.goto('/posts/home/#hi');
  await expect(page.locator('#hi')).toContainText('Hi');
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
      return ids.length === new Set(ids).size;
    }),
  ).toBe(true);
});
