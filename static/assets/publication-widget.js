(() => {
  const WIDGET_SELECTOR = '.profile-publication-widget[data-widget-base]';
  const RESOLVED_SRC_ATTR = 'data-widget-resolved-src';
  let resizeTimer = 0;

  function allWidgets() {
    return Array.from(document.querySelectorAll(WIDGET_SELECTOR));
  }

  function widgetHeight(widget) {
    const host = widget.parentElement || widget;
    const rect = host.getBoundingClientRect();
    const width = rect?.width || host.clientWidth || window.innerWidth || 960;
    const portrait =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(orientation: portrait)').matches
        : (window.innerHeight || 0) > (window.innerWidth || 0);

    if (width <= 430) return portrait ? 620 : 540;
    if (width <= 620) return portrait ? 560 : 500;
    if (width <= 820) return portrait ? 500 : 460;
    return 420;
  }

  function resolvedTheme(widget) {
    const currentTheme =
      document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const lightTheme = widget.getAttribute('data-theme-light') || 'light';
    const darkTheme = widget.getAttribute('data-theme-dark') || 'dark';
    return currentTheme === 'dark' ? darkTheme : lightTheme;
  }

  function buildWidgetUrl(widget, height) {
    const base = widget.getAttribute('data-widget-base') || widget.getAttribute('src') || '';
    if (!base) return '';

    let url;
    try {
      url = new URL(base, window.location.origin);
    } catch {
      return '';
    }

    url.searchParams.set('theme', resolvedTheme(widget));
    url.searchParams.set('width', '100%');
    url.searchParams.set('height', `${height}px`);
    return url.toString();
  }

  function syncWidget(widget) {
    const height = widgetHeight(widget);
    const url = buildWidgetUrl(widget, height);
    if (!url) return;

    widget.style.height = `${height}px`;
    widget.style.minHeight = `${Math.max(360, height - 40)}px`;

    if (widget.getAttribute(RESOLVED_SRC_ATTR) !== url) {
      widget.setAttribute(RESOLVED_SRC_ATTR, url);
      widget.src = url;
    }
  }

  function syncAllWidgets() {
    const widgets = allWidgets();
    if (widgets.length === 0) return;
    widgets.forEach(syncWidget);
  }

  function scheduleSync() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(syncAllWidgets, 120);
  }

  function watchThemeChanges() {
    if (typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === 'data-theme')) {
        scheduleSync();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  function watchResizes() {
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(scheduleSync);
      allWidgets().forEach((widget) => {
        observer.observe(widget.parentElement || widget);
      });
    }

    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('orientationchange', scheduleSync);
  }

  function boot() {
    if (!document.querySelector(WIDGET_SELECTOR)) return;
    syncAllWidgets();
    watchThemeChanges();
    watchResizes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
