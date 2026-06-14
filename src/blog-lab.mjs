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

function displaySourceName(value = '') {
  const source = String(value || '').trim();
  if (/^(hugging\s*face\s*papers|huggingface\.co)$/i.test(source)) return 'HF Papers';
  if (/^google scholar link$/i.test(source)) return 'Scholar';
  return source;
}

function displayMeta(parts = []) {
  return parts.map(displaySourceName).filter(Boolean).join(' · ');
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
  tape.textContent = (data.sources || []).slice(0, 5).map((source) => displaySourceName(source.source || source.title)).filter(Boolean).join('  ·  ') || 'source context';
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
    meta.textContent = displayMeta([source.source, source.publishedAt]);
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
  const sources = [...new Set(candidates.map((candidate) => displaySourceName(candidate.source || candidate.type || 'source')).filter(Boolean))].slice(0, 8);
  const board = document.createElement('div');
  board.className = 'news-source-radar';
  const boardTitle = document.createElement('strong');
  boardTitle.textContent = `${candidates.length} source candidates`;
  const boardRail = document.createElement('span');
  boardRail.textContent = sources.join(' · ');
  board.append(boardTitle, boardRail);

  const toolbar = document.createElement('div');
  toolbar.className = 'news-candidate-toolbar';
  toolbar.setAttribute('aria-label', 'Candidate selection controls');
  const selectAll = document.createElement('button');
  selectAll.type = 'button';
  selectAll.dataset.candidateAction = 'select-all';
  selectAll.textContent = 'Select all';
  const clearAll = document.createElement('button');
  clearAll.type = 'button';
  clearAll.dataset.candidateAction = 'clear-all';
  clearAll.textContent = 'Clear';
  toolbar.append(selectAll, clearAll);

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
    meta.textContent = displayMeta([candidate.source, candidate.type, candidate.publishedAt]);
    if (candidate.score) meta.title = `Internal match signal ${candidate.score}`;
    const summary = document.createElement('span');
    summary.textContent = candidate.summary || candidate.url || '';
    const meter = document.createElement('span');
    meter.className = 'news-candidate-meter';
    meter.setAttribute('aria-hidden', 'true');
    body.append(title, meta, summary, meter);
    label.append(checkbox, thumb, body);
    list.append(label);
  });
  container.append(board, toolbar, list);
}

function slugify(value = 'generated-news-draft') {
  return String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'generated-news-draft';
}

