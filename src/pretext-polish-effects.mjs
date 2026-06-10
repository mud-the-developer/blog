export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-ascii-cat' || !stage || !surface) return;
  surface.replaceChildren();

  for (const layerName of ['paper', 'current', 'dust']) {
    const layer = document.createElement('span');
    layer.className = `pretext-ambient-layer pretext-ambient-layer--${layerName}`;
    layer.setAttribute('aria-hidden', 'true');
    surface.append(layer);
  }

  const catStage = document.createElement('div');
  catStage.className = 'pretext-cat-stage';
  catStage.setAttribute('aria-hidden', 'true');
  catStage.style.setProperty('--duration', effect.motion?.duration || '6.8s');
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

  const shadow = document.createElement('span');
  shadow.className = 'pretext-cat-shadow';
  shadow.textContent = effect.cat?.shadow?.glyph || '~~~~~~~~~~~~';
  shadow.style.setProperty('--delay', effect.cat?.shadow?.delay || '0s');
  shadow.style.setProperty('--duration', effect.cat?.shadow?.duration || '4.8s');
  catStage.append(shadow);
  surface.append(catStage);

  for (const pawModel of effect.paws || []) {
    const paw = document.createElement('span');
    paw.className = 'pretext-cat-paw';
    paw.setAttribute('aria-hidden', 'true');
    paw.textContent = pawModel.glyph || '·';
    paw.dataset.depth = String(pawModel.depth ?? 0.3);
    paw.style.setProperty('--x', pawModel.x || '50%');
    paw.style.setProperty('--y', pawModel.y || '72%');
    paw.style.setProperty('--delay', pawModel.delay || '0s');
    paw.style.setProperty('--duration', pawModel.duration || '4.4s');
    paw.style.setProperty('--depth', String(pawModel.depth ?? 0.3));
    surface.append(paw);
  }

  const frontGlass = document.createElement('span');
  frontGlass.className = 'pretext-front-glass';
  frontGlass.setAttribute('aria-hidden', 'true');
  surface.append(frontGlass);

  stage.dataset.pretextScene = effect.scene || 'kinetic-ascii-cat';
  stage.dataset.pretextReady = 'true';
}
