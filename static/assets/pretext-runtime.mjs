import { layoutWithLines, prepareWithSegments } from './vendor/pretext/layout.mjs';

const AUTO_TARGET_SELECTORS = [
  '[data-pretext-target]',
  '.note-body > h2',
  '.note-body > h3',
  '.note-body > h4',
  '.note-body figcaption',
  '.note-body blockquote > p',
  '.backlinks > h2',
  '.backlinks-empty',
  '.backlinks-meta',
  '.backlinks li > p',
].join(',');

const FORBIDDEN_DESCENDANTS = [
  'pre',
  'code',
  'table',
  'img',
  'svg',
  'canvas',
  'video',
  'audio',
  'iframe',
  'picture',
  'math',
  '.katex',
  '.mermaid-render',
  '.plantuml-embed',
  '.note-excalidraw-embed',
  '.note-canvas-embed',
  '.note-pdf-embed',
  '.profile-publication-widget',
  'script',
  'style',
  'input',
  'textarea',
  'select',
  'button',
  'details',
  'summary',
].join(',');

const PRETEXT_READY_CLASS = 'pretext-enhanced';
const PRETEXT_LINE_CLASS = 'pretext-line';
const elementState = new WeakMap();
const connectedElements = new Set();
const pendingRender = new Set();
let rafId = null;

const resizeObserver =
  typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) {
            queueRender(entry.target);
          }
        }
      })
    : null;

const mutationObserver =
  typeof window.MutationObserver === 'function'
    ? new window.MutationObserver(records => {
        let shouldRescan = false;
        for (const record of records) {
          if (record.addedNodes.length > 0 || record.removedNodes.length > 0) {
            shouldRescan = true;
            break;
          }
        }
        if (shouldRescan) {
          connectTargets(document);
          scheduleAll();
        }
      })
    : null;

function supportsPretext() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Intl !== 'undefined' &&
    typeof Intl.Segmenter === 'function' &&
    (typeof window.OffscreenCanvas !== 'undefined' || typeof document.createElement === 'function')
  );
}

function boot() {
  if (!supportsPretext()) {
    return;
  }

  const start = () => {
    connectTargets(document);
    scheduleAll();
    if (document.body) {
      mutationObserver?.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(
      () => {
        start();
        scheduleAll();
      },
      () => {
        start();
      },
    );
  } else {
    start();
  }

  window.addEventListener(
    'resize',
    () => {
      scheduleAll();
    },
    { passive: true },
  );
}

function connectTargets(root) {
  const targets = root.querySelectorAll(AUTO_TARGET_SELECTORS);
  for (const target of targets) {
    if (!(target instanceof HTMLElement)) {
      continue;
    }
    if (elementState.has(target)) {
      continue;
    }
    if (!isEligibleTarget(target)) {
      continue;
    }
    elementState.set(target, {
      sourceText: extractSourceText(target),
      prepared: null,
      preparedKey: '',
      lastRenderKey: '',
    });
    connectedElements.add(target);
    resizeObserver?.observe(target);
  }
}

function isEligibleTarget(element) {
  if (!element.isConnected) {
    return false;
  }
  if (element.dataset.pretextOptout === 'true') {
    return false;
  }
  if (element.closest('[data-pretext-optout="true"]')) {
    return false;
  }
  if (element.closest('.search-results, .graph-stage, .graph-detail, .graph-status')) {
    return false;
  }
  if (element.matches('.pretext-line')) {
    return false;
  }
  if (element.querySelector(FORBIDDEN_DESCENDANTS)) {
    return false;
  }
  if (!element.matches('[data-pretext-target]') && element.childElementCount > 0) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  return extractSourceText(element).length > 0;
}

function extractSourceText(element) {
  return collapseWhitespace(element.textContent ?? '');
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function queueRender(element) {
  if (!elementState.has(element)) {
    return;
  }
  pendingRender.add(element);
  scheduleFlush();
}

function scheduleAll() {
  connectTargets(document);
  for (const element of connectedElements) {
    queueRender(element);
  }
}

function scheduleFlush() {
  if (rafId !== null) {
    return;
  }
  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    flush();
  });
}

function flush() {
  if (pendingRender.size === 0) {
    return;
  }
  const targets = Array.from(pendingRender);
  pendingRender.clear();
  for (const element of targets) {
    renderElement(element);
  }
}

function renderElement(element) {
  const state = elementState.get(element);
  if (!state) {
    return;
  }
  if (!element.isConnected) {
    connectedElements.delete(element);
    elementState.delete(element);
    resizeObserver?.unobserve(element);
    return;
  }

  const width = Math.floor(element.clientWidth || element.getBoundingClientRect().width);
  if (width <= 0) {
    return;
  }

  const sourceText = extractSourceText(element);
  if (!sourceText) {
    return;
  }
  state.sourceText = sourceText;

  const style = window.getComputedStyle(element);
  const displayText = applyTextTransform(sourceText, style.textTransform);
  const font = resolveCanvasFont(style);
  const lineHeight = resolveLineHeight(style);
  const prepareKey = `${font}__${displayText}`;
  const renderKey = `${prepareKey}__${width}__${lineHeight}`;

  if (state.lastRenderKey === renderKey) {
    return;
  }

  try {
    if (state.prepared === null || state.preparedKey !== prepareKey) {
      state.prepared = prepareWithSegments(displayText, font);
      state.preparedKey = prepareKey;
    }

    const result = layoutWithLines(state.prepared, width, lineHeight);
    const fragment = document.createDocumentFragment();

    for (const line of result.lines) {
      const lineElement = document.createElement('span');
      lineElement.className = PRETEXT_LINE_CLASS;
      lineElement.textContent = line.text.length > 0 ? line.text : '\u00A0';
      fragment.appendChild(lineElement);
    }

    element.replaceChildren(fragment);
    element.classList.add(PRETEXT_READY_CLASS);
    element.style.setProperty('--pretext-line-count', String(result.lineCount));
    element.style.setProperty('--pretext-height', `${Math.ceil(result.height)}px`);
    state.lastRenderKey = renderKey;
  } catch (_error) {
    connectedElements.delete(element);
    elementState.delete(element);
    resizeObserver?.unobserve(element);
  }
}

function resolveCanvasFont(style) {
  const rawFont = typeof style.font === 'string' ? style.font.trim() : '';
  if (rawFont.length > 0) {
    return rawFont.replace(/\/[^ ]+(?= )/, '');
  }

  const parts = [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ].filter(Boolean);

  return parts.join(' ');
}

function resolveLineHeight(style) {
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const raw = style.lineHeight;
  if (raw.endsWith('px')) {
    return Number.parseFloat(raw);
  }
  if (raw.endsWith('%')) {
    return fontSize * (Number.parseFloat(raw) / 100);
  }
  const unitless = Number.parseFloat(raw);
  if (Number.isFinite(unitless)) {
    return fontSize * unitless;
  }
  return fontSize * 1.4;
}

function applyTextTransform(text, transform) {
  switch (transform) {
    case 'uppercase':
      return text.toLocaleUpperCase();
    case 'lowercase':
      return text.toLocaleLowerCase();
    case 'capitalize':
      return text.replace(/(^|[\s\-–—])([^\s\-–—])/gu, (match, boundary, character) => {
        return `${boundary}${character.toLocaleUpperCase()}`;
      });
    default:
      return text;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
