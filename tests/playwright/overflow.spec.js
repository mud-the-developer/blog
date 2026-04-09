const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { width: 320, height: 900 },
  { width: 375, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1280, height: 960 },
  { width: 1440, height: 1100 },
];

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'graph', path: '/graph/' },
  { name: 'note-long', path: '/notes/system/overflow-regression-case/' },
  { name: 'tag-ai', path: '/tags/ai/' },
];

const TRACK_SELECTORS = [
  '.site-shell',
  '.site-header',
  '.site-layout',
  '.site-main',
  '.site-main-stack',
  '.graph-main-layout',
  '.graph-main-side',
  '.note-shell',
  '.collection-hero',
  '.graph-panel--editorial',
  '.page-tabs',
  '.live-graph',
  '.article-list',
  '.signal-stream',
  '.note-web-stage',
  '.graph-stage',
  '.site-nav',
  '.search-results',
];

for (const viewport of VIEWPORTS) {
  for (const pageDef of PAGES) {
    test(`${pageDef.name} has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(pageDef.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);

      const result = await page.evaluate((selectors) => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const offenders = [];

        for (const selector of selectors) {
          for (const element of document.querySelectorAll(selector)) {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.left < -1 || rect.right > viewportWidth + 1) {
              offenders.push({
                selector,
                left: rect.left,
                right: rect.right,
                width: rect.width,
              });
            }
          }
        }

        return {
          viewportWidth,
          scrollWidth,
          overflow: scrollWidth > viewportWidth + 1,
          offenders,
        };
      }, TRACK_SELECTORS);

      expect(result.overflow, `document overflowed: ${JSON.stringify(result, null, 2)}`).toBe(
        false,
      );
      expect(
        result.offenders,
        `layout container overflowed: ${JSON.stringify(result.offenders, null, 2)}`,
      ).toHaveLength(0);
    });
  }
}
