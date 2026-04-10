import { layoutNextLine, prepareWithSegments } from './vendor/pretext/layout.mjs';

const NOTE_SELECTOR = '.page-note .note-body';
const FLOW_SELECTOR = '[data-note-flow]';
const FLOW_BODY_SELECTOR = '[data-note-flow-body]';
const FLOW_RAIL_SELECTOR = '[data-note-flow-rail]';
const FLOW_BREAKPOINT = 1100;
const FLOW_PADDING_X = 4;
const FLOW_GAP_X = 14;
const FLOW_GAP_Y = 6;
const FLOW_MIN_SPAN = 180;
const FLOW_PARAGRAPH_GAP = 10;
const START_CURSOR = Object.freeze({ segmentIndex: 0, graphemeIndex: 0 });

const layouts = new Set();
const states = new WeakMap();
let rafId = 0;
const pending = new Set();

const resizeObserver =
  typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) {
            scheduleRender(entry.target.closest(FLOW_SELECTOR));
          }
        }
      })
    : null;

function boot() {
  const noteBody = document.querySelector(NOTE_SELECTOR);
  if (!(noteBody instanceof HTMLElement)) return;
  enhanceMarkdown(noteBody);
  connectFlows(noteBody);
  scheduleAll();

  window.addEventListener(
    'resize',
    () => {
      scheduleAll();
    },
    { passive: true },
  );
}

function enhanceMarkdown(noteBody) {
  const children = Array.from(noteBody.children);
  const firstParagraph = children.find((child) => child instanceof HTMLParagraphElement);
  if (firstParagraph instanceof HTMLParagraphElement) {
    firstParagraph.classList.add('note-lede');
    firstParagraph.dataset.pretextTarget = '';
  }

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!(child instanceof HTMLElement)) continue;

    if (/^H2$/i.test(child.tagName)) {
      const intro = children.slice(index + 1).find((node) => node instanceof HTMLParagraphElement);
      if (intro instanceof HTMLParagraphElement) {
        intro.classList.add('note-section-intro');
        intro.dataset.pretextTarget = '';
      }
    }

    if (child instanceof HTMLElement && child.tagName === 'BLOCKQUOTE') {
      const text = collapseWhitespace(child.textContent || '');
      if (text.length > 0 && text.length <= 220 && !child.querySelector('ul,ol,pre,code')) {
        child.classList.add('pullquote');
        const paragraph = child.querySelector('p');
        if (paragraph instanceof HTMLElement) {
          paragraph.dataset.pretextTarget = '';
        }
      }
    }

    if (child instanceof HTMLElement && child.tagName === 'FIGURE') {
      const caption = child.querySelector('figcaption');
      if (caption instanceof HTMLElement) {
        const text = collapseWhitespace(caption.textContent || '');
        if (text.length > 0 && text.length <= 140) {
          child.classList.add('note-figure--aside');
          caption.dataset.pretextTarget = '';
        }
      }
    }
  }

  for (const paragraph of noteBody.querySelectorAll('.note-lede, .note-section-intro')) {
    if (!(paragraph instanceof HTMLElement)) continue;
    const next = paragraph.nextElementSibling;
    if (!(next instanceof HTMLElement)) continue;
    if (!next.matches('.pullquote, .note-figure--aside')) continue;
    if (paragraph.closest(FLOW_SELECTOR)) continue;

    const layout = document.createElement('div');
    layout.className = 'note-flow-layout';
    layout.dataset.noteFlow = '';

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'note-flow-body';
    bodyWrap.dataset.noteFlowBody = '';

    paragraph.dataset.pretextOptout = 'true';
    bodyWrap.appendChild(paragraph);
    next.dataset.noteFlowRail = '';

    next.before(layout);
    layout.append(bodyWrap, next);
  }
}

function connectFlows(root) {
  for (const layout of root.querySelectorAll(FLOW_SELECTOR)) {
    if (!(layout instanceof HTMLElement) || states.has(layout)) continue;
    const body = layout.querySelector(FLOW_BODY_SELECTOR);
    const rail = layout.querySelector(FLOW_RAIL_SELECTOR);
    if (!(body instanceof HTMLElement) || !(rail instanceof HTMLElement)) continue;

    const state = {
      body,
      rail,
      layer: null,
      prepared: [],
      prepareKey: '',
      lastKey: '',
    };

    states.set(layout, state);
    layouts.add(layout);
    resizeObserver?.observe(layout);
    resizeObserver?.observe(rail);
  }
}

function scheduleAll() {
  for (const layout of layouts) scheduleRender(layout);
}

function scheduleRender(layout) {
  if (!(layout instanceof HTMLElement) || !states.has(layout)) return;
  pending.add(layout);
  if (rafId) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = 0;
    const queue = Array.from(pending);
    pending.clear();
    for (const item of queue) renderFlow(item);
  });
}

