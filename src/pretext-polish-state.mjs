const referenceNotes = [
  {
    source: 'asciiart.eu classic kitten',
    cue: String.raw`/\_/\ ( o.o ) > ^ <`,
    url: 'https://www.asciiart.eu/animals/cats'
  },
  {
    source: 'asciiart.eu sleeping cat',
    cue: 'long curled body with ZZZ sleep cue',
    url: 'https://www.asciiart.eu/animals/cats'
  }
];

const catFrameModels = [
  {
    pose: 'sit',
    offset: { x: -30, y: 18 },
    scale: 1,
    rows: [
      '      /\\_/\\        sit',
      '     ( o.o )',
      '      > ^ <',
      '   __/|   |\\__',
      '  /___|___|__\\',
      '     (_   _ )',
      '       )_/  ~'
    ]
  },
  {
    pose: 'blink',
    offset: { x: -18, y: 14 },
    scale: 1,
    rows: [
      '      /\\_/\\       blink',
      '     ( -.- )',
      '      > ^ <',
      '   __/|   |\\__',
      '  /___|___|__\\',
      '     (_   _ )',
      '       )_/  ~'
    ]
  },
  {
    pose: 'crouch',
    offset: { x: 12, y: 28 },
    scale: 0.98,
    rows: [
      '       /\\_/\\      crouch',
      '    __( o.o )__',
      '  _/  \\_^_/  \\_',
      ' /__  /   \\  __\\',
      '    \\_\\___/_/',
      '      (_|_)',
      '     ready...'
    ]
  },
  {
    pose: 'jump',
    offset: { x: 42, y: -56 },
    scale: 1.02,
    rows: [
      '        /\\_/\\       hop!',
      '     \\ (=^.^=) /',
      '       \\  ^  /',
      '     __/     \\__',
      '   _/  /|   |\\  \\_',
      '      /_|___|_\\',
      '       /     \\'
    ]
  },
  {
    pose: 'land',
    offset: { x: 18, y: 8 },
    scale: 1,
    rows: [
      '      /\\_/\\       land',
      '     ( o.o )',
      '    / > ^ < \\',
      '   /__/| |\\__\\',
      '      /___\\',
      '     (_/ \\_)',
      '        tail~'
    ]
  },
  {
    pose: 'nap',
    offset: { x: -44, y: 22 },
    scale: 0.98,
    rows: [
      '   zzz      /\\_/\\',
      '  |\\__/,|  ( -.- )',
      '  |_ _  |   > ^ <',
      '   ( (   )',
      '  -(((---(((----',
      '      curled nap',
      '       tail ~'
    ]
  }
];

function createCatFrame(frame, index) {
  return {
    rows: frame.rows,
    index,
    pose: frame.pose,
    offset: frame.offset,
    scale: frame.scale,
    delay: `${index * -0.84}s`,
    duration: '5.04s',
    depth: Number((0.62 + index * 0.04).toFixed(2))
  };
}

function createCat() {
  return {
    label: 'cute-reference-cat',
    references: referenceNotes,
    frames: catFrameModels.map(createCatFrame),
    shadow: null,
    decorations: [],
    paws: [],
    motion: { duration: '10.4s', delay: '-0.35s', behaviors: ['sit', 'blink', 'crouch', 'jump', 'land'] }
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
    const cat = createCat();
    const next = { ...state, phase: 'ready', cat };
    return {
      state: next,
      effects: [{ type: 'render-pretext-ascii-cat', scene: 'kinetic-ascii-cat', links: [], cat, paws: cat.paws, motion: cat.motion }]
    };
  }
  return { state, effects: [] };
}
