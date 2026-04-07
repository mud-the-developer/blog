import { layoutNextLine, layoutWithLines, prepareWithSegments } from './vendor/pretext/layout.mjs';

const STAGE_SELECTOR = '[data-note-web]';
const MAX_NODES = 14;
const CARD_MIN_WIDTH = 128;
const CARD_MAX_WIDTH = 210;
const CARD_PADDING_X = 15;
const CARD_PADDING_Y = 14;
const CARD_LINE_HEIGHT = 24;
const CARD_MAX_LINES = 3;
const ITERATIONS = 180;
const COMPACT_BREAKPOINT = 720;
const TEXT_DESKTOP =
  'This archive keeps design-system thinking, AI papers, semantic communications, and daily signal tracking in one readable place. Drag the note cards and the introduction will continuously reflow around the graph.';
const TEXT_MOBILE =
  'Drag the note cards and the intro copy will reflow around the graph.';
const TEXT_FONT = '700 28px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const TEXT_LINE_HEIGHT = 36;
const MOBILE_TEXT_FONT = '700 19px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const MOBILE_TEXT_LINE_HEIGHT = 25;
const DEFAULT_DETAIL_TITLE = 'Hover a note';
const DEFAULT_DETAIL_COPY =
  'Connections light up here so the archive feels explorable instead of just sortable.';

function boot() {
  const stage = document.querySelector(STAGE_SELECTOR);
  if (!(stage instanceof HTMLElement)) return;

  const graphUrl = stage.dataset.graphUrl || '/graph.json';
  render(stage, graphUrl).catch(() => {
    stage.textContent = '';
  });
}

