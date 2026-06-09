const stage = document.querySelector('[data-pretext-polish]');
const surface = document.querySelector('[data-pretext-surface]');
const archiveNode = document.getElementById('archive-data');

const parseArchive = () => {
  if (!archiveNode) return [];
  try {
    const parsed = JSON.parse(archiveNode.textContent || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const cleanTerm = (value) =>
  String(value || '')
    .replace(/[—–:|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const termsFromArchive = (archive) => {
  const terms = new Map();
  const add = (term, weight = 1) => {
    const clean = cleanTerm(term);
    if (!clean || clean.length < 3) return;
    const key = clean.toLowerCase();
    terms.set(key, { label: clean, weight: (terms.get(key)?.weight || 0) + weight });
  };

  for (const post of archive) {
    add(`${post.folder}/`, 6);
    add(post.primary_tag, 3);
    for (const tag of post.tags || []) add(tag, 2);
    const words = cleanTerm(post.title).split(' ');
    if (words.length >= 2) add(words.slice(0, 3).join(' '), 2);
  }

  return [...terms.values()]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, window.matchMedia('(max-width: 700px)').matches ? 10 : 18)
    .map((term) => term.label);
};

const renderTokens = (terms) => {
  if (!stage || !surface) return;
  surface.replaceChildren();
  const slots = [
    [9, 10], [42, 8], [62, 16], [18, 28], [51, 34], [64, 42],
    [10, 54], [37, 58], [60, 62], [22, 74], [50, 78], [63, 84],
    [30, 18], [7, 38], [65, 26], [45, 48], [14, 88], [58, 5],
  ];

  terms.forEach((term, index) => {
    const token = document.createElement('span');
    const [x, y] = slots[index % slots.length];
    token.className = 'pretext-token';
    token.textContent = term;
    token.style.setProperty('--x', `${x}%`);
    token.style.setProperty('--y', `${y}%`);
    token.style.setProperty('--delay', `${index * -0.42}s`);
    surface.append(token);
  });

  stage.dataset.pretextReady = 'true';
};

renderTokens(termsFromArchive(parseArchive()));
