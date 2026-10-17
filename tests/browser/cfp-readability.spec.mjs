import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const snapshot = JSON.parse(fs.readFileSync('data/cfp/latest.json', 'utf8'));

for (const [width, colorScheme] of [
  [390, 'light'],
  [1440, 'light'],
  [390, 'dark'],
  [1440, 'dark'],
]) {
  test(`CFP venue cells stay compact and expand accessibly at ${width}px in ${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme });
    await page.clock.setFixedTime(new Date(snapshot.generatedAt));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/cfp/');
    await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', `system-${colorScheme}`);
    await page.screenshot({ path: `target/cfp-review/after-top-${width}-${colorScheme}.png` });
    const actions = page.locator('.cfp-actions');
    for (const link of await actions.locator('a').all()) {
      const bounds = await link.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    const radar = page.locator('.cfp-radar-table');
    await expect(radar).toBeVisible();
    const icc = radar.locator('tr:visible .cfp-venue').first();
    await expect(icc).not.toHaveAttribute('open', '');
    await icc.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(icc).toHaveAttribute('open', '');
    await expect(icc.locator('.cfp-venue-full')).toBeVisible();
    await expect(icc.locator('.cfp-venue-full')).not.toHaveText('');
    if (width < 600) await expect(icc.locator('.cfp-mobile-details a').first()).toBeVisible();
    await page.keyboard.press('Enter');
    const journal = page
      .locator('.cfp-watchlist-table .cfp-venue')
      .filter({ has: page.locator('.cfp-venue-topic') })
      .first();
    await journal.scrollIntoViewIfNeeded();
    const collapsed = await journal.boundingBox();
    expect(collapsed.height).toBeLessThan(100);
    await journal.locator('summary').click();
    await expect(journal).toHaveAttribute('open', '');
    await expect(journal.locator('.cfp-venue-topic')).not.toHaveText('');
    expect(await journal.locator('.cfp-venue-topic').evaluate((topic) => topic.scrollHeight <= topic.clientHeight + 1)).toBe(true);
    const expanded = await journal.boundingBox();
    expect(expanded.height).toBeGreaterThan(collapsed.height);
    await journal.locator('summary').click();
    const dimensions = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      tables: [...document.querySelectorAll('.cfp-table-scroll')].map((table) => ({ width: table.clientWidth, scroll: table.scrollWidth })),
    }));
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
    if (width < 600) {
      expect(dimensions.tables.every((table) => table.scroll <= table.width + 1)).toBe(true);
      for (const region of await page.locator('.cfp-table-scroll').all()) {
        const bounds = await region.boundingBox();
        for (const column of await region.locator('th:nth-child(-n+2)').all()) {
          const cell = await column.boundingBox();
          expect(cell.x).toBeGreaterThanOrEqual(bounds.x);
          expect(cell.x + cell.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
        }
      }
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: `target/cfp-review/after-${width}-${colorScheme}.png` });
    console.log(
      JSON.stringify({ width, colorScheme, compactJournalHeight: collapsed.height, expandedJournalHeight: expanded.height, ...dimensions }),
    );
  });
}
