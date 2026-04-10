import { layoutNextLine, layoutWithLines, prepareWithSegments } from './vendor/pretext/layout.mjs';

const STAGE_SELECTOR = '[data-note-web]';
const MAX_NODES = 14;
const MOBILE_NODES = 8;
const CARD_MIN_WIDTH = 132;
const CARD_MAX_WIDTH = 228;
const CARD_PADDING_X = 12;
const CARD_PADDING_Y = 12;
const CARD_LINE_HEIGHT = 22;
const CARD_TARGET_LINES = 3;
const ITERATIONS = 180;
const COMPACT_BREAKPOINT = 720;
const DEFAULT_DETAIL_TITLE = 'Archive atlas';
const DEFAULT_DETAIL_COPY =
  'Move through the slips to reveal one local thread at a time, then open the note from its nearby cluster.';
const FIELD_TOP = 22;
const FIELD_SIDE = 20;
const FIELD_GUTTER = 8;
const FIELD_VERTICAL_GUTTER = 2;
const FIELD_MIN_SPAN = 52;
const FIELD_FONT_SIZE = 12.5;
const FIELD_LINE_HEIGHT = 18;
const MOBILE_FIELD_FONT_SIZE = 11.25;
const MOBILE_FIELD_LINE_HEIGHT = 16;
const DRAG_THRESHOLD = 4;
const PHYSICS_DAMPING = 0.84;
const PHYSICS_REPULSION = 8200;
const PHYSICS_SPRING = 0.0034;
const PHYSICS_REST_LENGTH = 168;
const PHYSICS_COLLISION_PUSH = 0.12;
const PHYSICS_CENTERING = 0.0011;
const PHYSICS_SETTLE_EPSILON = 0.11;
const SIZE_RETRY_FRAMES = 24;
const START_CURSOR = Object.freeze({ segmentIndex: 0, graphemeIndex: 0 });
const DEFAULT_FIELD_TERMS = ['archive', 'notes', 'graph', 'brief', 'references'];

