import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { safeUrl } from '../../src/safe-url.mjs';
import { readApiInput, requestLimit } from '../../functions/api/_request.js';
import { callGemma } from '../../functions/api/_shared.js';
import { onRequestPost as search } from '../../functions/api/news-search.js';
import { onRequestPost as draft } from '../../functions/api/focused-issue.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
let sequence = 0;
function request(body, headers = {}) {
  return new Request('https://blog.test/api/news-search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': `safety-${++sequence}`, ...headers },
    body: JSON.stringify(body),
  });
}
const env = { GOOGLE_AI_API_KEY: 'fake-review-key', GOOGLE_AI_MODEL: 'gemini-2.5-flash', GOOGLE_AI_FALLBACK_MODELS: 'gemini-2.5-flash' };

test('URLs allow only HTTP(S), anchors and root-relative paths', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '//evil.test',
    '/\\evil.test',
    'java\nscript:alert(1)',
    'https://user:password@host.test/',
    'file:///tmp/test',
  ])
    assert.equal(safeUrl(value), '', value);
  for (const value of ['https://example.test/paper?a=1&b=2', 'http://example.test/', '/posts/research/', '#section'])
    assert.equal(safeUrl(value), value);
  assert.equal(safeUrl('javascript:alert(1)', '/assets/fallback.svg'), '/assets/fallback.svg');
});

test('API rejects null, invalid fields and oversized bodies before model IO', async () => {
  globalThis.fetch = () => {
    throw new Error('No upstream call is allowed');
  };
  for (const handler of [search, draft]) {
    assert.equal((await handler({ request: request(null), env })).status, 400);
    assert.equal((await handler({ request: request({ keywords: ['x'.repeat(250000)] }), env })).status, 413);
  }
  for (const input of [
    { query: {} },
    { date: '2026-02-30' },
    { keywords: ['x'.repeat(161)] },
    { candidates: [{ categories: {} }] },
    { candidates: Array(13).fill({}) },
  ]) {
    const response = await readApiInput(request(input), 'draft');
    assert.equal(response.status, 400);
  }
  assert.equal((await readApiInput(request({}, { 'content-type': 'text/plain' }), 'draft')).status, 415);
});

test('streamed oversized input is capped even without Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(33000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request('https://blog.test/api/news-search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  });
  assert.equal((await readApiInput(req, 'search')).status, 413);
  assert.equal(cancelled, true);
});

test('rate window and cross-site checks bound bursts without calling upstream', () => {
  const req = request({}, { 'cf-connecting-ip': 'rate-fixture' });
  for (let index = 0; index < 6; index += 1) assert.equal(requestLimit(req, 'draft', 1000), null);
  assert.equal(requestLimit(req, 'draft', 1000).status, 429);
  assert.equal(requestLimit(req, 'draft', 61000), null);
  assert.equal(requestLimit(request({}, { origin: 'https://elsewhere.test' }), 'search').status, 403);
});

test('duplicate source IDs fetch once and expansion cache hits do not call a model', async () => {
  let models = 0;
  let providers = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      models += 1;
      return Response.json({
        candidates: [{ content: { parts: [{ text: '{"keywords":["safety-cache-query"],"searchQuery":"safety-cache-query"}' }] } }],
      });
    }
    providers += 1;
    return Response.json({ items: [] });
  };
  const body = { query: 'safety-cache-query', queryMode: 'gemma-expand', sources: Array(100).fill('github-repositories') };
  await search({ request: request(body), env });
  const result = await (await search({ request: request(body), env })).json();
  assert.equal(result.cacheStatus, 'hit');
  assert.equal(models, 1);
  assert.equal(providers, 1);
  assert.deepEqual(result.searched, ['github-repositories']);
});

test('expanded search keywords fit the subsequent draft request schema', async () => {
  globalThis.fetch = async (url) =>
    String(url).includes('generativelanguage.googleapis.com')
      ? Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      keywords: Array.from({ length: 8 }, (_, index) => `related topic ${index}`),
                      searchQuery: 'keyword-schema-fixture',
                    }),
                  },
                ],
              },
            },
          ],
        })
      : Response.json({ items: [] });
  const response = await search({
    request: request({ query: 'keyword-schema-fixture', queryMode: 'gemma-expand', sources: ['github-repositories'] }),
    env,
  });
  const result = await response.json();
  assert.equal(result.keywords.length, 6);
  const input = await readApiInput(
    request({ keywords: result.keywords, date: '', candidates: [{ title: 'Source', url: 'https://example.test/' }] }),
    'draft',
  );
  assert(!(input instanceof Response));
});

test('model transport and malformed responses fall back without disclosing credentials', async () => {
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    assert(options.signal instanceof AbortSignal);
    if (++calls === 1) throw new Error('transport error including fake-review-key');
    if (calls === 2) return new Response('invalid-json');
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"title":"Recovered"}' }] } }] });
  };
  const result = await callGemma({ ...env, GOOGLE_AI_FALLBACK_MODELS: 'gemma-4-31b-it,gemini-2.5-flash-lite' }, { task: 'fixture' });
  assert.equal(calls, 3);
  assert.equal(result.usedGemma, true);
  assert(!JSON.stringify(result).includes('fake-review-key'));
});

test('model timeout aborts the request and returns a safe fallback result', async () => {
  const set = globalThis.setTimeout;
  const clear = globalThis.clearTimeout;
  try {
    globalThis.setTimeout = (callback) => {
      queueMicrotask(callback);
      return 1;
    };
    globalThis.clearTimeout = () => {};
    globalThis.fetch = (_url, options) =>
      new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError'))));
    const result = await callGemma(env, { task: 'fixture' });
    assert.equal(result.usedGemma, false);
    assert.match(result.error, /timeout/);
    assert(!result.error.includes('fake-review-key'));
  } finally {
    globalThis.setTimeout = set;
    globalThis.clearTimeout = clear;
  }
});
