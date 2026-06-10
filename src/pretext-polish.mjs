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

function attachPretextInteraction() {
  const tokens = [...surface.querySelectorAll('.pretext-cat-frame,.pretext-cat-paw,.pretext-cat-shadow')];
  if (!tokens.length) return;
  stage.dataset.pretextInteractive = 'true';
  const settle = () => {
    for (const token of tokens) {
      token.style.setProperty('--tx', '0px');
      token.style.setProperty('--ty', '0px');
    }
  };
  const move = (event) => {
    const rect = surface.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) || 0;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) || 0;
    tokens.forEach((token, index) => {
      const depth = Number(token.dataset.depth || 0.35);
      const wave = Math.sin(index + nx * 2.5) * 2;
      token.style.setProperty('--tx', `${(nx * 10 * depth + wave).toFixed(1)}px`);
      token.style.setProperty('--ty', `${(ny * 6 * depth + Math.cos(index + ny * 2) * 1.5).toFixed(1)}px`);
    });
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
  attachPretextInteraction();
  stage.dataset.pretextPhase = state.phase;
}

setupPretextPolish();
