import { renderPretextTokens } from './pretext-polish-effects.mjs';
import { createPretextState, pretextReducer } from './pretext-polish-state.mjs';

const stage = document.querySelector('[data-pretext-polish]');
const surface = document.querySelector('[data-pretext-surface]');
const archiveNode = document.getElementById('archive-data');

const parseArchive = () => {
  if (!archiveNode) return [];
  try {
    const parsed = JSON.parse(archiveNode.textContent || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

function parseRainColumns() {
  const columnNode = surface?.querySelector('[data-pretext-rain-columns]');
  if (!columnNode) return [];
  try {
    const parsed = JSON.parse(columnNode.textContent || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function chooseGlyph(pool) {
  if (!pool.length) return '·';
  return pool[Math.floor(Math.random() * pool.length)] || pool[0] || '·';
}

function makeRandomColumn(pool, length) {
  return Array.from({ length }, () => chooseGlyph(pool)).join('\n');
}

function startPostTextRain() {
  const rainStage = surface?.querySelector('.pretext-rain-stage');
  const columns = [...(surface?.querySelectorAll('.pretext-rain-column') || [])];
  const columnData = parseRainColumns();
  if (!rainStage || columns.length === 0 || columnData.length === 0) return;

  const glyphPool = [...(rainStage.dataset.glyphPool || rainStage.dataset.sourceWords || 'MUD')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepMs = Number(rainStage.dataset.stepMs || 220);
  const samples = [];
  window.__pretextRainMotionSamples = samples;

  const sample = (columnIndex, tick, now) => {
    if (samples.length >= 36) return;
    samples.push({
      columnIndex,
      tick,
      glyph: columns[columnIndex]?.textContent?.replace(/\s+/g, '').slice(0, 1) || '',
      phase: Number(((now % stepMs) / stepMs).toFixed(2))
    });
  };

  const refreshColumn = (columnIndex, tick, now) => {
    const column = columns[columnIndex];
    if (!column) return;
    const length = Number(column.dataset.length || columnData[columnIndex]?.length || 24);
    column.textContent = makeRandomColumn(glyphPool, length);
    column.dataset.refreshTick = String(tick);
    rainStage.dataset.activeColumn = String(columnIndex);
    rainStage.dataset.activeGlyph = column.textContent.replace(/\s+/g, '').slice(0, 1) || '';
    sample(columnIndex, tick, now);
  };

  if (reducedMotion) {
    rainStage.dataset.motionPaused = 'reduced-motion';
    columns.slice(0, Math.min(3, columns.length)).forEach((_, index) => {
      refreshColumn(index, 0, 0);
    });
    return;
  }

  let startTime = null;
  let lastTick = -1;
  const tick = (now) => {
    startTime ??= now;
    const elapsed = now - startTime;
    const tickIndex = Math.floor(elapsed / stepMs);
    if (tickIndex !== lastTick) {
      const columnIndex = Math.floor(Math.random() * columns.length);
      refreshColumn(columnIndex, tickIndex, now);
      if (tickIndex % 3 === 0) {
        refreshColumn((columnIndex + 7) % columns.length, tickIndex, now);
      }
      lastTick = tickIndex;
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

function attachPretextInteraction() {
  const rainStage = surface?.querySelector('.pretext-rain-stage');
  if (!rainStage || !stage || !surface) return;
  stage.dataset.pretextInteractive = 'true';
  const settle = () => {
    rainStage.style.setProperty('--tx', '0px');
    rainStage.style.setProperty('--ty', '0px');
  };
  const move = (event) => {
    const rect = surface.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) || 0;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) || 0;
    rainStage.style.setProperty('--tx', `${(nx * 4).toFixed(1)}px`);
    rainStage.style.setProperty('--ty', `${(ny * 3).toFixed(1)}px`);
  };
  surface.addEventListener('pointermove', move, { passive: true });
  surface.addEventListener('pointerleave', settle);
}

function setupPretextPolish() {
  if (!stage || !surface) return;
  const stateInput = {
    archive: parseArchive(),
    isMobile: window.matchMedia('(max-width: 700px)').matches
  };
  let state = createPretextState(stateInput);
  const step = pretextReducer(state, { type: 'pretext.mounted' });
  state = step.state;
  for (const effect of step.effects) {
    renderPretextTokens(effect, { stage, surface, document });
  }
  startPostTextRain();
  attachPretextInteraction();
  stage.dataset.pretextPhase = state.phase;
}

setupPretextPolish();
