import { jsonResponse } from './_shared.js';

const MAX_BYTES = 32 * 1024;
const REQUEST_WINDOWS = new Map();

export function requestLimit(request, kind, now = Date.now()) {
  const origin = request.headers.get('origin');
  let requestOrigin;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request URL.' }, { status: 400 });
  }
  if ((origin && origin !== requestOrigin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return jsonResponse({ ok: false, error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }
  // shortcut: per-isolate burst protection; configure Cloudflare WAF limits for distributed enforcement.
  for (const [key, window] of REQUEST_WINDOWS) if (window.until <= now) REQUEST_WINDOWS.delete(key);
  const key = `${kind}:${(request.headers.get('cf-connecting-ip') || 'anonymous').slice(0, 128)}`;
  const window = REQUEST_WINDOWS.get(key) || { count: 0, until: now + 60_000 };
  if (window.count >= (kind === 'draft' ? 6 : 20) || (!REQUEST_WINDOWS.has(key) && REQUEST_WINDOWS.size >= 1024)) {
    return jsonResponse(
      { ok: false, error: 'Too many requests. Try again in a minute.' },
      { status: 429, headers: { 'retry-after': '60' } },
    );
  }
  window.count += 1;
  REQUEST_WINDOWS.set(key, window);
  return null;
}

function validText(value, max) {
  return value === undefined || (typeof value === 'string' && value.length <= max);
}

function validWords(value, maxItems, maxLength) {
  return (
    value === undefined ||
    (Array.isArray(value) && value.length <= maxItems && value.every((item) => typeof item === 'string' && item.length <= maxLength))
  );
}

function validCandidate(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const limits = {
    title: 360,
    name: 360,
    summary: 2000,
    description: 2000,
    excerpt: 2000,
    url: 2048,
    link: 2048,
    thumbnail: 2048,
    image_url: 2048,
    imageUrl: 2048,
    source: 160,
    domain: 160,
    publishedAt: 80,
    date: 80,
    origin: 80,
    type: 80,
  };
  return (
    Object.entries(limits).every(([key, max]) => validText(item[key], max)) &&
    validWords(item.tags, 16, 80) &&
    validWords(item.categories, 16, 80) &&
    (item.score === undefined || (typeof item.score === 'number' && Number.isFinite(item.score)))
  );
}

export async function readApiInput(request, kind) {
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    return jsonResponse({ ok: false, error: 'Content-Type must be application/json.' }, { status: 415 });
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES)
    return jsonResponse({ ok: false, error: 'Request body is too large.' }, { status: 413 });
  if (!request.body) return jsonResponse({ ok: false, error: 'Expected a JSON object.' }, { status: 400 });
  const reader = request.body.getReader();
  let input;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let text = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return jsonResponse({ ok: false, error: 'Request body is too large.' }, { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(text + decoder.decode());
  } catch {
    return jsonResponse({ ok: false, error: 'Expected a valid JSON object.' }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return jsonResponse({ ok: false, error: 'Expected a JSON object.' }, { status: 400 });
  const keywords = (value) => validText(value, 960) || validWords(value, 6, 160);
  const validDate =
    input.date === undefined ||
    input.date === '' ||
    (typeof input.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
      Number.isFinite(Date.parse(input.date)) &&
      new Date(input.date).toISOString().slice(0, 10) === input.date);
  const candidates = input.candidates ?? (kind === 'draft' ? input.sources : undefined);
  if (
    !validText(input.query, 160) ||
    !keywords(input.keywords) ||
    !keywords(input.keyword) ||
    !validText(input.queryMode, 32) ||
    !validText(input.searchMode, 32) ||
    !validDate ||
    (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 15)) ||
    (kind === 'search' && !validWords(input.sources, 128, 80)) ||
    (candidates !== undefined && (!Array.isArray(candidates) || candidates.length > 12 || !candidates.every(validCandidate)))
  ) {
    return jsonResponse({ ok: false, error: 'Invalid or oversized request fields.' }, { status: 400 });
  }
  return input;
}
