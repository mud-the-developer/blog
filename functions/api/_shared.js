export function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {})
    }
  });
}

export function apiKeyFromEnv(env = {}) {
  return env.GOOGLE_AI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_API_KEY || '';
}

export function modelNameFromEnv(env = {}) {
  const raw = String(env.GOOGLE_AI_MODEL || 'models/gemma-4-31b-it').trim();
  return raw.startsWith('models/') ? raw : `models/${raw}`;
}

export function normalizeKeywords(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(/[,;]/);
  const seen = new Set();
  const keywords = [];
  for (const raw of parts) {
    const keyword = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords.slice(0, 6);
}

export function sanitizeText(value, max = 6000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function readJsonAsset(env, url, path, fallback) {
  if (!env?.ASSETS?.fetch) return fallback;
  try {
    const assetUrl = new URL(path, url);
    const response = await env.ASSETS.fetch(new Request(assetUrl));
    if (!response.ok) return fallback;
    return await response.json();
  } catch (_error) {
    return fallback;
  }
}

export async function callGemma(env, payload) {
  const apiKey = apiKeyFromEnv(env);
  if (!apiKey) {
    return { text: '', usedGemma: false, missingKey: true };
  }
  const model = modelNameFromEnv(env);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(payload, null, 2) }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 2400
      }
    })
  });
  if (!response.ok) {
    return { text: '', usedGemma: true, error: `Gemma request failed: ${response.status}` };
  }
  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';
  return { text, usedGemma: true };
}

export function parseMaybeJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const objectCandidate = candidate.includes('{') && candidate.includes('}')
    ? candidate.slice(candidate.indexOf('{'), candidate.lastIndexOf('}') + 1)
    : candidate;
  try {
    return JSON.parse(objectCandidate);
  } catch (_error) {
    return null;
  }
}
