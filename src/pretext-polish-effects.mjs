export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-ascii-cat' || !stage || !surface) return;
  surface.replaceChildren();

  const catStage = document.createElement('div');
  catStage.className = 'pretext-cat-stage';
  catStage.setAttribute('aria-hidden', 'true');
  catStage.style.setProperty('--duration', effect.motion?.duration || '10.4s');
  catStage.style.setProperty('--delay', effect.motion?.delay || '0s');
  catStage.dataset.behaviors = (effect.motion?.behaviors || []).join(' ');

  for (const frameModel of effect.cat?.frames || []) {
    const frame = document.createElement('pre');
    frame.className = `pretext-cat-frame pretext-cat-frame--${frameModel.index ?? 0}`;
    frame.textContent = (frameModel.rows || []).join('\n');
    frame.dataset.depth = String(frameModel.depth ?? 0.55);
    frame.dataset.pose = frameModel.pose || 'cat';
    frame.style.setProperty('--delay', frameModel.delay || '0s');
    frame.style.setProperty('--duration', frameModel.duration || '5.04s');
    frame.style.setProperty('--frame-index', String(frameModel.index ?? 0));
    frame.style.setProperty('--depth', String(frameModel.depth ?? 0.55));
    frame.style.setProperty('--pose-x', `${frameModel.offset?.x ?? 0}px`);
    frame.style.setProperty('--pose-y', `${frameModel.offset?.y ?? 0}px`);
    frame.style.setProperty('--pose-scale', String(frameModel.scale ?? 1));
    catStage.append(frame);
  }

  surface.append(catStage);

  stage.dataset.pretextScene = effect.scene || 'kinetic-ascii-cat';
  stage.dataset.pretextReady = 'true';
}
