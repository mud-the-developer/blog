import { layoutNextLine, prepareWithSegments } from './vendor/pretext/layout.mjs';

const SELECTOR = '[data-dragon-reflow]';
const FONT = '700 28px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const LINE_HEIGHT = 36;
const MOBILE_FONT = '700 19px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const MOBILE_LINE_HEIGHT = 25;

function boot() {
  const stage = document.querySelector(SELECTOR);
  if (!(stage instanceof HTMLElement)) return;

  const obstacle = stage.querySelector('.dragon-obstacle');
  if (!(obstacle instanceof HTMLElement)) return;

  const layer = document.createElement('div');
  layer.className = 'dragon-reflow-layer';
  stage.prepend(layer);

  const label = document.createElement('div');
  label.className = 'dragon-reflow-label';
  label.textContent = 'Drag the block';
  stage.appendChild(label);

  const state = {
    obstacle,
    layer,
    label,
    preparedDesktop: null,
    preparedMobile: null,
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  };

  stage.classList.add('is-enhanced');

  const render = () => renderStage(stage, state);

  const startDrag = event => {
    const rect = obstacle.getBoundingClientRect();
    state.dragging = true;
    state.offsetX = event.clientX - rect.left;
    state.offsetY = event.clientY - rect.top;
    obstacle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = event => {
    if (!state.dragging) return;
    const stageRect = stage.getBoundingClientRect();
    const x = event.clientX - stageRect.left - state.offsetX;
    const y = event.clientY - stageRect.top - state.offsetY;
    const maxX = stageRect.width - obstacle.offsetWidth - 20;
    const maxY = stageRect.height - obstacle.offsetHeight - 20;
    obstacle.style.left = `${Math.min(Math.max(20, x), maxX)}px`;
    obstacle.style.top = `${Math.min(Math.max(20, y), maxY)}px`;
    render();
  };

  const endDrag = event => {
    state.dragging = false;
    obstacle.releasePointerCapture?.(event.pointerId);
  };

  obstacle.addEventListener('pointerdown', startDrag);
  obstacle.addEventListener('pointermove', moveDrag);
  obstacle.addEventListener('pointerup', endDrag);
  obstacle.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', render, { passive: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(render, render);
  }
  render();
}

function renderStage(stage, state) {
  const width = Math.floor(stage.clientWidth || stage.getBoundingClientRect().width);
  const height = Math.floor(stage.clientHeight || stage.getBoundingClientRect().height);
  if (width <= 0 || height <= 0) return;

  const mobile = width < 760;
  const font = mobile ? MOBILE_FONT : FONT;
  const lineHeight = mobile ? MOBILE_LINE_HEIGHT : LINE_HEIGHT;
  const paddingX = mobile ? 22 : 28;
  const paddingTop = mobile ? 20 : 24;
  const paddingBottom = mobile ? 22 : 26;
  const text = stage.dataset.text || '';
  const preparedKey = mobile ? 'preparedMobile' : 'preparedDesktop';

  if (!state[preparedKey] || state[preparedKey].font !== font || state[preparedKey].text !== text) {
    state[preparedKey] = { font, text, prepared: prepareWithSegments(text, font) };
  }

  if (!state.obstacle.style.left) {
    state.obstacle.style.left = mobile ? `${Math.max(width - 148, width * 0.54)}px` : `${width - 178}px`;
    state.obstacle.style.top = mobile ? `${Math.max(120, height * 0.46)}px` : `${paddingTop + 56}px`;
  }

  state.layer.textContent = '';
  const fragment = document.createDocumentFragment();
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = paddingTop;

  const obstacleRect = {
    x: parseFloat(state.obstacle.style.left) || width - state.obstacle.offsetWidth - 24,
    y: parseFloat(state.obstacle.style.top) || paddingTop + 56,
    w: state.obstacle.offsetWidth || 130,
    h: state.obstacle.offsetHeight || 130,
  };

  while (y + lineHeight <= height - paddingBottom) {
    const spans = availableSpans(width, paddingX, y, lineHeight, obstacleRect);
    if (spans.length === 0) break;

    let advanced = false;
    for (const span of spans) {
      const maxWidth = Math.max(80, span.right - span.left);
      const line = layoutNextLine(state[preparedKey].prepared, cursor, maxWidth);
      if (!line) {
        if (!advanced) {
          finalize(state, fragment, mobile, obstacleRect);
          return;
        }
        continue;
      }

      const el = document.createElement('span');
      el.className = 'dragon-reflow-line';
      el.textContent = line.text.length > 0 ? line.text : '\u00A0';
      el.style.left = `${span.left}px`;
      el.style.top = `${y}px`;
      el.style.font = font;
      fragment.appendChild(el);
      cursor = line.end;
      advanced = true;
      break;
    }

    if (!advanced) break;
    y += lineHeight;
  }

  finalize(state, fragment, mobile, obstacleRect);
}

function availableSpans(width, paddingX, y, lineHeight, obstacle) {
  const left = paddingX;
  const right = width - paddingX;
  const bandTop = y;
  const bandBottom = y + lineHeight;
  const intersects = bandBottom > obstacle.y && bandTop < obstacle.y + obstacle.h;
  if (!intersects) {
    return [{ left, right }];
  }

  const spans = [];
  if (obstacle.x - left > 88) {
    spans.push({ left, right: obstacle.x - 14 });
  }
  if (right - (obstacle.x + obstacle.w) > 88) {
    spans.push({ left: obstacle.x + obstacle.w + 14, right });
  }
  return spans;
}

function finalize(state, fragment, mobile, obstacleRect) {
  state.layer.appendChild(fragment);
  state.label.style.left = `${obstacleRect.x}px`;
  state.label.style.top = `${obstacleRect.y - 24}px`;
  state.label.textContent = mobile ? 'Move' : 'Drag the block';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