async function render(stage, graphUrl) {
  const response = await fetch(graphUrl, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('failed to load graph');
  const graph = await response.json();
  const data = buildSubset(graph);
  if (data.nodes.length === 0) return;

  const width = Math.floor(stage.clientWidth || stage.getBoundingClientRect().width);
  const height = Math.floor(stage.clientHeight || stage.getBoundingClientRect().height);
  if (width <= 0 || height <= 0) return;

  const compact = width < COMPACT_BREAKPOINT;
  const sizing = compact
    ? { minWidth: 112, maxWidth: 164, lineHeight: 19, maxLines: 3, fontSize: 24 }
    : { minWidth: CARD_MIN_WIDTH, maxWidth: CARD_MAX_WIDTH, lineHeight: CARD_LINE_HEIGHT, maxLines: CARD_MAX_LINES, fontSize: 33 };

  const sizedNodes = data.nodes
    .slice(0, compact ? 8 : MAX_NODES)
    .map(node => sizeNode(node, sizing));
  const filteredLinks = data.links.filter(
    link => sizedNodes.some(node => node.id === link.source) && sizedNodes.some(node => node.id === link.target),
  );
  const positions = compact
    ? solveCompactLayout(sizedNodes, width)
    : solveLayout(sizedNodes, filteredLinks, width, height);
  const compactHeight = Math.max(
    ...Array.from(positions.values()).map(position => position.y + position.h),
    0,
  ) + 24;

  stage.textContent = '';
  stage.style.height = compact ? `${compactHeight}px` : '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'note-web-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${compact ? compactHeight : height}`);
  stage.appendChild(svg);

  const textLayer = document.createElement('div');
  textLayer.className = 'note-web-text-layer';
  stage.appendChild(textLayer);

  const label = document.createElement('div');
  label.className = 'note-web-text-label';
  label.textContent = compact ? 'Move notes' : 'Drag notes to change the flow';
  stage.appendChild(label);

  const fragment = document.createDocumentFragment();
  const nodeById = new Map();
  const neighborMap = buildNeighborMap(filteredLinks);
  const lines = [];
  const state = {
    compact,
    width,
    height: compact ? compactHeight : height,
    textLayer,
    label,
    nodes: sizedNodes.map(node => ({ ...node, position: positions.get(node.id) })),
    links: filteredLinks,
    svgLines: lines,
    activeId: '',
    dragging: null,
    preparedDesktop: prepareWithSegments(TEXT_DESKTOP, TEXT_FONT),
    preparedMobile: prepareWithSegments(TEXT_MOBILE, MOBILE_TEXT_FONT),
  };

  for (const link of filteredLinks) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'note-web-link');
    line.dataset.source = link.source;
    line.dataset.target = link.target;
    svg.appendChild(line);
    lines.push(line);
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

    for (const [id, entry] of nodeById.entries()) {
      entry.el.classList.toggle('is-active', id === nodeId || neighbors.has(id));
    }

    for (const line of lines) {
      const source = line.dataset.source;
      const target = line.dataset.target;
      line.classList.toggle('is-active', source === nodeId || target === nodeId);
    }

    applyDetailState({
      title: active.title,
      copy:
        neighbors.size > 0
          ? `${neighbors.size} connected note${neighbors.size === 1 ? '' : 's'} around this node.`
          : 'No local links in the current subset.',
      href: active.url,
      hidden: false,
    });
  };

  const clearActive = () => {
    if (state.dragging) return;
    state.activeId = '';
    for (const [, entry] of nodeById.entries()) {
      entry.el.classList.remove('is-active');
    }
    for (const line of lines) {
      line.classList.remove('is-active');
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
    card.className = 'note-web-card';
    card.type = 'button';
    card.style.width = `${node.w}px`;
    card.style.height = `${node.h}px`;

    const labelWrap = document.createElement('span');
    labelWrap.className = 'note-web-card-label';
    for (const lineText of node.lines) {
      const line = document.createElement('span');
      line.className = 'note-web-card-line';
      line.textContent = lineText.length > 0 ? lineText : '\u00A0';
      labelWrap.appendChild(line);
    }
    card.appendChild(labelWrap);

    const meta = document.createElement('span');
    meta.className = 'note-web-card-meta';
    meta.textContent = `${neighborMap.get(node.id)?.size ?? 0} links`;
    card.appendChild(meta);

    card.addEventListener('pointerenter', () => setActive(node.id));
    card.addEventListener('focus', () => setActive(node.id));
    card.addEventListener('pointerleave', clearActive);
    card.addEventListener('blur', clearActive);
    card.addEventListener('pointerdown', event => startDrag(event, node.id));

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
    const stageRect = stage.getBoundingClientRect();
    state.dragging = {
      id: nodeId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    node.el.setPointerCapture?.(event.pointerId);
    setActive(nodeId);
    event.preventDefault();
  }

  stage.addEventListener('pointermove', event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const node = nodeById.get(state.dragging.id);
    const stageRect = stage.getBoundingClientRect();
    const x = event.clientX - stageRect.left - state.dragging.offsetX;
    const y = event.clientY - stageRect.top - state.dragging.offsetY;
    node.position.x = clamp(x, 18, state.width - node.w - 18);
    node.position.y = clamp(y, 18, state.height - node.h - 18);
    renderScene(state, neighborMap);
  });

  const endDrag = event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const node = nodeById.get(state.dragging.id);
    node?.el.releasePointerCapture?.(event.pointerId);
    state.dragging = null;
  };

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
}

function renderScene(state, neighborMap) {
  renderText(state);
  renderLines(state);
  for (const node of state.nodes) {
    node.el.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`;
    node.el.classList.toggle(
      'is-active',
      state.activeId === node.id || (state.activeId && (neighborMap.get(state.activeId) || new Set()).has(node.id)),
    );
  }
}

function renderLines(state) {
  for (const linkEl of state.svgLines) {
    const source = state.nodes.find(node => node.id === linkEl.dataset.source);
    const target = state.nodes.find(node => node.id === linkEl.dataset.target);
    if (!source || !target) continue;
    linkEl.setAttribute('x1', `${source.position.x + source.w / 2}`);
    linkEl.setAttribute('y1', `${source.position.y + source.h / 2}`);
    linkEl.setAttribute('x2', `${target.position.x + target.w / 2}`);
    linkEl.setAttribute('y2', `${target.position.y + target.h / 2}`);
  }
}

function renderText(state) {
  const mobile = state.compact;
  const font = mobile ? MOBILE_TEXT_FONT : TEXT_FONT;
  const lineHeight = mobile ? MOBILE_TEXT_LINE_HEIGHT : TEXT_LINE_HEIGHT;
  const prepared = mobile ? state.preparedMobile : state.preparedDesktop;
  const paddingX = mobile ? 22 : 28;
  const paddingTop = mobile ? 18 : 24;
  const paddingBottom = mobile ? 20 : 24;
  const fragment = document.createDocumentFragment();
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = paddingTop;
  const obstacles = state.nodes.map(node => ({
    left: node.position.x - 10,
    right: node.position.x + node.w + 10,
    top: node.position.y - 8,
    bottom: node.position.y + node.h + 8,
  }));

  state.textLayer.textContent = '';

  while (y + lineHeight <= state.height - paddingBottom) {
    const spans = buildSpans(state.width, paddingX, y, lineHeight, obstacles);
    if (spans.length === 0) break;
    const span = spans.sort((a, b) => (b.right - b.left) - (a.right - a.left))[0];
    const maxWidth = Math.max(120, span.right - span.left);
    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (!line) break;

    const el = document.createElement('span');
    el.className = 'dragon-reflow-line';
    el.textContent = line.text.length > 0 ? line.text : '\u00A0';
    el.style.left = `${span.left}px`;
    el.style.top = `${y}px`;
    el.style.font = font;
    fragment.appendChild(el);
    cursor = line.end;
    y += lineHeight;
  }

  state.textLayer.appendChild(fragment);
  const labelX = state.nodes[0] ? state.nodes[0].position.x : paddingX;
  const labelY = state.nodes[0] ? Math.max(18, state.nodes[0].position.y - 24) : 12;
  state.label.style.left = `${labelX}px`;
  state.label.style.top = `${labelY}px`;
}

