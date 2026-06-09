import { createPretextState, pretextReducer, renderPretextTokens } from './pretext-polish-state.mjs';

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
  stage.dataset.pretextPhase = state.phase;
}

setupPretextPolish();
