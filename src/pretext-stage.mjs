import { layoutNextLine, measureLineStats, prepareWithSegments } from './pretext/layout.js';
import { safeUrl } from './safe-url.mjs';
import { createV3State, filterCommandItems, v3Reducer } from './v3-interactive-state.mjs';

const REDUCED_MOTION = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function parseJsonScript(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  try {
    return JSON.parse(el.textContent || '');
  } catch {
    return fallback;
  }
}

function readFontShorthand(element) {
  const cs = getComputedStyle(element);
  const style = cs.fontStyle || 'normal';
  const weight = cs.fontWeight || '400';
  const size = cs.fontSize || '16px';
  const family = cs.fontFamily || 'Inter, system-ui, sans-serif';
  return {
    font: `${style} ${weight} ${size} ${family}`,
    lineHeight: Number.parseFloat(cs.lineHeight) || Number.parseFloat(size) * 1.65,
  };
}

function balanceHeadlines() {
  document.querySelectorAll('[data-pretext-balance]').forEach((heading) => {
    const text = (heading.textContent || '').trim();
    if (!text) return;
    const containerWidth = heading.parentElement?.clientWidth || heading.clientWidth;
    if (containerWidth < 200) return;
    const { font } = readFontShorthand(heading);
    try {
      const prepared = prepareWithSegments(text, font);
      const base = measureLineStats(prepared, containerWidth);
      if (base.lineCount <= 1) {
        heading.style.removeProperty('max-width');
        return;
      }
      let low = Math.floor(containerWidth * 0.56);
      let high = containerWidth;
      let best = containerWidth;
      for (let step = 0; step < 10; step += 1) {
        const mid = Math.floor((low + high) / 2);
        const stats = measureLineStats(prepared, mid);
        if (stats.lineCount <= base.lineCount) {
          best = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
      heading.style.maxWidth = `${Math.ceil(best + 4)}px`;
    } catch {
      heading.style.removeProperty('max-width');
    }
  });
}

function createBioPretextEngine() {
  const wrapEl = document.querySelector('[data-pretext-bio-wrap]');
  const sourceEl = document.querySelector('[data-pretext-bio-source]');
  const canvasEl = document.querySelector('[data-pretext-bio-lines]');
  if (!wrapEl || !sourceEl || !canvasEl) {
    return { reflow: () => {} };
  }

  const rawText = (sourceEl.textContent || '').replace(/\s+/g, ' ').trim();
  let prepared = null;
  let cachedFont = '';
  let cachedLineHeight = 25;

  const ensurePrepared = () => {
    const { font, lineHeight } = readFontShorthand(sourceEl);
    if (!prepared || cachedFont !== font) {
      prepared = prepareWithSegments(rawText, font);
      cachedFont = font;
      cachedLineHeight = lineHeight;
    }
  };

  const reflow = ({ pulse = false } = {}) => {
    ensurePrepared();
    const wrapWidth = Math.floor(wrapEl.clientWidth);
    const desktopRail = window.innerWidth >= 900;
    if (!desktopRail || wrapWidth < 240 || !prepared) {
      wrapEl.dataset.pretextMode = 'native';
      wrapEl.dataset.pretextEngine = 'chenglou-pretext';
      sourceEl.classList.remove('v3-bio-sr-only');
      canvasEl.replaceChildren();
      canvasEl.style.removeProperty('min-height');
      return;
    }

    // Use Pretext binary-search shrinkwrap to avoid ragged last-line orphans while preserving exact line count
    const baseStats = measureLineStats(prepared, wrapWidth);
    let targetWidth = wrapWidth;
    if (baseStats.lineCount >= 3) {
      let low = Math.floor(wrapWidth * 0.86);
      let high = wrapWidth;
      for (let step = 0; step < 8; step += 1) {
        const mid = Math.floor((low + high) / 2);
        const stats = measureLineStats(prepared, mid);
        if (stats.lineCount <= baseStats.lineCount) {
          targetWidth = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
      targetWidth = Math.min(wrapWidth, targetWidth + 4);
    }

    const lines = [];
    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;

    for (let guard = 0; guard < 40; guard += 1) {
      const line = layoutNextLine(prepared, targetWidth, cursor);
      if (!line) break;
      lines.push({ text: line.text, y });
      cursor = line.end;
      y += cachedLineHeight;
    }

    const fragment = document.createDocumentFragment();
    lines.forEach((line, index) => {
      const row = document.createElement('span');
      row.className = pulse && !REDUCED_MOTION() ? 'v3-bio-line v3-bio-line-pulse' : 'v3-bio-line';
      row.textContent = line.text;
      row.style.setProperty('--line-index', String(index));
      row.style.top = `${Math.round(line.y)}px`;
      fragment.append(row);
    });

    canvasEl.replaceChildren(fragment);
    canvasEl.style.minHeight = `${Math.ceil(y)}px`;
    sourceEl.classList.add('v3-bio-sr-only');
    wrapEl.dataset.pretextMode = 'active';
    wrapEl.dataset.pretextEngine = 'chenglou-pretext';
    wrapEl.dataset.pretextLines = String(lines.length);
  };

  const ro = new ResizeObserver(() => {
    balanceHeadlines();
    reflow({ pulse: false });
  });
  ro.observe(wrapEl);

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      cachedFont = '';
      balanceHeadlines();
      reflow({ pulse: true });
    });
  } else {
    balanceHeadlines();
    reflow({ pulse: true });
  }

  return { reflow };
}
const RAN_PHASES = [
  { link: 0, nodes: [0], beam: 'ul', led: '0', tone: 'primary' },
  { link: 1, nodes: [1], beam: '', led: '1', tone: 'primary' },
  { link: 2, nodes: [1, 2], beam: '', led: '2', tone: 'secondary' },
  { link: 3, nodes: [0, 1], beam: 'dl', led: 'ant', tone: 'secondary' },
];

function createRanNetworkEngine() {
  const stage = document.querySelector('[data-ran-stage]');
  if (!stage) return { reflow: () => {} };

  const links = new Map(
    [...stage.querySelectorAll('[data-ran-link]')].map((el) => [Number(el.dataset.ranLink), el]),
  );
  const nodes = [...stage.querySelectorAll('[data-ran-node]')];
  const beams = [...stage.querySelectorAll('[data-ran-beam]')];
  const leds = [...stage.querySelectorAll('[data-ran-led]')];
  const pktGroup = stage.querySelector('[data-ran-packet]');
  const pktHalo = stage.querySelector('.ran-pkt-halo');
  const pktCore = stage.querySelector('.ran-pkt-core');

  let activePhase = 0;
  const playing = !REDUCED_MOTION();
  let phaseStart = performance.now();
  const PHASE_MS = 1900;

  const placePacket = (progress) => {
    const phase = RAN_PHASES[activePhase] || RAN_PHASES[0];
    const path = links.get(phase.link);
    if (!path || !pktGroup || typeof path.getTotalLength !== 'function') return;
    const len = path.getTotalLength();
    const t = phase.link === 2
      ? (progress < 0.5 ? progress * 2 : (1 - progress) * 2)
      : progress;
    const pt = path.getPointAtLength(len * Math.max(0.05, Math.min(0.95, t)));
    pktGroup.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
  };

  const selectPhase = (idx) => {
    activePhase = ((idx % RAN_PHASES.length) + RAN_PHASES.length) % RAN_PHASES.length;
    phaseStart = performance.now();
    const phase = RAN_PHASES[activePhase];
    stage.dataset.ranPhase = String(activePhase);
    links.forEach((el, id) => { el.dataset.active = id === phase.link ? 'true' : 'false'; });
    nodes.forEach((el) => {
      const id = Number(el.dataset.ranNode);
      el.dataset.active = phase.nodes.includes(id) ? 'true' : 'false';
    });
    beams.forEach((el) => { el.dataset.active = el.dataset.ranBeam === phase.beam ? 'true' : 'false'; });
    leds.forEach((el) => { el.dataset.active = el.dataset.ranLed === phase.led ? 'true' : 'false'; });
    const isSec = phase.tone === 'secondary';
    if (pktHalo) pktHalo.setAttribute('fill', isSec ? 'var(--accent-secondary)' : 'var(--accent-primary)');
    if (pktCore) pktCore.setAttribute('fill', isSec ? 'var(--accent-2)' : 'var(--accent)');
    placePacket(playing ? 0.08 : 0.5);
  };

  const tick = (now) => {
    if (!playing) return;
    const elapsed = now - phaseStart;
    if (elapsed >= PHASE_MS) {
      selectPhase(activePhase + 1);
    } else {
      const t = elapsed / PHASE_MS;
      const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      placePacket(eased);
    }
    window.requestAnimationFrame(tick);
  };

  nodes.forEach((node) => {
    const activate = () => selectPhase(Number(node.dataset.ranNode || 0));
    node.addEventListener('click', activate);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });

  selectPhase(0);
  if (playing) window.requestAnimationFrame(tick);
  return { reflow: () => placePacket(0.5) };
}

function setupInteractiveV3() {
  const commandItems = parseJsonScript('command-index-data', []);
  let state = createV3State({ commandItems });
  const bioEngine = createBioPretextEngine();
  const ranEngine = createRanNetworkEngine();
  balanceHeadlines();
  const cmdBackdrop = document.querySelector('[data-cmd-backdrop]');
  const cmdInput = document.querySelector('[data-cmd-input]');
  const cmdResults = document.querySelector('[data-cmd-results]');
  const cmdOpenBtns = document.querySelectorAll('[data-cmd-open]');
  const cmdCloseBtn = document.querySelector('[data-cmd-close]');

  const renderCommand = (focusInput) => {
    if (!cmdBackdrop || !cmdInput || !cmdResults) return;
    cmdBackdrop.hidden = !state.commandOpen;
    if (!state.commandOpen) return;

    if (cmdInput.value !== state.commandQuery) {
      cmdInput.value = state.commandQuery;
    }
    const matches = filterCommandItems(state.commandItems, state.commandQuery);
    const fragment = document.createDocumentFragment();
    if (matches.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'v3-cmd-empty';
      empty.textContent = 'No matching pages, papers, or projects.';
      fragment.append(empty);
    } else {
      matches.forEach((item, index) => {
        const href = safeUrl(item.url) || '/';
        const row = document.createElement('a');
        row.className = 'v3-cmd-item';
        row.href = href;
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', index === state.commandActiveIndex ? 'true' : 'false');

        const left = document.createElement('span');
        left.className = 'v3-cmd-label';
        left.textContent = item.label;

        const right = document.createElement('span');
        right.className = 'v3-cmd-meta';
        right.textContent = item.shortcut ? `${item.section} · [${item.shortcut}]` : item.section;

        row.append(left, right);
        fragment.append(row);
      });
    }
    cmdResults.replaceChildren(fragment);
    if (focusInput) {
      requestAnimationFrame(() => cmdInput.focus());
    }
  };

  const dispatch = (event) => {
    const step = v3Reducer(state, event);
    state = step.state;
    for (const effect of step.effects) {
      if (effect.type === 'render-command') renderCommand(effect.focusInput);
    }
  };

  cmdOpenBtns.forEach((btn) => {
    btn.addEventListener('click', () => dispatch({ type: 'cmd.open' }));
  });
  cmdCloseBtn?.addEventListener('click', () => dispatch({ type: 'cmd.close' }));
  cmdBackdrop?.addEventListener('click', (evt) => {
    if (evt.target === cmdBackdrop) dispatch({ type: 'cmd.close' });
  });
  cmdInput?.addEventListener('input', (evt) => {
    dispatch({ type: 'cmd.query', query: evt.currentTarget.value });
  });
  cmdInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      dispatch({ type: 'cmd.move', delta: 1 });
    } else if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      dispatch({ type: 'cmd.move', delta: -1 });
    } else if (evt.key === 'Enter') {
      const matches = filterCommandItems(state.commandItems, state.commandQuery);
      const picked = matches[state.commandActiveIndex];
      const href = picked ? safeUrl(picked.url) : null;
      if (href) {
        evt.preventDefault();
        window.location.assign(href);
      }
    }
  });

  document.addEventListener('keydown', (evt) => {
    if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === 'k') {
      if (!cmdBackdrop) return;
      evt.preventDefault();
      dispatch({ type: state.commandOpen ? 'cmd.close' : 'cmd.open' });
      return;
    }
    if (evt.key === 'Escape' && state.commandOpen) {
      evt.preventDefault();
      dispatch({ type: 'cmd.close' });
    }
  });

  document.querySelectorAll('[data-copy-bibtex]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bib = btn.getAttribute('data-copy-bibtex') || '';
      if (!bib) return;
      const labelEl = btn.querySelector('[data-copy-label]') || btn;
      const original = labelEl.textContent;
      try {
        await navigator.clipboard.writeText(bib);
        labelEl.textContent = 'Copied BibTeX';
      } catch {
        labelEl.textContent = 'BibTeX ready';
      }
      setTimeout(() => {
        labelEl.textContent = original;
      }, 1600);
    });
  });

  document.querySelectorAll('[data-copy-code]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const block = btn.closest('.code-block');
      const code = block?.querySelector('pre code')?.textContent || '';
      if (!code) return;
      const original = btn.textContent;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Ready';
      }
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    });
  });

  document.querySelector('[data-cv-print]')?.addEventListener('click', () => {
    window.print();
  });
  window.addEventListener('pageshow', (evt) => {
    if (state.commandOpen) dispatch({ type: 'cmd.close' });
    if (evt.persisted) {
      bioEngine.reflow({ pulse: false });
      ranEngine.reflow();
    }
  });

  document.body.dataset.v3StageReady = 'true';
}

setupInteractiveV3();
