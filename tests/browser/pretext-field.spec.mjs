import { test, expect } from '@playwright/test';

const folders = ['projects', 'cfp'];
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

test('v3 personal homepage renders No-Hero Swiss Glass Dossier with Pretext bio, command palette, and dedicated routes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const archiveCount = await archivePostCount(page);
  expect(archiveCount).toBeGreaterThan(0);

  await expect(page.locator('html')).toHaveAttribute('data-runtime', 'tokio');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'index');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'v3-dossier');
  await expect(page.locator('body')).toHaveAttribute('data-palette', 'pair-07');
  await expect(page.locator('html')).not.toHaveAttribute('hx-boost', 'true');
  await expect(page.getByLabel('mud blog home')).toContainText('mud blog');
  await expect(page.locator('[data-theme-toggle]')).toBeVisible();
  await expect(page.locator('script[src="/assets/site-chrome.mjs"]')).toHaveCount(1);
  await expect(page.locator('script[src="/assets/pretext-stage.mjs"]')).toHaveCount(1);
  await expect(page.locator('script[src="/assets/blog-lab.mjs"]')).toHaveCount(0);
  await expect(page.locator('script[src="/assets/pretext-polish.mjs"]')).toHaveCount(0);
  await expect(page.locator('script[src="/assets/pretext-editorial.mjs"]')).toHaveCount(0);
  await expect(page.locator('script[src="/assets/pretext-field.mjs"]')).toHaveCount(0);

  // Functional @chenglou/pretext bio typography layout
  const bioWrap = page.locator('[data-pretext-bio-wrap]');
  await expect(bioWrap).toHaveAttribute('data-pretext-mode', 'active');
  await expect(bioWrap).toHaveAttribute('data-pretext-engine', 'chenglou-pretext');
  const initialLines = await page.locator('.v3-bio-line').count();
  expect(initialLines).toBeGreaterThanOrEqual(2);

  // No hero, research cluster, theme filter bar, or empty writing section
  await expect(page.locator('[data-research-cluster]')).toHaveCount(0);
  await expect(page.locator('[data-theme-filter-bar]')).toHaveCount(0);
  await expect(page.locator('#section-writing')).toHaveCount(0);

  // Calm personal-site sections: 2x2 Selected Work, minimal Publications (no Copy BibTeX on home), Affiliations strip
  await expect(page.locator('.v3-work-tile')).toHaveCount(4);
  await expect(page.locator('.v3-pub-row')).toHaveCount(3);
  await expect(page.locator('.v3-affil-item')).toHaveCount(3);
  await expect(page.locator('[data-copy-bibtex]')).toHaveCount(0);
  await expect(page.locator('a[href="/cv/jinhyuk-kim-cv.pdf"]')).toHaveCount(0);
  await page.locator('[data-cmd-open]').click();
  await expect(page.locator('[data-cmd-backdrop]')).toBeVisible();
  await page.locator('[data-cmd-input]').fill('MWC');
  await expect(page.locator('.v3-cmd-item').first()).toHaveAttribute('href', /mwc/i);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cmd-backdrop]')).toBeHidden();

  // Check no legacy/rejected copy or private phone number
  const visibleText = await page.evaluate(() => document.body.textContent || '');
  expect(visibleText).not.toMatch(/(?:\(\+82\)\s*)?0?10-\d{4}-\d{4}/);
  for (const copy of rejectedCopy) {
    expect(visibleText).not.toContain(copy);
  }

  const audit = await page.evaluate(() => {
    const css = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => rule.cssText);
        } catch (_error) {
          return [];
        }
      })
      .join('\n');
    return {
      hasDecorativeBackgroundPattern: /radial-gradient|repeating-linear-gradient|skewY|orbit|bubble|stripe/i.test(css),
      mentionsNeon: css.toLowerCase().includes('neon'),
      decorativeCount: document.querySelectorAll('.pretext-rain-stage,.pretext-loom-stage,.pretext-cat-sprite,[data-pretext-polish],[data-pretext-editorial]').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(audit.hasDecorativeBackgroundPattern).toBe(false);
  expect(audit.mentionsNeon).toBe(false);
  expect(audit.decorativeCount).toBe(0);
  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);

  // Dedicated /projects/ page
  await page.goto('/projects/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'projects');
  await expect(page.locator('[data-theme-filter-bar]')).toHaveCount(0);
  await expect(page.locator('.v3-project-card')).toHaveCount(4);

  // Dedicated /cv/ page
  await page.goto('/cv/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'cv');
  await expect(page.locator('#education')).toContainText('Yonsei University');
  await expect(page.locator('#experience')).toContainText('Singapore University of Technology and Design');
  await expect(page.locator('#publications .v3-work-card')).toHaveCount(3);
  const firstBibBtn = page.locator('[data-copy-bibtex]').first();
  await firstBibBtn.click();
  await expect(firstBibBtn).toContainText(/Copied BibTeX|BibTeX ready/);
  await expect(page.locator('a[href="/cv/jinhyuk-kim-cv.pdf"]')).toBeVisible();
  const cvText = await page.evaluate(() => document.body.textContent || '');
  expect(cvText).not.toMatch(/(?:\(\+82\)\s*)?0?10-\d{4}-\d{4}/);
  expect(cvText).not.toContain('Submitted to');
  await page.goto('/writing/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'writing');
  const writingCount = await page.locator('.post-card').count();
  expect(writingCount).toBeGreaterThan(0);
  await expect(page.locator('.filetree')).toHaveCount(1);
  await expect(page.locator('.filetree-folder')).toHaveCount(folders.length);
  await expect(page.locator('.filetree-file')).toHaveCount(writingCount);
  await expect(page.locator('details.filetree-folder[data-folder="news"]')).toHaveCount(0);
  await page.locator('details.filetree-folder[data-folder="projects"] > summary').click();
  await expect(page.locator('details.filetree-folder[data-folder="projects"]')).not.toHaveAttribute('open', '');
});

test('local preview serves focused issue API and a dedicated news page', async ({ page, request }) => {
  const api = await request.post('/api/focused-issue', {
    data: { date: '2026-04-14', keywords: 'open RAN, Gemma', limit: 4 },
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
  await expect(page.locator('.site-header nav a[href="/news/"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('a[href="/news/search/"]').first()).toBeVisible();
  await expect(page.locator('[data-focused-issue-lab]')).toHaveCount(0);
  await expect(page.locator('[data-news-visual-summary] svg.news-visual-svg')).toHaveCount(2);
  const newsVisualBox = await page.locator('[data-news-visual-summary] svg.news-visual-svg').first().boundingBox();
  expect(newsVisualBox?.width ?? 0).toBeGreaterThan(200);
  await expect(page.locator('[data-news-featured] .news-feature-card')).toHaveCount(1);
  await expect(page.locator('[data-news-featured] .news-feature-thumb')).toHaveCount(1);
  const newsIssues = await page.locator('[data-news-monthly-archive] .news-month-link').count();
  await expect(page.locator('[data-news-recent] .news-row')).toHaveCount(Math.min(7, Math.max(0, newsIssues - 1)));
  await expect(page.locator('[data-news-monthly-archive] .news-month-link')).toHaveCount(newsIssues);
  await expect(page.locator('[data-news-utility]')).toContainText('latest.json');
  await expect(page.locator('[data-news-digest-json]')).toHaveCount(0);
  await expect(page.locator('[data-news-featured] .news-feature-card strong')).toContainText('Brief');
  await page.goto('/news/search/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'news-search');
  await expect(page.locator('.site-header nav a[href="/news/"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-focused-issue-lab]')).toBeVisible();
  await expect(page.getByText('AI-assisted expansion', { exact: true })).toBeVisible();
  await expect(page.getByText('Gemma 4', { exact: false })).toHaveCount(0);
  await expect(page.locator('[data-overview-figure]')).toHaveCount(0);
});

test('mobile news digest keeps every paper title visible without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/news/');
  const latestHref = await page.locator('[data-news-featured] a.news-feature-card').first().getAttribute('href');
  expect(latestHref).toMatch(/^\/posts\/\d{4}-\d{2}-\d{2}-ai-news-digest\/$/);
  await page.goto(latestHref);

  const audit = await page.evaluate(() => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const paperRows = [...document.querySelectorAll('.news-digest-compact-row--paper')];
    const paperTitles = paperRows.map((row) => row.querySelector('.news-digest-compact-copy > strong')?.textContent.trim() || '');
    const paperLeadTitles = [...document.querySelectorAll('.news-digest-lead-card--paper strong')];
    const repoRows = [...document.querySelectorAll('.news-digest-compact-row--repo')];
    return {
      visiblePaperRows: paperRows.filter(isVisible).length,
      visibleRepoRows: repoRows.filter(isVisible).length,
      paperTitles,
      visiblePaperLeadTitles: paperLeadTitles.filter(isVisible).map((title) => title.textContent.trim()),
      clampedPaperLeadTitles: paperLeadTitles.filter((title) => {
        if (!isVisible(title)) return false;
        const style = getComputedStyle(title);
        return style.webkitLineClamp && style.webkitLineClamp !== 'none' && style.webkitLineClamp !== 'unset';
      }).length,
      clampedPaperTitles: paperRows.filter((row) => {
        const title = row.querySelector('.news-digest-compact-copy > strong');
        if (!title || !isVisible(title)) return false;
        const style = getComputedStyle(title);
        return style.webkitLineClamp && style.webkitLineClamp !== 'none' && style.webkitLineClamp !== 'unset';
      }).length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  expect(audit.visiblePaperRows).toBeGreaterThanOrEqual(1);
  expect(audit.visibleRepoRows).toBeGreaterThanOrEqual(1);
  expect(audit.paperTitles.every((title) => title.length > 0)).toBe(true);
  expect(audit.paperTitles.some((title) => title.endsWith('…'))).toBe(false);
  expect(audit.visiblePaperLeadTitles.some((title) => title.endsWith('…'))).toBe(false);
  expect(audit.clampedPaperTitles).toBe(0);
  expect(audit.clampedPaperLeadTitles).toBe(0);
  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
});

test('theme follows the system default and persists toggled override across navigation, reload, and back', async ({ browser }) => {
  const darkContext = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 820 } });
  const darkPage = await darkContext.newPage();
  await darkPage.goto('/');
  await expect(darkPage.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', 'system-dark');
  await expect(darkPage.locator('[data-ran-stage]')).toBeVisible();
  await darkPage.locator('[data-ran-node="2"]').click();
  await expect(darkPage.locator('[data-ran-stage]')).toHaveAttribute('data-ran-phase', '2');
  await expect(darkPage.locator('[data-ran-node="2"]')).toHaveAttribute('data-active', 'true');

  let themeAudit = await darkPage.evaluate(() => {
    const style = getComputedStyle(document.body);
    return {
      htmlTheme: document.documentElement.dataset.theme || '',
      bg: style.backgroundColor,
      pressed: document.querySelector('[data-theme-toggle]')?.getAttribute('aria-pressed'),
      iconLabel: document.querySelector('[data-theme-toggle] .theme-toggle-label')?.textContent || '',
      saved: window.localStorage.getItem('mud-blog-theme'),
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
    iconLabel: document.querySelector('[data-theme-toggle] .theme-toggle-label')?.textContent || '',
  }));
  expect(themeAudit.saved).toBe('light');
  expect(themeAudit.iconLabel).toContain('Light');

  // Persists across reload and cross-page navigation
  await darkPage.reload();
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(darkPage.locator('[data-theme-toggle]')).toHaveAttribute('data-active-theme', 'light');

  await darkPage.locator('a[href="/posts/cfp-radar-system/"]').first().click();
  await darkPage.waitForURL('**/posts/cfp-radar-system/');
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'light');

  // Smart in-page back link returns to referring home page while keeping theme
  await darkPage.locator('a.back-link').click();
  await darkPage.waitForURL(/\/$/);
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(darkPage.locator('[data-pretext-bio-wrap]')).toHaveAttribute('data-pretext-mode', 'active');

  // Browser goBack / goForward preserves persisted theme
  await darkPage.goto('/projects/');
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await darkPage.goBack();
  await darkPage.waitForURL(/\/$/);
  await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await darkContext.close();
});

test('global blog chrome is glass over space black with an inverted light mode and no decorative patterns', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/news/search/');

  const auditTheme = async (
    selectors = ['.site-header nav a', '.focused-issue-lab', '.news-desk-grid', '.source-picker', '.news-command-strip span'],
  ) =>
    page.evaluate((selectorsToAudit) => {
      const css = [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules].map((rule) => rule.cssText);
          } catch (_error) {
            return [];
          }
        })
        .join('\n');
      const parseRgb = (value) =>
        (value.match(/rgba?\(([^)]+)\)/)?.[1] || '')
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
          backdrop: style ? style.backdropFilter || style.webkitBackdropFilter || '' : '',
          border: style?.borderColor || '',
        };
      });
      return {
        bodyRgb,
        hasPatterns: /radial-gradient|repeating-linear-gradient|skewY|orbit|bubble|stripe/i.test(css),
        hasSpaceTokens: css.includes('--space-bg') && css.includes('--glass-bg') && css.includes('--glass-blur'),
        glass,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    }, selectors);

  const dark = await auditTheme();
  expect(dark.bodyRgb.every((channel) => channel <= 22)).toBe(true);
  expect(dark.hasPatterns).toBe(false);
  expect(dark.hasSpaceTokens).toBe(true);
  expect(dark.glass.every((item) => item.present && item.backdrop.includes('blur'))).toBe(true);
  expect(dark.scrollWidth).toBeLessThanOrEqual(dark.clientWidth + 1);

  await page.goto('/');
  const homeDark = await auditTheme(['.site-header', '.v3-work-tile-live']);
  expect(homeDark.glass.every((item) => item.present && item.backdrop.includes('blur'))).toBe(true);
  expect(homeDark.hasPatterns).toBe(false);
  expect(homeDark.scrollWidth).toBeLessThanOrEqual(homeDark.clientWidth + 1);

  await page.goto('/writing/');
  const writingDark = await auditTheme(['.filetree', '.post-card']);
  expect(writingDark.glass.every((item) => item.present && item.backdrop.includes('blur'))).toBe(true);
  expect(writingDark.scrollWidth).toBeLessThanOrEqual(writingDark.clientWidth + 1);
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
      a: 1,
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
      ['pipeline chip', '.news-command-strip span', 4.5],
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

