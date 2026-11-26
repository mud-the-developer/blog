// Self-contained Web Vitals RUM collector using native PerformanceObserver APIs.
// Reports LCP, INP, CLS, FCP, and TTFB to /api/vitals with zero external CDN dependencies.

(function () {
  'use strict';

  const endpoint = '/api/vitals';
  const sampleRate = 1.0;

  function rateMetric(name, value) {
    const thresholds = {
      CLS: [0.1, 0.25],
      FCP: [1800, 3000],
      INP: [200, 500],
      LCP: [2500, 4000],
      TTFB: [800, 1800],
    };
    const limits = thresholds[name];
    if (!limits) return 'unknown';
    if (value <= limits[0]) return 'good';
    if (value <= limits[1]) return 'needs-improvement';
    return 'poor';
  }

  window.__mudReportWebVital = function reportWebVital(metric) {
    if (!metric || Math.random() > sampleRate) return;
    const navigation = performance.getEntriesByType('navigation')[0];
    const value = metric.name === 'CLS' ? metric.value : Math.round(metric.value);
    const body = JSON.stringify({
      name: metric.name,
      value,
      rating: metric.rating || rateMetric(metric.name, value),
      id: metric.id,
      delta: metric.delta,
      url: location.href,
      ua: navigator.userAgent,
      ts: Date.now(),
      navType: navigation?.type || 'unknown',
      connection: navigator.connection?.effectiveType || 'unknown',
    });
    navigator.sendBeacon(endpoint, body);
  };

  if (typeof PerformanceObserver !== 'function') return;

  const metricId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const reported = new Set();
  const emitOnce = (name, value) => {
    if (reported.has(name) || !Number.isFinite(value) || value < 0) return;
    reported.add(name);
    window.__mudReportWebVital({
      name,
      value,
      delta: value,
      id: metricId(name.toLowerCase()),
    });
  };

  const nav = performance.getEntriesByType('navigation')[0];
  if (nav && Number.isFinite(nav.responseStart) && nav.responseStart >= 0) {
    emitOnce('TTFB', nav.responseStart);
  }

  let latestLcp = 0;
  let clsTotal = 0;
  let maxInp = 0;

  const observeSafe = (options, handler) => {
    try {
      const observer = new PerformanceObserver((list) => handler(list.getEntries()));
      observer.observe(options);
      return observer;
    } catch {
      return null;
    }
  };

  observeSafe({ type: 'paint', buffered: true }, (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        emitOnce('FCP', entry.startTime);
      }
    }
  });

  observeSafe({ type: 'largest-contentful-paint', buffered: true }, (entries) => {
    const last = entries.at(-1);
    if (last && Number.isFinite(last.startTime)) {
      latestLcp = last.startTime;
    }
  });

  observeSafe({ type: 'layout-shift', buffered: true }, (entries) => {
    for (const entry of entries) {
      if (!entry.hadRecentInput && Number.isFinite(entry.value)) {
        clsTotal += entry.value;
      }
    }
  });

  observeSafe({ type: 'event', buffered: true, durationThreshold: 40 }, (entries) => {
    for (const entry of entries) {
      if (entry.interactionId && Number.isFinite(entry.duration)) {
        maxInp = Math.max(maxInp, entry.duration);
      }
    }
  });

  const flush = () => {
    if (latestLcp > 0) emitOnce('LCP', latestLcp);
    emitOnce('CLS', Number(clsTotal.toFixed(4)));
    if (maxInp > 0) emitOnce('INP', maxInp);
  };

  document.addEventListener?.('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener?.('pagehide', flush, { once: true });
})();
