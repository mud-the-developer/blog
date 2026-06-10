const referenceNotes = [
  {
    source: 'archive metadata',
    cue: 'right-side Pretext is generated from public post titles, folders, and tags',
    url: 'inline://archive-data'
  },
  {
    source: 'kinetic ASCII index loom',
    cue: 'a restrained text instrument instead of a toy ASCII animal',
    url: 'skill://creative-web-visual-design/pretext-kinetic-ascii-loom'
  }
];

const fallbackArchive = [
  { title: 'Second Brain Architecture', folder: 'blog', tags: ['rust', 'architecture'] },
  { title: 'Uncertainty-Aware Hybrid Inference', folder: 'papers', tags: ['paper', 'llm'] },
  { title: 'Rust Rendering Notes', folder: 'blog', tags: ['rust'] }
];

function cleanText(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

function compactTitle(title, max = 37) {
  const cleaned = cleanText(title, 'untitled note');
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = cleanText(item?.[key], 'notes').toLowerCase();
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map());
}

function topTags(items) {
  const counts = new Map();
  for (const item of items) {
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    for (const tag of tags) {
      const cleaned = cleanText(tag).toLowerCase();
      if (!cleaned || cleaned === 'home') continue;
      counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([tag]) => tag);
}

function createLoomRows(items, { maxTitles = 5, maxRows = 12 } = {}) {
  const folders = [...countBy(items, 'folder').entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  const titles = items
    .filter((item) => cleanText(item?.title).toLowerCase() !== 'home')
    .slice(0, 5)
    .map((item) => compactTitle(item.title));
  const tags = topTags(items);

  const rows = [
    { kind: 'system', text: 'PRETEXT // CURRENT', weight: 1 },
    { kind: 'count', text: `${String(items.length).padStart(2, '0')} public notes indexed`, weight: 0.72 }
  ];

  folders.forEach(([folder, count], index) => {
    const joint = index === 0 ? '┬' : index === folders.length - 1 ? '┴' : '┼';
    rows.push({ kind: 'folder', text: `${folder.padEnd(7, ' ')} ──${joint}─ ${String(count).padStart(2, '0')} entries`, weight: 0.78 });
  });

  titles.slice(0, maxTitles).forEach((title, index, visibleTitles) => {
    const lead = index === visibleTitles.length - 1 ? '└─' : '├─';
    rows.push({ kind: 'title', text: `${lead} ${title}`, weight: 0.92 });
  });

  rows.push({ kind: 'signal', text: `signal: ${tags.length ? tags.join(' · ') : 'writing · index'}`, weight: 0.68 });
  rows.push({ kind: 'cursor', text: 'writing index is live ▌', weight: 0.85 });

  return rows.slice(0, maxRows).map((row, index) => ({
    ...row,
    index,
    depth: Number((0.64 + index * 0.025).toFixed(3))
  }));
}

function createLoom({ archive = [], isMobile = false } = {}) {
  const items = (Array.isArray(archive) && archive.length ? archive : fallbackArchive)
    .map((item) => ({
      title: cleanText(item?.title, 'untitled note'),
      folder: cleanText(item?.folder, 'notes'),
      tags: Array.isArray(item?.tags) ? item.tags.map((tag) => cleanText(tag)).filter(Boolean) : []
    }))
    .slice(0, 12);
  const rows = createLoomRows(items, { maxTitles: isMobile ? 2 : 5, maxRows: isMobile ? 9 : 12 });
  return {
    label: 'PRETEXT / INDEX LOOM',
    mode: 'kinetic-text-instrument',
    references: referenceNotes,
    rows,
    rowCount: rows.length,
    sourceCount: items.length,
    motion: {
      duration: '11.8s',
      durationMs: 11800,
      stepMs: 860,
      continuous: true,
      behaviors: ['row-pulse', 'cursor-blink', 'archive-current'],
      reference: 'archive-derived Pretext rows pulse in a bounded text instrument'
    },
    status: {
      label: 'INDEX CURRENT',
      copy: `${String(items.length).padStart(2, '0')} notes · ${rows.length} rows · no cat`
    }
  };
}

export function createPretextState({ archive = [], isMobile = false } = {}) {
  return {
    phase: 'idle',
    archive: Array.isArray(archive) ? archive : [],
    isMobile: Boolean(isMobile),
    loom: null
  };
}

export function pretextReducer(state, event) {
  if (event.type === 'pretext.mounted') {
    const loom = createLoom({ archive: state.archive, isMobile: state.isMobile });
    const next = { ...state, phase: 'ready', loom };
    return {
      state: next,
      effects: [{ type: 'render-pretext-loom', scene: 'kinetic-ascii-loom', links: [], loom, motion: loom.motion }]
    };
  }
  return { state, effects: [] };
}
