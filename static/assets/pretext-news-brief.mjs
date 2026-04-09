import { layoutNextLine, prepareWithSegments } from './vendor/pretext/layout.mjs';

const FLOW_SELECTOR = '[data-news-brief-flow]';
const BODY_SELECTOR = '[data-news-brief-body]';
const RAIL_SELECTOR = '[data-news-brief-rail]';
const FLOW_BREAKPOINT = 980;
const FLOW_PADDING_X = 2;
const FLOW_GAP_X = 10;
const FLOW_GAP_Y = 4;
const FLOW_MIN_SPAN = 168;
const PARAGRAPH_GAP_RATIO = 0.72;
const START_CURSOR = Object.freeze({ segmentIndex: 0, graphemeIndex: 0 });

const states = new WeakMap();
const flows = new Set();

const resizeObserver =
  typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) {
            scheduleRender(entry.target);
          }
        }
      })
    : null;

let rafId = 0;
const pending = new Set();

function boot() {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Intl === 'undefined' ||
    typeof Intl.Segmenter !== 'function'
  ) {
    return;
  }

  connectFlows(document);
  scheduleAll();
  window.addEventListener(
    'resize',
    () => {
      scheduleAll();
    },
    { passive: true },
  );
}

function connectFlows(root) {
  const elements = root.querySelectorAll(FLOW_SELECTOR);
  for (const layout of elements) {
    if (!(layout instanceof HTMLElement) || states.has(layout)) continue;
    const body = layout.querySelector(BODY_SELECTOR);
    const rail = layout.querySelector(RAIL_SELECTOR);
    if (!(body instanceof HTMLElement) || !(rail instanceof HTMLElement)) continue;

    const state = {
      body,
      rail,
      layer: null,
      paragraphs: readParagraphs(body),
      prepared: [],
      prepareKey: '',
      lastRenderKey: '',
    };
    states.set(layout, state);
    flows.add(layout);
    resizeObserver?.observe(layout);
    resizeObserver?.observe(rail);
  }
}

function readParagraphs(body) {
  return Array.from(body.querySelectorAll('.news-digest-beta-story-copy'))
    .map(element => collapseWhitespace(element.textContent ?? ''))
    .filter(Boolean);
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function scheduleAll() {
  for (const flow of flows) scheduleRender(flow);
}

function scheduleRender(layout) {
  if (!states.has(layout)) return;
  pending.add(layout);
  if (rafId) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = 0;
    const queue = Array.from(pending);
    pending.clear();
    for (const item of queue) renderFlow(item);
  });
}

function ensureLayer(layout, state) {
  if (state.layer instanceof HTMLElement && state.layer.isConnected) return state.layer;
  const layer = document.createElement('div');
  layer.className = 'news-digest-beta-flow-layer';
  layer.setAttribute('aria-hidden', 'true');
  layout.appendChild(layer);
  state.layer = layer;
  return layer;
}