function readArchiveFieldEntries() {
  const element = document.getElementById('archive-field-data');
  if (!(element instanceof HTMLScriptElement)) return [];
  try {
    const parsed = JSON.parse(element.textContent || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readRootNumber(name, fallback) {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function atlasTuning() {
  return {
    cardMinWidth: readRootNumber('--atlas-card-min-width', CARD_MIN_WIDTH),
    cardMaxWidth: readRootNumber('--atlas-card-max-width', CARD_MAX_WIDTH),
    fontBase: readRootNumber('--atlas-card-font-base', 18),
    fontHub: readRootNumber('--atlas-card-font-hub', 20),
    fontBranch: readRootNumber('--atlas-card-font-branch', 18),
    fontLeaf: readRootNumber('--atlas-card-font-leaf', 16),
    fieldFontSize: readRootNumber('--atlas-field-font-size', FIELD_FONT_SIZE),
    fieldFontSizeMobile: readRootNumber('--atlas-field-font-size-mobile', MOBILE_FIELD_FONT_SIZE),
  };
}

function atlasFieldFont(size) {
  return `500 ${size}px "Iowan Old Style", "Palatino Linotype", Georgia, serif`;
}

function boot() {
  const stage = document.querySelector(STAGE_SELECTOR);
  if (!(stage instanceof HTMLElement)) return;

  const graphUrl = stage.dataset.graphUrl || '/graph.json';
  const archiveField = readArchiveFieldEntries();
  scheduleRender(stage, graphUrl, archiveField);
}

function scheduleRender(stage, graphUrl, archiveField, attempts = 0) {
  const width = Math.floor(stage.clientWidth || stage.getBoundingClientRect().width);
  const height = Math.floor(stage.clientHeight || stage.getBoundingClientRect().height);

  if ((width <= 0 || height <= 0) && attempts < SIZE_RETRY_FRAMES) {
    window.requestAnimationFrame(() => scheduleRender(stage, graphUrl, archiveField, attempts + 1));
    return;
  }

  render(stage, graphUrl, archiveField).catch(error => {
    console.error('note-web render failed', error);
    stage.textContent = '';
  });
}

async function render(stage, graphUrl, archiveField) {
  const response = await fetch(graphUrl, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('failed to load graph');
  const graph = await response.json();
  const data = buildSubset(graph, archiveField);
  if (data.nodes.length === 0) return;

  const width = Math.floor(stage.clientWidth || stage.getBoundingClientRect().width);
  const height = Math.floor(stage.clientHeight || stage.getBoundingClientRect().height);
  if (width <= 0 || height <= 0) return;

  const compact = width < COMPACT_BREAKPOINT;
  const tuning = atlasTuning();
  const desktopHeight = compact ? height : getDesktopStageHeight(stage, height);
  const sizing = compact
    ? {
        minWidth: Math.max(132, tuning.cardMinWidth),
        maxWidth: Math.min(248, tuning.cardMaxWidth + 18),
        lineHeight: 20,
        preferredLines: 3,
        fontSize: tuning.fontBranch,
      }
    : {
        minWidth: tuning.cardMinWidth,
        maxWidth: tuning.cardMaxWidth,
        lineHeight: CARD_LINE_HEIGHT,
        preferredLines: CARD_TARGET_LINES,
        fontSize: tuning.fontBase,
      };

  const sizedNodes = data.nodes
    .slice(0, compact ? MOBILE_NODES : MAX_NODES)
    .map(node => sizeNode(node, sizing));
  const filteredLinks = data.links.filter(
    link => sizedNodes.some(node => node.id === link.source) && sizedNodes.some(node => node.id === link.target),
  );
  const positions = compact
    ? solveCompactLayout(sizedNodes, width)
    : solveLayout(sizedNodes, filteredLinks, width, desktopHeight);
  const compactHeight =
    Math.max(...Array.from(positions.values()).map(position => position.y + position.h), 0) + 24;

  stage.textContent = '';
  stage.style.height = `${compact ? compactHeight : desktopHeight}px`;

  const sceneHeight = compact ? compactHeight : desktopHeight;

  const textLayer = document.createElement('div');
  textLayer.className = 'note-web-text-layer';
  stage.appendChild(textLayer);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'note-web-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${sceneHeight}`);
  stage.appendChild(svg);

  const fragment = document.createDocumentFragment();
  const nodeById = new Map();
  const neighborMap = buildNeighborMap(filteredLinks);
  const lines = [];
  const state = {
    compact,
    width,
    height: sceneHeight,
    centerX: width * 0.52,
    centerY: sceneHeight * 0.5,
    textLayer,
    textPreparedDesktop: prepareWithSegments(buildFieldText(archiveField, false), atlasFieldFont(tuning.fieldFontSize)),
    textPreparedMobile: prepareWithSegments(buildFieldText(archiveField, true), atlasFieldFont(tuning.fieldFontSizeMobile)),
    nodes: sizedNodes.map(node => ({ ...node, position: positions.get(node.id) })),
    links: filteredLinks,
    neighborMap,
    linkPairs: filteredLinks.map(link => [link.source, link.target]),
    svgLines: lines,
    activeId: '',
    dragging: null,
    skipClickId: '',
    animationFrame: 0,
  };

  for (const link of filteredLinks) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'note-web-link');
    path.dataset.source = link.source;
    path.dataset.target = link.target;
    svg.appendChild(path);
    lines.push(path);
  }

  const detailTitle = document.getElementById('note-web-detail-title');
  const detailCopy = document.getElementById('note-web-detail-copy');
  const detailLink = document.getElementById('note-web-detail-link');

  const applyDetailState = ({ title, copy, href, hidden }) => {
    if (detailTitle) detailTitle.textContent = title;
    if (detailCopy) detailCopy.textContent = copy;
    if (detailLink instanceof HTMLAnchorElement) {
      detailLink.hidden = hidden;
      detailLink.href = href;
      detailLink.textContent = 'Open note';
    }
  };

  const setActive = nodeId => {
    const active = nodeById.get(nodeId);
    if (!active) return;
    state.activeId = nodeId;
    const neighbors = neighborMap.get(nodeId) || new Set();
    const hasActive = Boolean(nodeId);

    for (const [id, entry] of nodeById.entries()) {
      const visible = id === nodeId || neighbors.has(id);
      entry.el.classList.toggle('is-active', visible);
      entry.el.classList.toggle('is-dim', hasActive && !visible);
    }

    for (const line of lines) {
      const source = line.dataset.source;
      const target = line.dataset.target;
      const visible = source === nodeId || target === nodeId;
      line.classList.toggle('is-active', visible);
      line.classList.toggle('is-dim', hasActive && !visible);
    }

    applyDetailState({
      title: active.title,
      copy:
        active.excerpt ||
        (neighbors.size > 0
          ? 'Open this note to read the full entry inside its local cluster.'
          : 'Open this note to read the full entry in the archive.'),
      href: active.url,
      hidden: false,
    });
  };

  const clearActive = () => {
    if (state.dragging) return;
    state.activeId = '';
    for (const [, entry] of nodeById.entries()) {
      entry.el.classList.remove('is-active');
      entry.el.classList.remove('is-dim');
    }
    for (const line of lines) {
      line.classList.remove('is-active');
      line.classList.remove('is-dim');
    }
    applyDetailState({
      title: DEFAULT_DETAIL_TITLE,
      copy: DEFAULT_DETAIL_COPY,
      href: '/',
      hidden: true,
    });
  };

  for (const node of state.nodes) {
    const card = document.createElement('button');
    card.className = `note-web-card note-web-card--${node.tier}`;
    card.type = 'button';
    card.style.width = `${node.w}px`;
    card.style.height = `${node.h}px`;

    const kicker = document.createElement('span');
    kicker.className = 'note-web-card-kicker';
    const folder = document.createElement('span');
    folder.textContent = node.folder || 'notes';
    const taxon = document.createElement('span');
    taxon.textContent = node.tags?.[0] || node.aliases?.[0] || node.tier;
    kicker.append(folder, taxon);
    card.appendChild(kicker);

    const labelWrap = document.createElement('span');
    labelWrap.className = 'note-web-card-label';
    card.style.setProperty('--note-web-card-font-size', `${node.fontSize}px`);
    for (const lineText of node.lines) {
      const line = document.createElement('span');
      line.className = 'note-web-card-line';
      line.textContent = lineText.length > 0 ? lineText : '\u00A0';
      labelWrap.appendChild(line);
    }
    card.appendChild(labelWrap);

    if (node.excerpt && node.tier !== 'leaf') {
      const excerpt = document.createElement('span');
      excerpt.className = 'note-web-card-excerpt';
      excerpt.textContent = node.excerpt;
      card.appendChild(excerpt);
    }

    card.addEventListener('pointerenter', () => setActive(node.id));
    card.addEventListener('focus', () => setActive(node.id));
    card.addEventListener('pointerleave', clearActive);
    card.addEventListener('blur', clearActive);
    card.addEventListener('pointerdown', event => startDrag(event, node.id));
    card.addEventListener('click', () => {
      if (state.skipClickId === node.id) {
        state.skipClickId = '';
        return;
      }
      window.location.href = node.url;
    });

    node.el = card;
    nodeById.set(node.id, node);
    fragment.appendChild(card);
  }

  stage.appendChild(fragment);
  renderScene(state, neighborMap);

  function startDrag(event, nodeId) {
    const node = nodeById.get(nodeId);
    if (!node) return;
    const rect = node.el.getBoundingClientRect();
    state.dragging = {
      id: nodeId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
      targetX: node.position.x,
      targetY: node.position.y,
      moved: false,
    };
    node.el.setPointerCapture?.(event.pointerId);
    setActive(nodeId);
    ensurePhysicsLoop(state);
    event.preventDefault();
  }

  stage.addEventListener('pointermove', event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const node = nodeById.get(state.dragging.id);
    if (!node) return;
    const x = event.clientX - stage.getBoundingClientRect().left - state.dragging.offsetX;
    const y = event.clientY - stage.getBoundingClientRect().top - state.dragging.offsetY;
    if (
      Math.hypot(event.clientX - state.dragging.startClientX, event.clientY - state.dragging.startClientY) >
      DRAG_THRESHOLD
    ) {
      state.dragging.moved = true;
    }
    state.dragging.targetX = clamp(x, 18, state.width - node.w - 18);
    state.dragging.targetY = clamp(y, 18, state.height - node.h - 18);
    if (state.compact) {
      node.position.x = state.dragging.targetX;
      node.position.y = state.dragging.targetY;
      renderScene(state, neighborMap);
    } else {
      ensurePhysicsLoop(state);
    }
  });

  const endDrag = event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const node = nodeById.get(state.dragging.id);
    node?.el.releasePointerCapture?.(event.pointerId);
    const moved = state.dragging.moved;
    const dragId = state.dragging.id;
    state.dragging = null;
    if (!moved) {
      setActive(node?.id || '');
    } else {
      state.skipClickId = dragId;
    }
    ensurePhysicsLoop(state);
  };

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
}

function renderScene(state, neighborMap) {
  renderText(state);
  renderLines(state);
  const activeNeighbors = state.activeId ? neighborMap.get(state.activeId) || new Set() : new Set();

  for (const node of state.nodes) {
    node.el.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`;
    node.el.classList.toggle('is-active', state.activeId === node.id || activeNeighbors.has(node.id));
  }
}

function renderText(state) {
  const tuning = atlasTuning();
  const lineHeight = state.compact ? MOBILE_FIELD_LINE_HEIGHT : FIELD_LINE_HEIGHT;
  const fontSize = state.compact ? tuning.fieldFontSizeMobile : tuning.fieldFontSize;
  const prepared = state.compact ? state.textPreparedMobile : state.textPreparedDesktop;
  const rows = Math.floor((state.height - FIELD_TOP * 2) / lineHeight);
  const fragment = document.createDocumentFragment();
  let cursor = START_CURSOR;

  for (let row = 0; row < rows; row += 1) {
    const y = FIELD_TOP + row * lineHeight;
    const spans = buildSpans(state.nodes, y, lineHeight, state.width, state.compact);
    for (const span of spans) {
      let line = layoutNextLine(prepared, cursor, span.width);
      if (line === null) {
        cursor = START_CURSOR;
        line = layoutNextLine(prepared, cursor, span.width);
      }
      if (line === null || line.text.trim().length === 0) continue;
      const element = document.createElement('span');
      element.className = 'note-web-text-line';
      element.textContent = line.text;
      element.style.left = `${span.x}px`;
      element.style.top = `${y}px`;
      element.style.fontSize = `${fontSize}px`;
      fragment.appendChild(element);
      cursor = line.end;
    }
  }

  state.textLayer.replaceChildren(fragment);
}

function buildSpans(nodes, y, lineHeight, width, compact) {
  const bandTop = y - FIELD_VERTICAL_GUTTER;
  const bandBottom = y + lineHeight + FIELD_VERTICAL_GUTTER;
  const padding = compact ? 6 : FIELD_GUTTER;
  const minX = FIELD_SIDE;
  const maxX = width - FIELD_SIDE;
  const intervals = [];

  for (const node of nodes) {
    const top = node.position.y - padding;
    const bottom = node.position.y + node.h + padding;
    if (bottom <= bandTop || top >= bandBottom) continue;
    intervals.push({
      start: clamp(node.position.x - padding, minX, maxX),
      end: clamp(node.position.x + node.w + padding, minX, maxX),
    });
  }

  intervals.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  const spans = [];
  let cursor = minX;
  for (const interval of merged) {
    if (interval.start - cursor >= FIELD_MIN_SPAN) {
      spans.push({ x: cursor, width: interval.start - cursor });
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (maxX - cursor >= FIELD_MIN_SPAN) {
    spans.push({ x: cursor, width: maxX - cursor });
  }
  return spans;
}

function buildFieldText(entries, compact) {
  const separator = compact ? ' · ' : '  ·  ';
  const targetLength = compact ? 1800 : 4200;
  const terms = collectFieldTerms(entries, compact);
  let text = '';
  while (text.length < targetLength) {
    text += `${terms.join(separator)}${separator}`;
  }
  return text;
}

function collectFieldTerms(entries, compact) {
  const terms = [];
  const pushTerm = value => {
    const cleaned = collapseWhitespace(String(value || ''))
      .replace(/[^\p{L}\p{N}\s\-–—/:&]/gu, '')
      .trim();
    if (!cleaned || cleaned.length < 3) return;
    if (terms.some(term => term.toLowerCase() === cleaned.toLowerCase())) return;
    terms.push(cleaned);
  };

  for (const entry of entries) {
    pushTerm(entry.title);
    pushTerm(entry.folder);
    for (const tag of entry.tags || []) pushTerm(tag);
    for (const alias of entry.aliases || []) pushTerm(alias);
    const excerptWords = collapseWhitespace(entry.excerpt || '').split(/\s+/).slice(0, compact ? 10 : 16);
    if (excerptWords.length > 2) {
      pushTerm(excerptWords.join(' '));
    }
  }

  return terms.length > 0 ? terms : DEFAULT_FIELD_TERMS;
}

function getDesktopStageHeight(stage, fallbackHeight) {
  const layout = stage.closest('.graph-main-layout');
  if (!(layout instanceof HTMLElement)) return fallbackHeight;
  const side = layout.querySelector('.graph-main-side');
  if (!(side instanceof HTMLElement)) return fallbackHeight;
  const sideHeight = Math.ceil(side.getBoundingClientRect().height);
  return sideHeight > 0 ? sideHeight : fallbackHeight;
}

function renderLines(state) {
  for (const linkEl of state.svgLines) {
    const source = state.nodes.find(node => node.id === linkEl.dataset.source);
    const target = state.nodes.find(node => node.id === linkEl.dataset.target);
    if (!source || !target) continue;
    const x1 = source.position.x + source.w / 2;
    const y1 = source.position.y + source.h / 2;
    const x2 = target.position.x + target.w / 2;
    const y2 = target.position.y + target.h / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const curve = Math.max(12, Math.min(48, Math.hypot(dx, dy) * 0.12));
    const cx = x1 + dx * 0.5 + (Math.abs(dy) < Math.abs(dx) ? 0 : (dx >= 0 ? curve : -curve));
    const cy = y1 + dy * 0.5 - (dx >= 0 ? curve : -curve);
    linkEl.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
  }
}

function buildSubset(graph, archiveField) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const links = Array.isArray(graph.links) ? graph.links : [];
  const degree = new Map();
  const metaByUrl = new Map(
    archiveField.map(entry => [String(entry.url || '').replace(/\/+$/, '') + '/', entry]),
  );

  for (const node of nodes) degree.set(node.id, 0);
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const adjacency = buildNeighborMap(links);
  const selected = [];
  const visited = new Set();
  const queue = ['home'];

  while (queue.length > 0 && selected.length < MAX_NODES) {
    const id = queue.shift();
    if (!id || visited.has(id) || !nodeById.has(id)) continue;
    visited.add(id);
    const rawNode = nodeById.get(id);
    selected.push(enrichNode(rawNode, metaByUrl, degree.get(id) || 0));
    const neighbors = Array.from(adjacency.get(id) || []).sort(
      (a, b) => (degree.get(b) || 0) - (degree.get(a) || 0),
    );
    queue.push(...neighbors);
  }

  if (selected.length < MAX_NODES) {
    const remaining = nodes
      .filter(node => !visited.has(node.id))
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));
    selected.push(
      ...remaining
        .slice(0, MAX_NODES - selected.length)
        .map(node => enrichNode(node, metaByUrl, degree.get(node.id) || 0)),
    );
  }

  const ids = new Set(selected.map(node => node.id));
  const filteredLinks = links.filter(link => ids.has(link.source) && ids.has(link.target));
  const sortedNodes = selected.sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));

  return {
    nodes: sortedNodes,
    links: filteredLinks,
  };
}

function enrichNode(node, metaByUrl, degree) {
  const meta = metaByUrl.get(String(node.url || '').replace(/\/+$/, '') + '/') || {};
  return {
    ...node,
    folder: meta.folder || inferFolder(node.id),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    aliases: Array.isArray(meta.aliases) ? meta.aliases : [],
    excerpt: meta.excerpt || '',
    degree,
    tier: nodeTier(node.id, degree),
  };
}

function inferFolder(id) {
  if (id === 'home') return 'home';
  const [folder] = String(id || '').split('/');
  return folder || 'notes';
}

function nodeTier(id, degree) {
  if (id === 'home' || degree >= 4) return 'hub';
  if (degree >= 2) return 'branch';
  return 'leaf';
}

function buildNeighborMap(links) {
  const map = new Map();
  for (const link of links) {
    if (!map.has(link.source)) map.set(link.source, new Set());
    if (!map.has(link.target)) map.set(link.target, new Set());
    map.get(link.source).add(link.target);
    map.get(link.target).add(link.source);
  }
  return map;
}

function sizeNode(node, sizing) {
  const tuning = atlasTuning();
  const tierScale =
    node.tier === 'hub'
      ? { min: Math.max(sizing.minWidth + 32, 184), max: Math.min(sizing.maxWidth + 44, 276), font: tuning.fontHub, lines: sizing.preferredLines + 1 }
      : node.tier === 'branch'
        ? { min: Math.max(sizing.minWidth + 18, 156), max: Math.min(sizing.maxWidth + 20, 244), font: tuning.fontBranch, lines: sizing.preferredLines }
        : { min: sizing.minWidth, max: Math.min(sizing.maxWidth - 8, 212), font: tuning.fontLeaf, lines: Math.max(2, sizing.preferredLines - 1) };
  const font = `700 ${tierScale.font}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
  const prepared = prepareWithSegments(node.title, font);
  let chosen = null;

  for (let width = tierScale.min; width <= tierScale.max; width += 8) {
    const layout = layoutWithLines(prepared, width - CARD_PADDING_X * 2, sizing.lineHeight);
    if (layout.lineCount <= tierScale.lines) {
      chosen = { width, layout };
      break;
    }
  }

  if (!chosen) {
    chosen = {
      width: tierScale.max,
      layout: layoutWithLines(prepared, tierScale.max - CARD_PADDING_X * 2, sizing.lineHeight),
    };
  }

  return {
    id: node.id,
    title: node.title,
    url: node.url,
    folder: node.folder,
    tags: node.tags,
    aliases: node.aliases,
    excerpt: node.excerpt,
    degree: node.degree,
    tier: node.tier,
    fontSize: tierScale.font,
    w: chosen.width,
    h:
      CARD_PADDING_Y * 2 +
      chosen.layout.lineCount * sizing.lineHeight +
      (node.tier === 'leaf' ? 20 : 52),
    lines: chosen.layout.lines.map(line => line.text),
  };
}

function solveLayout(nodes, links, width, height) {
  const positions = new Map();
  const hubNodes = nodes.filter(node => node.tier === 'hub');
  const branchNodes = nodes.filter(node => node.tier === 'branch');
  const leafNodes = nodes.filter(node => node.tier === 'leaf');

  const placeBand = (group, xCenter, top, bottom) => {
    const span = bottom - top;
    group.forEach((node, index) => {
      const ratio = group.length === 1 ? 0.5 : index / (group.length - 1);
      const yCenter = top + span * ratio;
      positions.set(node.id, {
        x: xCenter - node.w / 2,
        y: yCenter - node.h / 2,
        anchorX: xCenter - node.w / 2,
        anchorY: yCenter - node.h / 2,
        w: node.w,
        h: node.h,
        vx: 0,
        vy: 0,
      });
    });
  };

  placeBand(hubNodes, width * 0.26, 110, height - 130);
  placeBand(branchNodes, width * 0.53, 72, height - 96);
  placeBand(leafNodes, width * 0.76, 54, height - 78);

  const linkPairs = links.map(link => [link.source, link.target]);

  for (let i = 0; i < ITERATIONS; i += 1) {
    for (const node of nodes) {
      const position = positions.get(node.id);
      position.vx *= 0.88;
      position.vy *= 0.88;
    }

    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const pa = positions.get(nodes[a].id);
        const pb = positions.get(nodes[b].id);
        const ax = pa.x + pa.w / 2;
        const ay = pa.y + pa.h / 2;
        const bx = pb.x + pb.w / 2;
        const by = pb.y + pb.h / 2;
        let dx = bx - ax;
        let dy = by - ay;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = 9000 / (dist * dist);
        dx /= dist;
        dy /= dist;
        pa.vx -= dx * force;
        pa.vy -= dy * force;
        pb.vx += dx * force;
        pb.vy += dy * force;
      }
    }

    for (const [sourceId, targetId] of linkPairs) {
      const source = positions.get(sourceId);
      const target = positions.get(targetId);
      let dx = target.x + target.w / 2 - (source.x + source.w / 2);
      let dy = target.y + target.h / 2 - (source.y + source.h / 2);
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const desired = 170;
      const force = (dist - desired) * 0.0032;
      dx /= dist;
      dy /= dist;
      source.vx += dx * force;
      source.vy += dy * force;
      target.vx -= dx * force;
      target.vy -= dy * force;
    }

    for (const node of nodes) {
      const position = positions.get(node.id);
      position.vx += (position.anchorX - position.x) * 0.008;
      position.vy += (position.anchorY - position.y) * 0.008;
      position.x += position.vx;
      position.y += position.vy;
      position.x = clamp(position.x, 22, width - position.w - 22);
      position.y = clamp(position.y, 22, height - position.h - 22);
    }
  }

  return positions;
}

