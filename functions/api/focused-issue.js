import { callGemma, jsonResponse, normalizeKeywords, readJsonAsset } from './_shared.js';
import { runFocusedIssueMachine } from './focused-issue-machine.js';
import { readApiInput, requestLimit } from './_request.js';

export async function onRequestPost({ request, env }) {
  const limited = requestLimit(request, 'draft');
  if (limited) return limited;
  const input = await readApiInput(request, 'draft');
  if (input instanceof Response) return input;

  const keywords = normalizeKeywords(input.keywords || input.keyword);
  if (!keywords.length) {
    return jsonResponse({ ok: false, error: 'At least one keyword is required.' }, { status: 400 });
  }

  const result = await runFocusedIssueMachine({
    request: { ...input, keywords, nowMs: Date.now() },
    effects: {
      async readContextAssets() {
        const archive = await readJsonAsset(env, request.url, '/archive.json', []);
        const feed = await readJsonAsset(env, request.url, '/news/data/latest.json', { all: [] });
        return { archive, feed };
      },
      async callGemma(payload) {
        return callGemma(env, payload);
      },
    },
  });

  return jsonResponse(result);
}
