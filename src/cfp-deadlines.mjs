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

export function deadlineStatus(deadline, currentDate = currentDateInKst()) {
  const deadlineValue = isoDateValue(deadline);
  const currentValue = isoDateValue(currentDate);
  if (deadlineValue === null || currentValue === null) return null;
  const days = Math.round((deadlineValue - currentValue) / DAY_MS);
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
    const status = deadlineStatus(cell.dataset.cfpDeadline, currentDate);
    if (!status) continue;
    const recent = verificationIsRecent(cell.dataset.cfpLastVerified, now);
    const verified = cell.dataset.cfpVerified === 'true' && recent;
    const warning = cell.dataset.cfpLastVerified ? 'stale — recheck required' : 'unverified — check official page';
    cell.textContent = `${cell.dataset.cfpDeadline} (${verified ? status : warning})`;
    if (verified && cell.dataset.cfpCached === 'true') cell.textContent += ' · cached; verify official page';
    cell.dataset.cfpCurrentOpen = String(verified && status !== 'closed');
    cell.dataset.cfpExpired = String(status === 'closed');
    cell.closest('td').dataset.cfpDeadlineAsOf = currentDate;
    refreshed += 1;
  }
  return refreshed;
}

export function refreshCfpDashboard(root = document, now = new Date()) {
  refreshCfpDeadlineCells(root, now);
  let open = 0;
  let cached = 0;
  for (const table of root.querySelectorAll('.cfp-table-scroll')) {
    const radar = table.classList.contains('cfp-radar-table');
    const limit = radar ? 12 : table.closest('.cfp-preview') ? 3 : Infinity;
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
      row.hidden = !eligible || visible >= limit;
      if (!row.hidden) visible += 1;
    }
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
  const generatedAt = root.querySelector('[data-cfp-generated-at]')?.dataset.cfpGeneratedAt;
  const generated = Date.parse(generatedAt);
  for (const warning of root.querySelectorAll('[data-cfp-stale-warning]')) {
    warning.hidden = Number.isFinite(generated) && now.getTime() - generated <= 36 * 60 * 60 * 1000;
  }
  return { open, cached };
}

if (typeof document !== 'undefined' && document.querySelector('[data-cfp-generated-at]')) {
  refreshCfpDashboard();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshCfpDashboard();
  });
  window.setInterval(() => refreshCfpDashboard(), 60_000);
}
