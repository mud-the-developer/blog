import { layoutWithLines, prepareWithSegments, walkLineRanges } from './vendor/pretext/layout.mjs';

const HERO_SELECTOR = '[data-home-hero]';
const ORB_COUNT = 3;
const ORB_PRESETS = [
  { x: 0.78, y: 0.18, r: 88, dx: 18, dy: 14, speed: 0.00022 },
  { x: 0.9, y: 0.74, r: 110, dx: -16, dy: 12, speed: 0.00016 },
  { x: 0.56, y: 0.86, r: 62, dx: 12, dy: -10, speed: 0.00028 },
];

const state = new WeakMap();
let rafId = null;
let introTimer = null;

function boot() {
  const stage = document.querySelector(HERO_SELECTOR);
  if (!(stage instanceof HTMLElement)) return;
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return;

  const layers = createLayers(stage);
  const hero = {
    stage,
    layers,
    expanded: false,
    headlinePrepared: null,
    deckPrepared: null,
    kickerPrepared: null,
    lastWidth: 0,
    lastHeight: 0,
  };
  state.set(stage, hero);

  window.addEventListener('resize', scheduleRender, { passive: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleRender, scheduleRender);
  }
  scheduleRender();
  introTimer = window.setTimeout(() => {
    hero.expanded = true;
    scheduleRender();
  }, 180);
}

function createLayers(stage) {
  stage.classList.add('is-enhanced');
  const layer = document.createElement('div');
  layer.className = 'home-hero-layer';
  stage.appendChild(layer);

  const kicker = document.createElement('div');
  kicker.className = 'home-hero-kicker';
  layer.appendChild(kicker);

  const deck = document.createElement('div');
  deck.className = 'home-hero-deck';
  layer.appendChild(deck);

  const note = document.createElement('div');
  note.className = 'home-hero-note';
  note.textContent = 'Live archive · static build · animated type';
  layer.appendChild(note);

  const headlineLines = [];
  for (let i = 0; i < 8; i += 1) {
    const line = document.createElement('span');
    line.className = 'home-hero-line';
    line.style.opacity = '0';
    layer.appendChild(line);
    headlineLines.push(line);
  }

  const deckLines = [];
  for (let i = 0; i < 4; i += 1) {
    const line = document.createElement('span');
    line.className = 'home-hero-deck';
    line.style.opacity = '0';
    layer.appendChild(line);
    deckLines.push(line);
  }

  const orbs = [];
  for (let i = 0; i < ORB_COUNT; i += 1) {
    const orb = document.createElement('div');
    orb.className = `home-hero-orb home-hero-orb--${i}`;
    layer.appendChild(orb);
    orbs.push(orb);
  }

  return { layer, kicker, note, headlineLines, deckLines, orbs };
}

function scheduleRender() {
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(now => {
    rafId = null;
    render(now);
  });
}

