export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-ascii-loom' || !stage || !surface) return;
  surface.replaceChildren();

  for (const layerName of ['paper', 'current', 'dust']) {
    const layer = document.createElement('span');
    layer.className = `pretext-ambient-layer pretext-ambient-layer--${layerName}`;
    layer.setAttribute('aria-hidden', 'true');
    surface.append(layer);
  }

  for (const threadModel of effect.threads || []) {
    const thread = document.createElement('span');
    thread.className = `pretext-loom-thread pretext-loom-thread--${threadModel.direction || 'normal'}`;
    thread.setAttribute('aria-hidden', 'true');
    thread.textContent = threadModel.text;
    thread.style.setProperty('--y', threadModel.y);
    thread.style.setProperty('--delay', threadModel.delay);
    thread.style.setProperty('--duration', threadModel.duration);
    surface.append(thread);
  }

  const frame = document.createElement('div');
  frame.className = 'pretext-ascii-frame';
  frame.setAttribute('aria-hidden', 'true');

  const title = document.createElement('span');
  title.className = 'pretext-ascii-title';
  title.textContent = effect.frame?.title || 'PRETEXT / INDEX LOOM';
  frame.append(title);

  for (const rowModel of effect.frame?.rows || []) {
    const row = document.createElement('span');
    row.className = `pretext-ascii-row pretext-ascii-row--${rowModel.kind || 'phrase'}`;
    row.dataset.rowKind = rowModel.kind || 'phrase';
    row.dataset.depth = String(rowModel.depth ?? 0.5);
    row.textContent = rowModel.text;
    row.style.setProperty('--delay', rowModel.delay || '0s');
    row.style.setProperty('--duration', rowModel.duration || '10s');
    row.style.setProperty('--row-index', String(rowModel.index ?? 0));
    row.style.setProperty('--depth', String(rowModel.depth ?? 0.5));
    frame.append(row);
  }

  const cursor = document.createElement('span');
  cursor.className = 'pretext-scan-cursor';
  cursor.textContent = effect.scanCursor?.label || 'writing index is live ▌';
  cursor.style.setProperty('--delay', effect.scanCursor?.delay || '0s');
  cursor.style.setProperty('--duration', effect.scanCursor?.duration || '9.5s');
  frame.append(cursor);
  surface.append(frame);

  const frontGlass = document.createElement('span');
  frontGlass.className = 'pretext-front-glass';
  frontGlass.setAttribute('aria-hidden', 'true');
  surface.append(frontGlass);

  stage.dataset.pretextScene = effect.scene || 'kinetic-ascii-loom';
  stage.dataset.pretextReady = 'true';
}
