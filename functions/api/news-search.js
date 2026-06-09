import { jsonResponse, normalizeKeywords, readJsonAsset, sanitizeText } from './_shared.js';

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlTag(block, tag) {
  const match = String(block || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1] || '');
}

function queryTokens(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9가-힣+-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .slice(0, 12);
}

function scoreCandidate(candidate, tokens, index = 0) {
  const haystack = [candidate.title, candidate.summary, candidate.source].join(' ').toLowerCase();
  let score = Math.max(0, 3 - index * 0.15);
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2.5;
  }
  if (candidate.url) score += 0.5;
  if (candidate.source === 'GitHub' && Number(candidate.stars || 0) > 100) score += Math.log10(Number(candidate.stars)) * 0.6;
  const published = Date.parse(candidate.publishedAt || '');
  if (Number.isFinite(published)) score += Math.max(0, 2 - (Date.now() - published) / 86_400_000 / 21);
  return Number(score.toFixed(3));
}

function thumbnailForCandidate(candidate = {}) {
  const text = [candidate.source, candidate.type, candidate.url, ...(candidate.categories || []), ...(candidate.tags || [])].join(' ').toLowerCase();
  if (text.includes('github') || text.includes('repo')) return '/assets/news/thumb-repo.svg';
  if (text.includes('arxiv') || text.includes('paper') || text.includes('huggingface')) return '/assets/news/thumb-paper.svg';
  if (text.includes('ran') || text.includes('vran') || text.includes('o-ran')) return '/assets/news/thumb-vran.svg';
  return '/assets/news/thumb-ai.svg';
}

function normalizeCandidate(candidate, query, index) {
  const tokens = queryTokens(query);
  const item = {
    id: sanitizeText(candidate.id || `${candidate.source || 'source'}-${index + 1}`, 120),
    title: sanitizeText(candidate.title || `News candidate ${index + 1}`, 220),
    url: String(candidate.url || ''),
    source: sanitizeText(candidate.source || '', 120),
    summary: sanitizeText(candidate.summary || '', 520),
    publishedAt: sanitizeText(candidate.publishedAt || '', 80),
    origin: sanitizeText(candidate.origin || 'live-search', 40),
    type: sanitizeText(candidate.type || 'news', 40),
    stars: candidate.stars ? Number(candidate.stars) : undefined
  };
  return { ...item, score: scoreCandidate(item, tokens, index), thumbnail: String(candidate.thumbnail || candidate.image_url || candidate.imageUrl || thumbnailForCandidate(item)) };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const key = String(candidate.url || candidate.title).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function searchGoogleNews(query, limit) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetchWithTimeout(url, { headers: { 'user-agent': 'mud-blog-news-search/1.0' } });
  if (!response.ok) throw new Error(`Google News RSS ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, limit).map((match, index) => ({
    id: `google-news-${index + 1}`,
    title: xmlTag(match[0], 'title'),
    url: xmlTag(match[0], 'link'),
    source: xmlTag(match[0], 'source') || 'Google News',
    summary: xmlTag(match[0], 'description'),
    publishedAt: xmlTag(match[0], 'pubDate'),
    type: 'news'
  }));
}

async function searchGithub(query, limit) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${Math.min(limit, 10)}`;
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'mud-blog-news-search/1.0' } });
  if (!response.ok) throw new Error(`GitHub search ${response.status}`);
  const json = await response.json();
  return (json.items || []).slice(0, limit).map((repo, index) => ({
    id: `github-${index + 1}`,
    title: repo.full_name || repo.name,
    url: repo.html_url,
    source: 'GitHub',
    summary: repo.description || '',
    publishedAt: repo.updated_at || '',
    type: 'repo',
    stars: repo.stargazers_count || 0
  }));
}

async function searchArxiv(query, limit) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${Math.min(limit, 10)}&sortBy=submittedDate&sortOrder=descending`;
  const response = await fetchWithTimeout(url, { headers: { 'user-agent': 'mud-blog-news-search/1.0' } });
  if (!response.ok) throw new Error(`arXiv search ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].slice(0, limit).map((match, index) => ({
    id: `arxiv-${index + 1}`,
    title: xmlTag(match[0], 'title'),
    url: xmlTag(match[0], 'id'),
    source: 'arXiv',
    summary: xmlTag(match[0], 'summary'),
    publishedAt: xmlTag(match[0], 'published') || xmlTag(match[0], 'updated'),
    type: 'paper'
  }));
}

function htmlAttr(block, name) {
  const match = String(block || '').match(new RegExp(`${name}=["']([^"']+)["']`, 'i'));
  return decodeXml(match?.[1] || '');
}

