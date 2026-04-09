(() => {
  const runtimeConfig =
    window.__BLOG_RUNTIME_CONFIG__ && typeof window.__BLOG_RUNTIME_CONFIG__ === 'object'
      ? window.__BLOG_RUNTIME_CONFIG__
      : {};

  const themeConfig =
    window.__BLOG_THEME__ && typeof window.__BLOG_THEME__ === 'object'
      ? window.__BLOG_THEME__
      : {
          storageKey: runtimeConfig.themeStorageKey || 'theme-preference',
          colors: {
            light: '#F5F1E8',
            dark: '#111318',
          },
        };

  const THEME_ICONS = {
    dark: '<svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"></path></svg><span class="sr-only">Switch to dark mode</span>',
    light:
      '<svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.2"></path><path d="M12 19.8V22"></path><path d="M4.9 4.9 6.5 6.5"></path><path d="M17.5 17.5 19.1 19.1"></path><path d="M2 12h2.2"></path><path d="M19.8 12H22"></path><path d="M4.9 19.1 6.5 17.5"></path><path d="M17.5 6.5 19.1 4.9"></path></svg><span class="sr-only">Switch to light mode</span>',
  };

  const noteBody = document.querySelector('.note-body');
  const themeToggle = document.getElementById('theme-mode-toggle');
  const themeColorMeta = document.getElementById('theme-color-meta');
  const mediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  let explicitTheme = readStoredTheme();

  init();

  function init() {
    applyResolvedTheme(resolveTheme(), explicitTheme ? 'explicit' : 'system');
    syncThemeToggle();
    bindThemeToggle();
    bindSystemThemeListener();
    initPageTabsState();
    initLazyFeatures();
  }

  function readStoredTheme() {
    try {
      const value = localStorage.getItem(themeConfig.storageKey);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      if (theme === 'light' || theme === 'dark') {
        localStorage.setItem(themeConfig.storageKey, theme);
      } else {
        localStorage.removeItem(themeConfig.storageKey);
      }
    } catch (_error) {}
  }

  function resolveTheme() {
    if (explicitTheme === 'light' || explicitTheme === 'dark') {
      return explicitTheme;
    }

    return mediaQuery?.matches ? 'dark' : 'light';
  }

  function applyResolvedTheme(theme, mode) {
    const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
    const themeMode = mode === 'explicit' ? 'explicit' : 'system';
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-mode', themeMode);
    document.documentElement.style.colorScheme = resolvedTheme;

    if (themeColorMeta instanceof HTMLMetaElement) {
      themeColorMeta.content =
        themeConfig.colors?.[resolvedTheme] || themeConfig.colors?.light || '#F5F1E8';
    }
  }

  function syncThemeToggle() {
    if (!(themeToggle instanceof HTMLButtonElement)) return;

    const resolvedTheme = resolveTheme();
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const label = nextTheme === 'dark' ? 'Switch to dark mode' : 'Switch to light mode';

    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
    themeToggle.setAttribute('data-theme-next', nextTheme);
    themeToggle.innerHTML = THEME_ICONS[nextTheme];
  }

  function bindThemeToggle() {
    if (!(themeToggle instanceof HTMLButtonElement)) return;

    themeToggle.addEventListener('click', () => {
      const current = resolveTheme();
      explicitTheme = current === 'dark' ? 'light' : 'dark';
      writeStoredTheme(explicitTheme);
      applyResolvedTheme(explicitTheme, 'explicit');
      syncThemeToggle();
    });
  }

  function bindSystemThemeListener() {
    if (!mediaQuery) return;

    const handler = () => {
      if (explicitTheme) return;
      applyResolvedTheme(resolveTheme(), 'system');
      syncThemeToggle();
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handler);
    }
  }

  function scheduleIdle(task) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 850 });
      return;
    }
    window.setTimeout(task, 120);
  }

  function loadScriptOnce(src) {
    const selector = `script[data-script-src="${src}"]`;
    if (document.querySelector(selector)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.defer = true;
      script.src = src;
      script.setAttribute('data-script-src', src);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function lazyLoadOnIntent(element, task, delay = 0) {
    let triggered = false;
    const run = () => {
      if (triggered) return;
      triggered = true;
      task();
    };

    element.addEventListener('pointerenter', run, { once: true });
    element.addEventListener('focusin', run, { once: true });

    if (typeof window.IntersectionObserver === 'function') {
      const observer = new window.IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
            observer.disconnect();
            run();
          }
        },
        { rootMargin: '200px 0px' },
      );
      observer.observe(element);
    }

    const onLoad = () => {
      const timeout = typeof delay === 'number' ? delay : 0;
      window.setTimeout(() => scheduleIdle(run), timeout);
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }
  }

  function createGraphStageGuard({ stageId, nodeLayerId, statusId, loadingText, delayedText }) {
    const stage = document.getElementById(stageId || '');
    const nodeLayer = document.getElementById(nodeLayerId || '');
    const status = document.getElementById(statusId || '');

    if (
      !(stage instanceof Element && nodeLayer instanceof Element && status instanceof HTMLElement)
    ) {
      return { markUnavailable() {} };
    }

    let resolved = false;
    let delayedTimer = 0;
    let observer = null;

    const showStatus = (kind, text) => {
      status.hidden = false;
      status.classList.toggle('is-loading', kind === 'loading');
      status.classList.toggle('is-delayed', kind === 'delayed');
      status.classList.toggle('is-error', kind === 'error');
      status.textContent = text;
    };

    const resolve = () => {
      if (resolved) return;
      resolved = true;
      stage.classList.remove('is-loading');
      stage.removeAttribute('aria-busy');
      status.hidden = true;
      window.clearTimeout(delayedTimer);
      observer?.disconnect();
    };

    stage.classList.add('is-loading');
    stage.setAttribute('aria-busy', 'true');
    showStatus('loading', loadingText || 'Loading graph...');

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => {
        if (nodeLayer.childElementCount > 0) {
          resolve();
        }
      });
      observer.observe(nodeLayer, { childList: true });
    }

    delayedTimer = window.setTimeout(() => {
      if (resolved || nodeLayer.childElementCount > 0) {
        resolve();
      } else {
        showStatus('delayed', delayedText || 'Still loading graph data...');
      }
    }, 4200);

    return {
      markUnavailable(message) {
        if (resolved) return;
        stage.classList.remove('is-loading');
        stage.removeAttribute('aria-busy');
        window.clearTimeout(delayedTimer);
        observer?.disconnect();
        showStatus('error', message || 'Graph preview is unavailable right now.');
      },
    };
  }

  function initPageTabsState() {
    const details = document.getElementById('page-tabs-details');
    if (!(details instanceof HTMLDetailsElement)) return;

    const storageKey = 'note-page-tabs-open';
    try {
      const value = localStorage.getItem(storageKey);
      if (value === '1') details.open = true;
      if (value === '0') details.open = false;
    } catch (_error) {}

    details.addEventListener('toggle', () => {
      try {
        localStorage.setItem(storageKey, details.open ? '1' : '0');
      } catch (_error) {}
    });
  }

  function initLazyFeatures() {
    const filetreeRoot = document.getElementById('filetree-root');
    if (filetreeRoot && !window.matchMedia?.('(pointer: coarse)').matches) {
      lazyLoadOnIntent(
        filetreeRoot,
        async () => {
          try {
            await loadScriptOnce('/assets/filetree.min.js');
            window.initFileTree?.({
              containerId: 'filetree-root',
              dataUrl: '/filetree.json',
              scrollHostSelector: '.page-tabs-list',
            });
          } catch (_error) {}
        },
        900,
      );
    }

    if (document.querySelector('.toc-panel')) {
      scheduleIdle(async () => {
        try {
          await loadScriptOnce('/assets/toc-tracker.js');
          window.initTocTracker?.({ panelSelector: '.toc-panel' });
        } catch (_error) {}
      });
    }

    if (
      document.querySelector('.note-body a[href], .page-tabs-list a[href], #filetree-root a[href]')
    ) {
      scheduleIdle(async () => {
        try {
          await loadScriptOnce('/assets/link-preview.js');
          window.initLinkPreview?.({
            containerSelector: '.note-body, .page-tabs-list, #filetree-root',
            indexUrl: '/search-index.json',
          });
        } catch (_error) {}
      });
    }

    if (
      document.querySelector(
        '.note-body pre > code.language-mermaid, .note-body pre > code.lang-mermaid',
      )
    ) {
      scheduleIdle(() => {
        loadScriptOnce('/assets/mermaid-render.js').catch(() => {});
      });
    }

    if (noteBody && (noteBody.textContent || '').includes('$')) {
      scheduleIdle(() => {
        loadScriptOnce('/assets/math-render.js').catch(() => {});
      });
    }

    if (document.querySelector('.note-excalidraw-embed[data-excalidraw-src]')) {
      scheduleIdle(() => {
        loadScriptOnce('/assets/excalidraw-preview.js').catch(() => {});
      });
    }

    if (document.querySelector('.note-canvas-embed[data-canvas-src]')) {
      scheduleIdle(() => {
        loadScriptOnce('/assets/canvas-preview.js').catch(() => {});
      });
    }

    initGraphs();
  }

  function initGraphs() {
    const globalStage = document.getElementById('global-graph-stage');
    const sideStage = document.getElementById('side-graph-stage');
    const stage = globalStage || sideStage;
    const graphDataUrl =
      typeof runtimeConfig.graphDataUrl === 'string' && runtimeConfig.graphDataUrl.length > 0
        ? runtimeConfig.graphDataUrl
        : '/graph.json';
    const graphCenterId =
      typeof runtimeConfig.graphCenterId === 'string' ? runtimeConfig.graphCenterId : '';

    if (!stage) return;

    lazyLoadOnIntent(
      stage,
      async () => {
        const globalGuard = createGraphStageGuard({
          stageId: 'global-graph-stage',
          nodeLayerId: 'global-graph-node-layer',
          statusId: 'global-graph-status',
          loadingText: 'Loading graph map...',
          delayedText: 'Still loading graph map...',
        });
        const sideGuard = createGraphStageGuard({
          stageId: 'side-graph-stage',
          nodeLayerId: 'side-graph-node-layer',
          statusId: 'side-graph-status',
          loadingText: 'Loading graph preview...',
          delayedText: 'Still loading graph preview...',
        });

        try {
          await loadScriptOnce('/assets/graph-view.min.js');
          if (typeof window.initGraphView !== 'function') {
            globalGuard.markUnavailable('Graph module failed to initialize.');
            sideGuard.markUnavailable('Graph module failed to initialize.');
            return;
          }

          if (globalStage) {
            window.initGraphView({
              stageId: 'global-graph-stage',
              svgId: 'global-graph-svg',
              linkLayerId: 'global-graph-link-layer',
              nodeLayerId: 'global-graph-node-layer',
              detailId: 'global-graph-detail',
              zoomInButtonId: 'global-graph-zoom-in',
              zoomOutButtonId: 'global-graph-zoom-out',
              searchInputId: 'global-graph-search',
              resetButtonId: 'global-graph-reset',
              toggleButtonId: 'global-graph-toggle',
              dataUrl: '/graph.json',
              width: 1000,
              height: 640,
              idealDistance: 112,
              nodeRadius: 9,
              showLabels: true,
              labelFontSize: 12,
              freezeVelocity: 999999,
              freezeStableFrames: 1,
              emptyText: 'No graph data yet.',
            });
          }

          if (sideStage) {
            window.initGraphView({
              stageId: 'side-graph-stage',
              svgId: 'side-graph-svg',
              linkLayerId: 'side-graph-link-layer',
              nodeLayerId: 'side-graph-node-layer',
              detailId: 'side-graph-detail',
              zoomInButtonId: 'side-graph-zoom-in',
              zoomOutButtonId: 'side-graph-zoom-out',
              resetButtonId: 'side-graph-reset',
              dataUrl: graphDataUrl,
              fallbackDataUrl: '/graph.json',
              centerNodeId: graphCenterId,
              width: 540,
              height: 420,
              idealDistance: 88,
              nodeRadius: 7,
              showLabels: true,
              labelFontSize: 10,
              freezeVelocity: 999999,
              freezeStableFrames: 1,
              idleText: 'Hover a note to inspect its immediate context.',
              emptyText: 'No graph data yet.',
            });
          }
        } catch (_error) {
          globalGuard.markUnavailable('Graph panel is unavailable right now.');
          sideGuard.markUnavailable('Graph panel is unavailable right now.');
        }
      },
      320,
    );
  }
})();
