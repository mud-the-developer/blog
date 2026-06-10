export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-type-current' || !stage || !surface) return;
  surface.replaceChildren();
  for (const layerName of ['current', 'caustic', 'dust']) {
    const layer = document.createElement('span');
    layer.className = `pretext-ambient-layer pretext-ambient-layer--${layerName}`;
    layer.setAttribute('aria-hidden', 'true');
    surface.append(layer);
  }
  for (const volumeName of ['rear', 'mid']) {
    const volume = document.createElement('span');
    volume.className = `pretext-inner-volume pretext-inner-volume--${volumeName}`;
    volume.setAttribute('aria-hidden', 'true');
    surface.append(volume);
  }
  for (const rowModel of effect.microRows || []) {
    const row = document.createElement('span');
    row.className = `pretext-micro-row pretext-micro-row--${rowModel.direction || 'normal'}`;
    row.setAttribute('aria-hidden', 'true');
    row.textContent = rowModel.text;
    row.style.setProperty('--y', rowModel.y);
    row.style.setProperty('--delay', rowModel.delay);
    row.style.setProperty('--duration', rowModel.duration);
    row.style.setProperty('--row-opacity', rowModel.opacity);
    surface.append(row);
  }
  for (const tokenModel of effect.tokens) {
    const token = document.createElement('span');
    token.className = `pretext-type-fragment ${tokenModel.variant}`;
    token.dataset.depth = String(tokenModel.depth);
    token.dataset.tokenKind = tokenModel.kind || 'type-phrase';
    token.textContent = tokenModel.label;
    token.style.setProperty('--x', tokenModel.x);
    token.style.setProperty('--y', tokenModel.y);
    token.style.setProperty('--delay', tokenModel.delay);
    token.style.setProperty('--duration', tokenModel.duration);
    token.style.setProperty('--scale-start', tokenModel.scaleStart);
    token.style.setProperty('--scale-end', tokenModel.scaleEnd);
    token.style.setProperty('--opacity-start', tokenModel.opacityStart);
    token.style.setProperty('--opacity-end', tokenModel.opacityEnd);
    token.style.setProperty('--depth', String(tokenModel.depth));
    surface.append(token);
  }
  const frontGlass = document.createElement('span');
  frontGlass.className = 'pretext-front-glass';
  frontGlass.setAttribute('aria-hidden', 'true');
  surface.append(frontGlass);
  stage.dataset.pretextScene = effect.scene || 'pretext-type-current';
  stage.dataset.pretextReady = 'true';
}
