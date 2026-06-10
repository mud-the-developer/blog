#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EFFECT_PATTERNS = [
  /\bdocument\s*\./,
  /\bwindow\s*\./,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bnavigator\s*\./,
  /\blocation\s*\./,
  /\bhistory\s*\./,
  /\baddEventListener\s*\(/,
  /\bremoveEventListener\s*\(/,
  /\bcreateElement(?:NS)?\s*\(/,
  /\bquerySelector(?:All)?\s*\(/,
  /\breplaceChildren\s*\(/,
  /\bappend(?:Child)?\s*\(/,
  /\bclassList\s*\./,
  /\bdataset\s*\./,
  /\binnerHTML\s*=/,
  /\btextContent\s*=/,
  /\bhref\s*=/,
  /\bnew\s+Blob\b/,
  /\bURL\.createObjectURL\b/,
  /\bnew\s+Response\b/,
  /\bResponse\.json\b/,
  /\bnew\s+Request\b/
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

function defaultStateFiles(root) {
  const srcFiles = walk(resolve(root, 'src'))
    .filter((path) => /-(?:state|machine)\.mjs$/.test(path));
  const functionMachineFiles = walk(resolve(root, 'functions', 'api'))
    .filter((path) => /-machine\.js$/.test(path));
  return [...srcFiles, ...functionMachineFiles].sort();
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

export function checkStateArchitecture({ root = resolve(fileURLToPath(import.meta.url), '..', '..'), files = defaultStateFiles(root) } = {}) {
  const violations = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of EFFECT_PATTERNS) {
      const match = pattern.exec(source);
      if (!match) continue;
      const location = lineAndColumn(source, match.index);
      violations.push({
        file: relative(root, file),
        line: location.line,
        column: location.column,
        token: match[0],
        message: `${relative(root, file)}:${location.line}:${location.column} direct effect token ${JSON.stringify(match[0])} is not allowed in state/machine modules`
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStateArchitecture();
  if (!result.ok) {
    console.error('State architecture lint failed: state/machine modules must stay pure and emit effect descriptors only.');
    for (const violation of result.violations) {
      console.error(`- ${violation.message}`);
    }
    process.exit(1);
  }
  console.log('State architecture lint passed.');
}
