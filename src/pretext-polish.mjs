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

function parseLoomRows() {
  const rowNode = surface?.querySelector('[data-pretext-loom-rows]');
  if (!rowNode) return [];
  try {
    const parsed = JSON.parse(rowNode.textContent || '[]');
    return Array.isArray(parsed) ? parsed.filter((row) => typeof row.text === 'string') : [];
  } catch (_error) {
    return [];
  }
}

function startKineticLoom() {
  const loomStage = surface?.querySelector('.pretext-loom-stage');
  const rows = [...(surface?.querySelectorAll('.pretext-loom-row') || [])];
  const status = surface?.querySelector('[data-pretext-loom-status]');
  const rowData = parseLoomRows();
  if (!loomStage || rows.length === 0 || rowData.length === 0) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepMs = Number(loomStage.dataset.stepMs || 860);
  const samples = [];
  window.__pretextLoomMotionSamples = samples;

  const activateRow = (rowIndex, now = 0) => {
    rows.forEach((row) => {
      row.dataset.active = row.dataset.loomRow === String(rowIndex) ? 'true' : 'false';
    });
    const active = rowData[rowIndex % rowData.length] || rowData[0];
    loomStage.dataset.activeRow = String(rowIndex);
    loomStage.dataset.activeKind = active.kind || 'row';
    if (status) {
      status.textContent = `INDEX CURRENT · row ${String(rowIndex + 1).padStart(2, '0')} · ${active.kind || 'row'}`;
    }
    if (samples.length < 24) {
      samples.push({
        rowIndex,
        kind: active.kind || 'row',
        text: active.text || '',
        phase: Number(((now % stepMs) / stepMs).toFixed(2))
      });
    }
  };

  if (reducedMotion) {
    loomStage.dataset.motionPaused = 'reduced-motion';
    activateRow(0, 0);
    return;
  }

  let startTime = null;
  let lastRow = -1;
  const tick = (now) => {
    startTime ??= now;
    const elapsed = now - startTime;
    const rowIndex = Math.floor(elapsed / stepMs) % rowData.length;
    if (rowIndex !== lastRow) {
      activateRow(rowIndex, now);
      lastRow = rowIndex;
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

function attachPretextInteraction() {
  const loomStage = surface?.querySelector('.pretext-loom-stage');
  if (!loomStage || !stage || !surface) return;
  stage.dataset.pretextInteractive = 'true';
  const settle = () => {
    loomStage.style.setProperty('--tx', '0px');
    loomStage.style.setProperty('--ty', '0px');
  };
  const move = (event) => {
    const rect = surface.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) || 0;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) || 0;
    loomStage.style.setProperty('--tx', `${(nx * 5).toFixed(1)}px`);
    loomStage.style.setProperty('--ty', `${(ny * 4).toFixed(1)}px`);
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
  startKineticLoom();
  attachPretextInteraction();
  stage.dataset.pretextPhase = state.phase;
}

setupPretextPolish();
