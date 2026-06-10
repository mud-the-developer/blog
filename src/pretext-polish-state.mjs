const catFrames = [
  [
    ' /\\_/\\',
    '( o.o )',
    ' > ^ <',
    ' /   \\\\',
    '(__|__)'
  ],
  [
    ' /\\_/\\',
    '( -.- )',
    ' > ^ <',
    ' \\\\   /',
    '(__|__)'
  ],
  [
    ' /\\_/\\',
    '( o.o )',
    ' /|_|\\\\',
    '  / \\\\',
    '(_/ \\_)'
  ],
  [
    ' /\\_/\\',
    '( -.- )',
    ' /| |\\\\',
    '  \\\\ /',
    '(_/ \\_)'
  ]
];

function createCatFrame(rows, index) {
  return {
    rows,
    index,
    delay: `${index * -0.62}s`,
    duration: '3.2s',
    depth: Number((0.58 + index * 0.07).toFixed(2))
  };
}

function createPaws({ isMobile = false } = {}) {
  const count = isMobile ? 8 : 11;
  return Array.from({ length: count }, (_value, index) => ({
    glyph: index % 2 === 0 ? '·' : '˙',
    x: `${10 + index * (80 / Math.max(1, count - 1))}%`,
    y: `${72 + (index % 3) * 5}%`,
    delay: `${index * -0.28}s`,
    duration: `${(4.4 + (index % 4) * 0.35).toFixed(1)}s`,
    depth: Number((0.25 + (index % 4) * 0.09).toFixed(2))
  }));
}

function createCat({ isMobile = false } = {}) {
  return {
    label: '=^._.^=',
    frames: catFrames.map(createCatFrame),
    shadow: { glyph: '~~~~~~~~~~~~', delay: '-0.4s', duration: '4.8s' },
    paws: createPaws({ isMobile }),
    motion: { duration: '6.8s', delay: '-0.7s' }
  };
}

export function createPretextState({ archive = [], isMobile = false } = {}) {
  return {
    phase: 'idle',
    archive: Array.isArray(archive) ? archive : [],
    isMobile: Boolean(isMobile),
    cat: null
  };
}

export function pretextReducer(state, event) {
  if (event.type === 'pretext.mounted') {
    const cat = createCat({ isMobile: state.isMobile });
    const next = { ...state, phase: 'ready', cat };
    return {
      state: next,
      effects: [{ type: 'render-pretext-ascii-cat', scene: 'kinetic-ascii-cat', links: [], cat, paws: cat.paws, motion: cat.motion }]
    };
  }
  return { state, effects: [] };
}
