const stopWords = new Set([
  'and', 'with', 'the', 'for', 'from', 'into', 'your', 'this', 'that',
  'guide', 'notes', 'post', 'posts', 'aware', 'remote', 'large', 'small',
  'language', 'models', 'device', 'hybrid', 'inference', 'uncertainty'
]);

const phraseRewrites = new Map([
  ['github to cloudflare pipeline', 'Cloudflare pipeline'],
  ['second brain architecture', 'second brain'],
  ['seo and performance guide', 'SEO'],
  ['rust rendering notes', 'Rust rendering'],
  ['obsidian linking habits', 'Obsidian links'],
  ['jinhyuk kim', 'about'],
  ['home', 'index']
]);

const labelRewrites = new Map([
  ['rust', 'Rust'],
  ['tokio', 'Tokio'],
  ['seo', 'SEO'],
  ['llm', 'LLM'],
  ['ai', 'AI'],
  ['papers', 'papers'],
  ['paper', 'paper'],
  ['open ran', 'open RAN']
]);

const connectorFrames = [
  'posts/ ──┬──── {term}',
  '        │     {term}',
  'blog/  ──┼──── {term}',
  '        │     {term}',
  'papers/──┴──── {term}',
  '        ╰──── {term}'
];

const threadPatterns = [
  '═══╪═════╪═════╪═════╪══',
  '──╮    ╭──╮    ╭──╮    ╭─',
  '  ╲╱────╲╱────╲╱────╲╱  ',
  '░▒░ index ─░▒░ archive ─░▒░',
  '──── compose ── publish ──'
];

export function cleanPretextTerm(value) {
  return String(value || '')
    .replace(/[—–:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampRowText(value, limit = 38) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function addFragment(fragments, seen, label, weight = 1) {
  const cleanBase = cleanPretextTerm(label).replace(/\/$/, '');
  const clean = labelRewrites.get(cleanBase.toLowerCase()) || cleanBase;
  if (!clean || clean.length < 2 || clean.length > 28) return;
  const key = clean.toLowerCase();
  if (stopWords.has(key)) return;
  const existing = seen.get(key);
  if (existing) {
    existing.weight += weight;
    return;
  }
  const entry = { label: clean, weight };
  seen.set(key, entry);
  fragments.push(entry);
}

function titleFragments(title) {
  const clean = cleanPretextTerm(title);
  const lower = clean.toLowerCase();
  if (phraseRewrites.has(lower)) return [phraseRewrites.get(lower)];
  const words = clean.split(' ').filter(Boolean);
  const phrases = [];
  if (words.length <= 3 && clean.length <= 28) phrases.push(clean);
  if (words.length >= 2) phrases.push(words.slice(0, 2).join(' '));
  for (const word of words) {
    const normalized = word.replace(/[^\p{L}\p{N}-]/gu, '');
    if (!normalized || normalized.length < 3) continue;
    if (stopWords.has(normalized.toLowerCase())) continue;
    phrases.push(normalized);
  }
  return phrases;
}

export function termsFromArchive(archive, { isMobile = false } = {}) {
  const fragments = [];
  const seen = new Map();
  for (const post of Array.isArray(archive) ? archive : []) {
    addFragment(fragments, seen, post.folder, 3);
    addFragment(fragments, seen, post.primary_tag, 4);
    for (const tag of post.tags || []) addFragment(fragments, seen, tag, 3);
    for (const phrase of titleFragments(post.title)) addFragment(fragments, seen, phrase, 2);
  }
  return fragments
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, isMobile ? 12 : 18)
    .map((term) => term.label);
}

function cycleTerm(terms, index, fallback) {
  if (!terms.length) return fallback;
  return terms[index % terms.length] || fallback;
}

function connectorRows(terms) {
  return connectorFrames.map((frame, index) => ({
    kind: index % 2 === 0 ? 'connector' : 'phrase',
    text: clampRowText(frame.replace('{term}', cycleTerm(terms, index, ['index', 'writing', 'archive'][index % 3]))),
    delay: `${index * -0.42}s`,
    duration: `${(8.5 + index * 0.65).toFixed(1)}s`,
    depth: Number((0.72 - index * 0.045).toFixed(2))
  }));
}

function phraseRows(terms, { isMobile = false } = {}) {
  const source = terms.length ? terms : ['index', 'writing', 'notes', 'papers', 'archive', 'public'];
  const count = isMobile ? 6 : 10;
  return Array.from({ length: count }, (_value, index) => {
    const left = cycleTerm(source, index * 2, 'index');
    const right = cycleTerm(source, index * 2 + 1, 'notes');
    const bridge = index % 3 === 0 ? ' · ' : index % 3 === 1 ? ' / ' : ' :: ';
    return {
      kind: index % 4 === 2 ? 'connector' : 'phrase',
      text: clampRowText(`${left}${bridge}${right}`),
      delay: `${(index + 6) * -0.34}s`,
      duration: `${(10.5 + (index % 5) * 0.8).toFixed(1)}s`,
      depth: Number((0.38 + (index % 5) * 0.07).toFixed(2))
    };
  });
}

function frameFromTerms(terms, options = {}) {
  const rows = [...connectorRows(terms), ...phraseRows(terms, options)];
  return {
    title: 'PRETEXT / INDEX LOOM',
    rows: rows.map((row, index) => ({ ...row, index }))
  };
}

function threadsFromTerms(terms) {
  return threadPatterns.map((pattern, index) => ({
    text: clampRowText(pattern.replace('index', cycleTerm(terms, index, 'index'))),
    y: `${22 + index * 12}%`,
    delay: `${index * -1.8}s`,
    duration: `${(15 + index * 2.2).toFixed(1)}s`,
    direction: index % 2 === 0 ? 'normal' : 'reverse'
  }));
}

export function createPretextState({ archive = [], isMobile = false } = {}) {
  return {
    phase: 'idle',
    archive: Array.isArray(archive) ? archive : [],
    isMobile: Boolean(isMobile),
    terms: [],
    frame: null
  };
}

export function pretextReducer(state, event) {
  if (event.type === 'pretext.mounted') {
    const terms = termsFromArchive(state.archive, { isMobile: state.isMobile });
    const frame = frameFromTerms(terms, { isMobile: state.isMobile });
    const threads = threadsFromTerms(terms);
    const scanCursor = { label: 'writing index is live ▌', delay: '-1.2s', duration: '9.5s' };
    const next = { ...state, phase: 'ready', terms, frame };
    return {
      state: next,
      effects: [{ type: 'render-pretext-ascii-loom', scene: 'kinetic-ascii-loom', terms, links: [], frame, threads, scanCursor }]
    };
  }
  return { state, effects: [] };
}
