const fragmentSlots = [
  [8, 14], [46, 13], [18, 25], [49, 25], [9, 37], [45, 38],
  [20, 50], [51, 51], [10, 64], [42, 64], [16, 78], [50, 78],
  [37, 18], [31, 43], [61, 59], [36, 86]
];

const fragmentVariants = ['type-phrase', 'type-ghost', 'type-mark', 'type-phrase'];
const punctuationMarks = ['/', '·', '—', '::'];

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
  ['papers', 'papers']
]);

export function cleanPretextTerm(value) {
  return String(value || '')
    .replace(/[—–:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addFragment(fragments, seen, label, weight = 1) {
  const cleanBase = cleanPretextTerm(label).replace(/\/$/, '');
  const clean = labelRewrites.get(cleanBase.toLowerCase()) || cleanBase;
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
    .slice(0, isMobile ? 12 : 16)
    .map((term) => term.label);
}

function tokenKind(index, termCount) {
  if (index >= termCount) return 'type-punctuation';
  return index < 4 ? 'focus-word' : 'type-phrase';
}

function tokenModel(label, index, termCount) {
  const [x, y] = fragmentSlots[index % fragmentSlots.length];
  const kind = tokenKind(index, termCount);
  const depth = kind === 'focus-word' ? 0.76 - index * 0.05 : kind === 'type-punctuation' ? 0.22 : 0.42 + (index % 4) * 0.07;
  return {
    label,
    url: '',
    kind,
    x: `${x}%`,
    y: `${y}%`,
    delay: `${index * -0.37}s`,
    duration: `${(11 + depth * 6).toFixed(1)}s`,
    scaleStart: (0.985 + depth * 0.02).toFixed(3),
    scaleEnd: (1.004 + depth * 0.026).toFixed(3),
    opacityStart: (0.36 + depth * 0.24).toFixed(2),
    opacityEnd: (0.58 + depth * 0.3).toFixed(2),
    depth: Number(depth.toFixed(2)),
    variant: kind === 'focus-word' ? 'type-focus' : kind === 'type-punctuation' ? 'type-mark' : fragmentVariants[(index - 4) % fragmentVariants.length]
  };
}

export function tokensFromTerms(terms) {
  const selected = terms.slice(0, 12);
  const labels = [...selected, ...punctuationMarks];
  return labels.map((term, index) => tokenModel(term, index, selected.length));
}

export function tokensFromArchive(archive, { isMobile = false } = {}) {
  return tokensFromTerms(termsFromArchive(archive, { isMobile }));
}

export function linksFromTokens() {
  return [];
}

function microRowsFromTerms(terms) {
  const source = terms.length ? terms : ['index', 'writing', 'notes', 'papers'];
  const rows = [0, 1, 2, 3].map((row) => {
    const rotated = source.slice(row * 3).concat(source.slice(0, row * 3));
    const text = rotated.slice(0, 9).join(row % 2 === 0 ? ' · ' : ' / ');
    return {
      text,
      y: `${18 + row * 21}%`,
      delay: `${row * -4.2}s`,
      duration: `${24 + row * 5}s`,
      direction: row % 2 === 0 ? 'normal' : 'reverse',
      opacity: (0.13 + row * 0.025).toFixed(2)
    };
  });
  return rows;
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
    const microRows = microRowsFromTerms(terms);
    const next = { ...state, phase: 'ready', terms, tokens };
    return {
      state: next,
      effects: [{ type: 'render-pretext-type-current', scene: 'pretext-type-current', terms, tokens, links, lanes: [], microRows }]
    };
  }
  return { state, effects: [] };
}
