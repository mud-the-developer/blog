import { layout, prepare } from './vendor/pretext/layout.mjs';

const CONTAINER_SELECTOR = '[data-pretext-masonry]';
const CARD_SELECTOR = '[data-masonry-card]';
const TITLE_SELECTOR = '[data-masonry-title]';
const DECK_SELECTOR = '[data-masonry-deck]';

const cardState = new WeakMap();
const connectedContainers = new Set();
const pendingContainers = new Set();
let rafId = null;

const resizeObserver =
  typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) {
            queue(entry.target);
          }
        }
      })
    : null;

const mutationObserver =
  typeof window.MutationObserver === 'function'
    ? new window.MutationObserver(() => {
        connectAll(document);
        scheduleAll();
      })
    : null;

function boot() {
  connectAll(document);
  scheduleAll();

  if (document.body) {
    mutationObserver?.observe(document.body, { childList: true, subtree: true });
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleAll, scheduleAll);
  }

  window.addEventListener(
    'resize',
    () => {
      scheduleAll();
    },
    { passive: true },
  );
}

function connectAll(root) {
  const containers = root.querySelectorAll(CONTAINER_SELECTOR);
  for (const container of containers) {
    if (!(container instanceof HTMLElement)) {
      continue;
    }
    if (connectedContainers.has(container)) {
      continue;
    }
    connectedContainers.add(container);
    resizeObserver?.observe(container);
  }
}

function scheduleAll() {
  for (const container of connectedContainers) {
    queue(container);
  }
}

function queue(container) {
  pendingContainers.add(container);
  if (rafId !== null) {
    return;
  }
  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    flush();
  });
}

function flush() {
  if (pendingContainers.size === 0) {
    return;
  }

  const containers = Array.from(pendingContainers);
  pendingContainers.clear();
  for (const container of containers) {
    renderContainer(container);
  }
}

function renderContainer(container) {
  if (!container.isConnected) {
    connectedContainers.delete(container);
    pendingContainers.delete(container);
    resizeObserver?.unobserve(container);
    return;
  }

  const cards = Array.from(container.querySelectorAll(CARD_SELECTOR)).filter(
    card => card instanceof HTMLElement,
  );
  if (cards.length === 0) {
    return;
  }

  const containerWidth = Math.floor(container.clientWidth || container.getBoundingClientRect().width);
  if (containerWidth <= 0) {
    return;
  }

  const gap = readPx(container, '--masonry-gap', 20);
  const minColumnWidth = readPx(container, '--masonry-min-column-width', 280);
  const padding = readPx(container, '--masonry-card-padding', 24);
  const eyebrowHeight = readPx(container, '--masonry-eyebrow-height', 22);
  const bodyGap = readPx(container, '--masonry-body-gap', 16);
  const footerGap = readPx(container, '--masonry-footer-gap', 18);
  const footerHeight = readPx(container, '--masonry-footer-height', 22);

  let columnCount = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)));
  if (containerWidth <= minColumnWidth * 1.35) {
    columnCount = 1;
  }

  const availableWidth = Math.max(containerWidth - gap * Math.max(columnCount - 1, 0), 0);
  const columnWidth = columnCount === 1 ? containerWidth : Math.floor(availableWidth / columnCount);
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  container.classList.add('is-masonry-enhanced');

  for (const card of cards) {
    const state = getCardState(card);
    const textWidth = Math.max(columnWidth - padding * 2, 120);
    const titleHeight = measureTextBlock(card.querySelector(TITLE_SELECTOR), textWidth, state.title);
    const deckHeight = measureTextBlock(card.querySelector(DECK_SELECTOR), textWidth, state.deck);

    let cardHeight = padding * 2 + eyebrowHeight + footerGap + footerHeight;
    if (titleHeight > 0) {
      cardHeight += bodyGap + titleHeight;
    }
    if (deckHeight > 0) {
      cardHeight += bodyGap + deckHeight;
    }

    let targetColumn = 0;
    for (let index = 1; index < columnHeights.length; index += 1) {
      if (columnHeights[index] < columnHeights[targetColumn]) {
        targetColumn = index;
      }
    }

    const x = targetColumn * (columnWidth + gap);
    const y = columnHeights[targetColumn];

    card.style.position = 'absolute';
    card.style.inset = '0 auto auto 0';
    card.style.width = `${columnWidth}px`;
    card.style.height = `${Math.ceil(cardHeight)}px`;
    card.style.transform = `translate(${x}px, ${y}px)`;

    columnHeights[targetColumn] += cardHeight + gap;
  }

  const tallestColumn = columnHeights.length > 0 ? Math.max(...columnHeights) : 0;
  container.style.height = `${Math.max(tallestColumn - gap, 0)}px`;
}

function getCardState(card) {
  let state = cardState.get(card);
  if (!state) {
    state = {
      title: createTextState(),
      deck: createTextState(),
    };
    cardState.set(card, state);
  }
  return state;
}

function createTextState() {
  return {
    prepareKey: '',
    prepared: null,
  };
}

function measureTextBlock(element, width, state) {
  if (!(element instanceof HTMLElement)) {
    return 0;
  }

  const sourceText = collapseWhitespace(element.textContent ?? '');
  if (!sourceText) {
    return 0;
  }

  const style = window.getComputedStyle(element);
  const displayText = applyTextTransform(sourceText, style.textTransform);
  const font = resolveCanvasFont(style);
  const lineHeight = resolveLineHeight(style);
  const prepareKey = `${font}__${displayText}`;

  if (state.prepared === null || state.prepareKey !== prepareKey) {
    state.prepared = prepare(displayText, font);
    state.prepareKey = prepareKey;
  }

  return Math.ceil(layout(state.prepared, width, lineHeight).height);
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
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

function readPx(element, property, fallback) {
  const value = window.getComputedStyle(element).getPropertyValue(property).trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
