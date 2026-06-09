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
  return terms.map((term, index) => {
    const [x, y] = tokenSlots[index % tokenSlots.length];
    const depth = 0.28 + (index % 5) * 0.14;
    return {
      label: term,
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
  });
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
    const next = { ...state, phase: 'ready', terms, tokens };
    return { state: next, effects: [{ type: 'render-pretext-tokens', terms, tokens }] };
  }
  return { state, effects: [] };
}

export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-tokens' || !stage || !surface) return;
  surface.replaceChildren();
  for (const layerName of ['haze', 'veil', 'glint']) {
    const layer = document.createElement('span');
    layer.className = `pretext-ambient-layer pretext-ambient-layer--${layerName}`;
    layer.setAttribute('aria-hidden', 'true');
    surface.append(layer);
  }
  for (const tokenModel of effect.tokens) {
    const token = document.createElement('span');
    token.className = `pretext-token pretext-glass-block ${tokenModel.variant}`;
    token.dataset.depth = String(tokenModel.depth);
    token.textContent = tokenModel.label;
    token.style.setProperty('--x', tokenModel.x);
    token.style.setProperty('--y', tokenModel.y);
    token.style.setProperty('--delay', tokenModel.delay);
    token.style.setProperty('--duration', tokenModel.duration);
    token.style.setProperty('--shadow-y', tokenModel.shadowY);
    token.style.setProperty('--shadow-blur', tokenModel.shadowBlur);
    token.style.setProperty('--scale-start', tokenModel.scaleStart);
    token.style.setProperty('--scale-end', tokenModel.scaleEnd);
    token.style.setProperty('--depth', String(tokenModel.depth));
    surface.append(token);
  }
  stage.dataset.pretextScene = 'deep-space-glass';
  stage.dataset.pretextReady = 'true';
}
