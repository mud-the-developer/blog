const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_VERIFICATION_DAYS = 7;

function isoDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value ? null : timestamp;
}

export function currentDateInKst(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function deadlineDays(deadline, currentDate = currentDateInKst()) {
  const deadlineValue = isoDateValue(deadline);
  const currentValue = isoDateValue(currentDate);
  if (deadlineValue === null || currentValue === null) return null;
  return Math.round((deadlineValue - currentValue) / DAY_MS);
}

export function deadlineUrgency(deadline, currentDate = currentDateInKst()) {
  const days = deadlineDays(deadline, currentDate);
  if (days === null) return null;
  if (days < 0) return 'closed';
  if (days <= 7) return 'urgent';
  if (days <= 21) return 'soon';
  return 'watch';
}

export function deadlineStatus(deadline, currentDate = currentDateInKst()) {
  const days = deadlineDays(deadline, currentDate);
  if (days === null) return null;
  if (days < 0) return 'closed';
  if (days === 0) return 'due today';
  if (days <= 14) return `due in ${days} days`;
  if (days <= 45) return `upcoming in ${days} days`;
  return `watching: ${days} days out`;
}

export function verificationIsRecent(verifiedAt, now = new Date()) {
  const value = Date.parse(verifiedAt);
  const age = now.getTime() - value;
  return Number.isFinite(value) && age >= -5 * 60 * 1000 && age <= MAX_VERIFICATION_DAYS * DAY_MS;
}

export function refreshCfpDeadlineCells(root = document, now = new Date()) {
  const currentDate = currentDateInKst(now);
  let refreshed = 0;
  for (const cell of root.querySelectorAll('[data-cfp-deadline]')) {
    const days = deadlineDays(cell.dataset.cfpDeadline, currentDate);
    const status = deadlineStatus(cell.dataset.cfpDeadline, currentDate);
    if (!status) continue;
    const recent = verificationIsRecent(cell.dataset.cfpLastVerified, now);
    const verified = cell.dataset.cfpVerified === 'true' && recent;
    const warning = cell.dataset.cfpLastVerified ? 'stale — recheck required' : 'unverified — check official page';
    const urgency = verified
      ? deadlineUrgency(cell.dataset.cfpDeadline, currentDate)
      : cell.dataset.cfpLastVerified
        ? 'stale'
        : 'unverified';
    cell.textContent = `${cell.dataset.cfpDeadline} (${verified ? status : warning})`;
    if (verified && cell.dataset.cfpCached === 'true') cell.textContent += ' · cached; verify official page';
    cell.dataset.cfpCurrentOpen = String(verified && status !== 'closed');
    cell.dataset.cfpExpired = String(status === 'closed');
    cell.dataset.cfpDays = String(days);
    cell.dataset.cfpUrgency = urgency;
    const td = cell.closest('td');
    if (td?.dataset) {
      td.dataset.cfpDeadlineAsOf = currentDate;
      td.dataset.cfpUrgency = urgency;
    }
    refreshed += 1;
  }
  return refreshed;
}

function tableSectionKind(table) {
  let node = table?.previousElementSibling;
  for (let steps = 0; node && steps < 4; steps += 1) {
    if (node.tagName === 'H3') {
      const label = (node.textContent || '').toLowerCase();
      if (label.includes('journal') || label.includes('special issue')) return 'journal';
      if (label.includes('workshop')) return 'workshop';
      if (label.includes('conference')) return 'conference';
    }
    node = node.previousElementSibling;
  }
  return '';
}

function rowKind(row, fallbackKind) {
  const kindCell = row?.cells?.[2]?.textContent?.toLowerCase() || '';
  if (kindCell.includes('journal') || kindCell.includes('special issue')) return 'journal';
  if (kindCell.includes('workshop')) return 'workshop';
  if (kindCell.includes('conference')) return 'conference';
  return fallbackKind;
}

function readCfpFilterState(root) {
  const search = root?.querySelector?.('[data-cfp-search]');
  const query = (search?.value || '').trim().toLowerCase();
  const activeKindBtn = root?.querySelector?.('[data-cfp-kind-filter][aria-pressed="true"]');
  const kind = activeKindBtn?.dataset?.cfpKindFilter || 'all';
  const soonBtn = root?.querySelector?.('[data-cfp-soon-filter]');
  const soonOnly = soonBtn?.getAttribute?.('aria-pressed') === 'true';
  return {
    query,
    terms: query ? query.split(/\s+/).filter(Boolean) : [],
    kind,
    soonOnly,
    active: Boolean(query || kind !== 'all' || soonOnly),
  };
}

function rowMatchesFilter(row, cell, fallbackKind, filter) {
  if (!filter.active) return true;
  if (filter.kind !== 'all') {
    const kind = rowKind(row, fallbackKind);
    if (kind && kind !== filter.kind) return false;
  }
  if (filter.soonOnly) {
    const days = Number(cell?.dataset?.cfpDays);
    if (cell?.dataset?.cfpCurrentOpen !== 'true' || !Number.isFinite(days) || days < 0 || days > 30) {
      return false;
    }
  }
  if (filter.terms.length > 0) {
    const haystack = (row.textContent || '').toLowerCase();
    for (const term of filter.terms) {
      if (!haystack.includes(term)) return false;
    }
  }
  return true;
}

export function refreshCfpDashboard(root = document, now = new Date()) {
  refreshCfpDeadlineCells(root, now);
  const filter = readCfpFilterState(root);
  let open = 0;
  let cached = 0;
  let radarVisible = 0;
  for (const table of root.querySelectorAll('.cfp-table-scroll')) {
    const radar = table.classList.contains('cfp-radar-table');
    const fallbackKind = radar ? '' : tableSectionKind(table);
    const limit = filter.active ? Infinity : radar ? 12 : table.closest?.('.cfp-preview') ? 3 : Infinity;
    let visible = 0;
    for (const row of table.querySelectorAll('tbody tr')) {
      const cell = row.querySelector('[data-cfp-deadline]');
      const eligible = radar ? cell?.dataset.cfpCurrentOpen === 'true' : cell?.dataset.cfpExpired !== 'true';
      for (const link of row.querySelectorAll('a[href^="https://calendar.google.com/calendar/render"]')) {
        link.hidden = cell?.dataset.cfpCurrentOpen !== 'true';
      }
      if (radar && eligible) {
        open += 1;
        if (cell.dataset.cfpCached === 'true') cached += 1;
      }
      const matched = eligible && rowMatchesFilter(row, cell, fallbackKind, filter);
      row.hidden = !matched || visible >= limit;
      if (!row.hidden) visible += 1;
    }
    if (radar) radarVisible = visible;
    const empty = table.querySelector('[data-cfp-empty]');
    if (empty) empty.hidden = visible > 0;
    table.dataset.cfpReady = 'true';
  }
  for (const [selector, value] of [
    ['[data-cfp-open-count]', open],
    ['[data-cfp-fresh-count]', open - cached],
    ['[data-cfp-cached-count]', cached],
  ]) {
    for (const label of root.querySelectorAll(selector)) label.textContent = String(value);
  }
  const matchLabel = root?.querySelector?.('[data-cfp-match-count]');
  if (matchLabel) {
    matchLabel.textContent = filter.active
      ? `${radarVisible} open match${radarVisible === 1 ? '' : 'es'}`
      : `Top ${radarVisible} of ${open} open`;
  }
  const resetBtn = root?.querySelector?.('[data-cfp-reset]');
  if (resetBtn) resetBtn.hidden = !filter.active;
  const generatedAt = root.querySelector('[data-cfp-generated-at]')?.dataset.cfpGeneratedAt;
  const generated = Date.parse(generatedAt);
  for (const warning of root.querySelectorAll('[data-cfp-stale-warning]')) {
    warning.hidden = Number.isFinite(generated) && now.getTime() - generated <= 36 * 60 * 60 * 1000;
  }
  return { open, cached };
}

export function setupCfpFilters(root = document, nowProvider = () => new Date()) {
  const toolbar = root?.querySelector?.('[data-cfp-toolbar]');
  if (!toolbar || toolbar.dataset?.cfpFiltersReady === 'true') return;
  toolbar.dataset.cfpFiltersReady = 'true';
  const search = toolbar.querySelector('[data-cfp-search]');
  const kindButtons = [...toolbar.querySelectorAll('[data-cfp-kind-filter]')];
  const soonBtn = toolbar.querySelector('[data-cfp-soon-filter]');
  const resetBtn = toolbar.querySelector('[data-cfp-reset]');
  const apply = () => refreshCfpDashboard(root, nowProvider());

  search?.addEventListener('input', apply);
  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      for (const other of kindButtons) other.setAttribute('aria-pressed', String(other === button));
      apply();
    });
  }
  soonBtn?.addEventListener('click', () => {
    const next = soonBtn.getAttribute('aria-pressed') !== 'true';
    soonBtn.setAttribute('aria-pressed', String(next));
    apply();
  });
  resetBtn?.addEventListener('click', () => {
    if (search) search.value = '';
    for (const button of kindButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.cfpKindFilter === 'all'));
    }
    soonBtn?.setAttribute('aria-pressed', 'false');
    apply();
  });
  if (typeof document !== 'undefined' && root === document && search) {
    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
      event.preventDefault();
      search.focus();
      search.select();
    });
  }
}

if (typeof document !== 'undefined' && document.querySelector('[data-cfp-generated-at]')) {
  setupCfpFilters();
  refreshCfpDashboard();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshCfpDashboard();
  });
  window.setInterval(() => refreshCfpDashboard(), 60_000);
}