function renderFlow(layout) {
  const state = states.get(layout);
  if (!state) return;

  const width = Math.floor(layout.clientWidth || layout.getBoundingClientRect().width);
  if (width <= 0 || width < FLOW_BREAKPOINT) {
    teardown(layout, state);
    return;
  }

  const paragraphs = readParagraphs(state.body);
  if (paragraphs.length === 0) {
    teardown(layout, state);
    return;
  }

  const sample = state.body.querySelector('p');
  if (!(sample instanceof HTMLElement)) {
    teardown(layout, state);
    return;
  }

  const style = window.getComputedStyle(sample);
  const font = resolveCanvasFont(style);
  const lineHeight = resolveLineHeight(style);
  const prepareKey = `${font}__${paragraphs.join('¶')}`;

  if (prepareKey !== state.prepareKey) {
    state.prepared = paragraphs.map((text) => prepareWithSegments(text, font));
    state.prepareKey = prepareKey;
    state.lastKey = '';
  }

  const railRect = state.rail.getBoundingClientRect();
  const renderKey = `${width}__${Math.round(railRect.width)}__${prepareKey}`;
  if (renderKey === state.lastKey || !state.prepared) return;

  layout.classList.add('is-pretext-flow');
  state.body.setAttribute('aria-hidden', 'true');

  let layer = state.layer;
  if (!(layer instanceof HTMLElement) || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'note-flow-layer';
    layout.appendChild(layer);
    state.layer = layer;
  }

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
    if (!line) {
      paragraphIndex += 1;
      cursor = START_CURSOR;
      if (paragraphIndex < state.prepared.length) {
        y += FLOW_PARAGRAPH_GAP;
      }
      continue;
    }

    const lineElement = document.createElement('span');
    lineElement.className = 'note-flow-line';
    lineElement.textContent = line.text;
    lineElement.style.left = `${Math.round(span.x)}px`;
    lineElement.style.top = `${Math.round(y)}px`;
    fragment.appendChild(lineElement);
    cursor = line.end;
    y += lineHeight;
  }

  layer.replaceChildren(fragment);
  const height = Math.max(
    Math.ceil(y + FLOW_PARAGRAPH_GAP),
    Math.ceil(state.rail.getBoundingClientRect().height),
  );
  layout.style.setProperty('--note-flow-height', `${height}px`);
  state.lastKey = renderKey;
}

function teardown(layout, state) {
  layout.classList.remove('is-pretext-flow');
  layout.style.removeProperty('--note-flow-height');
  state.body.removeAttribute('aria-hidden');
  if (state.layer instanceof HTMLElement) {
    state.layer.remove();
    state.layer = null;
  }
  state.lastKey = '';
}

function measureObstacles(layout, rail) {
  const layoutRect = layout.getBoundingClientRect();
  const rect = rail.getBoundingClientRect();
  return [
    {
      top: rect.top - layoutRect.top - FLOW_GAP_Y,
      bottom: rect.bottom - layoutRect.top + FLOW_GAP_Y,
      left: rect.left - layoutRect.left - FLOW_GAP_X,
      right: rect.right - layoutRect.left + FLOW_GAP_X,
    },
  ];
}

function readParagraphs(body) {
  return Array.from(body.querySelectorAll('p'))
    .map((element) => collapseWhitespace(element.textContent || ''))
    .filter(Boolean);
}

function buildSpans(obstacles, y, lineHeight, width) {
  const bandTop = y;
  const bandBottom = y + lineHeight;
  const minX = FLOW_PADDING_X;
  const maxX = width - FLOW_PADDING_X;
  const intervals = [];

  for (const obstacle of obstacles) {
    if (obstacle.bottom <= bandTop || obstacle.top >= bandBottom) continue;
    intervals.push({
      start: clamp(obstacle.left, minX, maxX),
      end: clamp(obstacle.right, minX, maxX),
    });
  }

  intervals.sort((a, b) => a.start - b.start);
  const spans = [];
  let cursor = minX;

  for (const interval of intervals) {
    if (interval.start - cursor >= FLOW_MIN_SPAN) {
      spans.push({ x: cursor, width: interval.start - cursor });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (maxX - cursor >= FLOW_MIN_SPAN) {
    spans.push({ x: cursor, width: maxX - cursor });
  }

  if (spans.length === 0) {
    spans.push({ x: minX, width: maxX - minX });
  }

  return spans;
}

function resolveCanvasFont(style) {
  const raw = typeof style.font === 'string' ? style.font.trim() : '';
  if (raw) return raw.replace(/\/[^ ]+(?= )/, '');
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
  const unitless = Number.parseFloat(raw);
  if (Number.isFinite(unitless)) return fontSize * unitless;
  return fontSize * 1.7;
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
