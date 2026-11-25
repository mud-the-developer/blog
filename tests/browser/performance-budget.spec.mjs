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
    const bioWrap = document.querySelector('[data-pretext-bio-wrap]');
    return {
      archiveCount: Array.isArray(archive) ? archive.length : 0,
      nodes: document.getElementsByTagName('*').length,
      workCards: document.querySelectorAll('.v3-work-card').length,
      pretextMode: bioWrap?.dataset.pretextMode || '',
      pretextEngine: bioWrap?.dataset.pretextEngine || '',
      pretextLines: Number(bioWrap?.dataset.pretextLines || 0),
      pretextCatSprites: document.querySelectorAll('.pretext-cat-sprite').length,
      pretextRainStages: document.querySelectorAll('.pretext-rain-stage').length,
      pretextRainColumns: JSON.parse(document.querySelector('[data-pretext-rain-columns]')?.textContent || '[]').length,
      pretextRainBehaviors: document.querySelector('.pretext-rain-stage')?.dataset.behaviors || '',
      pretextPolishPanels: document.querySelectorAll('[data-pretext-polish]').length,
      pretextEditorialLayers: document.querySelectorAll('[data-pretext-editorial]').length,
      pretextDecorations: document.querySelectorAll('.pretext-cat-paw,.pretext-cat-shadow,.pretext-ambient-layer,.pretext-front-glass').length,
      graphCount: document.querySelectorAll('[data-archive-graph]').length,
      fieldStages: document.querySelectorAll('[data-field-stage]').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      resources,
    };
  });
}

test('desktop and mobile v3 homepage stay fast, readable, and free of decorative motion', async ({ browser }) => {
  for (const [name, contextOptions] of [
    ['desktop', { viewport: desktopViewport }],
    ['mobile', { ...devices['Pixel 5'] }],
  ]) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'networkidle' });
    const audit = await runtimeAudit(page);

    expect(audit.archiveCount, name).toBeGreaterThan(0);
    expect(audit.workCards, name).toBeGreaterThanOrEqual(7);
    if (name === 'desktop') {
      expect(audit.pretextMode, name).toBe('active');
      expect(audit.pretextEngine, name).toBe('chenglou-pretext');
      expect(audit.pretextLines, name).toBeGreaterThanOrEqual(2);
    } else {
      expect(audit.pretextMode, name).toBe('native');
    }
    expect(audit.graphCount, name).toBe(0);
    expect(audit.fieldStages, name).toBe(0);
    expect(audit.pretextCatSprites, name).toBe(0);
    expect(audit.pretextPolishPanels, name).toBe(0);
    expect(audit.pretextEditorialLayers, name).toBe(0);
    expect(audit.pretextRainStages, name).toBe(0);
    expect(audit.pretextRainColumns, name).toBe(0);
    expect(audit.pretextRainBehaviors, name).toBe('');
    expect(audit.pretextDecorations, name).toBe(0);
    expect(audit.nodes, name).toBeLessThanOrEqual(980);
    expect(audit.scrollWidth, name).toBeLessThanOrEqual(audit.clientWidth + 1);
    expect(pageErrors, name).toEqual([]);

    const resourceBudget = audit.resources.reduce((sum, resource) => sum + resource.encodedBodySize, 0);
    expect(resourceBudget, name).toBeLessThanOrEqual(450_000);
    await context.close();
  }
});

test('reduced-motion v3 homepage stays readable without decorative background motion', async ({ browser }) => {
  const context = await browser.newContext({ viewport: desktopViewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  const audit = await runtimeAudit(page);

  expect(audit.archiveCount).toBeGreaterThan(0);
  expect(audit.workCards).toBeGreaterThanOrEqual(7);
  expect(audit.pretextMode).toBe('active');
  expect(audit.graphCount).toBe(0);
  expect(audit.fieldStages).toBe(0);
  expect(audit.pretextPolishPanels).toBe(0);
  expect(audit.pretextEditorialLayers).toBe(0);
  expect(audit.pretextRainStages).toBe(0);
  expect(audit.nodes).toBeLessThanOrEqual(980);
  expect(pageErrors).toEqual([]);
  await context.close();
});
