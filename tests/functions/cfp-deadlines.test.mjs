import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentDateInKst,
  deadlineStatus,
  verificationIsRecent,
  refreshCfpDeadlineCells,
  refreshCfpDashboard,
} from '../../src/cfp-deadlines.mjs';

const now = new Date('2026-10-17T12:00:00Z');
function cell(date, verified = true, cached = false, last = '2026-10-17T10:00:00Z') {
  const td = { dataset: {} };
  return {
    textContent: '',
    dataset: { cfpDeadline: date, cfpVerified: String(verified), cfpCached: String(cached), cfpLastVerified: last },
    closest: () => td,
  };
}

test('deadline status uses the current KST date and rejects impossible dates', () => {
  assert.equal(currentDateInKst(new Date('2026-10-16T15:00:00Z')), '2026-10-17');
  assert.equal(deadlineStatus('2026-10-16', '2026-10-17'), 'closed');
  assert.equal(deadlineStatus('2026-10-17', '2026-10-17'), 'due today');
  assert.equal(deadlineStatus('2026-10-30', '2026-10-17'), 'due in 13 days');
  assert.equal(deadlineStatus('2026-11-10', '2026-10-17'), 'upcoming in 24 days');
  assert.equal(deadlineStatus('2027-01-01', '2026-10-17'), 'watching: 76 days out');
  assert.equal(deadlineStatus('2026-02-30', '2026-02-01'), null);
});

test('cache verification expires after seven days and does not accept future timestamps', () => {
  assert.equal(verificationIsRecent('2026-10-16T12:00:00Z', now), true);
  assert.equal(verificationIsRecent('2026-10-09T12:00:00Z', now), false);
  assert.equal(verificationIsRecent('2026-10-18T12:00:00Z', now), false);
  assert.equal(verificationIsRecent('', now), false);
});

test('date refresh preserves cached warnings and distinguishes stale and unverified values', () => {
  const cells = [
    cell('2026-10-30', true, true),
    cell('2026-10-30', false, false, ''),
    cell('2026-10-30', true, true, '2026-10-01T12:00:00Z'),
  ];
  assert.equal(refreshCfpDeadlineCells({ querySelectorAll: () => cells }, now), 3);
  assert.match(cells[0].textContent, /due in 13 days.*cached/);
  assert.match(cells[1].textContent, /unverified/);
  assert.match(cells[2].textContent, /stale/);
  assert.equal(cells[0].dataset.cfpCurrentOpen, 'true');
  assert.equal(cells[1].dataset.cfpCurrentOpen, 'false');
  assert.equal(cells[2].dataset.cfpCurrentOpen, 'false');
});

test('expired rows leave the radar, later rows fill the gap, and counts exclude stale dates', () => {
  const cells = [
    cell('2026-10-16'),
    ...Array.from({ length: 13 }, (_, index) => cell('2026-10-30', true, index === 0)),
    cell('2026-11-01', true, true, '2026-10-01T12:00:00Z'),
  ];
  const calendarLinks = cells.map(() => ({ hidden: false }));
  const rows = cells.map((value, index) => ({
    hidden: false,
    querySelector: () => value,
    querySelectorAll(selector) {
      assert.equal(selector, 'a[href^="https://calendar.google.com/calendar/render"]');
      return [calendarLinks[index]];
    },
  }));
  const empty = { hidden: true };
  const table = { classList: { contains: () => true }, dataset: {}, querySelectorAll: () => rows, querySelector: () => empty };
  const open = {},
    fresh = {},
    cached = {},
    warning = {};
  const nodes = {
    '[data-cfp-deadline]': cells,
    '.cfp-table-scroll': [table],
    '[data-cfp-open-count]': [open],
    '[data-cfp-fresh-count]': [fresh],
    '[data-cfp-cached-count]': [cached],
    '[data-cfp-stale-warning]': [warning],
  };
  const root = {
    querySelectorAll: (selector) => nodes[selector],
    querySelector: () => ({ dataset: { cfpGeneratedAt: '2026-10-14T12:00:00Z' } }),
  };
  assert.deepEqual(refreshCfpDashboard(root, now), { open: 13, cached: 1 });
  assert.equal(rows[0].hidden, true);
  assert.equal(rows.filter((row) => !row.hidden).length, 12);
  assert.equal(rows.at(-1).hidden, true);
  assert.equal(open.textContent, '13');
  assert.equal(fresh.textContent, '12');
  assert.equal(cached.textContent, '1');
  assert.equal(warning.hidden, false);
  assert.equal(empty.hidden, true);
  assert.equal(calendarLinks[0].hidden, true, 'Expired call must not offer calendar addition');
  assert.equal(calendarLinks[1].hidden, false, 'Still-valid cached call can be added');
  assert.equal(calendarLinks.at(-1).hidden, true, 'Stale evidence must not offer calendar addition');
  cells[1].dataset.cfpVerified = 'false';
  refreshCfpDashboard(root, now);
  assert.equal(calendarLinks[1].hidden, true, 'Unverified call must not offer calendar addition');
});
