import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  deadlineStatus,
  refreshCfpDeadlineCells,
} from '../../src/cfp-deadlines.mjs';

test('deadline status is calculated from the current date, not the weekly issue date', () => {
  assert.equal(deadlineStatus('2026-07-15', '2026-07-16'), 'closed');
  assert.equal(deadlineStatus('2026-07-16', '2026-07-16'), 'due today');
  assert.equal(deadlineStatus('2026-07-18', '2026-07-16'), 'due in 2 days');
  assert.equal(deadlineStatus('2026-08-10', '2026-07-16'), 'upcoming in 25 days');
  assert.equal(deadlineStatus('2026-09-01', '2026-07-16'), 'watching: 47 days out');
});

test('CFP deadline cells refresh while non-deadline cells remain unchanged', () => {
  const cells = [
    { textContent: '2026-07-15 (due in 2 days)', dataset: {} },
    { textContent: 'No dated CFP posted on official page', dataset: {} },
    { textContent: '2026-08-10 (upcoming in 28 days)', dataset: {} },
  ];
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, '.post-body td');
      return cells;
    },
  };

  const refreshed = refreshCfpDeadlineCells(root, '2026-07-16');

  assert.equal(refreshed, 2);
  assert.equal(cells[0].textContent, '2026-07-15 (closed)');
  assert.equal(cells[1].textContent, 'No dated CFP posted on official page');
  assert.equal(cells[2].textContent, '2026-08-10 (upcoming in 25 days)');
  assert.equal(cells[0].dataset.cfpDeadlineAsOf, '2026-07-16');
});