test('post pages keep typography and layout aligned with the article width', async ({ page }) => {
  await page.goto('/posts/mwc26-ai-ran-beamforming/');
  await expect(page.locator('html')).toHaveAttribute('data-askama-template', 'post');
  await expect(page.locator('body')).toHaveAttribute('data-layout', 'reader-post');
  await expect(page.getByRole('heading', { name: 'LLM-Based 5G Beamforming for AI-RAN' })).toBeVisible();
  await expect(page.locator('[data-blog-chat]')).toHaveCount(0);
  await expect(page.locator('script[src="/assets/blog-lab.mjs"]')).toHaveCount(0);

  const audit = await page.evaluate(() => {
    const article = document.querySelector('.post-reader')?.getBoundingClientRect();
    const backLink = document.querySelector('.back-link')?.getBoundingClientRect();
    const metadata = document.querySelector('.post-reader > .eyebrow')?.getBoundingClientRect();
    const images = [...document.querySelectorAll('.post-body img')].map((image) => image.getBoundingClientRect().width);
    const body = document.querySelector('.post-body');
    const bodyStyles = body ? getComputedStyle(body) : null;
    return {
      articleWidth: article?.width || 0,
      imageMax: images.length ? Math.max(...images) : 0,
      backBottom: backLink?.bottom || 0,
      metadataTop: metadata?.top || 0,
      lineHeight: bodyStyles ? Number.parseFloat(bodyStyles.lineHeight) : 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(audit.articleWidth).toBeGreaterThanOrEqual(780);
  expect(audit.articleWidth).toBeLessThanOrEqual(1320);
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
    const rects = (selector) =>
      [...document.querySelectorAll(selector)].map((node) => {
        const box = node.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
          text: node.textContent.trim(),
        };
      });
    const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const inside = (child, parent) => child && parent && child.left >= parent.left - 1 && child.right <= parent.right + 1;
    const query = rect('.query-mode-picker');
    const queryLegend = rect('.query-mode-picker legend');
    const queryLabels = rects('.query-mode-picker label');
    const sourcePicker = rect('.source-picker');
    const sourceGroups = rects('.source-picker-group');
    const sourceLabels = rects('.source-picker label');
    const sourceActionButtons = rects('.source-picker-group [data-source-group-action]');
    const actionButtons = rects('.draft-action-row button');
    const queryInput = document.querySelector('[name="query"]');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      queryLabelWidths: queryLabels.map((label) => label.width),
      queryLegendOverlaps: queryLabels.map((label) => overlaps(queryLegend, label)),
      queryLabelsInside: queryLabels.map((label) => inside(label, query)),
      sourceGroupWidths: sourceGroups.map((group) => group.width),
      sourceGroupsInside: sourceGroups.map((group) => inside(group, sourcePicker)),
      sourceLabelHeights: sourceLabels.map((label) => label.height),
      sourceActionHeights: sourceActionButtons.map((button) => button.height),
      queryInputFontSize: queryInput ? Number.parseFloat(getComputedStyle(queryInput).fontSize) : 0,
      actionButtonOverlaps: actionButtons.flatMap((button, index) => actionButtons.slice(index + 1).map((next) => overlaps(button, next))),
    };
  });
  expect(newsLayout.scrollWidth).toBeLessThanOrEqual(newsLayout.clientWidth + 1);
  expect(newsLayout.queryLabelWidths.every((width) => width >= 160)).toBe(true);
  expect(newsLayout.queryLegendOverlaps).toEqual([false, false]);
  expect(newsLayout.queryLabelsInside).toEqual([true, true]);
  expect(newsLayout.sourceGroupWidths.every((width) => width >= 160)).toBe(true);
  expect(newsLayout.sourceGroupsInside).toEqual([true, true, true, true]);
  expect(newsLayout.sourceLabelHeights.every((height) => height >= 44)).toBe(true);
  expect(newsLayout.sourceActionHeights.every((height) => height >= 44)).toBe(true);
  expect(newsLayout.queryInputFontSize).toBeGreaterThanOrEqual(16);
  expect(newsLayout.actionButtonOverlaps.every((value) => value === false)).toBe(true);

  await page.goto('/posts/mwc26-ai-ran-beamforming/');
  const postLayout = await page.evaluate(() => {
    const back = document.querySelector('.back-link')?.getBoundingClientRect();
    const metadata = document.querySelector('.post-reader > .eyebrow')?.getBoundingClientRect();
    const body = document.querySelector('.post-body');
    const bodyStyles = body ? getComputedStyle(body) : null;
    return {
      backBottom: back?.bottom || 0,
      metadataTop: metadata?.top || 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyFontSize: bodyStyles ? Number.parseFloat(bodyStyles.fontSize) : 0,
      bodyLineHeight: bodyStyles ? Number.parseFloat(bodyStyles.lineHeight) : 0,
    };
  });
  expect(postLayout.scrollWidth).toBeLessThanOrEqual(postLayout.clientWidth + 1);
  expect(postLayout.metadataTop).toBeGreaterThanOrEqual(postLayout.backBottom + 10);
  expect(postLayout.bodyFontSize).toBeGreaterThanOrEqual(17);
  expect(postLayout.bodyLineHeight).toBeGreaterThanOrEqual(30.5);
});

