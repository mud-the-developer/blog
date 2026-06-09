import { normalizeKeywords, parseMaybeJson, sanitizeText, stripModelThinking } from './_shared.js';

function itemText(item) {
  return [item.title, item.summary, item.description, item.excerpt, item.source, ...(item.categories || []), ...(item.tags || [])]
    .map((value) => String(value || ''))
    .join(' ')
    .toLowerCase();
}

function scoreItem(item, keywords, nowMs) {
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
  if (Number.isFinite(date) && Number.isFinite(nowMs)) {
    score += Math.max(0, 2 - (nowMs - date) / 86_400_000 / 14);
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

function normalizeSourceItem(item, index, keywords, nowMs) {
  const normalized = {
    title: sanitizeText(item.title || item.name || `source ${index + 1}`, 180),
    summary: sanitizeText(item.summary || item.description || item.excerpt || '', 420),
    url: String(item.url || item.link || ''),
    source: String(item.source || item.domain || ''),
    publishedAt: String(item.publishedAt || item.date || ''),
    tags: [...(item.categories || []), ...(item.tags || [])].map((tag) => String(tag)).slice(0, 8),
    score: Number.isFinite(Number(item.score)) ? Number(Number(item.score).toFixed(3)) : scoreItem(item, keywords, nowMs),
    origin: String(item.origin || (item.source === 'blog archive' ? 'archive' : 'digest-data')),
    type: String(item.type || '')
  };
  return { ...normalized, thumbnail: String(item.thumbnail || item.image_url || item.imageUrl || thumbnailForSource(normalized)) };
}

export function rankedNewsItems(feed, archive, keywords, limit, candidates = [], nowMs = Date.now()) {
  const searchedCandidates = Array.isArray(candidates)
    ? candidates.map((item) => ({ ...item, origin: item.origin || 'live-search' }))
    : [];
  if (searchedCandidates.length) {
    const cap = Math.max(1, Math.min(Number(limit) || searchedCandidates.length, searchedCandidates.length, 12));
    return searchedCandidates
      .map((item, index) => normalizeSourceItem(item, index, keywords, nowMs))
      .slice(0, cap);
  }
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
    .map((item, index) => normalizeSourceItem(item, index, keywords, nowMs))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(3, Math.min(Number(limit) || 8, 12)));
}

function fallbackIssue({ date, keywords, sources, gemmaText }) {
  const focus = keywords.join(', ');
  const title = `${focus || 'AI'} Focused Brief — ${date}`;
  const cleanGemmaText = stripModelThinking(gemmaText);
  const sourceLines = sources
    .slice(0, 6)
    .map((source, index) => `${index + 1}. [${source.title}](${source.url || '#'}) — ${source.summary || source.source || 'ranked source'}`)
    .join('\n');
  return {
    title,
    summary: cleanGemmaText || `Draft focused issue from ${sources.length} ranked source candidates.`,
    markdown: `## ${title}\n\n${cleanGemmaText || `Keywords: ${focus || 'AI news'}.`}\n\n### Ranked sources\n${sourceLines}`,
    bullets: sources.slice(0, 3).map((source) => source.title)
  };
}

function issueFromGemma({ gemma, date, keywords, sources }) {
  const parsed = parseMaybeJson(gemma.text);
  return parsed?.markdown
    ? {
        title: sanitizeText(parsed.title || `${keywords.join(', ')} Focused Brief — ${date}`, 200),
        summary: sanitizeText(parsed.summary || '', 800),
        markdown: stripModelThinking(parsed.markdown || ''),
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map((item) => sanitizeText(item, 220)).slice(0, 6) : []
      }
    : fallbackIssue({ date, keywords, sources, gemmaText: sanitizeText(gemma.text, 1200) });
}

function buildGemmaPayload({ date, keywords, hasSelectedCandidates, sources, blogContext }) {
  return {
    task: 'Draft a focused public blog news issue. Return JSON only with title, summary, markdown, and bullets. Do not include chain-of-thought, thinking, reasoning notes, diagrams, or overview figures. Format important phrases with Markdown bold where useful.',
    date,
    keywords,
    source_contract: hasSelectedCandidates
      ? 'The user selected these searched candidates. Treat ranked_news_items as the complete authoritative source set. Do not use blog_archive_context or unrelated agent news. Every concrete claim in markdown must be supported by one of ranked_news_items and should cite the source title or URL.'
      : 'Use ranked_news_items as the source set. Use blog_archive_context only as style/context fallback, not as factual evidence. Do not invent unsupported facts.',
    ranking_policy: hasSelectedCandidates
      ? 'Preserve the selected search result set and order. Do not re-rank against latest digest/archive items.'
      : 'Use live searched candidates first, then latest digest/archive context as fallback. Score by query match, recency, source quality, and blog relevance. Do not invent unsupported facts.',
    searched_news_candidates: sources.filter((source) => source.origin === 'live-search'),
    ranked_news_items: sources,
    blog_archive_context: blogContext
  };
}

export function createFocusedIssueState(input = {}) {
  const keywords = normalizeKeywords(input.keywords || input.keyword);
  const date = String(input.date || new Date().toISOString().slice(0, 10));
  const candidates = Array.isArray(input.candidates) ? input.candidates : input.sources || [];
  return {
    phase: 'accepted',
    request: {
      date,
      keywords,
      limit: input.limit,
      candidates,
      hasSelectedCandidates: Array.isArray(input.candidates) && input.candidates.length > 0,
      nowMs: Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now()
    },
    sources: [],
    blogContext: [],
    gemma: null,
    response: null
  };
}

export function focusedIssueReducer(state, event) {
  if (state.phase === 'accepted' && event.type === 'request.accepted') {
    return {
      state: { ...state, phase: 'reading-context' },
      effects: [{ type: 'read-context-assets' }]
    };
  }

  if (state.phase === 'reading-context' && event.type === 'context.loaded') {
    const { date, keywords, limit, candidates, hasSelectedCandidates, nowMs } = state.request;
    const sources = rankedNewsItems(event.feed, event.archive, keywords, limit, candidates, nowMs);
    const blogContext = !hasSelectedCandidates && Array.isArray(event.archive)
      ? event.archive.slice(0, 24).map((post) => ({ title: post.title, folder: post.folder, excerpt: post.excerpt, url: post.url }))
      : [];
    const payload = buildGemmaPayload({ date, keywords, hasSelectedCandidates, sources, blogContext });
    return {
      state: { ...state, phase: 'drafting', sources, blogContext },
      effects: [{ type: 'call-gemma', payload }]
    };
  }

  if (state.phase === 'drafting' && event.type === 'gemma.completed') {
    const { date, keywords } = state.request;
    const gemma = event.gemma || { text: '', usedGemma: false };
    const issue = issueFromGemma({ gemma, date, keywords, sources: state.sources });
    return {
      state: {
        ...state,
        phase: 'complete',
        gemma,
        response: {
          ok: true,
          date,
          keywords,
          issue,
          sources: state.sources,
          usedGemma: Boolean(gemma.usedGemma && !gemma.error),
          warning: gemma.missingKey ? 'GOOGLE_AI_API_KEY/GOOGLE_API_KEY/GEMINI_API_KEY is not configured on the server.' : gemma.error || undefined
        }
      },
      effects: []
    };
  }

  return { state, effects: [] };
}

async function performEffect(effect, effects) {
  if (effect.type === 'read-context-assets') {
    const { archive, feed } = await effects.readContextAssets();
    return { type: 'context.loaded', archive, feed };
  }
  if (effect.type === 'call-gemma') {
    const gemma = await effects.callGemma(effect.payload);
    return { type: 'gemma.completed', gemma };
  }
  throw new Error(`Unknown focused issue effect: ${effect.type}`);
}

export async function runFocusedIssueMachine({ request, effects }) {
  let state = createFocusedIssueState(request);
  let pendingEvents = [{ type: 'request.accepted' }];

  while (pendingEvents.length) {
    const [event, ...rest] = pendingEvents;
    pendingEvents = rest;
    const step = focusedIssueReducer(state, event);
    state = step.state;
    for (const effect of step.effects) {
      pendingEvents.push(await performEffect(effect, effects));
    }
  }

  return state.response || { ok: false, error: 'Focused issue machine did not reach a response state.' };
}
