import { test, expect } from '@playwright/test';

const folders = ['blog', 'papers', 'about'];
const rejectedCopy = [
  '읽기 좋은 노트',
  'Readable archive',
  'Markdown archive',
  'Pretext Kinetic Blog',
  'Research Radar',
  'README Post Template',
  'About Jinhyuk',
  'tokio · askama · htmx',
  'refresh fragment',
];

async function archivePostCount(page) {
  return page.evaluate(() => {
    const archive = JSON.parse(document.getElementById('archive-data')?.textContent || '[]');
    return Array.isArray(archive) ? archive.length : 0;
  });
}

async function newsPostCount(request) {
  const response = await request.get('/archive.json');
  expect(response.ok()).toBe(true);
  const archive = await response.json();
  return Array.isArray(archive) ? archive.filter((post) => post.folder === 'news').length : 0;
}

test('homepage is a polished public filetree with subtle Pretext animation and no hero pane', async ({ page }) => {
  await page.goto('/');
  const publicPostCount = await archivePostCount(page);

  await expect(page.locator('html')).toHaveAttribute('data-runtime', 'tokio');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'index');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'public-index');
  await expect(page.locator('html')).not.toHaveAttribute('hx-boost', 'true');
  await expect(page.getByLabel("Mud's Blog home")).toContainText("Mud's Blog");
  await expect(page.locator('[data-theme-toggle]')).toBeVisible();
  const iconCount = await page.locator('.ui-icon svg').count();
  expect(iconCount).toBeGreaterThanOrEqual(7);
  await expect(page.getByRole('link', { name: /^Data$/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^News$/ })).toHaveAttribute('href', '/news/');

  await expect(page.locator('.reader-intro')).toHaveCount(0);
  await expect(page.locator('.lede')).toHaveCount(0);
  await expect(page.locator('.public-shell')).toHaveCount(1);
  await expect(page.locator('.filetree')).toHaveCount(1);
  await expect(page.locator('.filetree-folder')).toHaveCount(folders.length);
  await expect(page.locator('.filetree-folder summary')).toHaveCount(folders.length);
  await expect(page.locator('.filetree-file')).toHaveCount(publicPostCount);
  await expect(page.locator('details.filetree-folder[data-folder="news"]')).toHaveCount(0);
  await expect(page.getByText('news/', { exact: true })).toHaveCount(0);
  for (const folder of ['blog', 'papers', 'about']) {
    await expect(page.locator(`details.filetree-folder[data-folder="${folder}"]`)).toHaveAttribute('open', '');
  }
  await expect(page.locator('#posts-surface > .post-card')).toHaveCount(publicPostCount);
  await expect(page.locator('[data-focused-issue-lab]')).toHaveCount(0);
  await expect(page.locator('[data-blog-chat]')).toHaveCount(0);
  await expect(page.locator('[data-pretext-polish]')).toHaveCount(1);
  await expect(page.locator('script[src="/assets/pretext-polish.mjs"]')).toHaveCount(1);
  await expect(page.locator('script[src="/assets/site-chrome.mjs"]')).toHaveCount(1);
  await expect(page.locator('script[src="/assets/blog-lab.mjs"]')).toHaveCount(0);
  await expect(page.locator('script[src="/assets/pretext-field.mjs"]')).toHaveCount(0);

  for (const folder of folders) {
    await expect(page.locator(`[data-folder="${folder}"]`)).toBeVisible();
    await expect(page.locator(`[data-folder="${folder}"]`).getByText(`${folder}/`, { exact: true })).toBeVisible();
  }

  await page.locator('details.filetree-folder[data-folder="blog"] > summary').click();
  await expect(page.locator('details.filetree-folder[data-folder="blog"]')).not.toHaveAttribute('open', '');

  await expect(page.getByRole('link', { name: /^About me$/ })).toHaveAttribute('href', '/posts/jinhyuk-kim/');
  await expect(page.locator('[data-home-post]')).toBeVisible();
  await expect(page.locator('[data-home-post-body]')).toContainText('Hi 🙋');
  await expect(page.locator('[data-home-post-body]')).toContainText('Welcome to my blog');
  await expect(page.getByRole('link', { name: /About Jinhyuk/ })).toHaveCount(0);

  const visibleText = await page.evaluate(() => document.body.innerText);
  expect(visibleText).not.toContain('Public writing');
  expect(visibleText).not.toContain('A tight public desk for AI systems');
  for (const copy of rejectedCopy) {
    expect(visibleText).not.toContain(copy);
  }

  await expect(page.locator('[data-field-stage]')).toHaveCount(0);
  await expect(page.locator('[data-archive-graph]')).toHaveCount(0);
  await expect(page.locator('.archive-graph-label')).toHaveCount(0);
  await expect(page.locator('.paper-grid')).toHaveCount(0);

  await expect(page.locator('[data-pretext-polish]')).toHaveAttribute('data-pretext-ready', 'true');
  await expect(page.getByLabel('post text rain')).toHaveCount(1);
  const firstRainSample = await page.evaluate(() => {
    const stage = document.querySelector('.pretext-rain-stage');
    return {
      activeColumn: stage?.dataset.activeColumn || '',
      activeGlyph: stage?.dataset.activeGlyph || '',
      text: document.querySelector('.pretext-rain-column')?.textContent || ''
    };
  });
  await page.waitForTimeout(760);
  const secondRainSample = await page.evaluate(() => {
    const stage = document.querySelector('.pretext-rain-stage');
    return {
      activeColumn: stage?.dataset.activeColumn || '',
      activeGlyph: stage?.dataset.activeGlyph || '',
      text: document.querySelector('.pretext-rain-column')?.textContent || ''
    };
  });

  const motion = await page.evaluate(() => {
    const rainStage = document.querySelector('.pretext-rain-stage');
    const columnData = JSON.parse(document.querySelector('[data-pretext-rain-columns]')?.textContent || '[]');
    const columns = [...document.querySelectorAll('.pretext-rain-column')];
    const style = getComputedStyle(columns[0] || rainStage || document.body);
    const css = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => rule.cssText);
        } catch (_error) {
          return [];
        }
      })
      .join('\n');
    const archive = JSON.parse(document.getElementById('archive-data')?.textContent || '[]');
    const stage = document.querySelector('[data-pretext-polish]');
    const stageRect = stage?.getBoundingClientRect();
    const rainRect = rainStage?.getBoundingClientRect();
    const rainText = rainStage?.textContent || '';
    const samples = window.__pretextRainMotionSamples || [];
    const sampleColumns = new Set(samples.map((sample) => sample.columnIndex));
    return {
      archiveCount: Array.isArray(archive) ? archive.length : 0,
      rainStageCount: document.querySelectorAll('.pretext-rain-stage').length,
      rainColumnCount: columns.length,
      loomStageCount: document.querySelectorAll('.pretext-loom-stage').length,
      loomRowCount: document.querySelectorAll('.pretext-loom-row').length,
      catStageCount: document.querySelectorAll('.pretext-cat-stage').length,
      spriteCount: document.querySelectorAll('.pretext-cat-sprite').length,
      hiddenFrameNodeCount: document.querySelectorAll('.pretext-cat-frame').length,
      columnDataCount: columnData.length,
      animatedCount: columns.some((column) => {
        const columnStyle = getComputedStyle(column);
        return columnStyle.animationName !== 'none' && columnStyle.animationDuration !== '0s';
      }) ? 1 : 0,
      ambientLayerCount: document.querySelectorAll('.pretext-ambient-layer').length,
      scene: stage?.dataset.pretextScene || '',
      references: stage?.dataset.pretextReferences || '',
      rainMode: rainStage?.dataset.rainMode || '',
      sourceCount: Number(rainStage?.dataset.sourceCount || 0),
      sourceWords: rainStage?.dataset.sourceWords || '',
      glyphPool: rainStage?.dataset.glyphPool || '',
      statusCount: document.querySelectorAll('[data-pretext-loom-status]').length,
      cursorCount: document.querySelectorAll('[data-pretext-loom-cursor]').length,
      frontGlassCount: document.querySelectorAll('.pretext-front-glass').length,
      linkCount: document.querySelectorAll('.pretext-link,.pretext-network').length,
      anchorTokenCount: document.querySelectorAll('a.pretext-loom-row[href],a.pretext-fragment[href],a.pretext-token[href]').length,
      rainText,
      behaviorList: rainStage?.dataset.behaviors || '',
      catCopyCount: (stage?.textContent || '').match(/CAT-LINK|tail-sweep|large-tail|oneko|ascii cat/g)?.length || 0,
      clippedRainCount: stageRect && rainRect && (rainRect.left < stageRect.left || rainRect.right > stageRect.right || rainRect.top < stageRect.top || rainRect.bottom > stageRect.bottom) ? 1 : 0,
      interactive: stage?.dataset.pretextInteractive || '',
      columnFontSize: Number.parseFloat(style.fontSize || '0'),
      decorativeNodeCount: document.querySelectorAll('.pretext-cat-paw,.pretext-cat-shadow,.pretext-ambient-layer,.pretext-front-glass').length,
      filetreeWidth: document.querySelector('.filetree')?.getBoundingClientRect().width || 0,
      hasRainCss: css.includes('pretext-rain-fall') && css.includes('pretext-rain-column') && css.includes('font-variant-ligatures'),
      hasLoomCss: css.includes('pretext-loom-breathe') || css.includes('pretext-loom-row'),
      hasCatCss: css.includes('pretext-cat-sprite') || css.includes('pretext-cat-breathe'),
      hasDecorativeBackgroundPattern: /radial-gradient|orbit|bubble|stripe/i.test(css),
      mentionsNeon: css.toLowerCase().includes('neon'),
      sampleCount: samples.length,
      sampleColumnCount: sampleColumns.size,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(motion.archiveCount).toBe(publicPostCount);
  expect(motion.rainStageCount).toBe(1);
  expect(motion.rainColumnCount).toBeGreaterThanOrEqual(24);
  expect(motion.rainColumnCount).toBeLessThanOrEqual(32);
  expect(motion.loomStageCount).toBe(0);
  expect(motion.loomRowCount).toBe(0);
  expect(motion.catStageCount).toBe(0);
  expect(motion.spriteCount).toBe(0);
  expect(motion.hiddenFrameNodeCount).toBe(0);
  expect(motion.columnDataCount).toBe(motion.rainColumnCount);
  expect(motion.animatedCount).toBe(1);
  expect(motion.ambientLayerCount).toBe(0);
  expect(motion.scene).toBe('post-text-rain');
  expect(motion.references).toContain('archive-data');
  expect(motion.rainMode).toBe('post-text-rain');
  expect(motion.sourceCount).toBe(publicPostCount);
  expect(motion.sourceWords).toContain('Second Brain Architecture');
  expect(motion.glyphPool).toContain('R');
  expect(motion.statusCount).toBe(0);
  expect(motion.cursorCount).toBe(0);
  expect(motion.frontGlassCount).toBe(0);
  expect(motion.linkCount).toBe(0);
  expect(motion.anchorTokenCount).toBe(0);
  expect(motion.rainText).not.toContain('PRETEXT // CURRENT');
  expect(motion.rainText).not.toContain('INDEX CURRENT');
  expect(motion.rainText).not.toContain('signal:');
  expect(motion.behaviorList).toBe('falling-columns random-letter-refresh post-derived-glyphs');
  expect(motion.catCopyCount).toBe(0);
  expect(motion.clippedRainCount).toBe(0);
  expect(motion.interactive).toBe('true');
  expect(motion.columnFontSize).toBeLessThanOrEqual(14);
  expect(motion.decorativeNodeCount).toBe(0);
  expect(motion.filetreeWidth).toBeLessThanOrEqual(860);
  expect(motion.hasRainCss).toBe(true);
  expect(motion.hasLoomCss).toBe(false);
  expect(motion.hasCatCss).toBe(false);
  expect(motion.hasDecorativeBackgroundPattern).toBe(false);
  expect(motion.mentionsNeon).toBe(false);
  expect(motion.sampleCount).toBeGreaterThanOrEqual(2);
  expect(motion.sampleColumnCount).toBeGreaterThanOrEqual(2);
  expect(firstRainSample.text).not.toBe('');
  expect(secondRainSample.activeColumn).not.toBe('');
  expect(secondRainSample.activeGlyph).not.toBe('');
  expect(motion.scrollWidth).toBeLessThanOrEqual(motion.clientWidth + 1);
});

