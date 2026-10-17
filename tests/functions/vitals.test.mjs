import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { onRequestPost } from '../../functions/api/vitals.js';

test('RUM preserves fractional CLS and rounds only millisecond metrics', () => {
  const sent = [];
  const sandbox = {
    window: {},
    document: { createElement: () => ({}), head: { appendChild() {} } },
    navigator: { userAgent: 'test', sendBeacon: (_url, body) => sent.push(JSON.parse(body)) },
    performance: { getEntriesByType: () => [] },
    location: { href: 'https://blog.test/' },
    Math,
    Date,
  };
  vm.runInNewContext(readFileSync('src/web-vitals-rum.js', 'utf8'), sandbox);
  sandbox.window.__mudReportWebVital({ name: 'CLS', value: 0.23, id: 'test-cls' });
  sandbox.window.__mudReportWebVital({ name: 'LCP', value: 1234.56, id: 'test-lcp' });
  assert.equal(sent[0].value, 0.23);
  assert.equal(sent[1].value, 1235);
});

function request(body) {
  return new Request('https://mud-blog.pages.dev/api/vitals', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('vitals endpoint accepts a bounded known metric without content', async () => {
  const originalInfo = console.info;
  const records = [];
  console.info = (record) => records.push(JSON.parse(record));
  try {
    const result = await onRequestPost({
      request: request({
        name: 'LCP',
        value: 1234,
        rating: 'good',
        id: 'v4-123',
        url: 'https://mud-blog.pages.dev/',
        ts: 1,
      }),
    });
    assert.equal(result.status, 204);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(records[0], {
      event: 'web-vital',
      name: 'LCP',
      value: 1234,
      rating: 'good',
      id: 'v4-123',
      url: 'https://mud-blog.pages.dev/',
      ts: 1,
    });
  } finally {
    console.info = originalInfo;
  }
});

test('vitals endpoint rejects malformed and unknown metrics', async () => {
  assert.equal((await onRequestPost({ request: request('not-json') })).status, 400);
  assert.equal(
    (
      await onRequestPost({
        request: request({ name: 'CUSTOM', value: 1, id: 'x' }),
      })
    ).status,
    400,
  );
});
