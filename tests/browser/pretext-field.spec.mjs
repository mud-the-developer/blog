import { test, expect } from '@playwright/test';

const publicPostCount = 91;
const folders = ['news', 'blog', 'papers', 'about'];
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

test('homepage is a polished public filetree with subtle Pretext animation and no hero pane', async ({ page }) => {
  await page.goto('/');

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
  await expect(page.locator('details.filetree-folder[data-folder="news"]')).not.toHaveAttribute('open', '');
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

  await page.locator('details.filetree-folder[data-folder="news"] > summary').click();
  await expect(page.locator('details.filetree-folder[data-folder="news"]')).toHaveAttribute('open', '');
  await page.locator('details.filetree-folder[data-folder="blog"] > summary').click();
  await expect(page.locator('details.filetree-folder[data-folder="blog"]')).not.toHaveAttribute('open', '');

  await expect(page.getByRole('link', { name: /Jinhyuk Kim/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /About Jinhyuk/ })).toHaveCount(0);

  const visibleText = await page.evaluate(() => document.body.innerText);
  for (const copy of rejectedCopy) {
    expect(visibleText).not.toContain(copy);
  }

  await expect(page.locator('[data-field-stage]')).toHaveCount(0);
  await expect(page.locator('[data-archive-graph]')).toHaveCount(0);
  await expect(page.locator('.archive-graph-label')).toHaveCount(0);
  await expect(page.locator('.paper-grid')).toHaveCount(0);

  await expect(page.locator('[data-pretext-polish]')).toHaveAttribute('data-pretext-ready', 'true');
  const motion = await page.evaluate(() => {
    const tokens = [...document.querySelectorAll('.pretext-token')];
    const animated = tokens.filter((token) => {
      const style = getComputedStyle(token);
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });
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
    return {
      archiveCount: Array.isArray(archive) ? archive.length : 0,
      tokenCount: tokens.length,
      animatedCount: animated.length,
      filetreeWidth: document.querySelector('.filetree')?.getBoundingClientRect().width || 0,
      hasRadialGradient: css.includes('radial-gradient'),
      mentionsNeon: css.toLowerCase().includes('neon'),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(motion.archiveCount).toBe(publicPostCount);
  expect(motion.tokenCount).toBeGreaterThanOrEqual(10);
  expect(motion.animatedCount).toBeGreaterThanOrEqual(6);
  expect(motion.filetreeWidth).toBeLessThanOrEqual(860);
  expect(motion.hasRadialGradient).toBe(false);
  expect(motion.mentionsNeon).toBe(false);
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
  await expect(page.locator('[data-news-archive] .news-row')).toHaveCount(83);
  await expect(page.locator('[data-news-digest-json]')).toContainText('latest.json');
  await expect(page.getByText('AI News Brief — Jun 09')).toBeVisible();

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
    const images = [...document.querySelectorAll('.post-body img')].map((image) => image.getBoundingClientRect().width);
    const body = document.querySelector('.post-body');
    const bodyStyles = body ? getComputedStyle(body) : null;
    return {
      articleWidth: article?.width || 0,
      iframeWidth: iframe?.width || 0,
      linkGridWidth: linkGrid?.width || 0,
      imageMax: images.length ? Math.max(...images) : 0,
      lineHeight: bodyStyles ? Number.parseFloat(bodyStyles.lineHeight) : 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(audit.articleWidth).toBeLessThanOrEqual(820);
  expect(audit.iframeWidth).toBeLessThanOrEqual(audit.articleWidth + 1);
  expect(audit.linkGridWidth).toBeLessThanOrEqual(audit.articleWidth + 1);
  expect(audit.imageMax).toBeLessThanOrEqual(audit.articleWidth + 1);
  expect(audit.lineHeight).toBeGreaterThanOrEqual(30.8);
  expect(audit.lineHeight).toBeLessThanOrEqual(32.5);
  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
});

test('post fragment remains direct readable cards for safe replacement', async ({ page, request }) => {
  const response = await request.get('/fragments/posts');
  expect(response.ok()).toBe(true);
  const fragment = await response.text();
  expect(fragment).not.toContain('class="post-grid"');
  expect(fragment).not.toContain('data-askama-template="posts-fragment"');
  expect(fragment.trim().startsWith('<a class="post-card"')).toBe(true);
  expect(fragment).toContain('AI News Brief — Jun 09');
  expect(fragment).toContain('Jinhyuk Kim');
  expect(fragment).not.toContain('About Jinhyuk');
  expect(fragment).not.toContain('Pretext Kinetic Blog');

  await page.goto('/');
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
    expect(body.sources).toEqual(['google-news-rss', 'github-repositories', 'arxiv', 'google-scholar', 'huggingface-papers', 'x', 'linkedin', 'geeknews', 'endigest']);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        query: body.query,
        queryMode: body.queryMode,
        searchQuery: 'open RAN Gemma OR O-RAN automation OR agentic RAN operations',
        keywords: ['open RAN Gemma', 'O-RAN automation', 'agentic RAN operations'],
        searched: ['google-news-rss', 'github-repositories', 'arxiv', 'google-scholar', 'huggingface-papers', 'x', 'linkedin', 'geeknews', 'endigest'],
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
  await expect(page.getByLabel('Google News')).toBeChecked();
  await expect(page.getByLabel('GitHub repositories')).toBeChecked();
  await expect(page.getByLabel('arXiv papers')).toBeChecked();
  await expect(page.getByLabel('Google Scholar')).toBeChecked();
  await expect(page.getByLabel('Hugging Face Papers')).toBeChecked();
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