test('local preview serves focused issue API and a dedicated news page', async ({ page, request }) => {
  const api = await request.post('/api/focused-issue', {
    data: { date: '2026-04-14', keywords: 'open RAN, Gemma', limit: 4 }
  });
  expect(api.status()).not.toBe(404);
  expect(api.ok()).toBe(true);
  const payload = await api.json();
  expect(payload.ok).toBe(true);
  expect(payload.issue.title).toContain('open RAN');
  expect(payload.sources.length).toBeGreaterThan(0);

  await page.goto('/news/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'news');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'news-index');
  await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^News$/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /^News Search$/ })).toHaveAttribute('href', '/news/search/');
  await expect(page.locator('[data-focused-issue-lab]')).toHaveCount(0);
  const newsIssues = await newsPostCount(request) - 1;
  await expect(page.locator('[data-news-featured] .news-feature-card')).toHaveCount(1);
  await expect(page.locator('[data-news-featured] .news-feature-thumb')).toHaveCount(1);
  await expect(page.locator('[data-news-recent] .news-row')).toHaveCount(Math.min(7, Math.max(0, newsIssues - 1)));
  await expect(page.locator('[data-news-monthly-archive] .news-month-link')).toHaveCount(newsIssues);
  await expect(page.locator('[data-news-utility]')).toContainText('latest.json');
  await expect(page.locator('[data-news-digest-json]')).toHaveCount(0);
  await expect(page.locator('text=AI News Brief — Jun 09').first()).toBeVisible();

  await page.goto('/news/search/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'news-search');
  await expect(page.getByRole('link', { name: /^News Search$/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-focused-issue-lab]')).toBeVisible();
  await expect(page.locator('[data-overview-figure]')).toHaveCount(0);
});

test('theme follows the system default and can be toggled without local persistence', async ({ browser }) => {
  const darkContext = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1024, height: 760 } });
  const darkPage = await darkContext.newPage();
  await darkPage.goto('/');
  await expect(darkPage.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', 'system-dark');
  let themeAudit = await darkPage.evaluate(() => {
    const style = getComputedStyle(document.body);
    return {
      htmlTheme: document.documentElement.dataset.theme || '',
      bg: style.backgroundColor,
      pressed: document.querySelector('[data-theme-toggle]')?.getAttribute('aria-pressed'),
      iconLabel: document.querySelector('[data-theme-toggle] .theme-toggle-label')?.textContent || '',
      saved: window.localStorage.getItem('mud-blog-theme')
    };
  });
  expect(themeAudit.htmlTheme).toBe('');
  expect(themeAudit.pressed).toBe('false');
  expect(themeAudit.iconLabel).toContain('Dark');
  expect(themeAudit.saved).toBeNull();
  expect(themeAudit.bg).not.toBe('rgb(246, 242, 234)');

  await darkPage.locator('[data-theme-toggle]').click();
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(darkPage.locator('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(darkPage.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', 'light');
  themeAudit = await darkPage.evaluate(() => ({
    saved: window.localStorage.getItem('mud-blog-theme'),
    iconLabel: document.querySelector('[data-theme-toggle] .theme-toggle-label')?.textContent || ''
  }));
  expect(themeAudit.saved).toBeNull();
  expect(themeAudit.iconLabel).toContain('Light');
  await darkPage.reload();
  await expect(darkPage.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await expect(darkPage.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', 'system-dark');
  await darkContext.close();
});

test('global blog chrome is glass over space black with an inverted light mode and no decorative patterns', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/news/search/');

  const auditTheme = async (selectors = ['.site-header nav a', '.focused-issue-lab', '.news-desk-grid', '.source-picker', '.news-command-strip span']) => page.evaluate((selectorsToAudit) => {
    const css = [...document.styleSheets]
      .flatMap((sheet) => {
        try { return [...sheet.cssRules].map((rule) => rule.cssText); }
        catch (_error) { return []; }
      })
      .join('\n');
    const parseRgb = (value) => (value.match(/rgba?\(([^)]+)\)/)?.[1] || '')
      .split(',')
      .slice(0, 3)
      .map((part) => Number.parseFloat(part));
    const bodyRgb = parseRgb(getComputedStyle(document.body).backgroundColor);
    const glass = selectorsToAudit.map((selector) => {
      const node = document.querySelector(selector);
      const style = node ? getComputedStyle(node) : null;
      return {
        selector,
        present: Boolean(node),
        background: style?.backgroundColor || '',
        backdrop: style ? (style.backdropFilter || style.webkitBackdropFilter || '') : '',
        border: style?.borderColor || ''
      };
    });
    return {
      bodyRgb,
      hasPatterns: /radial-gradient|repeating-linear-gradient|skewY|orbit|bubble|stripe/i.test(css),
      hasSpaceTokens: css.includes('--space-bg') && css.includes('--glass-bg') && css.includes('--glass-blur'),
      glass,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    };
  }, selectors);

  const dark = await auditTheme();
  expect(dark.bodyRgb.every((channel) => channel <= 22)).toBe(true);
  expect(dark.hasPatterns).toBe(false);
  expect(dark.hasSpaceTokens).toBe(true);
  expect(dark.glass.every((item) => item.present && item.backdrop.includes('blur'))).toBe(true);
  expect(dark.scrollWidth).toBeLessThanOrEqual(dark.clientWidth + 1);

  await page.goto('/');
  const homeDark = await auditTheme(['.filetree', '.pretext-polish', '.post-card']);
  expect(homeDark.glass.every((item) => item.present && item.backdrop.includes('blur'))).toBe(true);
  expect(homeDark.hasPatterns).toBe(false);
  expect(homeDark.scrollWidth).toBeLessThanOrEqual(homeDark.clientWidth + 1);

  await page.goto('/news/search/');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await auditTheme();
  expect(light.bodyRgb.every((channel) => channel >= 232)).toBe(true);
  expect(light.hasPatterns).toBe(false);
  expect(light.glass.every((item) => item.present && item.backdrop.includes('blur'))).toBe(true);
  expect(light.scrollWidth).toBeLessThanOrEqual(light.clientWidth + 1);

  await context.close();
});



