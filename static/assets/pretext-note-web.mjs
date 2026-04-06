import { layoutWithLines, prepareWithSegments } from './vendor/pretext/layout.mjs';

const STAGE_SELECTOR = '[data-note-web]';
const MAX_NODES = 16;
const CARD_MIN_WIDTH = 128;
const CARD_MAX_WIDTH = 210;
const CARD_PADDING_X = 15;
const CARD_PADDING_Y = 14;
const CARD_LINE_HEIGHT = 24;
const CARD_MAX_LINES = 3;
const ITERATIONS = 180;

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

  const sizedNodes = data.nodes.map(node => sizeNode(node));
  const positions = solveLayout(sizedNodes, data.links, width, height);

  stage.textContent = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'note-web-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  stage.appendChild(svg);

  const fragments = document.createDocumentFragment();
  const nodeById = new Map();
  const neighborMap = buildNeighborMap(data.links);
  const lines = [];

  for (const link of data.links) {
    const source = positions.get(link.source);
    const target = positions.get(link.target);
    if (!source || !target) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'note-web-link');
    line.dataset.source = link.source;
    line.dataset.target = link.target;
    line.setAttribute('x1', `${source.x + source.w / 2}`);
    line.setAttribute('y1', `${source.y + source.h / 2}`);
    line.setAttribute('x2', `${target.x + target.w / 2}`);
    line.setAttribute('y2', `${target.y + target.h / 2}`);
    svg.appendChild(line);
    lines.push(line);
  }

  for (const node of sizedNodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    const card = document.createElement('a');
    card.className = 'note-web-card';
    card.href = node.url;
    card.style.width = `${position.w}px`;
    card.style.height = `${position.h}px`;
    card.style.transform = `translate(${position.x}px, ${position.y}px)`;
    card.dataset.nodeId = node.id;

    const label = document.createElement('span');
    label.className = 'note-web-card-label';
    for (const lineText of node.lines) {
      const line = document.createElement('span');
      line.className = 'note-web-card-line';
      line.textContent = lineText.length > 0 ? lineText : '\u00A0';
      label.appendChild(line);
    }
    card.appendChild(label);

    const meta = document.createElement('span');
    meta.className = 'note-web-card-meta';
    meta.textContent = `${neighborMap.get(node.id)?.size ?? 0} links`;
    card.appendChild(meta);

    card.addEventListener('pointerenter', () => setActive(node.id));
    card.addEventListener('focus', () => setActive(node.id));
    card.addEventListener('pointerleave', () => clearActive());
    card.addEventListener('blur', () => clearActive());

    nodeById.set(node.id, { node, card });
    fragments.appendChild(card);
  }

  stage.appendChild(fragments);

  const detailTitle = document.getElementById('note-web-detail-title');
  const detailCopy = document.getElementById('note-web-detail-copy');
  const detailLink = document.getElementById('note-web-detail-link');

  function setActive(nodeId) {
    const active = nodeById.get(nodeId);
    if (!active) return;
    const neighbors = neighborMap.get(nodeId) || new Set();

    for (const [id, entry] of nodeById.entries()) {
      entry.card.classList.toggle('is-active', id === nodeId || neighbors.has(id));
    }

    for (const line of lines) {
      const source = line.dataset.source;
      const target = line.dataset.target;
      line.classList.toggle('is-active', source === nodeId || target === nodeId);
    }

    if (detailTitle) detailTitle.textContent = active.node.title;
    if (detailCopy) {
      detailCopy.textContent = neighbors.size > 0
        ? `${neighbors.size} connected note${neighbors.size === 1 ? '' : 's'} in this local web.`
        : 'No local links in the current subset.';
    }
    if (detailLink instanceof HTMLAnchorElement) {
      detailLink.hidden = false;
      detailLink.href = active.node.url;
      detailLink.textContent = 'Open note';
    }
  }

  function clearActive() {
    for (const [, entry] of nodeById.entries()) {
      entry.card.classList.remove('is-active');
    }
    for (const line of lines) {
      line.classList.remove('is-active');
    }
    if (detailTitle) detailTitle.textContent = 'Hover a note';
    if (detailCopy) detailCopy.textContent = 'Connections light up here so the archive feels explorable instead of just sortable.';
    if (detailLink instanceof HTMLAnchorElement) {
      detailLink.hidden = true;
      detailLink.href = '/';
      detailLink.textContent = 'Open note';
    }
  }
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
    const neighbors = Array.from(adjacency.get(id) || []).sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0));
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

function sizeNode(node) {
  const font = '700 33px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  const prepared = prepareWithSegments(node.title, font);
  let chosen = null;
  for (let width = CARD_MIN_WIDTH; width <= CARD_MAX_WIDTH; width += 8) {
    const layout = layoutWithLines(prepared, width - CARD_PADDING_X * 2, CARD_LINE_HEIGHT);
    if (layout.lineCount <= CARD_MAX_LINES) {
      chosen = { width, layout };
      break;
    }
  }
  if (!chosen) {
    chosen = {
      width: CARD_MAX_WIDTH,
      layout: layoutWithLines(prepared, CARD_MAX_WIDTH - CARD_PADDING_X * 2, CARD_LINE_HEIGHT),
    };
  }
  return {
    id: node.id,
    title: node.title,
    url: node.url,
    w: chosen.width,
    h: CARD_PADDING_Y * 2 + chosen.layout.lineCount * CARD_LINE_HEIGHT + 22,
    lines: chosen.layout.lines.slice(0, CARD_MAX_LINES).map(line => line.text),
  };
}

function solveLayout(nodes, links, width, height) {
  const positions = new Map();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.28;

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
      const desired = 170;
      const force = (dist - desired) * 0.0028;
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
      position.vx += (centerX - cx) * 0.0009;
      position.vy += (centerY - cy) * 0.0009;
      position.x += position.vx;
      position.y += position.vy;
      position.x = clamp(position.x, 18, width - position.w - 18);
      position.y = clamp(position.y, 18, height - position.h - 18);
    }
  }

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
