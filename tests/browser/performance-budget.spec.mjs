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
      pretextCatSprites: document.querySelectorAll('.pretext-cat-sprite').length,
      pretextRainStages: document.querySelectorAll('.pretext-rain-stage').length,
      pretextRainColumns: JSON.parse(document.querySelector('[data-pretext-rain-columns]')?.textContent || '[]').length,
      pretextRainBehaviors: document.querySelector('.pretext-rain-stage')?.dataset.behaviors || '',
      pretextPolishPanels: document.querySelectorAll('[data-pretext-polish]').length,
      pretextEditorialLayers: document.querySelectorAll('[data-pretext-editorial]').length,
      pretextReady: document.querySelector('[data-pretext-editorial]')?.dataset.pretextReady || '',
      pretextSourceCount: Number(document.querySelector('[data-pretext-editorial]')?.dataset.pretextSourceCount || 0),
      pretextLayoutLines: Number(document.querySelector('[data-pretext-editorial]')?.dataset.pretextLayoutLines || 0),
      pretextFrame: Number(document.querySelector('[data-pretext-editorial]')?.dataset.pretextFrame || 0),
      pretextMotion: document.querySelector('[data-pretext-editorial]')?.dataset.pretextMotion || '',
      pretextDecorations: document.querySelectorAll('.pretext-cat-paw,.pretext-cat-shadow,.pretext-ambient-layer,.pretext-front-glass').length,
      graphCount: document.querySelectorAll('[data-archive-graph]').length,
      fieldStages: document.querySelectorAll('[data-field-stage]').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      resources,
    };
  });
}

test('desktop and mobile public homepage keep a measured Pretext atlas without layout overflow', async ({ browser }) => {
  for (const [name, contextOptions] of [
    ['desktop', { viewport: desktopViewport }],
    ['mobile', { ...devices['Pixel 5'] }],
  ]) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('[data-pretext-editorial][data-pretext-ready="true"]').waitFor();
    const audit = await runtimeAudit(page);
    const publicPostCount = audit.postCards;

    expect(audit.archiveCount, name).toBeGreaterThan(0);
    expect(audit.archiveCount, name).toBeLessThanOrEqual(publicPostCount);
    expect(audit.postCards, name).toBe(publicPostCount);
    expect(audit.filetreeFiles, name).toBe(publicPostCount);
    expect(audit.graphCount, name).toBe(0);
    expect(audit.fieldStages, name).toBe(0);
    expect(audit.pretextCatSprites, name).toBe(0);
    expect(audit.pretextPolishPanels, name).toBe(0);
    expect(audit.pretextEditorialLayers, name).toBe(1);
    expect(audit.pretextReady, name).toBe('true');
    expect(audit.pretextSourceCount, name).toBeGreaterThanOrEqual(4);
    expect(audit.pretextLayoutLines, name).toBeGreaterThanOrEqual(audit.pretextSourceCount);
    expect(audit.pretextMotion, name).toBe('active');
    expect(audit.pretextFrame, name).toBeGreaterThan(0);
    expect(audit.pretextRainStages, name).toBe(0);
    expect(audit.pretextRainColumns, name).toBe(0);
    expect(audit.pretextRainBehaviors, name).toBe('');
    expect(audit.pretextDecorations, name).toBe(0);
    expect(audit.nodes, name).toBeLessThanOrEqual(980);
    expect(audit.scrollWidth, name).toBeLessThanOrEqual(audit.clientWidth + 1);
    expect(pageErrors, name).toEqual([]);

    const resourceBudget = audit.resources.reduce((sum, resource) => sum + resource.encodedBodySize, 0);
    expect(resourceBudget, name).toBeLessThanOrEqual(52_000);
    await context.close();
  }
});

test('reduced-motion keeps the measured Pretext atlas static', async ({ browser }) => {
  const context = await browser.newContext({ viewport: desktopViewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('[data-pretext-editorial][data-pretext-ready="true"]').waitFor();
  const audit = await runtimeAudit(page);
  const publicPostCount = audit.postCards;
  await page.waitForTimeout(180);
  const laterFrame = Number(await page.locator('[data-pretext-editorial]').getAttribute('data-pretext-frame'));

  expect(audit.archiveCount).toBeGreaterThan(0);
  expect(audit.archiveCount).toBeLessThanOrEqual(publicPostCount);
  expect(audit.graphCount).toBe(0);
  expect(audit.fieldStages).toBe(0);
  expect(audit.pretextPolishPanels).toBe(0);
  expect(audit.pretextEditorialLayers).toBe(1);
  expect(audit.pretextReady).toBe('true');
  expect(audit.pretextSourceCount).toBeGreaterThanOrEqual(4);
  expect(audit.pretextLayoutLines).toBeGreaterThanOrEqual(audit.pretextSourceCount);
  expect(audit.pretextMotion).toBe('reduced');
  expect(laterFrame).toBe(audit.pretextFrame);
  expect(audit.pretextRainStages).toBe(0);
  expect(audit.postCards).toBe(publicPostCount);
  expect(audit.filetreeFiles).toBe(publicPostCount);
  expect(audit.nodes).toBeLessThanOrEqual(980);
  expect(pageErrors).toEqual([]);
  await context.close();
});
