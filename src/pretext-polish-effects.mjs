export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-tokens' || !stage || !surface) return;
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
  const network = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  network.classList.add('pretext-network');
  network.setAttribute('viewBox', '0 0 100 100');
  network.setAttribute('preserveAspectRatio', 'none');
  network.setAttribute('aria-hidden', 'true');
  for (const link of effect.links || []) {
    const from = effect.tokens[link.from];
    const to = effect.tokens[link.to];
    if (!from || !to) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('pretext-link');
    line.setAttribute('x1', Number.parseFloat(from.x));
    line.setAttribute('y1', Number.parseFloat(from.y));
    line.setAttribute('x2', Number.parseFloat(to.x));
    line.setAttribute('y2', Number.parseFloat(to.y));
    line.style.setProperty('--strength', String(link.strength || 0.4));
    network.append(line);
  }
  surface.append(network);
  for (const tokenModel of effect.tokens) {
    const token = document.createElement(tokenModel.url && tokenModel.url !== '#' ? 'a' : 'span');
    token.className = `pretext-token pretext-glass-block ${tokenModel.variant}`;
    if (token.tagName === 'A') {
      token.href = tokenModel.url;
      token.setAttribute('aria-label', `Open ${tokenModel.label}`);
    }
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
  const frontGlass = document.createElement('span');
  frontGlass.className = 'pretext-front-glass';
  frontGlass.setAttribute('aria-hidden', 'true');
  surface.append(frontGlass);
  stage.dataset.pretextScene = 'front-glass-aquarium';
  stage.dataset.pretextReady = 'true';
}
