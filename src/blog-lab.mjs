import { createNewsDeskState, newsDeskReducer, runNewsDeskEffect } from './blog-lab-machine.mjs';

function setStatus(node, message, kind = '') {
  if (!node) return;
  node.replaceChildren();
  node.dataset.state = kind;
  if (kind === 'loading') {
    const pulse = document.createElement('span');
    pulse.className = 'status-pulse';
    pulse.setAttribute('aria-hidden', 'true');
    pulse.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    node.append(pulse, document.createTextNode(` ${message}`));
    return;
  }
  node.textContent = message;
}

function fallbackThumbnail(source = {}) {
  const text = [source.source, source.type, source.url].join(' ').toLowerCase();
  if (text.includes('github') || text.includes('repo')) return '/assets/news/thumb-repo.svg';
  if (text.includes('arxiv') || text.includes('paper') || text.includes('huggingface')) return '/assets/news/thumb-paper.svg';
  if (text.includes('ran') || text.includes('vran') || text.includes('o-ran')) return '/assets/news/thumb-vran.svg';
  return '/assets/news/thumb-ai.svg';
}

function sourceKey(source = {}) {
  return String(source.source || source.type || source.url || 'source')
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'source';
}

function appendInlineMarkdown(container, text = '') {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  for (const match of String(text).matchAll(pattern)) {
    if (match.index > cursor) container.append(document.createTextNode(String(text).slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      container.append(strong);
    } else if (token.startsWith('`')) {
      const code = document.createElement('code');
      code.textContent = token.slice(1, -1);
      container.append(code);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const anchor = document.createElement('a');
      anchor.textContent = linkMatch?.[1] || token;
      anchor.href = linkMatch?.[2] || '#';
      anchor.rel = 'noopener noreferrer';
      container.append(anchor);
    }
    cursor = match.index + token.length;
  }
  if (cursor < String(text).length) container.append(document.createTextNode(String(text).slice(cursor)));
}

function appendMarkdownBlocks(container, markdown = '') {
  const lines = String(markdown || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const heading = line.match(/^(#{2,3})\s+(.+)/);
    const list = line.match(/^[-*]\s+(.+)/);
    const node = document.createElement(heading ? (heading[1].length === 2 ? 'h3' : 'h4') : 'p');
    if (list) node.className = 'generated-news-bullet';
    appendInlineMarkdown(node, heading ? heading[2] : list ? `• ${list[1]}` : line);
    container.append(node);
  }
}

function renderFocusedIssue(output, data) {
  if (!output) return null;
  output.replaceChildren();
  if (!data?.ok) {
    output.textContent = data?.error || 'Focused issue draft failed.';
    return null;
  }
  const article = document.createElement('article');
  article.className = 'generated-news-card';
  const header = document.createElement('header');
  header.className = 'generated-news-cover';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Generated card news draft';
  const title = document.createElement('h3');
  title.textContent = data.issue?.title || 'Generated news draft';
  const summary = document.createElement('p');
  summary.className = 'generated-news-summary';
  summary.textContent = data.issue?.summary || '';
  const metrics = document.createElement('div');
  metrics.className = 'generated-news-metrics';
  const modelLabel = data.usedGemma
    ? String(data.modelName || 'Gemma').replace(/^models\//, '')
    : 'fallback';
  const metricRows = [
    ['sources', String((data.sources || []).length)],
    ['model', modelLabel],
    ['mode', 'review']
  ];
  for (const [label, value] of metricRows) {
    const chip = document.createElement('span');
    const chipLabel = document.createElement('em');
    chipLabel.textContent = label;
    const chipValue = document.createElement('strong');
    chipValue.textContent = value;
    chip.append(chipLabel, chipValue);
    metrics.append(chip);
  }
  const tape = document.createElement('div');
  tape.className = 'generated-news-tape';
  tape.textContent = (data.sources || []).slice(0, 5).map((source) => source.source || source.title).filter(Boolean).join('  ·  ') || 'ranked source context';
  const warning = document.createElement('p');
  warning.className = 'generated-news-warning';
  warning.textContent = data.warning || '';
  if (data.warning) header.append(eyebrow, title, summary, metrics, tape, warning);
  else header.append(eyebrow, title, summary, metrics, tape);

  const body = document.createElement('div');
  body.className = 'generated-news-body';
  appendMarkdownBlocks(body, data.issue?.markdown || '');

  const sources = document.createElement('section');
  sources.className = 'generated-news-sources';
  const sourcesTitle = document.createElement('h4');
  sourcesTitle.textContent = 'Selected source cards';
  sources.append(sourcesTitle);
  const sourceGrid = document.createElement('div');
  sourceGrid.className = 'generated-news-source-grid';
  for (const source of (data.sources || []).slice(0, 8)) {
    const link = document.createElement(source.url ? 'a' : 'span');
    link.className = 'generated-news-source';
    if (source.url) link.href = source.url;
    const thumb = document.createElement('img');
    thumb.className = 'generated-news-thumbnail';
    thumb.src = source.thumbnail || fallbackThumbnail(source);
    thumb.alt = '';
    thumb.loading = 'lazy';
    const sourceBody = document.createElement('span');
    sourceBody.className = 'generated-news-source-body';
    const name = document.createElement('strong');
    name.textContent = source.title || 'Untitled source';
    const meta = document.createElement('em');
    meta.textContent = [source.source, source.publishedAt, source.score ? `score ${source.score}` : ''].filter(Boolean).join(' · ');
    const deck = document.createElement('span');
    deck.textContent = source.summary || source.url || '';
    sourceBody.append(name, meta, deck);
    link.append(thumb, sourceBody);
    sourceGrid.append(link);
  }
  sources.append(sourceGrid);
  article.append(header, body, sources);
  output.append(article);
  return {
    title: data.issue?.title || 'generated-news-draft',
    summary: data.issue?.summary || '',
    markdown: data.issue?.markdown || '',
    sources: data.sources || []
  };
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function renderSearchResults(container, candidates) {
  if (!container) return;
  container.replaceChildren();
  if (!candidates.length) {
    container.textContent = 'No candidates found. Try a broader query.';
    return;
  }
  const sources = [...new Set(candidates.map((candidate) => candidate.source || candidate.type || 'source').filter(Boolean))].slice(0, 8);
  const board = document.createElement('div');
  board.className = 'news-source-radar';
  const boardTitle = document.createElement('strong');
  boardTitle.textContent = `${candidates.length} ranked candidates`;
  const boardRail = document.createElement('span');
  boardRail.textContent = sources.join(' · ');
  board.append(boardTitle, boardRail);

  const list = document.createElement('div');
  list.className = 'news-candidate-list';
  candidates.forEach((candidate, index) => {
    const label = document.createElement('label');
    label.className = 'news-candidate-card';
    label.dataset.sourceKey = sourceKey(candidate);
    label.style.setProperty('--score', String(Math.max(4, Math.min(Number(candidate.score) || 6, 14))));
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = index < 5;
    checkbox.dataset.candidateIndex = String(index);
    const rank = document.createElement('span');
    rank.className = 'news-candidate-rank';
    rank.textContent = String(index + 1).padStart(2, '0');
    const thumb = document.createElement('img');
    thumb.className = 'news-candidate-thumbnail';
    thumb.src = candidate.thumbnail || fallbackThumbnail(candidate);
    thumb.alt = '';
    thumb.loading = 'lazy';
    const body = document.createElement('span');
    body.className = 'news-candidate-body';
    const title = document.createElement('strong');
    title.textContent = candidate.title || 'Untitled candidate';
    const meta = document.createElement('em');
    meta.textContent = [candidate.source, candidate.type, candidate.publishedAt, candidate.score ? `score ${candidate.score}` : ''].filter(Boolean).join(' · ');
    const summary = document.createElement('span');
    summary.textContent = candidate.summary || candidate.url || '';
    const meter = document.createElement('span');
    meter.className = 'news-candidate-meter';
    meter.setAttribute('aria-hidden', 'true');
    body.append(title, meta, summary, meter);
    label.append(checkbox, rank, thumb, body);
    list.append(label);
  });
  container.append(board, list);
}

function slugify(value = 'generated-news-draft') {
  return String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'generated-news-draft';
}

function draftMarkdown(draft) {
  const sourceLines = (draft.sources || []).map((source, index) => `${index + 1}. [${source.title || 'Untitled source'}](${source.url || '#'}) — ${source.summary || source.source || ''}`).join('\n');
  return `# ${draft.title}\n\n${draft.summary}\n\n${draft.markdown}\n\n## Sources\n${sourceLines}\n`;
}

function makeSimplePdf(text) {
  const safeLines = String(text).replace(/[()\\]/g, ' ').split(/\n+/).flatMap((line) => {
    const chunks = [];
    for (let i = 0; i < line.length; i += 82) chunks.push(line.slice(i, i + 82));
    return chunks.length ? chunks : [''];
  }).slice(0, 42);
  const content = `BT /F1 11 Tf 52 790 Td 14 TL ${safeLines.map((line) => `(${line}) Tj T*`).join(' ')} ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n',
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += object;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function setupFocusedIssueLab() {
  const lab = document.querySelector('[data-focused-issue-lab]');
  if (!lab) return;
  const form = lab.querySelector('[data-news-search-form]');
  const output = lab.querySelector('[data-focused-issue-output]');
  const status = lab.querySelector('[data-focused-issue-status]');
  const results = lab.querySelector('[data-news-search-results]');
  const draftButton = lab.querySelector('[data-draft-selected-news]');
  const downloadButtons = [...lab.querySelectorAll('[data-download-draft]')];
  const dateInput = lab.querySelector('[name="date"]');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  let currentDraft = null;
  let state = createNewsDeskState({ date: dateInput?.value });

  const setDownloadEnabled = (enabled) => {
    for (const button of downloadButtons) button.disabled = !enabled;
  };

  const setDraftEnabled = (enabled) => {
    if (draftButton) draftButton.disabled = !enabled;
  };

  const selectedSources = () => [...lab.querySelectorAll('input[name="sources"]:checked')]
    .map((input) => input.value)
    .filter(Boolean);

  const selectedIndexes = () => [...lab.querySelectorAll('[data-candidate-index]:checked')]
    .map((checkbox) => Number(checkbox.dataset.candidateIndex))
    .filter((index) => Number.isInteger(index));

  const applyEffect = async (effect) => {
    if (effect.type === 'render-status') {
      setStatus(status, effect.message, effect.kind);
    } else if (effect.type === 'clear-output') {
      output.textContent = '';
      currentDraft = null;
    } else if (effect.type === 'set-download-enabled') {
      setDownloadEnabled(effect.enabled);
    } else if (effect.type === 'set-draft-enabled') {
      setDraftEnabled(effect.enabled);
    } else if (effect.type === 'render-candidates') {
      renderSearchResults(results, effect.candidates);
    } else if (effect.type === 'render-draft') {
      currentDraft = renderFocusedIssue(output, effect.data);
    } else if (effect.type === 'post-json') {
      const event = await runNewsDeskEffect(effect, { postJson });
      if (event) await dispatch(event);
    }
  };

  async function dispatch(event) {
    const step = newsDeskReducer(state, event);
    state = step.state;
    for (const effect of step.effects) {
      await applyEffect(effect);
    }
    lab.dataset.newsDeskPhase = state.phase;
  }

  results?.addEventListener('change', () => {
    dispatch({ type: 'candidate.selection.changed', selectedIndexes: selectedIndexes() });
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    dispatch({
      type: 'search.submitted',
      query: formData.get('query'),
      queryMode: formData.get('queryMode'),
      date: formData.get('date'),
      sources: selectedSources()
    });
  });

  draftButton?.addEventListener('click', () => {
    dispatch({ type: 'candidate.selection.changed', selectedIndexes: selectedIndexes() })
      .then(() => dispatch({ type: 'draft.requested' }));
  });

  for (const button of downloadButtons) {
    button.addEventListener('click', () => {
      if (!currentDraft) return;
      const markdown = draftMarkdown(currentDraft);
      const filename = slugify(currentDraft.title);
      if (button.dataset.downloadDraft === 'pdf') {
        downloadBlob(makeSimplePdf(markdown), `${filename}.pdf`);
      } else {
        downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
      }
    });
  }

  dispatch({ type: 'lab.mounted' });
}

setupFocusedIssueLab();
document.body.dataset.blogLabReady = 'true';
