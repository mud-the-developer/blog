export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-post-text-rain' || !stage || !surface) return;
  surface.replaceChildren();

  const rain = effect.rain || {};
  const columns = rain.columns || [];
  const rainStage = document.createElement('div');
  rainStage.className = 'pretext-rain-stage';
  rainStage.setAttribute('aria-hidden', 'true');
  rainStage.dataset.behaviors = (effect.motion?.behaviors || []).join(' ');
  rainStage.dataset.rainMode = rain.mode || 'post-text-rain';
  rainStage.dataset.sourceCount = String(rain.sourceCount || 0);
  rainStage.dataset.columnCount = String(columns.length);
  rainStage.dataset.glyphPool = rain.glyphPool || '';
  rainStage.dataset.sourceWords = (rain.sourceText || '').slice(0, 240);
  rainStage.dataset.stepMs = String(effect.motion?.stepMs || 220);

  const columnData = document.createElement('script');
  columnData.type = 'application/json';
  columnData.dataset.pretextRainColumns = 'true';
  columnData.textContent = JSON.stringify(columns.map((column) => ({
    index: column.index ?? 0,
    text: column.text || '',
    length: column.length ?? 24,
    x: column.x ?? 0,
    alpha: column.alpha ?? 0.5,
    durationMs: column.durationMs ?? 6400,
    delayMs: column.delayMs ?? 0,
    speed: column.speed ?? 6.4
  })));

  const rainBody = document.createElement('div');
  rainBody.className = 'pretext-rain-body';
  columns.forEach((column) => {
    const stream = document.createElement('div');
    stream.className = 'pretext-rain-column';
    stream.dataset.rainColumn = String(column.index ?? 0);
    stream.dataset.length = String(column.length ?? 24);
    stream.style.setProperty('--x', `${column.x ?? 0}%`);
    stream.style.setProperty('--alpha', String(column.alpha ?? 0.5));
    stream.style.setProperty('--duration', `${column.durationMs ?? 6400}ms`);
    stream.style.setProperty('--delay', `${column.delayMs ?? 0}ms`);
    stream.textContent = column.text || '';
    rainBody.append(stream);
  });

  rainStage.append(columnData, rainBody);
  surface.append(rainStage);

  stage.dataset.pretextScene = effect.scene || 'post-text-rain';
  stage.dataset.pretextReferences = (rain.references || []).map((reference) => reference.url).join(' ');
  stage.dataset.pretextReady = 'true';
}
