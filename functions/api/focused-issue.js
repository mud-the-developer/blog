import { callGemma, jsonResponse, normalizeKeywords, readJsonAsset } from './_shared.js';
import { runFocusedIssueMachine } from './focused-issue-machine.js';

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: 'Expected a JSON request body.' }, { status: 400 });
  }

  const keywords = normalizeKeywords(input.keywords || input.keyword);
  if (!keywords.length) {
    return jsonResponse({ ok: false, error: 'At least one keyword is required.' }, { status: 400 });
  }

  const result = await runFocusedIssueMachine({
    request: { ...input, keywords },
    effects: {
      async readContextAssets() {
        const archive = await readJsonAsset(env, request.url, '/archive.json', []);
        const feed = await readJsonAsset(env, request.url, '/news/data/latest.json', { all: [] });
        return { archive, feed };
      },
      async callGemma(payload) {
        return callGemma(env, payload);
      }
    }
  });

  return jsonResponse(result);
}
