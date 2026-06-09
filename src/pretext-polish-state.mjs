const tokenSlots = [
  [9, 10], [42, 8], [62, 16], [18, 28], [51, 34], [64, 42],
  [10, 54], [37, 58], [60, 62], [22, 74], [50, 78], [63, 84],
  [30, 18], [7, 38], [65, 26], [45, 48], [14, 88], [58, 5]
];

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
    return {
      label: term,
      x: `${x}%`,
      y: `${y}%`,
      delay: `${index * -0.42}s`
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
  for (const tokenModel of effect.tokens) {
    const token = document.createElement('span');
    token.className = 'pretext-token';
    token.textContent = tokenModel.label;
    token.style.setProperty('--x', tokenModel.x);
    token.style.setProperty('--y', tokenModel.y);
    token.style.setProperty('--delay', tokenModel.delay);
    surface.append(token);
  }
  stage.dataset.pretextReady = 'true';
}
