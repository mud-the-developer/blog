const tokenSlots = [
  [8, 9], [38, 7], [58, 15], [16, 27], [48, 32], [61, 41],
  [9, 53], [35, 57], [57, 61], [20, 72], [47, 76], [60, 82],
  [28, 18], [7, 38], [62, 26], [43, 48], [13, 86], [55, 5]
];

const tokenVariants = ['glass-blue', 'glass-violet', 'glass-sea', 'glass-amber'];

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

export function tokensFromTerms(terms) {
  return terms.map((term, index) => tokenModel(term, index, '#'));
}

function tokenModel(label, index, url = '#') {
  const [x, y] = tokenSlots[index % tokenSlots.length];
  const depth = 0.28 + (index % 5) * 0.14;
  return {
    label,
    url,
    x: `${x}%`,
    y: `${y}%`,
    delay: `${index * -0.42}s`,
    duration: `${(8 + depth * 6).toFixed(1)}s`,
    shadowY: `${Math.round(12 + depth * 16)}px`,
    shadowBlur: `${Math.round(26 + depth * 16)}px`,
    scaleStart: (0.94 + depth * 0.08).toFixed(3),
    scaleEnd: (0.98 + depth * 0.08).toFixed(3),
    depth: Number(depth.toFixed(2)),
    variant: tokenVariants[index % tokenVariants.length]
  };
}

export function tokensFromArchive(archive, { isMobile = false } = {}) {
  const tokens = [];
  const seen = new Set();
  const add = (label, url) => {
    const clean = cleanPretextTerm(label);
    if (!clean || clean.length < 3 || !url) return;
    const key = `${clean.toLowerCase()}|${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push(tokenModel(clean, tokens.length, url));
  };
  for (const post of Array.isArray(archive) ? archive : []) {
    add(post.title, post.url);
    add(post.primary_tag, post.url);
    for (const tag of post.tags || []) add(tag, post.url);
  }
  return tokens.slice(0, isMobile ? 10 : 18);
}

export function linksFromTokens(tokens) {
  const links = [];
  const count = Array.isArray(tokens) ? tokens.length : 0;
  for (let index = 0; index < count - 1; index += 1) {
    links.push({ from: index, to: index + 1, strength: Number((0.38 + (index % 4) * 0.08).toFixed(2)) });
    if (index + 3 < count && index % 3 === 0) {
      links.push({ from: index, to: index + 3, strength: 0.46 });
    }
  }
  return links;
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
    const tokens = tokensFromArchive(state.archive, { isMobile: state.isMobile });
    const links = linksFromTokens(tokens);
    const next = { ...state, phase: 'ready', terms, tokens };
    return { state: next, effects: [{ type: 'render-pretext-tokens', terms, tokens, links }] };
  }
  return { state, effects: [] };
}