function renderFlow(layout) {
  const state = states.get(layout);
  if (!state) return;
  if (!layout.isConnected) {
    flows.delete(layout);
    states.delete(layout);
    resizeObserver?.unobserve(layout);
    resizeObserver?.unobserve(state.rail);
    return;
  }

  const width = Math.floor(layout.clientWidth || layout.getBoundingClientRect().width);
  if (width <= 0 || width < FLOW_BREAKPOINT) {
    teardownFlow(layout, state);
    return;
  }

  const paragraphs = readParagraphs(state.body);
  if (paragraphs.length === 0) {
    teardownFlow(layout, state);
    return;
  }

  layout.classList.add('is-pretext-flow');
  state.body.setAttribute('aria-hidden', 'true');
  layout.setAttribute('aria-label', paragraphs.join(' '));

  const sample = state.body.querySelector('.news-digest-beta-story-copy');
  if (!(sample instanceof HTMLElement)) {
    teardownFlow(layout, state);
    return;
  }
  const style = window.getComputedStyle(sample);
  const font = resolveCanvasFont(style);
  const lineHeight = resolveLineHeight(style);
  const prepareKey = `${font}__${paragraphs.join('¶')}`;

  if (state.prepareKey !== prepareKey) {
    state.prepared = paragraphs.map(text => prepareWithSegments(text, font));
    state.prepareKey = prepareKey;
    state.lastRenderKey = '';
  }

  const railWidth = Math.ceil(state.rail.getBoundingClientRect().width);
  const renderKey = `${width}__${railWidth}__${lineHeight}__${prepareKey}`;
  if (renderKey === state.lastRenderKey) return;

  const layer = ensureLayer(layout, state);
  const obstacles = measureObstacles(layout, state.rail);
  const fragment = document.createDocumentFragment();
  let y = 0;
  let paragraphIndex = 0;
  let cursor = START_CURSOR;
  let guard = 0;

  while (paragraphIndex < state.prepared.length && guard < 2400) {
    guard += 1;
    const spans = buildSpans(obstacles, y, lineHeight, width);
    if (spans.length === 0) {
      y += lineHeight;
      continue;
    }

    const span = spans.sort((a, b) => b.width - a.width)[0];
    const line = layoutNextLine(state.prepared[paragraphIndex], cursor, span.width);
    if (line === null) {
      paragraphIndex += 1;
      cursor = START_CURSOR;
      if (paragraphIndex < state.prepared.length) {
        y += Math.round(lineHeight * PARAGRAPH_GAP_RATIO);
      }
      continue;
    }

    const lineElement = document.createElement('span');
    lineElement.className = 'news-digest-beta-flow-line';
    lineElement.textContent = line.text.length > 0 ? line.text : '\u00A0';
    lineElement.style.left = `${Math.round(span.x)}px`;
    lineElement.style.top = `${Math.round(y)}px`;
    fragment.appendChild(lineElement);
    cursor = line.end;
    y += lineHeight;
  }

  layer.replaceChildren(fragment);
  const flowHeight = Math.max(
    Math.ceil(y),
    Math.ceil(state.rail.getBoundingClientRect().height),
  );
  layout.style.setProperty('--news-brief-flow-height', `${flowHeight}px`);
  state.lastRenderKey = renderKey;
}

function teardownFlow(layout, state) {
  layout.classList.remove('is-pretext-flow');
  layout.style.removeProperty('--news-brief-flow-height');
  layout.removeAttribute('aria-label');
  state.body.removeAttribute('aria-hidden');
  if (state.layer instanceof HTMLElement) {
    state.layer.remove();
    state.layer = null;
  }
  state.lastRenderKey = '';
}

function measureObstacles(layout, rail) {
  const layoutRect = layout.getBoundingClientRect();
  return Array.from(rail.querySelectorAll('.news-digest-card'))
    .filter(element => element instanceof HTMLElement)
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top - layoutRect.top - FLOW_GAP_Y,
        bottom: rect.bottom - layoutRect.top + FLOW_GAP_Y,
        left: rect.left - layoutRect.left - FLOW_GAP_X,
        right: rect.right - layoutRect.left + FLOW_GAP_X,
      };
    });
}

function buildSpans(obstacles, y, lineHeight, width) {
  const minX = FLOW_PADDING_X;
  const maxX = width - FLOW_PADDING_X;
  const bandTop = y;
  const bandBottom = y + lineHeight;
  const intervals = [];

  for (const obstacle of obstacles) {
    if (obstacle.bottom <= bandTop || obstacle.top >= bandBottom) continue;
    intervals.push({
      start: clamp(obstacle.left, minX, maxX),
      end: clamp(obstacle.right, minX, maxX),
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
    if (interval.start - cursor >= FLOW_MIN_SPAN) {
      spans.push({ x: cursor, width: interval.start - cursor });
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (maxX - cursor >= FLOW_MIN_SPAN) {
    spans.push({ x: cursor, width: maxX - cursor });
  }
  if (spans.length === 0 && maxX - minX >= FLOW_MIN_SPAN) {
    spans.push({ x: minX, width: maxX - minX });
  }
  return spans;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveCanvasFont(style) {
  const rawFont = typeof style.font === 'string' ? style.font.trim() : '';
  if (rawFont.length > 0) {
    return rawFont.replace(/\/[^ ]+(?= )/, '');
  }

  return [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ]
    .filter(Boolean)
    .join(' ');
}

function resolveLineHeight(style) {
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const raw = style.lineHeight;
  if (raw.endsWith('px')) return Number.parseFloat(raw);
  if (raw.endsWith('%')) return fontSize * (Number.parseFloat(raw) / 100);
  const unitless = Number.parseFloat(raw);
  if (Number.isFinite(unitless)) return fontSize * unitless;
  return fontSize * 1.65;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