function ensurePhysicsLoop(state) {
  if (state.compact || state.animationFrame) return;
  const tick = () => {
    state.animationFrame = 0;
    const moving = stepPhysics(state);
    renderScene(state, state.neighborMap);
    if (state.dragging || moving) {
      state.animationFrame = window.requestAnimationFrame(tick);
    }
  };
  state.animationFrame = window.requestAnimationFrame(tick);
}

function stepPhysics(state) {
  const draggingId = state.dragging?.id || '';
  const draggedNode = draggingId ? state.nodes.find(node => node.id === draggingId) : null;
  if (draggedNode && state.dragging) {
    draggedNode.position.x = state.dragging.targetX;
    draggedNode.position.y = state.dragging.targetY;
    draggedNode.position.vx = 0;
    draggedNode.position.vy = 0;
  }

  for (const node of state.nodes) {
    if (node.id === draggingId) continue;
    node.position.vx *= PHYSICS_DAMPING;
    node.position.vy *= PHYSICS_DAMPING;
  }

  for (let a = 0; a < state.nodes.length; a += 1) {
    for (let b = a + 1; b < state.nodes.length; b += 1) {
      const nodeA = state.nodes[a];
      const nodeB = state.nodes[b];
      const pa = nodeA.position;
      const pb = nodeB.position;
      const ax = pa.x + nodeA.w / 2;
      const ay = pa.y + nodeA.h / 2;
      const bx = pb.x + nodeB.w / 2;
      const by = pb.y + nodeB.h / 2;
      let dx = bx - ax;
      let dy = by - ay;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const force = PHYSICS_REPULSION / (dist * dist);
      dx /= dist;
      dy /= dist;
      if (nodeA.id !== draggingId) {
        pa.vx -= dx * force;
        pa.vy -= dy * force;
      }
      if (nodeB.id !== draggingId) {
        pb.vx += dx * force;
        pb.vy += dy * force;
      }

      const overlapX = Math.min(pa.x + nodeA.w, pb.x + nodeB.w) - Math.max(pa.x, pb.x);
      const overlapY = Math.min(pa.y + nodeA.h, pb.y + nodeB.h) - Math.max(pa.y, pb.y);
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          const push = overlapX * PHYSICS_COLLISION_PUSH;
          const direction = ax < bx ? -1 : 1;
          if (nodeA.id !== draggingId) pa.vx += direction * push;
          if (nodeB.id !== draggingId) pb.vx -= direction * push;
        } else {
          const push = overlapY * PHYSICS_COLLISION_PUSH;
          const direction = ay < by ? -1 : 1;
          if (nodeA.id !== draggingId) pa.vy += direction * push;
          if (nodeB.id !== draggingId) pb.vy -= direction * push;
        }
      }
    }
  }

  for (const [sourceId, targetId] of state.linkPairs) {
    const sourceNode = state.nodes.find(node => node.id === sourceId);
    const targetNode = state.nodes.find(node => node.id === targetId);
    if (!sourceNode || !targetNode) continue;
    const source = sourceNode.position;
    const target = targetNode.position;
    let dx = target.x + targetNode.w / 2 - (source.x + sourceNode.w / 2);
    let dy = target.y + targetNode.h / 2 - (source.y + sourceNode.h / 2);
    const dist = Math.max(Math.hypot(dx, dy), 1);
    const force = (dist - PHYSICS_REST_LENGTH) * PHYSICS_SPRING;
    dx /= dist;
    dy /= dist;
    if (sourceId !== draggingId) {
      source.vx += dx * force;
      source.vy += dy * force;
    }
    if (targetId !== draggingId) {
      target.vx -= dx * force;
      target.vy -= dy * force;
    }
  }

  let maxMotion = 0;
  for (const node of state.nodes) {
    if (node.id === draggingId) continue;
    const position = node.position;
    const anchorX = position.anchorX ?? position.x;
    const anchorY = position.anchorY ?? position.y;
    position.vx += (anchorX - position.x) * (PHYSICS_CENTERING * 6);
    position.vy += (anchorY - position.y) * (PHYSICS_CENTERING * 6);
    position.x += position.vx;
    position.y += position.vy;
    position.x = clamp(position.x, 18, state.width - node.w - 18);
    position.y = clamp(position.y, 18, state.height - node.h - 18);
    maxMotion = Math.max(maxMotion, Math.abs(position.vx), Math.abs(position.vy));
  }

  return maxMotion > PHYSICS_SETTLE_EPSILON;
}

function solveCompactLayout(nodes, width) {
  const positions = new Map();
  const columns = width < 430 ? 1 : 2;
  const sidePadding = 18;
  const gap = 14;
  const columnWidth = (width - sidePadding * 2 - gap * (columns - 1)) / columns;
  const columnHeights = Array.from({ length: columns }, () => 160);

  nodes.forEach((node, index) => {
    const column = index % columns;
    const x = sidePadding + column * (columnWidth + gap) + (columnWidth - node.w) / 2;
    const y = columnHeights[column];
    positions.set(node.id, {
      x,
      y,
      w: node.w,
      h: node.h,
      vx: 0,
      vy: 0,
    });
    columnHeights[column] += node.h + gap;
  });

  return positions;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
