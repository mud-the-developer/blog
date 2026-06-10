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

function parseCatFrames() {
  const frameNode = surface?.querySelector('[data-pretext-cat-frames]');
  if (!frameNode) return [];
  try {
    const parsed = JSON.parse(frameNode.textContent || '[]');
    return Array.isArray(parsed) ? parsed.filter((frame) => Array.isArray(frame.rows)) : [];
  } catch (_error) {
    return [];
  }
}

function startContinuousCat() {
  const sprite = surface?.querySelector('.pretext-cat-sprite');
  const linkStatus = surface?.querySelector('[data-pretext-cat-link]');
  const frames = parseCatFrames();
  if (!sprite || !frames.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const durationMs = Number(sprite.dataset.durationMs || 15200);
  const refreshMs = Number(sprite.dataset.refreshMs || 370);
  const lineSweepMs = Number(sprite.dataset.lineSweepMs || 28);
  const travelPx = Number(sprite.dataset.travelPx || 76);
  const xBiasPx = Number(sprite.dataset.xBiasPx || 0);
  const samples = [];
  window.__pretextCatMotionSamples = samples;

  let startTime = null;
  let lastFrameIndex = -1;
  let lastSampleAt = -Infinity;
  let displayedRows = [...(frames[0]?.rows || [])];
  let lineTimers = [];

  const clearLineTimers = () => {
    for (const timer of lineTimers) window.clearTimeout(timer);
    lineTimers = [];
  };

  const updateLinkStatus = (frame, rowIndex = null) => {
    if (!linkStatus) return;
    const rowCopy = rowIndex === null ? 'locked' : `row ${String(rowIndex + 1).padStart(2, '0')}`;
    linkStatus.textContent = `CAT-LINK 1200 · ${rowCopy} · ${frame.pose || 'walk'}`;
  };

  const paintRowsSlowly = (frame, frameIndex) => {
    clearLineTimers();
    sprite.dataset.frameIndex = String(frame.index ?? frameIndex);
    sprite.dataset.pose = frame.pose || 'walk';
    sprite.dataset.refreshing = 'true';
    sprite.dataset.refreshMode = 'slow-baud-row-refresh';

    frame.rows.forEach((row, rowIndex) => {
      const timer = window.setTimeout(() => {
        displayedRows[rowIndex] = row;
        sprite.textContent = displayedRows.join('\n');
        sprite.dataset.refreshRow = String(rowIndex + 1);
        updateLinkStatus(frame, rowIndex);
        if (rowIndex === frame.rows.length - 1) {
          sprite.dataset.refreshing = 'false';
          updateLinkStatus(frame);
        }
      }, rowIndex * lineSweepMs);
      lineTimers.push(timer);
    });
  };

  const paintFrame = (frameIndex, progress, now) => {
    const frame = frames[frameIndex % frames.length];
    const oneWayProgress = progress < 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
    const eased = oneWayProgress * oneWayProgress * (3 - 2 * oneWayProgress);
    const facing = progress < 0.5 ? 'right' : 'left';
    const gaitPhase = ((frameIndex % frames.length) / frames.length) * Math.PI * 2;
    const x = xBiasPx - travelPx + eased * travelPx * 2;
    const y = Math.sin(gaitPhase) * 1.8 + Math.sin(progress * Math.PI * 2) * 1.2;
    const scale = 0.996 + Math.sin(gaitPhase) * 0.004;

    if (lastFrameIndex !== frameIndex) {
      paintRowsSlowly(frame, frameIndex);
      lastFrameIndex = frameIndex;
    }

    sprite.dataset.facing = facing;
    sprite.style.setProperty('--cat-x', `${x.toFixed(1)}px`);
    sprite.style.setProperty('--cat-y', `${y.toFixed(1)}px`);
    sprite.style.setProperty('--cat-scale', scale.toFixed(3));
    sprite.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px + var(--tx, 0px)), calc(-50% + ${y.toFixed(1)}px + var(--ty, 0px)), 0px) scale(${scale.toFixed(3)})`;

    if (samples.length < 24 && now - lastSampleAt >= 120) {
      samples.push({
        frameIndex,
        pose: sprite.dataset.pose,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        facing,
        refreshRow: sprite.dataset.refreshRow || '0',
        refreshing: sprite.dataset.refreshing || 'false'
      });
      lastSampleAt = now;
    }
  };

  if (reducedMotion) {
    clearLineTimers();
    displayedRows = [...frames[0].rows];
    sprite.textContent = displayedRows.join('\n');
    sprite.dataset.motionPaused = 'reduced-motion';
    sprite.dataset.refreshing = 'false';
    sprite.dataset.refreshMode = 'slow-baud-row-refresh';
    updateLinkStatus(frames[0]);
    paintFrame(0, 0.18, 0);
    return;
  }

  const tick = (now) => {
    startTime ??= now;
    const elapsed = now - startTime;
    const progress = (elapsed % durationMs) / durationMs;
    const frameIndex = Math.floor(elapsed / refreshMs) % frames.length;
    paintFrame(frameIndex, progress, now);
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

function attachPretextInteraction() {
  const sprite = surface?.querySelector('.pretext-cat-sprite');
  if (!sprite || !stage || !surface) return;
  stage.dataset.pretextInteractive = 'true';
  const settle = () => {
    sprite.style.setProperty('--tx', '0px');
    sprite.style.setProperty('--ty', '0px');
  };
  const move = (event) => {
    const rect = surface.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) || 0;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) || 0;
    sprite.style.setProperty('--tx', `${(nx * 8).toFixed(1)}px`);
    sprite.style.setProperty('--ty', `${(ny * 5).toFixed(1)}px`);
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
  startContinuousCat();
  attachPretextInteraction();
  stage.dataset.pretextPhase = state.phase;
}

setupPretextPolish();
