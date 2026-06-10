export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-ascii-cat' || !stage || !surface) return;
  surface.replaceChildren();

  const catStage = document.createElement('div');
  catStage.className = 'pretext-cat-stage';
  catStage.setAttribute('aria-hidden', 'true');
  catStage.style.setProperty('--duration', effect.motion?.duration || '7.2s');
  catStage.style.setProperty('--delay', effect.motion?.delay || '0s');

  for (const frameModel of effect.cat?.frames || []) {
    const frame = document.createElement('pre');
    frame.className = `pretext-cat-frame pretext-cat-frame--${frameModel.index ?? 0}`;
    frame.textContent = (frameModel.rows || []).join('\n');
    frame.dataset.depth = String(frameModel.depth ?? 0.55);
    frame.style.setProperty('--delay', frameModel.delay || '0s');
    frame.style.setProperty('--duration', frameModel.duration || '3.2s');
    frame.style.setProperty('--frame-index', String(frameModel.index ?? 0));
    frame.style.setProperty('--depth', String(frameModel.depth ?? 0.55));
    catStage.append(frame);
  }

  surface.append(catStage);

  stage.dataset.pretextScene = effect.scene || 'kinetic-ascii-cat';
  stage.dataset.pretextReady = 'true';
}
