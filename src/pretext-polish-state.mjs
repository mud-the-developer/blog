const referenceNotes = [
  {
    "source": "user supplied long ASCII cat",
    "cue": "large side-facing cat with raised tail used as the visible Pretext sprite",
    "url": "inline://discord/ascii-cat-reference"
  },
  {
    "source": "baud-era terminal refresh cadence",
    "cue": "slow row-by-row redraw like a low-baud terminal link instead of a smooth modern tween",
    "url": "https://en.wikipedia.org/wiki/Baud"
  },
  {
    "source": "oneko.js Neko two-frame walk cycle",
    "cue": "single sprite motion path and repeated gait cadence, adapted to a large ASCII cat",
    "url": "https://github.com/adryd325/oneko.js"
  }
];

const catFrameModels = [
  {
    "pose": "tail-sweep-left",
    "rows": [
      " .--.",
      "                                            `.     \\",
      "                                              `.    \\",
      "                                                \\   \\",
      "                                                 .   .",
      "                                                 :    .",
      "                                                 |    :",
      "                                                 |    |",
      "  ..._  ___                                       |    |",
      " `.\"\".`''''\"\"--..___                              |    |",
      " ,-\\  \\             \"\"-...__         _____________/    |",
      " / ` \" '                    `\"\"\"\"\"\"\"\"                  .",
      " \\                                                      L",
      " (>                                                      \\",
      "/                                                         \\",
      "\\_    ___..---.                                            L",
      "  `--'         '.                                           \\",
      "                 .                                           \\_",
      "                _/`.                                           `.._",
      "             .'     -.                                             `.",
      "            /     __.-Y     /''''''-...___,...--------.._            |",
      "           /   _.\"    |    /                ' .      \\   '---..._    |",
      "          /   /      /    /                _,. '    ,/           |   |",
      "          \\_,'     _.'   /              /''     _,-'            _|   |",
      "                  '     /               `-----''               /     |",
      "                  `...-'                                     `...-'"
    ]
  },
  {
    "pose": "tail-sweep-mid",
    "rows": [
      " .--.",
      "                                               `.  \\",
      "                                                 \\  \\",
      "                                                  .  \\",
      "                                                  :   .",
      "                                                  |    .",
      "                                                  |    :",
      "                                                  |    |",
      "  ..._  ___                                       |    |",
      " `.\"\".`''''\"\"--..___                              |    |",
      " ,-\\  \\             \"\"-...__         _____________/    |",
      " / ` \" '                    `\"\"\"\"\"\"\"\"                  .",
      " \\                                                      L",
      " (>                                                      \\",
      "/                                                         \\",
      "\\_    ___..---.                                            L",
      "  `--'         '.                                           \\",
      "                 .                                           \\_",
      "                _/`.                                           `.._",
      "             .'     -.                                             `.",
      "            /     __.-Y     /''''''-...___,...--------.._            |",
      "           /   _.\"    |    /                ' .      \\   '---..._    |",
      "          /   /      /    /                _,. '    ,/           |   |",
      "          \\_,'     _.'   /              /''     _,-'            _|   |",
      "                  '     /               `-----''               /     |",
      "                  `...-'                                     `...-'"
    ]
  },
  {
    "pose": "tail-sweep-right",
    "rows": [
      "       .--.",
      "          `.  \\",
      "            \\  \\",
      "             \\  \\",
      "              .  \\",
      "              :   .",
      "              |    .",
      "              |    :",
      "  ..._  ___                                       |    |",
      " `.\"\".`''''\"\"--..___                              |    |",
      " ,-\\  \\             \"\"-...__         _____________/    |",
      " / ` \" '                    `\"\"\"\"\"\"\"\"                  .",
      " \\                                                      L",
      " (>                                                      \\",
      "/                                                         \\",
      "\\_    ___..---.                                            L",
      "  `--'         '.                                           \\",
      "                 .                                           \\_",
      "                _/`.                                           `.._",
      "             .'     -.                                             `.",
      "            /     __.-Y     /''''''-...___,...--------.._            |",
      "           /   _.\"    |    /                ' .      \\   '---..._    |",
      "          /   /      /    /                _,. '    ,/           |   |",
      "          \\_,'     _.'   /              /''     _,-'            _|   |",
      "                  '     /               `-----''               /     |",
      "                  `...-'                                     `...-'"
    ]
  },
  {
    "pose": "tail-sweep-settle",
    "rows": [
      "   .--.",
      "                                             `.   \\",
      "                                               \\  \\",
      "                                                .  \\",
      "                                                :   .",
      "                                                |    .",
      "                                                |    :",
      "                                                |    |",
      "  ..._  ___                                       |    |",
      " `.\"\".`''''\"\"--..___                              |    |",
      " ,-\\  \\             \"\"-...__         _____________/    |",
      " / ` \" '                    `\"\"\"\"\"\"\"\"                  .",
      " \\                                                      L",
      " (>                                                      \\",
      "/                                                         \\",
      "\\_    ___..---.                                            L",
      "  `--'         '.                                           \\",
      "                 .                                           \\_",
      "                _/`.                                           `.._",
      "             .'     -.                                             `.",
      "            /     __.-Y     /''''''-...___,...--------.._            |",
      "           /   _.\"    |    /                ' .      \\   '---..._    |",
      "          /   /      /    /                _,. '    ,/           |   |",
      "          \\_,'     _.'   /              /''     _,-'            _|   |",
      "                  '     /               `-----''               /     |",
      "                  `...-'                                     `...-'"
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
    label: 'large-tail-wag-ascii-cat',
    spriteMode: 'single-continuous-sprite',
    references: referenceNotes,
    frames,
    frameRate: 2.2,
    dimensions: {
      lineCount: 26,
      maxWidth: 70,
      scaleStrategy: 'shrink-to-fit-pretext-panel'
    },
    telecom: {
      label: 'CAT-LINK 1200',
      mode: 'slow-baud-row-refresh',
      refreshMs: 520,
      lineSweepMs: 9,
      statusCopy: 'tail sweep · row refresh'
    },
    shadow: null,
    decorations: [],
    paws: [],
    motion: {
      duration: '18s',
      durationMs: 18000,
      travelPx: 24,
      xBiasPx: -36,
      continuous: true,
      behaviors: ['side-walk', 'tail-wag', 'baud-refresh'],
      reference: 'large user-supplied ASCII cat translated sideways while tail rows cycle in one sprite'
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