function draftMarkdown(draft) {
  const sourceLines = (draft.sources || []).map((source, index) => `${index + 1}. [${source.title || 'Untitled source'}](${source.url || '#'}) — ${source.summary || source.source || ''}`).join('\n');
  return `# ${draft.title}\n\n${draft.summary}\n\n${draft.markdown}\n\n## Sources\n${sourceLines}\n`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdownHtml(text = '') {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function markdownBlocksHtml(markdown = '') {
  return String(markdown || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const heading = line.match(/^(#{2,3})\s+(.+)/);
      if (heading) return `<h${heading[1].length + 1}>${inlineMarkdownHtml(heading[2])}</h${heading[1].length + 1}>`;
      const list = line.match(/^[-*]\s+(.+)/);
      if (list) return `<p class="news-digest-list-line">• ${inlineMarkdownHtml(list[1])}</p>`;
      return `<p>${inlineMarkdownHtml(line)}</p>`;
    })
    .join('\n');
}

function buildPrintIssueHtml(draft) {
  const sources = (draft.sources || []).slice(0, 10);
  const sourceCards = sources.map((source, index) => `
    <a class="news-digest-card generated-news-print-source" href="${escapeHtml(source.url || '#')}">
      <span class="news-digest-card-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="news-digest-card-copy">
        <strong>${escapeHtml(source.title || 'Untitled source')}</strong>
        <em>${escapeHtml(displayMeta([source.source, source.publishedAt]))}</em>
        <span>${escapeHtml(source.summary || source.url || '')}</span>
      </span>
    </a>`).join('\n');
  const generatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(draft.title)} — Mud's Blog PDF</title>
  <link rel="stylesheet" href="/assets/style.css" />
  <style>
    @page { size: A4; margin: 15mm; }
    body { background: #f7fbff; color: #0b1020; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    a { color: inherit; text-decoration: none; }
    .generated-news-print { max-width: 860px; margin: 0 auto; }
    .generated-news-print .news-digest-hero { page-break-inside: avoid; }
    .generated-news-print .news-digest-hero-copy h1 { font-family: Georgia, serif; font-size: 2.6rem; line-height: 1.02; letter-spacing: -0.045em; margin: 0 0 12px; }
    .generated-news-print .news-digest-lead { font-size: 1.05rem; color: #30405b; }
    .generated-news-print .news-digest-meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .generated-news-print .news-digest-meta-card,
    .generated-news-print .news-digest-signal-brief,
    .generated-news-print .news-digest-card { border: 1px solid rgba(62,86,124,.22); border-radius: 18px; background: rgba(255,255,255,.78); box-shadow: 0 12px 34px rgba(63,89,132,.12); }
    .generated-news-print .news-digest-meta-card { padding: 12px; }
    .generated-news-print .news-digest-signal-brief { padding: 20px; margin-top: 18px; }
    .generated-news-print .news-digest-signal-brief h2,
    .generated-news-print .news-digest-signal-brief h3 { font-family: Georgia, serif; letter-spacing: -0.025em; margin: 16px 0 8px; }
    .generated-news-print .news-digest-signal-brief p { margin: 0 0 11px; line-height: 1.72; }
    .generated-news-print .news-digest-card-grid { display: grid; gap: 10px; margin-top: 14px; }
    .generated-news-print .news-digest-card { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; padding: 13px; }
    .generated-news-print .news-digest-card-index { font-family: ui-monospace, monospace; color: #315ea8; font-weight: 800; }
    .generated-news-print .news-digest-card-copy { display: grid; gap: 4px; min-width: 0; }
    .generated-news-print .news-digest-card-copy em { color: #566274; font-size: .86rem; }
    .generated-news-print .news-digest-card-copy span { color: #30405b; overflow-wrap: anywhere; }
    .section-kicker, .news-digest-meta-label { color: #566274; font-size: .76rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    @media print { body { background: white; } .generated-news-print { max-width: none; } }
  </style>
</head>
<body data-layout="reader-post">
  <article class="news-digest-shell generated-news-print">
    <section class="news-digest-hero">
      <div class="news-digest-hero-copy">
        <p class="section-kicker">Focused Brief</p>
        <h1>${escapeHtml(draft.title)}</h1>
        <p class="news-digest-lead">${escapeHtml(draft.summary || '')}</p>
      </div>
      <div class="news-digest-meta-grid">
        <div class="news-digest-meta-card"><span class="news-digest-meta-label">Issue</span><strong>review draft</strong></div>
        <div class="news-digest-meta-card"><span class="news-digest-meta-label">Generated</span><strong>${escapeHtml(generatedAt)} KST</strong></div>
        <div class="news-digest-meta-card"><span class="news-digest-meta-label">Sources</span><strong>${sources.length} cards</strong></div>
      </div>
    </section>
    <section class="news-digest-signal-brief">
      <header class="news-digest-section-head"><p class="section-kicker">Signal Brief</p><h2>Draft copy</h2></header>
      ${markdownBlocksHtml(draft.markdown)}
    </section>
    <section class="news-digest-signal-brief">
      <header class="news-digest-section-head"><p class="section-kicker">Evidence</p><h2>Selected source cards</h2></header>
      <div class="news-digest-card-grid">${sourceCards}</div>
    </section>
  </article>
</body>
</html>`;
}

function openPrintIssue(draft) {
  const html = buildPrintIssueHtml(draft);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${slugify(draft.title)}-print.html`);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus?.();
  printWindow.print?.();
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

  const setCandidateSelection = (checked) => {
    for (const checkbox of lab.querySelectorAll('[data-candidate-index]')) {
      checkbox.checked = checked;
    }
    return dispatch({ type: 'candidate.selection.changed', selectedIndexes: selectedIndexes() });
  };

  const setSourceGroupSelection = (button) => {
    const group = button.closest('[data-source-group]');
    if (!group) return;
    const checked = button.dataset.sourceGroupAction === 'select';
    for (const checkbox of group.querySelectorAll('input[name="sources"]')) {
      checkbox.checked = checked;
    }
  };

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

  results?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-candidate-action]');
    if (!button) return;
    event.preventDefault();
    setCandidateSelection(button.dataset.candidateAction === 'select-all');
  });

  form?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-source-group-action]');
    if (!button) return;
    event.preventDefault();
    setSourceGroupSelection(button);
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
        openPrintIssue(currentDraft);
      } else {
        downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
      }
    });
  }

  dispatch({ type: 'lab.mounted' });
}

setupFocusedIssueLab();
document.body.dataset.blogLabReady = 'true';
