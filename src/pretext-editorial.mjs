import { layoutWithLines, prepareWithSegments } from './pretext/layout.js';

const layer = document.querySelector('[data-pretext-editorial]');
const canvas = layer?.querySelector('canvas');
const archiveNode = document.getElementById('archive-data');

if (layer && canvas && archiveNode) {
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const archive = JSON.parse(archiveNode.textContent || '[]');
  const compact = window.matchMedia('(max-width: 560px)').matches;
  const sourceLimit = compact ? 5 : 9;
  const domPosts = Array.from(document.querySelectorAll('.filetree-file')).map((link) => ({
    title: link.querySelector('.filetree-title')?.textContent?.trim() || '',
    folder: link.closest('[data-folder]')?.getAttribute('data-folder') || 'note',
  }));
  const uniquePosts = new Map();
  [...archive, ...domPosts].forEach((post) => {
    if (post && typeof post.title === 'string' && post.title.trim()) {
      uniquePosts.set(post.title.trim(), post);
    }
  });
  const sources = Array.from(uniquePosts.values())
    .slice(0, sourceLimit)
    .map((post, index) => ({
      title: post.title.trim(),
      folder: String(post.folder || post.primary_tag || 'note'),
      phase: index * 0.83,
      speed: 0.52 + (index % 4) * 0.11,
    }));

  const font = compact ? '600 10px Arial' : '600 12px Arial';
  const lineHeight = compact ? 13 : 16;
  const preparedSources = sources.map((source) => ({
    ...source,
    prepared: prepareWithSegments(`${source.folder.toUpperCase()} / ${source.title}`, font),
  }));

  let width = 1;
  let height = 1;
  let dpr = 1;
  let frame = 0;
  let animationFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let layouts = [];

  const syncCanvas = () => {
    const bounds = layer.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const columnWidth = Math.max(126, Math.min(compact ? 174 : 250, width * (compact ? 0.62 : 0.34)));
    layouts = preparedSources.map((source) => ({
      ...source,
      result: layoutWithLines(source.prepared, columnWidth, lineHeight),
      columnWidth,
    }));
    layer.dataset.pretextSourceCount = String(layouts.length);
    layer.dataset.pretextLayoutLines = String(
      layouts.reduce((total, item) => total + item.result.lineCount, 0),
    );
  };

  const palette = () => {
    const style = getComputedStyle(document.documentElement);
    return {
      ink: style.getPropertyValue('--ink').trim() || '#0b1020',
      muted: style.getPropertyValue('--muted').trim() || '#566274',
      accent: style.getPropertyValue('--accent').trim() || '#315ea8',
      line: style.getPropertyValue('--line').trim() || 'rgba(62, 86, 124, .22)',
    };
  };

  const draw = (time = 0) => {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const colors = palette();
    pointerX += (targetX - pointerX) * 0.045;
    pointerY += (targetY - pointerY) * 0.045;

    context.save();
    context.font = font;
    context.textBaseline = 'alphabetic';
    context.globalCompositeOperation = 'source-over';

    const columns = compact ? 2 : 3;
    const cellWidth = width / columns;
    const rowHeight = compact ? 102 : 118;
    const elapsed = time * 0.001;

    layouts.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const drift = reducedMotion.matches ? 0 : Math.sin(elapsed * item.speed + item.phase);
      const x = column * cellWidth + 12 + drift * (compact ? 4 : 9) + pointerX * (index % 2 ? -5 : 7);
      const y = 28 + row * rowHeight + drift * (compact ? 3 : 7) + pointerY * (index % 3 - 1) * 5;

      context.globalAlpha = index % 3 === 0 ? 0.3 : 0.2;
      context.fillStyle = index % 3 === 0 ? colors.accent : colors.muted;
      item.result.lines.forEach((line, lineIndex) => {
        context.fillText(line.text, x, y + lineIndex * lineHeight);
      });

      context.globalAlpha = 0.16;
      context.strokeStyle = colors.line;
      context.beginPath();
      context.moveTo(x, y + item.result.height + 5);
      context.lineTo(x + Math.min(item.result.lines[0]?.width || 42, item.columnWidth), y + item.result.height + 5);
      context.stroke();
    });

    context.restore();
    layer.dataset.pretextFrame = String(frame);
  };

  const tick = (time) => {
    frame += 1;
    draw(time);
    animationFrame = requestAnimationFrame(tick);
  };

  const updateMotion = () => {
    cancelAnimationFrame(animationFrame);
    if (reducedMotion.matches) {
      layer.dataset.pretextMotion = 'reduced';
      draw(0);
      return;
    }
    layer.dataset.pretextMotion = 'active';
    animationFrame = requestAnimationFrame(tick);
  };

  const onPointerMove = (event) => {
    targetX = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
    targetY = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
  };

  syncCanvas();
  draw(0);
  layer.dataset.pretextEngine = '@chenglou/pretext';
  layer.dataset.pretextReady = 'true';
  updateMotion();

  const resizeObserver = new ResizeObserver(() => {
    syncCanvas();
    if (reducedMotion.matches) draw(0);
  });
  resizeObserver.observe(layer);
  reducedMotion.addEventListener?.('change', updateMotion);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  new MutationObserver(() => draw(performance.now())).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}