test('dark mode keeps news desk buttons and chips readable', async ({ page }) => {
  await page.goto('/news/search/');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const contrastAudit = await page.evaluate(() => {
    const parseColor = (value) => {
      const text = value.trim();
      const rgb = text.match(/^rgba?\(([^)]+)\)$/);
      if (rgb) {
        const parts = rgb[1].split(/,\s*/).map(Number);
        return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
      }
      const srgb = text.match(/^color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\)$/);
      if (srgb) {
        return { r: Number(srgb[1]) * 255, g: Number(srgb[2]) * 255, b: Number(srgb[3]) * 255, a: srgb[4] ? Number(srgb[4]) : 1 };
      }
      return { r: 0, g: 0, b: 0, a: 1 };
    };
    const flatten = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1
    });
    const luminance = (color) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const contrast = (fg, bg) => {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
    const checks = [
      ['theme toggle', '[data-theme-toggle]', 4.5],
      ['active nav', '.site-header nav a[aria-current="page"]', 4.5],
      ['search button', '.lab-form button[type="submit"]', 4.5],
      ['disabled draft button', '.draft-selected-button:disabled', 3.6],
      ['disabled markdown button', '.download-draft-button:disabled', 3.6],
      ['source chip', '.source-picker label', 4.5],
      ['pipeline chip', '.news-command-strip span', 4.5]
    ];
    return checks.map(([name, selector, minimum]) => {
      const node = document.querySelector(selector);
      const style = getComputedStyle(node);
      const fg = parseColor(style.color);
      const rawBg = parseColor(style.backgroundColor);
      const bg = rawBg.a < 1 ? flatten(rawBg, bodyBg) : rawBg;
      return { name, selector, minimum, ratio: Number(contrast(fg, bg).toFixed(2)), color: style.color, background: style.backgroundColor };
    });
  });

  const failing = contrastAudit.filter((item) => item.ratio < item.minimum);
  expect(failing).toEqual([]);
});


