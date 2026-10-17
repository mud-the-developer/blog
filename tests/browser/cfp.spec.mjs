import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { currentDateInKst } from '../../src/cfp-deadlines.mjs';

const snapshot = JSON.parse(fs.readFileSync('data/cfp/latest.json', 'utf8'));
const asOf = new Date(snapshot.generatedAt);

test('daily CFP has no archive and publishes matching dates and calendar feeds', async ({ page }) => {
  await page.clock.setFixedTime(asOf);
  await page.goto('/cfp/');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'cfp-index');
  await expect(page.locator('.post-body td[data-cfp-deadline-as-of]').first()).toHaveAttribute(
    'data-cfp-deadline-as-of',
    currentDateInKst(asOf),
  );
  await expect(page.locator('[data-cfp-history]')).toHaveCount(0);
  await expect(page.locator('[data-cfp-open-count]')).toHaveText(String(snapshot.activeCount));
  const response = await page.request.get('/cfp/data/latest.json');
  expect(await response.json()).toEqual(snapshot);
  const feed = await page.request.get('/cfp/radar.ics');
  const mirror = await page.request.get('/cfp/data/radar.ics');
  expect(await feed.text()).toBe(await mirror.text());
});

test('aging snapshots hide expired or stale calls and recalculate all open counts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.clock.setFixedTime(new Date(asOf.getTime() + 8 * 24 * 60 * 60 * 1000));
  await page.goto('/cfp/');
  await expect(page.locator('[data-cfp-open-count]')).toHaveText('0');
  await expect(page.locator('.cfp-radar-table tbody tr:visible')).toHaveCount(0);
  await expect(page.locator('.cfp-radar-table [data-cfp-empty]')).toBeVisible();
  await expect(page.locator('[data-cfp-stale-warning]')).toBeVisible();
  const open = page.locator('.cfp-watchlist-table tbody tr:visible [data-cfp-expired="true"]');
  await expect(open).toHaveCount(0);
  const staleRow = page
    .locator('.cfp-watchlist-table tbody tr:visible')
    .filter({ has: page.locator('[data-cfp-deadline][data-cfp-verified="true"]') })
    .first();
  await staleRow.locator('.cfp-venue summary').click();
  await expect(staleRow.locator('[data-cfp-deadline]')).toContainText('stale');
  await expect(staleRow.locator('.cfp-mobile-details a[href^="https://calendar.google.com/calendar/render"]')).toBeHidden();
  await expect(staleRow.locator('.cfp-mobile-details a', { hasText: 'Official CFP' })).toBeVisible();
});
