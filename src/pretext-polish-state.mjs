const fragmentSlots = [
  [8, 16], [48, 13], [20, 31], [58, 30], [10, 49],
  [45, 52], [18, 69], [56, 68], [34, 82], [66, 44]
];

const fragmentVariants = ['signal-cyan', 'signal-violet', 'signal-amber', 'signal-blue'];

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
  ['ai', 'AI']
]);

export function cleanPretextTerm(value) {
  return String(value || '')
    .replace(/[—–:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addFragment(fragments, seen, label, weight = 1) {
  const clean = labelRewrites.get(cleanPretextTerm(label).replace(/\/$/, '').toLowerCase()) || cleanPretextTerm(label).replace(/\/$/, '');
  if (!clean || clean.length < 2 || clean.length > 24) return;
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
  if (words.length <= 3 && clean.length <= 24) phrases.push(clean);
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
    addFragment(fragments, seen, post.folder, 2);
    addFragment(fragments, seen, post.primary_tag, 4);
    for (const tag of post.tags || []) addFragment(fragments, seen, tag, 3);
    for (const phrase of titleFragments(post.title)) addFragment(fragments, seen, phrase, 2);
  }
  return fragments
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, isMobile ? 8 : 10)
    .map((term) => term.label);
}

function tokenModel(label, index) {
  const [x, y] = fragmentSlots[index % fragmentSlots.length];
  const depth = 0.22 + (index % 5) * 0.13;
  return {
    label,
    url: '',
    kind: 'signal-fragment',
    x: `${x}%`,
    y: `${y}%`,
    delay: `${index * -0.42}s`,
    duration: `${(10 + depth * 5).toFixed(1)}s`,
    shadowY: `${Math.round(6 + depth * 9)}px`,
    shadowBlur: `${Math.round(12 + depth * 8)}px`,
    scaleStart: (0.98 + depth * 0.025).toFixed(3),
    scaleEnd: (1.006 + depth * 0.03).toFixed(3),
    depth: Number(depth.toFixed(2)),
    variant: fragmentVariants[index % fragmentVariants.length]
  };
}

export function tokensFromTerms(terms) {
  return terms.slice(0, 10).map((term, index) => tokenModel(term, index));
}

export function tokensFromArchive(archive, { isMobile = false } = {}) {
  return tokensFromTerms(termsFromArchive(archive, { isMobile }));
}

export function linksFromTokens() {
  return [];
}

function signalLanes() {
  return [
    { y: '27%', delay: '-1.4s', duration: '12s' },
    { y: '50%', delay: '-5.2s', duration: '15s' },
    { y: '72%', delay: '-8.1s', duration: '18s' }
  ];
}

export function createPretextState({ archive = [], isMobile = false } = {}) {
  return {
    phase: 'idle',
    archive: Array.isArray(archive) ? archive : [],
    isMobile: Boolean(isMobile),
    terms: [],
    tokens: []
  };
}

export function pretextReducer(state, event) {
  if (event.type === 'pretext.mounted') {
    const terms = termsFromArchive(state.archive, { isMobile: state.isMobile });
    const tokens = tokensFromTerms(terms);
    const links = [];
    const lanes = signalLanes();
    const next = { ...state, phase: 'ready', terms, tokens };
    return {
      state: next,
      effects: [{ type: 'render-pretext-signal-field', scene: 'pretext-signal-field', label: 'writing index', terms, tokens, links, lanes }]
    };
  }
  return { state, effects: [] };
}
