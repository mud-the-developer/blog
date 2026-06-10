export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-tokens' || !stage || !surface) return;
  surface.replaceChildren();
  for (const layerName of ['haze', 'veil', 'glint']) {
    const layer = document.createElement('span');
    layer.className = `pretext-ambient-layer pretext-ambient-layer--${layerName}`;
    layer.setAttribute('aria-hidden', 'true');
    surface.append(layer);
  }
  for (const tokenModel of effect.tokens) {
    const token = document.createElement('span');
    token.className = `pretext-token pretext-glass-block ${tokenModel.variant}`;
    token.dataset.depth = String(tokenModel.depth);
    token.textContent = tokenModel.label;
    token.style.setProperty('--x', tokenModel.x);
    token.style.setProperty('--y', tokenModel.y);
    token.style.setProperty('--delay', tokenModel.delay);
    token.style.setProperty('--duration', tokenModel.duration);
    token.style.setProperty('--shadow-y', tokenModel.shadowY);
    token.style.setProperty('--shadow-blur', tokenModel.shadowBlur);
    token.style.setProperty('--scale-start', tokenModel.scaleStart);
    token.style.setProperty('--scale-end', tokenModel.scaleEnd);
    token.style.setProperty('--depth', String(tokenModel.depth));
    surface.append(token);
  }
  stage.dataset.pretextScene = 'deep-space-glass';
  stage.dataset.pretextReady = 'true';
}
