const referenceNotes = [
  {
    "source": "oneko.js Neko two-frame walk cycle",
    "cue": "continuous cursor-follow cat movement with two-frame directional walk loops",
    "url": "https://github.com/adryd325/oneko.js"
  },
  {
    "source": "baud-era terminal refresh cadence",
    "cue": "slow row-by-row redraw like a low-baud terminal link instead of a smooth modern tween",
    "url": "https://en.wikipedia.org/wiki/Baud"
  },
  {
    "source": "asciiart.eu classic kitten",
    "cue": "/\\_/\\ ( o.o ) > ^ <",
    "url": "https://www.asciiart.eu/animals/cats"
  }
];

const catFrameModels = [
  {
    "pose": "gait-01-contact",
    "rows": [
      "        /\\_/\\",
      "   ____ ( o.o )___  ,",
      " _/    \\ > ^ <   _\\/ )",
      "/  /\\   \\______/\\__\\/",
      "\\_/  \\__  /\\    /",
      "    _/   /  \\   /_",
      "   (_ __/    \\__ _)"
    ]
  },
  {
    "pose": "gait-02-lift",
    "rows": [
      "        /\\_/\\",
      "   ____ ( o.o )___  ,",
      " _/    \\ > ^ <   _\\/ )",
      "/  /\\   \\______/\\__\\/",
      "\\_/  \\__  /\\   _/",
      "    _/   /  \\_/",
      "   (_ __/    \\___)"
    ]
  },
  {
    "pose": "gait-03-pass",
    "rows": [
      "        /\\_/\\",
      "   ___  ( o.o )___  ,",
      " _/   \\_ > ^ <   _\\/ )",
      "/  /\\   \\______/\\__\\/",
      "\\_/  \\_   /\\   _/",
      "    __/  /  \\_/",
      "   (_ __/   _/__)"
    ]
  },
  {
    "pose": "gait-04-reach",
    "rows": [
      "        /\\_/\\",
      "   ___  ( o.o )__   ,",
      " _/   \\_ > ^ <  _\\/ )",
      "/  /\\   \\_____/\\__\\/",
      "\\_/  \\_   /\\  \\",
      "    __/  /  \\  \\_",
      "   (_ __/    \\__ )"
    ]
  },
  {
    "pose": "gait-05-contact",
    "rows": [
      "        /\\_/\\",
      "   ____ ( o.o )__   ,",
      " _/   \\_ > ^ <  _\\/ )",
      "/  /\\   \\_____/\\__\\/",
      "\\_/  \\_   /\\   \\",
      "   __/   /  \\   \\__",
      "  (_ ___/    \\____)"
    ]
  },
  {
    "pose": "gait-06-lift",
    "rows": [
      "        /\\_/\\",
      "   ____ ( o.o )__   ,",
      " _/   \\_ > ^ <  _\\/ )",
      "/  /\\   \\_____/\\__\\/",
      "\\_/  \\_   /\\   /",
      "   __/   /  \\_/",
      "  (_ ___/    \\___)"
    ]
  },
  {
    "pose": "gait-07-pass",
    "rows": [
      "        /\\_/\\",
      "   ___  ( o.o )__   ,",
      " _/   \\_ > ^ <  _\\/ )",
      "/  /\\   \\_____/\\__\\/",
      "\\_/  \\_   /\\  /_",
      "    _/   /  \\   )",
      "   (_ __/    \\__/"
    ]
  },
  {
    "pose": "gait-08-reach",
    "rows": [
      "        /\\_/\\",
      "   ___  ( o.o )___  ,",
      " _/   \\_ > ^ <   _\\/ )",
      "/  /\\   \\______/\\__\\/",
      "\\_/  \\__  /\\   /",
      "    _/  ) /  \\  \\_",
      "   (_ _/ /    \\__ )"
    ]
  },
  {
    "pose": "blink-carrier",
    "rows": [
      "        /\\_/\\",
      "   ____ ( -.- )___  ,",
      " _/    \\ > ^ <   _\\/ )",
      "/  /\\   \\______/\\__\\/",
      "\\_/  \\__  /\\    /",
      "    _/   /  \\   /_",
      "   (_ __/    \\__ _)"
    ]
  },
  {
    "pose": "tail-handshake",
    "rows": [
      "        /\\_/\\",
      "   ____ (=^.^=)__  ,",
      " _/   \\_ > ^ <  _\\/ )",
      "/  /\\   \\_____/\\__\\/",
      "\\_/  \\_   /\\   /",
      "   __/   /  \\_/",
      "  (_ ___/    \\___)"
    ]
  }
];

function createCatFrame(frame, index) {
  return {
    rows: frame.rows,
    index,
    pose: frame.pose,
    depth: Number((0.64 + index * 0.018).toFixed(3))
  };
}

function createCat() {
  const frames = catFrameModels.map(createCatFrame);
  return {
    label: 'low-baud-continuous-ascii-cat',
    spriteMode: 'single-continuous-sprite',
    references: referenceNotes,
    frames,
    frameRate: 2.7,
    telecom: {
      label: 'CAT-LINK 1200',
      mode: 'slow-baud-row-refresh',
      refreshMs: 370,
      lineSweepMs: 28,
      statusCopy: 'carrier sync · row refresh'
    },
    shadow: null,
    decorations: [],
    paws: [],
    motion: {
      duration: '15.2s',
      durationMs: 15200,
      continuous: true,
      behaviors: ['walk', 'turn', 'blink', 'tail-handshake', 'baud-refresh'],
      reference: 'oneko.js directional walk cadence softened into a low-baud ASCII row refresh'
    }
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
