const referenceNotes = [
  {
    source: 'archive post letters',
    cue: 'right-side motion is generated from public post titles, folders, and tags',
    url: 'inline://archive-data'
  },
  {
    source: 'matrix-style text rain',
    cue: 'post-derived glyphs fall as continuous random columns, not an index/status loom',
    url: 'visual://post-text-rain'
  }
];

const fallbackArchive = [
  { title: 'Second Brain Architecture', folder: 'blog', tags: ['rust', 'architecture'] },
  { title: 'Uncertainty-Aware Hybrid Inference', folder: 'papers', tags: ['paper', 'llm'] },
  { title: 'Rust Rendering Notes', folder: 'blog', tags: ['rust'] }
];

const fallbackGlyphs = 'MUD BLOG AI RUST PAPER NOTES SYSTEMS WIRELESS TOKIO ASKAMA';

function cleanText(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

function normalizeArchive(archive) {
  return (Array.isArray(archive) && archive.length ? archive : fallbackArchive)
    .map((item) => ({
      title: cleanText(item?.title, 'untitled note'),
      folder: cleanText(item?.folder, 'notes'),
      primaryTag: cleanText(item?.primary_tag || item?.primaryTag || ''),
      tags: Array.isArray(item?.tags) ? item.tags.map((tag) => cleanText(tag)).filter(Boolean) : []
    }))
    .filter((item) => item.title)
    .slice(0, 16);
}

function makeSourceText(items) {
  const words = items.flatMap((item) => [item.title, item.folder, item.primaryTag, ...item.tags]);
  const text = words.map((word) => cleanText(word)).filter(Boolean).join('   ');
  return text || fallbackGlyphs;
}

function makeGlyphPool(sourceText) {
  const glyphs = [...sourceText]
    .filter((char) => /[\p{L}\p{N}._/+-]/u.test(char))
    .join('');
  const unique = [...new Set([...glyphs, ...fallbackGlyphs.replace(/\s+/g, '')])].join('');
  return unique || fallbackGlyphs.replace(/\s+/g, '');
}

function columnText(pool, index, length) {
  const chars = [...pool];
  return Array.from({ length }, (_, offset) => chars[(index * 7 + offset * 11 + offset) % chars.length]).join('\n');
}

function createColumns(pool, { isMobile = false } = {}) {
  const count = isMobile ? 18 : 30;
  const baseLength = isMobile ? 34 : 58;
  return Array.from({ length: count }, (_, index) => {
    const length = baseLength + (index % 7);
    const durationMs = 5200 + (index % 9) * 430;
    const delayMs = -1 * ((index * 317) % durationMs);
    return {
      index,
      text: columnText(pool, index, length),
      length,
      x: Number(((index + 0.35 + ((index * 13) % 5) * 0.08) * (100 / count)).toFixed(2)),
      alpha: Number((0.28 + (index % 6) * 0.08).toFixed(2)),
      durationMs,
      delayMs,
      speed: Number((durationMs / 1000).toFixed(2))
    };
  });
}

function createRain({ archive = [], isMobile = false } = {}) {
  const items = normalizeArchive(archive);
  const sourceText = makeSourceText(items);
  const glyphPool = makeGlyphPool(sourceText);
  const columns = createColumns(glyphPool, { isMobile });
  return {
    label: 'POST TEXT RAIN',
    mode: 'post-text-rain',
    references: referenceNotes,
    sourceText,
    glyphPool,
    columns,
    columnCount: columns.length,
    sourceCount: items.length,
    motion: {
      duration: '6.8s',
      durationMs: 6800,
      stepMs: isMobile ? 260 : 220,
      continuous: true,
      behaviors: ['falling-columns', 'random-letter-refresh', 'post-derived-glyphs'],
      reference: 'public post letters fall in randomized vertical columns'
    }
  };
}

export function createPretextState({ archive = [], isMobile = false } = {}) {
  return {
    phase: 'idle',
    archive: Array.isArray(archive) ? archive : [],
    isMobile: Boolean(isMobile),
    rain: null
  };
}

export function pretextReducer(state, event) {
  if (event.type === 'pretext.mounted') {
    const rain = createRain({ archive: state.archive, isMobile: state.isMobile });
    const next = { ...state, phase: 'ready', rain };
    return {
      state: next,
      effects: [{ type: 'render-post-text-rain', scene: 'post-text-rain', links: [], rain, motion: rain.motion }]
    };
  }
  return { state, effects: [] };
}
