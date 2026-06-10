export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-loom' || !stage || !surface) return;
  surface.replaceChildren();

  const rows = effect.loom?.rows || [];
  const loomStage = document.createElement('div');
  loomStage.className = 'pretext-loom-stage';
  loomStage.setAttribute('aria-hidden', 'true');
  loomStage.style.setProperty('--duration', effect.motion?.duration || '11.8s');
  loomStage.dataset.behaviors = (effect.motion?.behaviors || []).join(' ');
  loomStage.dataset.loomMode = effect.loom?.mode || 'kinetic-text-instrument';
  loomStage.dataset.sourceCount = String(effect.loom?.sourceCount || 0);

  const rowData = document.createElement('script');
  rowData.type = 'application/json';
  rowData.dataset.pretextLoomRows = 'true';
  rowData.textContent = JSON.stringify(rows.map((row) => ({
    index: row.index ?? 0,
    kind: row.kind || 'title',
    text: row.text || '',
    depth: row.depth ?? 0.6,
    weight: row.weight ?? 0.75
  })));

  const header = document.createElement('div');
  header.className = 'pretext-loom-header';
  header.textContent = effect.loom?.label || 'PRETEXT / INDEX LOOM';

  const body = document.createElement('div');
  body.className = 'pretext-loom-body';
  rows.forEach((row) => {
    const line = document.createElement('div');
    line.className = `pretext-loom-row pretext-loom-row-${row.kind || 'title'}`;
    line.dataset.loomRow = String(row.index ?? 0);
    line.dataset.kind = row.kind || 'title';
    line.style.setProperty('--row-depth', String(row.depth ?? 0.7));
    line.style.setProperty('--row-weight', String(row.weight ?? 0.75));
    line.textContent = row.text || '';
    body.append(line);
  });

  const cursor = document.createElement('div');
  cursor.className = 'pretext-loom-cursor';
  cursor.dataset.pretextLoomCursor = 'true';
  cursor.textContent = '▌';

  const status = document.createElement('div');
  status.className = 'pretext-loom-status';
  status.dataset.pretextLoomStatus = 'true';
  status.textContent = `${effect.loom?.status?.label || 'INDEX CURRENT'} · ${effect.loom?.status?.copy || 'archive rows'}`;

  loomStage.append(rowData, header, body, cursor, status);
  surface.append(loomStage);

  stage.dataset.pretextScene = effect.scene || 'kinetic-ascii-loom';
  stage.dataset.pretextReferences = (effect.loom?.references || []).map((reference) => reference.url).join(' ');
  stage.dataset.pretextReady = 'true';
}