function buildSpans(width, paddingX, y, lineHeight, obstacles) {
  let spans = [{ left: paddingX, right: width - paddingX }];
  const bandTop = y;
  const bandBottom = y + lineHeight;

  for (const obstacle of obstacles) {
    if (bandBottom <= obstacle.top || bandTop >= obstacle.bottom) continue;
    spans = spans.flatMap(span => {
      if (obstacle.right <= span.left || obstacle.left >= span.right) return [span];
      const next = [];
      if (obstacle.left - span.left > 88) next.push({ left: span.left, right: obstacle.left });
      if (span.right - obstacle.right > 88) next.push({ left: obstacle.right, right: span.right });
      return next;
    });
  }

  return spans;
}

function buildSubset(graph) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const links = Array.isArray(graph.links) ? graph.links : [];
  const degree = new Map();

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
    selected.push(nodeById.get(id));
    const neighbors = Array.from(adjacency.get(id) || []).sort(
      (a, b) => (degree.get(b) || 0) - (degree.get(a) || 0),
    );
    queue.push(...neighbors);
  }

  if (selected.length < MAX_NODES) {
    const remaining = nodes
      .filter(node => !visited.has(node.id))
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));
    selected.push(...remaining.slice(0, MAX_NODES - selected.length));
  }

  const ids = new Set(selected.map(node => node.id));
  const filteredLinks = links.filter(link => ids.has(link.source) && ids.has(link.target));
  const sortedNodes = selected.sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));

  return {
    nodes: sortedNodes,
    links: filteredLinks,
  };
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
  const font = `700 ${sizing.fontSize}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
  const prepared = prepareWithSegments(node.title, font);
  let chosen = null;

  for (let width = sizing.minWidth; width <= sizing.maxWidth; width += 8) {
    const layout = layoutWithLines(prepared, width - CARD_PADDING_X * 2, sizing.lineHeight);
    if (layout.lineCount <= sizing.maxLines) {
      chosen = { width, layout };
      break;
    }
  }

  if (!chosen) {
    chosen = {
      width: sizing.maxWidth,
      layout: layoutWithLines(prepared, sizing.maxWidth - CARD_PADDING_X * 2, sizing.lineHeight),
    };
  }

  return {
    id: node.id,
    title: node.title,
    url: node.url,
    w: chosen.width,
    h: CARD_PADDING_Y * 2 + chosen.layout.lineCount * sizing.lineHeight + 22,
    lines: chosen.layout.lines.slice(0, sizing.maxLines).map(line => line.text),
  };
}

function solveLayout(nodes, links, width, height) {
  const positions = new Map();
  const centerX = width * 0.68;
  const centerY = height * 0.48;
  const radius = Math.min(width, height) * 0.18;

  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius - node.w / 2,
      y: centerY + Math.sin(angle) * radius - node.h / 2,
      w: node.w,
      h: node.h,
      vx: 0,
      vy: 0,
    });
  });

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
      const desired = 150;
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
      const cx = position.x + position.w / 2;
      const cy = position.y + position.h / 2;
      position.vx += (centerX - cx) * 0.001;
      position.vy += (centerY - cy) * 0.001;
      position.x += position.vx;
      position.y += position.vy;
      position.x = clamp(position.x, width * 0.38, width - position.w - 22);
      position.y = clamp(position.y, 22, height - position.h - 22);
    }
  }

  return positions;
}

function solveCompactLayout(nodes, width) {
  const positions = new Map();
  const columns = 2;
  const sidePadding = 18;
  const gap = 14;
  const columnWidth = (width - sidePadding * 2 - gap) / columns;
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