test('news page searches candidates before drafting an issue and does not expose keys or overflow text', async ({ page }) => {
  await page.route('/api/news-search', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.query).toContain('open RAN');
    expect(body.queryMode).toBe('gemma-expand');
    expect(body.sources).toEqual([
      'gdelt',
      'google-news-rss',
      'github-repositories',
      'arxiv',
      'huggingface-papers',
      'openalex',
      'crossref',
      'semantic-scholar',
      'google-scholar',
      'hacker-news',
      'x',
      'linkedin',
      'geeknews',
      'endigest',
    ]);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        query: body.query,
        queryMode: body.queryMode,
        searchQuery: 'open RAN Gemma OR O-RAN automation OR agentic RAN operations',
        keywords: ['open RAN Gemma', 'O-RAN automation', 'agentic RAN operations'],
        searched: [
          'gdelt',
          'google-news-rss',
          'github-repositories',
          'arxiv',
          'huggingface-papers',
          'openalex',
          'crossref',
          'semantic-scholar',
          'google-scholar',
          'hacker-news',
          'x',
          'linkedin',
          'geeknews',
          'endigest',
        ],
        candidates: [
          {
            id: 'gnews-1',
            title: 'Open RAN Gemma operations update',
            url: 'https://news.example/oran-gemma',
            source: 'Example News',
            summary: 'Search result about Gemma and O-RAN operations.',
            publishedAt: '2026-04-14T08:00:00Z',
            score: 12,
            origin: 'live-search',
            thumbnail: '/assets/news/thumb-vran.svg',
          },
          {
            id: 'github-1',
            title: 'ran-lab/gemma-oran',
            url: 'https://github.com/ran-lab/gemma-oran',
            source: 'GitHub',
            summary: 'Repository signal from search.',
            publishedAt: '2026-04-14T09:00:00Z',
            score: 9,
            origin: 'live-search',
            thumbnail: '/assets/news/thumb-repo.svg',
          },
        ],
      }),
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
          markdown: `## Open RAN + Gemma\nRanked **source context** ready for review.\n\n${'verylongtoken'.repeat(80)}`,
        },
        sources: [
          {
            title: 'Open RAN accelerator stack',
            score: 8.5,
            url: 'https://example.test/oran',
            source: 'Example News',
            thumbnail: '/assets/news/thumb-vran.svg',
          },
        ],
        warning: 'Gemma is not configured; rendered a source-backed fallback.',
      }),
    });
  });

  await page.addInitScript(() => {
    window.__newsPrintDocuments = [];
    window.__newsPrintCalled = false;
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
            window.__newsPrintDocuments.push(this.srcdoc);
            window.__newsPrintCalled = true;
          },
        };
      },
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
  await expect(page.getByLabel('AI-assisted expansion')).not.toBeChecked();
  await expect(page.getByRole('group', { name: 'News sources' })).toBeVisible();
  await expect(page.locator('.source-picker-group')).toHaveCount(4);
  await expect(page.locator('.source-picker-group[data-source-group="code"]')).toContainText('Code');
  await expect(page.locator('.source-picker-group[data-source-group="paper"]')).toContainText('Paper');
  await expect(page.locator('.source-picker-group[data-source-group="social"]')).toContainText('Social');
  await expect(page.locator('[data-source-group-action]')).toHaveCount(8);
  await page.locator('.source-picker-group[data-source-group="paper"] [data-source-group-action="clear"]').click();
  await expect(page.getByLabel('arXiv papers')).not.toBeChecked();
  await expect(page.getByLabel('Scholar link')).not.toBeChecked();
  await page.locator('.source-picker-group[data-source-group="paper"] [data-source-group-action="select"]').click();
  await expect(page.getByLabel('GDELT live web')).toBeChecked();
  await expect(page.getByLabel('Google News')).toBeChecked();
  await expect(page.getByLabel('GitHub repositories')).toBeChecked();
  await expect(page.getByLabel('arXiv papers')).toBeChecked();
  await expect(page.getByLabel('HF Papers')).toBeChecked();
  await expect(page.getByText('Hugging Face Papers')).toHaveCount(0);
  await expect(page.getByLabel('OpenAlex')).toBeChecked();
  await expect(page.getByLabel('Crossref')).toBeChecked();
  await expect(page.getByLabel('Semantic Scholar')).toBeChecked();
  await expect(page.getByLabel('Scholar link')).toBeChecked();
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
  const stackMotion = await page
    .locator('[data-news-signal-stack] .signal-row')
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);
  expect(stackMotion).toContain('signal-row-drift');

  await page.getByRole('searchbox', { name: 'Search query' }).fill('open RAN AI');
  await page.getByLabel('AI-assisted expansion').check();
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
      pageWidth: document.documentElement.clientWidth,
    };
  });
  expect(dateLayout.inputWidth).toBeGreaterThanOrEqual(140);
  expect(dateLayout.inputWidth).toBeLessThanOrEqual(dateLayout.fieldWidth + 1);
  expect(dateLayout.inputRight).toBeLessThanOrEqual(dateLayout.formRight + 1);
  expect(dateLayout.pageScroll).toBeLessThanOrEqual(dateLayout.pageWidth + 1);
  await page.getByRole('button', { name: 'Search news' }).click();
  await expect(page.locator('[data-news-search-results]')).toContainText('Open RAN Gemma operations update');
  await expect(page.locator('[data-news-search-results] input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator('.news-source-radar')).toContainText('2 source candidates');
  await expect(page.locator('.news-candidate-toolbar')).toBeVisible();
  await page.locator('.news-candidate-toolbar [data-candidate-action="clear-all"]').click();
  await expect(page.locator('[data-news-search-results] input[type="checkbox"]:checked')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Draft from selected news' })).toBeDisabled();
  await page.locator('.news-candidate-toolbar [data-candidate-action="select-all"]').click();
  await expect(page.locator('[data-news-search-results] input[type="checkbox"]:checked')).toHaveCount(2);
  await expect(page.locator('.news-candidate-rank')).toHaveCount(0);
  await expect(page.locator('[data-news-search-results]')).not.toContainText(/score \d/i);
  await expect(page.locator('.news-candidate-meter')).toHaveCount(2);
  const candidateAnimation = await page
    .locator('.news-candidate-card')
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);
  expect(candidateAnimation).toContain('candidate-rise');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNewsLayout = await page.evaluate(() => {
    const card = document.querySelector('.news-candidate-card');
    const thumb = document.querySelector('.news-candidate-thumbnail');
    const labels = [...document.querySelectorAll('.source-picker label')].map((node) => node.getBoundingClientRect());
    const cardBox = card?.getBoundingClientRect();
    const thumbBox = thumb?.getBoundingClientRect();
    return {
      pageScroll: document.documentElement.scrollWidth,
      pageWidth: document.documentElement.clientWidth,
      cardColumns: card ? getComputedStyle(card).gridTemplateColumns : '',
      cardRight: cardBox?.right || 0,
      viewportRight: document.documentElement.clientWidth,
      thumbWidth: Math.round(thumbBox?.width || 0),
      crampedSourceLabels: labels.filter((box) => box.width < 92).length,
    };
  });
  expect(mobileNewsLayout.pageScroll).toBeLessThanOrEqual(mobileNewsLayout.pageWidth + 1);
  expect(mobileNewsLayout.cardRight).toBeLessThanOrEqual(mobileNewsLayout.viewportRight + 1);
  expect(mobileNewsLayout.cardColumns).toContain('58px');
  expect(mobileNewsLayout.thumbWidth).toBeGreaterThanOrEqual(54);
  expect(mobileNewsLayout.crampedSourceLabels).toBe(0);
  await page.setViewportSize({ width: 1280, height: 900 });
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
  const draftAnimation = await page
    .locator('[data-focused-issue-output] .generated-news-card')
    .evaluate((node) => getComputedStyle(node).animationName);
  expect(draftAnimation).toContain('generated-card-enter');
  await expect(page.locator('[data-focused-issue-output] strong').filter({ hasText: 'source context' })).toBeVisible();
  await expect(page.locator('[data-news-search-results]')).not.toContainText(/score \d/i);
  await expect(page.locator('[data-focused-issue-output] .generated-news-thumbnail')).toHaveCount(1);
  await expect(page.locator('[data-focused-issue-output] .generated-news-source')).toHaveCount(1);
  await expect(page.locator('[data-focused-issue-output] pre')).toHaveCount(0);
  await expect(page.locator('[data-overview-figure]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__newsPrintCalled)).toBe(true);
  const printAudit = await page.evaluate(() => ({
    called: window.__newsPrintCalled,
    html: window.__newsPrintDocuments?.[0] || '',
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
    pageWidth: document.documentElement.clientWidth,
  }));
  expect(draftLayout.outputScroll).toBeLessThanOrEqual(draftLayout.outputWidth + 1);
  expect(draftLayout.pageScroll).toBeLessThanOrEqual(draftLayout.pageWidth + 1);

  const html = await page.content();
  expect(html).not.toContain('GOOGLE_AI_API_KEY');
  expect(html).not.toContain('GEMINI_API_KEY');
});
