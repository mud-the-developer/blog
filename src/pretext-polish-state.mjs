const tokenSlots = [
  [8, 12], [26, 27], [8, 52], [26, 72]
];

const tokenVariants = ['glass-blue', 'glass-violet', 'glass-sea'];

export function cleanPretextTerm(value) {
  return String(value || '')
    .replace(/[—–:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function termsFromArchive(archive, { isMobile = false } = {}) {
  const terms = new Map();
  const add = (term, weight = 1) => {
    const clean = cleanPretextTerm(term);
    if (!clean || clean.length < 3) return;
    const key = clean.toLowerCase();
    terms.set(key, { label: clean, weight: (terms.get(key)?.weight || 0) + weight });
  };

  for (const post of Array.isArray(archive) ? archive : []) {
    add(`${post.folder}/`, 6);
    add(post.primary_tag, 3);
    for (const tag of post.tags || []) add(tag, 2);
    const words = cleanPretextTerm(post.title).split(' ');
    if (words.length >= 2) add(words.slice(0, 3).join(' '), 2);
  }

  return [...terms.values()]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, isMobile ? 10 : 18)
    .map((term) => term.label);
}

function tokenModel(label, index) {
  const [x, y] = tokenSlots[index % tokenSlots.length];
  const depth = 0.3 + (index % 4) * 0.12;
  return {
    label,
    url: '',
    kind: 'post-title',
    x: `${x}%`,
    y: `${y}%`,
    delay: `${index * -0.38}s`,
    duration: `${(9 + depth * 4).toFixed(1)}s`,
    shadowY: `${Math.round(10 + depth * 12)}px`,
    shadowBlur: `${Math.round(18 + depth * 10)}px`,
    scaleStart: (0.97 + depth * 0.04).toFixed(3),
    scaleEnd: (1 + depth * 0.04).toFixed(3),
    depth: Number(depth.toFixed(2)),
    variant: tokenVariants[index % tokenVariants.length]
  };
}

export function tokensFromTerms(terms) {
  return terms.slice(0, 4).map((term, index) => tokenModel(term, index));
}

export function tokensFromArchive(archive, { isMobile = false } = {}) {
  const tokens = [];
  const seen = new Set();
  const limit = 4;
  for (const post of Array.isArray(archive) ? archive : []) {
    const clean = cleanPretextTerm(post.title);
    if (!clean || clean.length > 56 || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    tokens.push(tokenModel(clean, tokens.length));
    if (tokens.length >= limit) break;
  }
  return tokens;
}

export function linksFromTokens() {
  return [];
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
    const terms = [];
    const tokens = tokensFromArchive(state.archive, { isMobile: state.isMobile });
    const links = [];
    const next = { ...state, phase: 'ready', terms, tokens };
    return { state: next, effects: [{ type: 'render-pretext-tokens', terms, tokens, links }] };
  }
  return { state, effects: [] };
}
