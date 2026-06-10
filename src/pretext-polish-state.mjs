const catFrames = [
  String.raw`          /\\_____/\\
       __/  o   o  \\__
      / ( ==  o  == ) \\
     /   \\   ---   /   \\
    /  /  '.___.'  \\   \\
   |  |  .-.___.-.  |   |  _.-'
   |  | /  / | \\  \\ |   |
   |  |/__/  |  \\__\\|   |
   |     /   |   \\      |
    \\___/  __|__  \\___/
       /__/  |  \\__\\
      (_/    |    \\_)
       /____/ \\____\\
      (_/          \\_)`,
  String.raw`          /\\_____/\\
       __/  -   -  \\__
      / ( ==  -  == ) \\
     /   \\   ___   /   \\
    /  /  '.___.'  \\   \\
   |  |  .-.___.-.  |   |  _.-'
   |  | /  / | \\  \\ |   |
   |  |/__/  |  \\__\\|   |
   |     /   |   \\      |
    \\___/  __|__  \\___/
       /__/  |  \\__\\
      (_/    |    \\_)
       /____/ \\____\\
      (_/          \\_)`,
  String.raw`          /\\_____/\\
       __/  o   o  \\__
      / ( ==  o  == ) \\
     /   \\  .---.  /   \\
    /  /  '.___.'  \\   \\
   |  |  .-.___.-.  |   |  _.-'
   |  | /  / | \\  \\ |  /|
   |  |/__/  |  \\__\\|_/ |
   |     /   |   \\       |
    \\___/  __|__  \\____/
       /__/  |  \\__\\
      (_/    |    \\_)
       /____/ \\____\\
      (_/          \\_)`,
  String.raw`          /\\_____/\\
       __/  o   o  \\__
      / ( ==  o  == ) \\
     /   \\  .---.  /   \\
    /  /  '.___.'  \\   \\
   |\\ |  .-.___.-.  |   |  _.-'
   | \\| /  / | \\  \\ |   |
   |  |/__/  |  \\__\\|   |
   |      /  |   \\      |
    \\____/ __|__  \\___/
       /__/  |  \\__\\
      (_/    |    \\_)
       /____/ \\____\\
      (_/          \\_)`
].map((frame) => frame.split('\n'));

function createCatFrame(rows, index) {
  return {
    rows,
    index,
    delay: `${index * -0.62}s`,
    duration: '3.2s',
    depth: Number((0.58 + index * 0.07).toFixed(2))
  };
}

function createCat() {
  return {
    label: 'miniature-detailed-cat',
    frames: catFrames.map(createCatFrame),
    shadow: null,
    decorations: [],
    paws: [],
    motion: { duration: '7.2s', delay: '-0.7s' }
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
