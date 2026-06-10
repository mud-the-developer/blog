import { test, expect, devices } from '@playwright/test';

const desktopViewport = { width: 1440, height: 900 };

async function runtimeAudit(page) {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
    }));
    const archive = JSON.parse(document.getElementById('archive-data')?.textContent || '[]');
    return {
      archiveCount: Array.isArray(archive) ? archive.length : 0,
      nodes: document.getElementsByTagName('*').length,
      postCards: document.querySelectorAll('.post-card').length,
      filetreeFiles: document.querySelectorAll('.filetree-file').length,
      pretextCatFrames: document.querySelectorAll('.pretext-cat-frame').length,
      pretextCatPaws: document.querySelectorAll('.pretext-cat-paw').length,
      graphCount: document.querySelectorAll('[data-archive-graph]').length,
      fieldStages: document.querySelectorAll('[data-field-stage]').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      resources,
    };
  });
}

test('desktop and mobile public homepage stay polished without layout overflow', async ({ browser }) => {
  for (const [name, contextOptions] of [
    ['desktop', { viewport: desktopViewport }],
    ['mobile', { ...devices['Pixel 5'] }],
  ]) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    const audit = await runtimeAudit(page);
    const publicPostCount = audit.archiveCount;

    expect(audit.archiveCount, name).toBe(publicPostCount);
    expect(audit.postCards, name).toBe(publicPostCount);
    expect(audit.filetreeFiles, name).toBe(publicPostCount);
    expect(audit.graphCount, name).toBe(0);
    expect(audit.fieldStages, name).toBe(0);
    expect(audit.pretextCatFrames, name).toBeGreaterThanOrEqual(4);
    expect(audit.pretextCatFrames, name).toBeLessThanOrEqual(6);
    expect(audit.pretextCatPaws, name).toBeGreaterThanOrEqual(8);
    expect(audit.nodes, name).toBeLessThanOrEqual(980);
    expect(audit.scrollWidth, name).toBeLessThanOrEqual(audit.clientWidth + 1);

    const resourceBudget = audit.resources.reduce((sum, resource) => sum + resource.encodedBodySize, 0);
    expect(resourceBudget, name).toBeLessThanOrEqual(52_000);
    await context.close();
  }
});

test('reduced-motion keeps the filetree but disables ambient Pretext animation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: desktopViewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  const audit = await runtimeAudit(page);
  const publicPostCount = audit.archiveCount;
  const animatedCount = await page.locator('.pretext-cat-frame,.pretext-cat-paw,.pretext-cat-shadow,.pretext-ambient-layer').evaluateAll((tokens) =>
    tokens.filter((token) => {
      const style = window.getComputedStyle(token);
      return style.animationName !== 'none' && style.animationDuration !== '0s' && style.animationDuration !== '0.01ms';
    }).length,
  );

  expect(audit.archiveCount).toBe(publicPostCount);
  expect(audit.graphCount).toBe(0);
  expect(audit.fieldStages).toBe(0);
  expect(audit.postCards).toBe(publicPostCount);
  expect(audit.filetreeFiles).toBe(publicPostCount);
  expect(animatedCount).toBe(0);
  expect(audit.nodes).toBeLessThanOrEqual(980);
  await context.close();
});
