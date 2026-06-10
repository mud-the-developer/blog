export function renderPretextTokens(effect, { stage, surface, document }) {
  if (effect.type !== 'render-pretext-ascii-cat' || !stage || !surface) return;
  surface.replaceChildren();

  const frames = effect.cat?.frames || [];
  const catStage = document.createElement('div');
  catStage.className = 'pretext-cat-stage';
  catStage.setAttribute('aria-hidden', 'true');
  catStage.style.setProperty('--duration', effect.motion?.duration || '8.8s');
  catStage.style.setProperty('--delay', effect.motion?.delay || '0s');
  catStage.dataset.behaviors = (effect.motion?.behaviors || []).join(' ');
  catStage.dataset.spriteMode = effect.cat?.spriteMode || 'single-continuous-sprite';
  catStage.dataset.refreshMode = effect.cat?.telecom?.mode || 'slow-baud-row-refresh';

  const frameData = document.createElement('script');
  frameData.type = 'application/json';
  frameData.dataset.pretextCatFrames = 'true';
  frameData.textContent = JSON.stringify(frames.map((frameModel) => ({
    index: frameModel.index ?? 0,
    pose: frameModel.pose || 'walk',
    depth: frameModel.depth ?? 0.6,
    rows: frameModel.rows || []
  })));

  const sprite = document.createElement('pre');
  sprite.className = 'pretext-cat-sprite';
  sprite.textContent = (frames[0]?.rows || []).join('\n');
  sprite.dataset.pose = frames[0]?.pose || 'walk';
  sprite.dataset.frameIndex = String(frames[0]?.index ?? 0);
  sprite.dataset.frameCount = String(frames.length);
  sprite.dataset.continuousMotion = String(Boolean(effect.motion?.continuous));
  sprite.dataset.durationMs = String(effect.motion?.durationMs || 8800);
  sprite.dataset.frameRate = String(effect.cat?.frameRate || 9);
  sprite.dataset.refreshMs = String(effect.cat?.telecom?.refreshMs || 370);
  sprite.dataset.lineSweepMs = String(effect.cat?.telecom?.lineSweepMs || 28);
  sprite.dataset.travelPx = String(effect.motion?.travelPx || 76);
  sprite.dataset.xBiasPx = String(effect.motion?.xBiasPx || 0);
  sprite.dataset.catMaxWidth = String(effect.cat?.dimensions?.maxWidth || 0);
  sprite.dataset.catLineCount = String(effect.cat?.dimensions?.lineCount || 0);
  sprite.dataset.referenceSource = (effect.cat?.references || []).map((reference) => reference.source).join(' | ');
  sprite.dataset.referenceUrl = effect.cat?.references?.[0]?.url || '';
  sprite.style.setProperty('--cat-x', `${(effect.motion?.xBiasPx || 0) - (effect.motion?.travelPx || 40)}px`);
  sprite.style.setProperty('--cat-y', '0px');
  sprite.style.setProperty('--cat-scale', '1');

  const linkStatus = document.createElement('div');
  linkStatus.className = 'pretext-cat-link';
  linkStatus.dataset.pretextCatLink = 'true';
  linkStatus.textContent = `${effect.cat?.telecom?.label || 'CAT-LINK 1200'} · ${effect.cat?.telecom?.statusCopy || 'row refresh'}`;

  catStage.append(frameData, sprite, linkStatus);
  surface.append(catStage);

  stage.dataset.pretextScene = effect.scene || 'kinetic-ascii-cat';
  stage.dataset.pretextReferences = (effect.cat?.references || []).map((reference) => reference.url).join(' ');
  stage.dataset.pretextReady = 'true';
}
