// Web Vitals RUM collector - light-weight, zero-dependency
// Sends LCP, INP, CLS to /api/vitals endpoint (to be implemented on Cloudflare Workers/Pages Functions)
// Sample rate: 100% (adjust via sampleRate below)

(function () {
  'use strict';

  const endpoint = '/api/vitals';
  const sampleRate = 1.0; // 100% - adjust down for high-traffic sites
  const debug = false;

  function log(...args) {
    if (debug) console.log('[web-vitals]', ...args);
  }

  function sendMetric(name, value, rating, id, delta) {
    if (Math.random() > sampleRate) return;
    const body = JSON.stringify({
      name,
      value: Math.round(value),
      rating,
      id,
      delta,
      url: location.href,
      ua: navigator.userAgent,
      ts: Date.now(),
      navType: performance.navigation?.type || 'unknown',
      connection: navigator.connection?.effectiveType || 'unknown',
    });
    navigator.sendBeacon(endpoint, body);
    log('sent', name, value, rating);
  }

  function onCLS(metric) {
    sendMetric('CLS', metric.value, metric.rating, metric.id, metric.delta);
  }
  function onINP(metric) {
    sendMetric('INP', metric.value, metric.rating, metric.id, metric.delta);
  }
  function onLCP(metric) {
    sendMetric('LCP', metric.value, metric.rating, metric.id, metric.delta);
  }
  function onFCP(metric) {
    sendMetric('FCP', metric.value, metric.rating, metric.id, metric.delta);
  }
  function onTTFB(metric) {
    sendMetric('TTFB', metric.value, metric.rating, metric.id, metric.delta);
  }

  // Load web-vitals from CDN (ESM)
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.js';
    onCLS(${onCLS.toString()});
    onINP(${onINP.toString()});
    onLCP(${onLCP.toString()});
    onFCP(${onFCP.toString()});
    onTTFB(${onTTFB.toString()});
  `;
  document.head.appendChild(script);
  log('web-vitals loader injected');
})();