function render(now) {
  const stage = document.querySelector(HERO_SELECTOR);
  if (!(stage instanceof HTMLElement)) return;
  const hero = state.get(stage);
  if (!hero) return;

  const width = Math.floor(stage.clientWidth || stage.getBoundingClientRect().width);
  const height = Math.floor(stage.clientHeight || stage.getBoundingClientRect().height);
  if (width <= 0 || height <= 0) return;

  const paddingX = Math.max(28, Math.round(width * 0.05));
  const paddingTop = Math.max(28, Math.round(height * 0.08));
  const headlineWidth = Math.round((hero.expanded ? 0.62 : 0.48) * width) - paddingX * 2;
  const deckWidth = Math.min(Math.round(width * 0.36), 380);

  const kickerText = stage.dataset.kicker || 'Signal notebook';
  const headlineText = stage.dataset.headline || '';
  const deckText = stage.dataset.deck || '';

  const headlineFit = fitHeadline(headlineText, headlineWidth, Math.round(height * 0.42));
  const deckFont = '500 20px Inter, Helvetica Neue, Arial, sans-serif';
  const deckLineHeight = 30;
  const kickerFont = '600 13px Inter, Helvetica Neue, Arial, sans-serif';

  hero.layers.kicker.textContent = kickerText.toUpperCase();
  hero.layers.kicker.style.left = `${paddingX}px`;
  hero.layers.kicker.style.top = `${paddingTop}px`;
  hero.layers.note.style.left = `${paddingX}px`;
  hero.layers.note.style.bottom = `${Math.max(28, Math.round(height * 0.08))}px`;

  const headlineTop = paddingTop + 36;
  renderLines(hero.layers.headlineLines, headlineFit.lines, paddingX, headlineTop, headlineFit.lineHeight, 0);

  const deckPrepared = getPrepared(deckText, deckFont, hero, 'deckPrepared');
  const deckLayout = layoutWithLines(deckPrepared, deckWidth, deckLineHeight);
  const deckLeft = Math.max(paddingX, width - deckWidth - paddingX);
  const deckTop = Math.max(headlineTop + headlineFit.lines.length * headlineFit.lineHeight + 18, height - deckLayout.height - 84);
  renderLines(hero.layers.deckLines, deckLayout.lines, deckLeft, deckTop, deckLineHeight, 120);

  animateOrbs(hero.layers.orbs, width, height, now);
}

function fitHeadline(text, maxWidth, maxHeight) {
  let low = 58;
  let high = 132;
  let best = { size: 72, lines: [], lineHeight: 74 };
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const font = `700 ${mid}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
    const lineHeight = Math.round(mid * 0.92);
    const prepared = prepareWithSegments(text, font);
    const layout = layoutWithLines(prepared, maxWidth, lineHeight);
    const lineCount = countLines(prepared, maxWidth);
    const breaksInsideWord = hasMidWordBreak(prepared, maxWidth);
    if (layout.height <= maxHeight && lineCount <= 4 && !breaksInsideWord) {
      best = { size: mid, lines: layout.lines, lineHeight };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function countLines(prepared, maxWidth) {
  let count = 0;
  walkLineRanges(prepared, maxWidth, () => {
    count += 1;
  });
  return count;
}

function hasMidWordBreak(prepared, maxWidth) {
  let midWord = false;
  walkLineRanges(prepared, maxWidth, line => {
    if (line.end.graphemeIndex !== 0) {
      midWord = true;
    }
  });
  return midWord;
}

function getPrepared(text, font, hero, key) {
  const preparedKey = `${font}__${text}`;
  const current = hero[key];
  if (current && current.key === preparedKey) return current.prepared;
  const prepared = prepareWithSegments(text, font);
  hero[key] = { key: preparedKey, prepared };
  return prepared;
}

function renderLines(elements, lines, left, top, lineHeight, delayOffset) {
  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i];
    const line = lines[i];
    if (!line) {
      element.style.opacity = '0';
      continue;
    }
    element.textContent = line.text;
    element.style.transitionDelay = `${delayOffset + i * 60}ms`;
    element.style.transform = `translate(${left}px, ${top + i * lineHeight}px)`;
    element.style.opacity = '1';
    element.style.fontSize = lineHeight > 40 ? `${Math.round(lineHeight * 1.02)}px` : '';
  }
}

function animateOrbs(orbs, width, height, now) {
  for (let i = 0; i < orbs.length; i += 1) {
    const orb = orbs[i];
    const preset = ORB_PRESETS[i];
    const radius = preset.r * (width < 700 ? 0.62 : 1);
    const x = width * preset.x + Math.sin(now * preset.speed) * preset.dx;
    const y = height * preset.y + Math.cos(now * preset.speed * 1.12) * preset.dy;
    orb.style.width = `${radius * 2}px`;
    orb.style.height = `${radius * 2}px`;
    orb.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
  }
  scheduleRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
