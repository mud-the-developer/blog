import { test, expect } from '@playwright/test';

test('CFP dashboard refreshes dates on entry and links the weekly archive', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+09:00'));
  await page.goto('/cfp/');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'cfp-index');
  await expect(page.locator('.post-body td[data-cfp-deadline-as-of]').first()).toHaveAttribute('data-cfp-deadline-as-of', '2026-10-15');
  await expect(page.locator('[data-cfp-history] a').first()).toHaveAttribute('href', /\/posts\/\d{4}-\d{2}-\d{2}-cfp-radar\//);
  const response = await page.request.get('/cfp/data/latest.json');
  const issue = await response.json();
  const icc = issue.items.find((item) => item.acronym === 'ICC');
  expect(icc.edition).toBeGreaterThanOrEqual(2027);
  expect(icc.url).toContain('ieee-icc.org/authors/');
  expect(icc.deadlineVerified).toBe(true);
  const feed = await page.request.get('/cfp/radar.ics');
  const mirror = await page.request.get('/cfp/data/radar.ics');
  expect(await feed.text()).toBe(await mirror.text());
});
