import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { checkStateArchitecture } from '../../scripts/check-state-architecture.mjs';

test('state architecture lint rejects browser DOM and network effects in state or machine modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'state-arch-lint-'));
  try {
    writeFileSync(join(root, 'pure-state.mjs'), 'export function reducer(state){ return { state, effects: [] }; }\n');
    writeFileSync(join(root, 'impure-state.mjs'), 'export function reducer(){ document.createElement("span"); return { effects: [] }; }\n');
    writeFileSync(join(root, 'machine.js'), 'export async function run(){ await fetch("/api"); }\n');

    const result = checkStateArchitecture({
      root,
      files: [join(root, 'pure-state.mjs'), join(root, 'impure-state.mjs'), join(root, 'machine.js')]
    });

    assert.equal(result.ok, false);
    assert.ok(result.violations.length >= 2);
    assert.ok(result.violations.some((violation) => /document\.|createElement/.test(violation.message)));
    assert.ok(result.violations.some((violation) => /fetch/.test(violation.message)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('current project keeps state and machine modules free of direct effects', () => {
  const result = checkStateArchitecture();
  assert.deepEqual(result.violations, []);
  assert.equal(result.ok, true);
});
