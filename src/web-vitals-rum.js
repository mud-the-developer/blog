// Web Vitals RUM collector — lightweight, self-contained callback bridge.
// Sends LCP, INP, CLS, FCP, and TTFB to /api/vitals.

(function () {
  'use strict';

  const endpoint = '/api/vitals';
  const sampleRate = 1.0;

  window.__mudReportWebVital = function reportWebVital(metric) {
    if (!metric || Math.random() > sampleRate) return;
    const navigation = performance.getEntriesByType('navigation')[0];
    const body = JSON.stringify({
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
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

  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.js';
    const report = (metric) => window.__mudReportWebVital?.(metric);
    onCLS(report);
    onINP(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  `;
  document.head.appendChild(script);
})();
