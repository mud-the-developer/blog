import { callGemma, jsonResponse, normalizeKeywords, parseMaybeJson, readJsonAsset, sanitizeText } from './_shared.js';

function itemText(item) {
  return [item.title, item.summary, item.description, item.excerpt, item.source, ...(item.categories || []), ...(item.tags || [])]
    .map((value) => String(value || ''))
    .join(' ')
    .toLowerCase();
}

function scoreItem(item, keywords) {
  const haystack = itemText(item);
  let score = 0;
  for (const keyword of keywords) {
    const key = keyword.toLowerCase();
    if (!key) continue;
    if (haystack.includes(key)) score += 5;
    for (const token of key.split(/\s+/)) {
      if (token.length > 2 && haystack.includes(token)) score += 1.5;
    }
  }
  const date = Date.parse(item.publishedAt || item.date || '');
  if (Number.isFinite(date)) {
    score += Math.max(0, 2 - (Date.now() - date) / 86_400_000 / 14);
  }
  if (item.url) score += 0.5;
  return Number(score.toFixed(3));
}

function thumbnailForSource(item = {}) {
  const text = [item.source, item.type, item.url, ...(item.categories || []), ...(item.tags || [])].join(' ').toLowerCase();
  if (text.includes('github') || text.includes('repo')) return '/assets/news/thumb-repo.svg';
  if (text.includes('arxiv') || text.includes('paper') || text.includes('huggingface')) return '/assets/news/thumb-paper.svg';
  if (text.includes('ran') || text.includes('vran') || text.includes('o-ran')) return '/assets/news/thumb-vran.svg';
  return '/assets/news/thumb-ai.svg';
}

function normalizeSourceItem(item, index, keywords) {
  const normalized = {
    title: sanitizeText(item.title || item.name || `source ${index + 1}`, 180),
    summary: sanitizeText(item.summary || item.description || item.excerpt || '', 420),
    url: String(item.url || item.link || ''),
    source: String(item.source || item.domain || ''),
    publishedAt: String(item.publishedAt || item.date || ''),
    tags: [...(item.categories || []), ...(item.tags || [])].map((tag) => String(tag)).slice(0, 8),
    score: Number.isFinite(Number(item.score)) ? Number(Number(item.score).toFixed(3)) : scoreItem(item, keywords),
    origin: String(item.origin || (item.source === 'blog archive' ? 'archive' : 'digest-data')),
    type: String(item.type || '')
  };
  return { ...normalized, thumbnail: String(item.thumbnail || item.image_url || item.imageUrl || thumbnailForSource(normalized)) };
}

function rankedNewsItems(feed, archive, keywords, limit, candidates = []) {
  const searchedCandidates = Array.isArray(candidates)
    ? candidates.map((item) => ({ ...item, origin: item.origin || 'live-search' }))
    : [];
  const rawNews = Array.isArray(feed?.all) ? feed.all : [];
  const archiveNews = Array.isArray(archive)
    ? archive.filter((post) => post.folder === 'news').map((post) => ({
        title: post.title,
        summary: post.excerpt,
        url: post.url,
        source: 'blog archive',
        date: post.date,
        tags: [post.primary_tag, post.folder].filter(Boolean)
      }))
    : [];
  return [...searchedCandidates, ...rawNews, ...archiveNews]
    .map((item, index) => normalizeSourceItem(item, index, keywords))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(3, Math.min(Number(limit) || 8, 12)));
}

function fallbackIssue({ date, keywords, sources, gemmaText }) {
  const focus = keywords.join(', ');
  const title = `${focus || 'AI'} Focused Brief — ${date}`;
  const sourceLines = sources
    .slice(0, 6)
    .map((source, index) => `${index + 1}. [${source.title}](${source.url || '#'}) — ${source.summary || source.source || 'ranked source'}`)
    .join('\n');
  return {
    title,
    summary: gemmaText || `Draft focused issue from ${sources.length} ranked source candidates.`,
    markdown: `## ${title}\n\n${gemmaText || `Keywords: ${focus || 'AI news'}.`}\n\n### Ranked sources\n${sourceLines}`,
    bullets: sources.slice(0, 3).map((source) => source.title)
  };
}

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
  const date = String(input.date || new Date().toISOString().slice(0, 10));
  const archive = await readJsonAsset(env, request.url, '/archive.json', []);
  const feed = await readJsonAsset(env, request.url, '/news/data/latest.json', { all: [] });
  const sources = rankedNewsItems(feed, archive, keywords, input.limit, input.candidates || input.sources || []);
  const blogContext = Array.isArray(archive)
    ? archive.slice(0, 24).map((post) => ({ title: post.title, folder: post.folder, excerpt: post.excerpt, url: post.url }))
    : [];
  const gemmaPayload = {
    task: 'Draft a focused public blog news issue. Return JSON only with title, summary, markdown, and bullets. Format important phrases with Markdown bold where useful. Do not include diagrams or overview figures.',
    date,
    keywords,
    ranking_policy: 'Use live searched candidates first, then latest digest/archive context as fallback. Score by query match, recency, source quality, and blog relevance. Do not invent unsupported facts.',
    searched_news_candidates: sources.filter((source) => source.origin === 'live-search'),
    ranked_news_items: sources,
    blog_archive_context: blogContext
  };
  const gemma = await callGemma(env, gemmaPayload);
  const parsed = parseMaybeJson(gemma.text);
  const issue = parsed?.markdown
    ? {
        title: sanitizeText(parsed.title || `${keywords.join(', ')} Focused Brief — ${date}`, 200),
        summary: sanitizeText(parsed.summary || '', 800),
        markdown: String(parsed.markdown || ''),
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map((item) => sanitizeText(item, 220)).slice(0, 6) : []
      }
    : fallbackIssue({ date, keywords, sources, gemmaText: sanitizeText(gemma.text, 1200) });

  return jsonResponse({
    ok: true,
    date,
    keywords,
    issue,
    sources,
    usedGemma: Boolean(gemma.usedGemma && !gemma.error),
    warning: gemma.missingKey ? 'GOOGLE_AI_API_KEY/GOOGLE_API_KEY/GEMINI_API_KEY is not configured on the server.' : gemma.error || undefined
  });
}