async function searchGoogleScholar(query, limit) {
  const url = `https://scholar.google.com/scholar?hl=en&q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, { headers: { 'user-agent': 'mud-blog-news-search/1.0 (+https://mud.blog/news/search)' } });
  if (!response.ok) throw new Error(`Google Scholar ${response.status}`);
  const html = await response.text();
  const items = [...html.matchAll(/<div[^>]+class=["'][^"']*gs_r[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*gs_r[^"']*["']|<div[^>]+id=["']gs_res_ccl_bot["']|<\/body>|$)/gi)]
    .slice(0, limit)
    .map((match, index) => {
      const block = match[0];
      const titleAnchor = block.match(/<h3[^>]+class=["'][^"']*gs_rt[^"']*["'][^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i);
      const plainTitle = block.match(/<h3[^>]+class=["'][^"']*gs_rt[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i);
      const meta = decodeXml(block.match(/<div[^>]+class=["'][^"']*gs_a[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
      const year = meta.match(/\b(19|20)\d{2}\b/)?.[0] || '';
      return {
        id: `google-scholar-${index + 1}`,
        title: decodeXml(titleAnchor?.[2] || plainTitle?.[1] || `Google Scholar result ${index + 1}`),
        url: htmlAttr(titleAnchor?.[1] || '', 'href'),
        source: 'Google Scholar',
        summary: decodeXml(block.match(/<div[^>]+class=["'][^"']*gs_rs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || meta),
        publishedAt: year ? `${year}-01-01` : '',
        type: 'paper'
      };
    })
    .filter((item) => item.title && !/Google Scholar result \d+/.test(item.title));
  if (items.length) return items;
  return [{
    id: 'google-scholar-search',
    title: `Open Google Scholar results for ${query}`,
    url,
    source: 'Google Scholar',
    summary: 'Google Scholar did not expose parseable result cards to this runtime; open the citation search page directly.',
    publishedAt: '',
    type: 'paper'
  }];
}

const DIGEST_SOURCE_DOMAINS = {
  'digest-snapshot': [],
  'huggingface-papers': ['huggingface.co'],
  x: ['x.com'],
  linkedin: ['linkedin.com'],
  geeknews: ['geeknews'],
  endigest: ['endigest.dev'],
  arxiv: ['arxiv.org'],
  'google-scholar': ['scholar.google.com'],
  'github-repositories': ['github.com']
};

function sourceMatchesSelection(item, sourceIds) {
  const source = String(item.source || '').toLowerCase();
  if (sourceIds.includes('digest-snapshot')) return true;
  return sourceIds.some((id) => (DIGEST_SOURCE_DOMAINS[id] || []).some((domain) => source === domain));
}

function fallbackFromAsset(feed, query, limit, sourceIds = ['digest-snapshot']) {
  const tokens = queryTokens(query);
  return (Array.isArray(feed?.all) ? feed.all : [])
    .filter((item) => sourceMatchesSelection(item, sourceIds))
    .filter((item) => {
      const haystack = [item.title, item.summary, item.description, item.source, ...(item.categories || [])].join(' ').toLowerCase();
      return tokens.length === 0 || tokens.some((token) => haystack.includes(token));
    })
    .slice(0, limit)
    .map((item, index) => normalizeCandidate({
      id: `asset-${index + 1}`,
      title: item.title,
      url: item.url,
      source: item.source || 'latest digest',
      summary: item.summary || item.description || item.excerpt || '',
      publishedAt: item.publishedAt || item.date || '',
      type: (item.categories || [])[0] || 'news',
      origin: 'digest-snapshot',
      thumbnail: item.image_url || item.imageUrl
    }, query, index));
}

function selectedSourceIds(inputSources) {
  const allowed = new Set(['google-news-rss', 'github-repositories', 'arxiv', 'google-scholar', 'huggingface-papers', 'x', 'linkedin', 'geeknews', 'endigest']);
  const requested = Array.isArray(inputSources)
    ? inputSources.map((source) => String(source)).filter((source) => allowed.has(source))
    : [];
  return requested.length ? requested : [...allowed];
}

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: 'Expected a JSON request body.' }, { status: 400 });
  }
  const query = sanitizeText(input.query || input.keywords || input.keyword, 160);
  if (!query) return jsonResponse({ ok: false, error: 'Search query is required.' }, { status: 400 });
  const limit = Math.max(3, Math.min(Number(input.limit) || 9, 15));
  const sourceIds = selectedSourceIds(input.sources);
  const perSource = Math.max(2, Math.ceil(limit / Math.max(3, sourceIds.length)));
  const searched = [];
  const warnings = [];
  const feed = await readJsonAsset(env, request.url, '/news/data/latest.json', { all: [] });
  const sourceTasks = {
    'google-news-rss': () => searchGoogleNews(query, perSource),
    'github-repositories': () => searchGithub(query, perSource),
    arxiv: () => searchArxiv(query, perSource),
    'google-scholar': () => searchGoogleScholar(query, perSource),
    'huggingface-papers': () => Promise.resolve(fallbackFromAsset(feed, query, perSource, ['huggingface-papers'])),
    x: () => Promise.resolve(fallbackFromAsset(feed, query, perSource, ['x'])),
    linkedin: () => Promise.resolve(fallbackFromAsset(feed, query, perSource, ['linkedin'])),
    geeknews: () => Promise.resolve(fallbackFromAsset(feed, query, perSource, ['geeknews'])),
    endigest: () => Promise.resolve(fallbackFromAsset(feed, query, perSource, ['endigest']))
  };
  const batches = await Promise.allSettled(sourceIds.map((source) => sourceTasks[source]()));
  const candidates = [];
  batches.forEach((batch, index) => {
    const name = sourceIds[index];
    searched.push(name);
    if (batch.status === 'fulfilled') candidates.push(...batch.value);
    else warnings.push(`${name}: ${batch.reason?.message || 'search failed'}`);
  });
  const normalized = dedupeCandidates(candidates.map((candidate, index) => normalizeCandidate(candidate, query, index)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (!normalized.length) {
    normalized.push(...fallbackFromAsset(feed, query, limit, sourceIds));
  }
  return jsonResponse({
    ok: true,
    query,
    keywords: normalizeKeywords(query),
    searched,
    candidates: normalized,
    warning: warnings.length ? warnings.join('; ') : undefined
  });
}