test('post pages keep rich media and inline html aligned with the article width', async ({ page }) => {
  await page.goto('/posts/jinhyuk-kim/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'post');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'reader-post');
  await expect(page.getByRole('heading', { name: 'Jinhyuk Kim' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About Jinhyuk' })).toHaveCount(0);
  await expect(page.locator('.profile-publication-widget')).toHaveCount(1);
  await expect(page.locator('.profile-link-grid')).toHaveCount(1);
  await expect(page.locator('[data-blog-chat]')).toHaveCount(0);
  await expect(page.locator('script[src="/assets/blog-lab.mjs"]')).toHaveCount(0);

  const audit = await page.evaluate(() => {
    const article = document.querySelector('.post-reader')?.getBoundingClientRect();
    const iframe = document.querySelector('.profile-publication-widget')?.getBoundingClientRect();
    const linkGrid = document.querySelector('.profile-link-grid')?.getBoundingClientRect();
    const backLink = document.querySelector('.back-link')?.getBoundingClientRect();
    const metadata = document.querySelector('.post-reader > .eyebrow')?.getBoundingClientRect();
    const images = [...document.querySelectorAll('.post-body img')].map((image) => image.getBoundingClientRect().width);
    const body = document.querySelector('.post-body');
    const bodyStyles = body ? getComputedStyle(body) : null;
    return {
      articleWidth: article?.width || 0,
      iframeWidth: iframe?.width || 0,
      linkGridWidth: linkGrid?.width || 0,
      imageMax: images.length ? Math.max(...images) : 0,
      backBottom: backLink?.bottom || 0,
      metadataTop: metadata?.top || 0,
      lineHeight: bodyStyles ? Number.parseFloat(bodyStyles.lineHeight) : 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(audit.articleWidth).toBeLessThanOrEqual(820);
  expect(audit.iframeWidth).toBeLessThanOrEqual(audit.articleWidth + 1);
  expect(audit.linkGridWidth).toBeLessThanOrEqual(audit.articleWidth + 1);
  expect(audit.imageMax).toBeLessThanOrEqual(audit.articleWidth + 1);
  expect(audit.metadataTop).toBeGreaterThanOrEqual(audit.backBottom + 10);
  expect(audit.lineHeight).toBeGreaterThanOrEqual(30.8);
  expect(audit.lineHeight).toBeLessThanOrEqual(32.5);
  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
});

test('narrow news search and post chrome keep controls separated without overlap', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1200 });
  await page.goto('/news/search/');

  const newsLayout = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const rects = (selector) => [...document.querySelectorAll(selector)].map((node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height, text: node.textContent.trim() };
    });
    const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const inside = (child, parent) => child && parent && child.left >= parent.left - 1 && child.right <= parent.right + 1;
    const query = rect('.query-mode-picker');
    const queryLegend = rect('.query-mode-picker legend');
    const queryLabels = rects('.query-mode-picker label');
    const sourcePicker = rect('.source-picker');
    const sourceGroups = rects('.source-picker-group');
    const actionButtons = rects('.draft-action-row button');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      queryLabelWidths: queryLabels.map((label) => label.width),
      queryLegendOverlaps: queryLabels.map((label) => overlaps(queryLegend, label)),
      queryLabelsInside: queryLabels.map((label) => inside(label, query)),
      sourceGroupWidths: sourceGroups.map((group) => group.width),
      sourceGroupsInside: sourceGroups.map((group) => inside(group, sourcePicker)),
      actionButtonOverlaps: actionButtons.flatMap((button, index) => actionButtons.slice(index + 1).map((next) => overlaps(button, next))),
    };
  });
  expect(newsLayout.scrollWidth).toBeLessThanOrEqual(newsLayout.clientWidth + 1);
  expect(newsLayout.queryLabelWidths.every((width) => width >= 160)).toBe(true);
  expect(newsLayout.queryLegendOverlaps).toEqual([false, false]);
  expect(newsLayout.queryLabelsInside).toEqual([true, true]);
  expect(newsLayout.sourceGroupWidths.every((width) => width >= 160)).toBe(true);
  expect(newsLayout.sourceGroupsInside).toEqual([true, true, true, true]);
  expect(newsLayout.actionButtonOverlaps.every((value) => value === false)).toBe(true);

  await page.goto('/posts/jinhyuk-kim/');
  const postLayout = await page.evaluate(() => {
    const back = document.querySelector('.back-link')?.getBoundingClientRect();
    const metadata = document.querySelector('.post-reader > .eyebrow')?.getBoundingClientRect();
    return {
      backBottom: back?.bottom || 0,
      metadataTop: metadata?.top || 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(postLayout.scrollWidth).toBeLessThanOrEqual(postLayout.clientWidth + 1);
  expect(postLayout.metadataTop).toBeGreaterThanOrEqual(postLayout.backBottom + 10);
});

test('post fragment remains direct readable cards for safe replacement', async ({ page, request }) => {
  const response = await request.get('/fragments/posts');
  expect(response.ok()).toBe(true);
  const fragment = await response.text();
  expect(fragment).not.toContain('class="post-grid"');
  expect(fragment).not.toContain('data-askama-template="posts-fragment"');
  expect(fragment.trim().startsWith('<a class="post-card"')).toBe(true);
  expect(fragment).not.toContain('AI News Brief — Jun 09');
  expect(fragment).toContain('Jinhyuk Kim');
  expect(fragment).not.toContain('About Jinhyuk');
  expect(fragment).not.toContain('Pretext Kinetic Blog');

  await page.goto('/');
  const publicPostCount = await archivePostCount(page);
  await page.evaluate(async () => {
    const html = await fetch('/fragments/posts').then((response) => response.text());
    const surface = document.querySelector('#posts-surface');
    if (surface) surface.innerHTML = html;
  });
  await expect(page.locator('#posts-surface > .post-card')).toHaveCount(publicPostCount);
  await expect(page.locator('#posts-surface > .post-grid')).toHaveCount(0);
});

test('news page searches candidates before drafting an issue and does not expose keys or overflow text', async ({ page }) => {
  await page.route('/api/news-search', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.query).toContain('open RAN');
    expect(body.queryMode).toBe('gemma-expand');
    expect(body.sources).toEqual(['gdelt', 'google-news-rss', 'github-repositories', 'arxiv', 'huggingface-papers', 'openalex', 'crossref', 'semantic-scholar', 'google-scholar', 'hacker-news', 'x', 'linkedin', 'geeknews', 'endigest']);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        query: body.query,
        queryMode: body.queryMode,
        searchQuery: 'open RAN Gemma OR O-RAN automation OR agentic RAN operations',
        keywords: ['open RAN Gemma', 'O-RAN automation', 'agentic RAN operations'],
        searched: ['gdelt', 'google-news-rss', 'github-repositories', 'arxiv', 'huggingface-papers', 'openalex', 'crossref', 'semantic-scholar', 'google-scholar', 'hacker-news', 'x', 'linkedin', 'geeknews', 'endigest'],
        candidates: [
          { id: 'gnews-1', title: 'Open RAN Gemma operations update', url: 'https://news.example/oran-gemma', source: 'Example News', summary: 'Search result about Gemma and O-RAN operations.', publishedAt: '2026-04-14T08:00:00Z', score: 12, origin: 'live-search', thumbnail: '/assets/news/thumb-vran.svg' },
          { id: 'github-1', title: 'ran-lab/gemma-oran', url: 'https://github.com/ran-lab/gemma-oran', source: 'GitHub', summary: 'Repository signal from search.', publishedAt: '2026-04-14T09:00:00Z', score: 9, origin: 'live-search', thumbnail: '/assets/news/thumb-repo.svg' }
        ]
      })
    });
  });
  await page.route('/api/focused-issue', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.keywords).toEqual(['open RAN Gemma', 'O-RAN automation', 'agentic RAN operations']);
    expect(body.candidates.length).toBeGreaterThanOrEqual(2);
    expect(body.candidates[0].origin).toBe('live-search');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        keywords: ['open RAN', 'Gemma'],
        issue: {
          title: 'Open RAN + Gemma Brief — 2026-04-14',
          summary: 'Ranked source context ready for review.',
          markdown: `## Open RAN + Gemma\nRanked **source context** ready for review.\n\n${'verylongtoken'.repeat(80)}`
        },
        sources: [{ title: 'Open RAN accelerator stack', score: 8.5, url: 'https://example.test/oran', source: 'Example News', thumbnail: '/assets/news/thumb-vran.svg' }],
        warning: 'Gemma is not configured; rendered a source-backed fallback.'
      })
    });
  });

  await page.addInitScript(() => {
    window.__newsPrintDocuments = [];
    window.__newsPrintCalled = false;
    window.open = () => ({
      document: {
        open() {},
        write(html) { window.__newsPrintDocuments.push(String(html)); },
        close() {}
      },
      focus() {},
      print() { window.__newsPrintCalled = true; }
    });
  });

  await page.goto('/news/search/');
  await expect(page.locator('[data-focused-issue-lab]')).toBeVisible();
  await expect(page.locator('[data-blog-chat]')).toHaveCount(0);
  await expect(page.getByText('Gemma guide')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask Gemma' })).toHaveCount(0);
  await expect(page.locator('script[src^="/assets/blog-lab.mjs"]')).toHaveCount(1);
  await expect(page.getByRole('searchbox', { name: 'Search query' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Search query mode' })).toBeVisible();
  await expect(page.getByLabel('Exact keyword')).toBeChecked();
  await expect(page.getByLabel('Gemma 4 expand')).not.toBeChecked();
  await expect(page.getByRole('group', { name: 'News sources' })).toBeVisible();
  await expect(page.locator('.source-picker-group')).toHaveCount(4);
  await expect(page.locator('.source-picker-group[data-source-group="code"]')).toContainText('Code');
  await expect(page.locator('.source-picker-group[data-source-group="paper"]')).toContainText('Paper');
  await expect(page.locator('.source-picker-group[data-source-group="social"]')).toContainText('Social');
  await expect(page.locator('[data-source-group-action]')).toHaveCount(8);
  await page.locator('.source-picker-group[data-source-group="paper"] [data-source-group-action="clear"]').click();
  await expect(page.getByLabel('arXiv papers')).not.toBeChecked();
  await expect(page.getByLabel('Google Scholar link')).not.toBeChecked();
  await page.locator('.source-picker-group[data-source-group="paper"] [data-source-group-action="select"]').click();
  await expect(page.getByLabel('GDELT live web')).toBeChecked();
  await expect(page.getByLabel('Google News')).toBeChecked();
  await expect(page.getByLabel('GitHub repositories')).toBeChecked();
  await expect(page.getByLabel('arXiv papers')).toBeChecked();
  await expect(page.getByLabel('Hugging Face Papers')).toBeChecked();
  await expect(page.getByLabel('OpenAlex')).toBeChecked();
  await expect(page.getByLabel('Crossref')).toBeChecked();
  await expect(page.getByLabel('Semantic Scholar')).toBeChecked();
  await expect(page.getByLabel('Google Scholar link')).toBeChecked();
  await expect(page.getByLabel('Hacker News')).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'X', exact: true })).toBeChecked();
  await expect(page.getByLabel('LinkedIn')).toBeChecked();
  await expect(page.getByLabel('GeekNews')).toBeChecked();
  await expect(page.getByLabel('Endigest')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Search news' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft from selected news' })).toBeDisabled();
  await expect(page.locator('.news-command-strip span')).toHaveCount(4);
  await expect(page.locator('[data-news-signal-stack]')).toBeVisible();
  await expect(page.locator('[data-news-signal-stack] .signal-row')).toHaveCount(7);
  await expect(page.locator('[data-news-pretext-board]')).toHaveCount(0);
  await expect(page.getByText('RANKING LANES')).toHaveCount(0);
  const stackMotion = await page.locator('[data-news-signal-stack] .signal-row').first().evaluate((node) => getComputedStyle(node).animationName);
  expect(stackMotion).toContain('signal-row-drift');

  await page.getByRole('searchbox', { name: 'Search query' }).fill('open RAN Gemma');
  await page.getByLabel('Gemma 4 expand').check();
  const dateLayout = await page.getByLabel('Issue date').evaluate((node) => {
    const input = node.getBoundingClientRect();
    const field = node.closest('.issue-date-field')?.getBoundingClientRect();
    const form = node.closest('form')?.getBoundingClientRect();
    return {
      inputWidth: input.width,
      fieldWidth: field?.width || 0,
      formRight: form?.right || 0,
      inputRight: input.right,
      pageScroll: document.documentElement.scrollWidth,
      pageWidth: document.documentElement.clientWidth
    };
  });
  expect(dateLayout.inputWidth).toBeGreaterThanOrEqual(140);
  expect(dateLayout.inputWidth).toBeLessThanOrEqual(dateLayout.fieldWidth + 1);
  expect(dateLayout.inputRight).toBeLessThanOrEqual(dateLayout.formRight + 1);
  expect(dateLayout.pageScroll).toBeLessThanOrEqual(dateLayout.pageWidth + 1);
  await page.getByRole('button', { name: 'Search news' }).click();
  await expect(page.locator('[data-news-search-results]')).toContainText('Open RAN Gemma operations update');
  await expect(page.locator('[data-news-search-results] input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator('.news-source-radar')).toContainText('2 ranked candidates');
  await expect(page.locator('.news-candidate-toolbar')).toBeVisible();
  await page.getByRole('button', { name: 'Clear candidate selection' }).click();
  await expect(page.locator('[data-news-search-results] input[type="checkbox"]:checked')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Draft from selected news' })).toBeDisabled();
  await page.getByRole('button', { name: 'Select all candidates' }).click();
  await expect(page.locator('[data-news-search-results] input[type="checkbox"]:checked')).toHaveCount(2);
  await expect(page.locator('.news-candidate-rank').first()).toHaveText('01');
  await expect(page.locator('.news-candidate-meter')).toHaveCount(2);
  const candidateAnimation = await page.locator('.news-candidate-card').first().evaluate((node) => getComputedStyle(node).animationName);
  expect(candidateAnimation).toContain('candidate-rise');
  await expect(page.getByRole('button', { name: 'Draft from selected news' })).toBeEnabled();
  await page.getByRole('button', { name: 'Draft from selected news' }).click();
  await expect(page.locator('[data-focused-issue-status] .status-pulse')).toBeVisible();
  await expect(page.locator('[data-focused-issue-status]')).toContainText('Drafting selected sources');
  await expect(page.locator('[data-focused-issue-output]')).toContainText('Open RAN + Gemma Brief');
  await expect(page.locator('[data-focused-issue-output]')).toContainText('Gemma is not configured');
  await expect(page.locator('[data-focused-issue-output]')).toContainText('Open RAN accelerator stack');
  await expect(page.locator('[data-focused-issue-output] .generated-news-card')).toBeVisible();
  await expect(page.locator('[data-focused-issue-output] .generated-news-cover')).toBeVisible();
  await expect(page.locator('[data-focused-issue-output] .generated-news-metrics')).toContainText('sources');
  await expect(page.locator('[data-focused-issue-output] .generated-news-tape')).toContainText(/Example News/i);
  const draftAnimation = await page.locator('[data-focused-issue-output] .generated-news-card').evaluate((node) => getComputedStyle(node).animationName);
  expect(draftAnimation).toContain('generated-card-enter');
  await expect(page.locator('[data-focused-issue-output] strong').filter({ hasText: 'source context' })).toBeVisible();
  await expect(page.locator('[data-focused-issue-output] .generated-news-thumbnail')).toHaveCount(1);
  await expect(page.locator('[data-focused-issue-output] .generated-news-source')).toHaveCount(1);
  await expect(page.locator('[data-focused-issue-output] pre')).toHaveCount(0);
  await expect(page.locator('[data-overview-figure]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const printAudit = await page.evaluate(() => ({
    called: window.__newsPrintCalled,
    html: window.__newsPrintDocuments?.[0] || ''
  }));
  expect(printAudit.called).toBe(true);
  expect(printAudit.html).toContain('generated-news-print');
  expect(printAudit.html).toContain('news-digest-shell');
  expect(printAudit.html).toContain('Open RAN + Gemma Brief');
  expect(printAudit.html).toContain('Open RAN accelerator stack');
  expect(printAudit.html).not.toContain('%PDF-1.4');
  const draftLayout = await page.evaluate(() => ({
    outputScroll: document.querySelector('[data-focused-issue-output]')?.scrollWidth || 0,
    outputWidth: document.querySelector('[data-focused-issue-output]')?.clientWidth || 0,
    pageScroll: document.documentElement.scrollWidth,
    pageWidth: document.documentElement.clientWidth
  }));
  expect(draftLayout.outputScroll).toBeLessThanOrEqual(draftLayout.outputWidth + 1);
  expect(draftLayout.pageScroll).toBeLessThanOrEqual(draftLayout.pageWidth + 1);

  const html = await page.content();
  expect(html).not.toContain('GOOGLE_AI_API_KEY');
  expect(html).not.toContain('GEMINI_API_KEY');
});

