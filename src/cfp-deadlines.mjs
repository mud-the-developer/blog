const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_CELL_PATTERN = /^(\d{4}-\d{2}-\d{2}) \((?:closed|due today|due in \d+ days|upcoming in \d+ days|watching: \d+ days out)\)$/;

function isoDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
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

export function refreshCfpDeadlineCells(root = document, currentDate = currentDateInKst()) {
  let refreshed = 0;
  for (const cell of root.querySelectorAll('.post-body td')) {
    const match = cell.textContent.trim().match(DEADLINE_CELL_PATTERN);
    if (!match) continue;

    const status = deadlineStatus(match[1], currentDate);
    if (!status) continue;
    cell.textContent = `${match[1]} (${status})`;
    cell.dataset.cfpDeadlineAsOf = currentDate;
    refreshed += 1;
  }
  return refreshed;
}

if (typeof document !== 'undefined') {
  const title = document.querySelector('.post-reader h1')?.textContent || '';
  if (title.includes('CFP Radar')) {
    refreshCfpDeadlineCells();
  }
}
