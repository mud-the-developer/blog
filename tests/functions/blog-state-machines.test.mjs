import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyThemeEffect } from '../../src/site-chrome-effects.mjs';
import { createThemeState, themeReducer } from '../../src/site-chrome-state.mjs';
import { createPretextState, pretextReducer } from '../../src/pretext-polish-state.mjs';
import { createNewsDeskState, newsDeskReducer, runNewsDeskEffect } from '../../src/blog-lab-machine.mjs';

const archive = [
  { folder: 'papers', primary_tag: 'paper', tags: ['llm'], title: 'Uncertainty-Aware Hybrid Inference with On-Device Small and Remote Large Language Models', url: '/posts/uhlm-2412-12687/' },
  { folder: 'news', primary_tag: 'ai', tags: ['Gemma', 'open RAN'], title: 'Gemma open RAN issue', url: '/posts/2026-06-10-ai-news-digest/' },
  { folder: 'blog', primary_tag: 'rust', tags: ['Tokio'], title: 'Rust rendering notes', url: '/posts/rust-rendering-notes/' },
  { folder: 'papers', primary_tag: 'radio', tags: ['semantic'], title: 'Semantic radio note', url: '/posts/uhlm-2412-12687/' }
];

const candidates = [
  { title: 'Photonics compiler', url: 'https://selected.example/photonics', source: 'Selected Wire', score: 9 },
  { title: 'Open RAN issue', url: 'https://selected.example/ran', source: 'RAN Wire', score: 7 }
];

test('site chrome theme reducer is pure and separates render effects', () => {
  const initial = createThemeState({ systemTheme: 'dark' });
  const rendered = themeReducer(initial, { type: 'chrome.mounted' });

  assert.deepEqual(initial, createThemeState({ systemTheme: 'dark' }));
  assert.equal(rendered.state.activeTheme, 'dark');
  assert.equal(rendered.state.overrideTheme, null);
  assert.deepEqual(rendered.effects, [{ type: 'render-theme', activeTheme: 'system-dark', theme: 'dark', override: false, accessibleLabel: 'Toggle color theme: Dark' }]);

  const toggled = themeReducer(rendered.state, { type: 'theme.toggle' });
  assert.equal(toggled.state.activeTheme, 'light');
  assert.equal(toggled.state.overrideTheme, 'light');
  assert.deepEqual(toggled.effects, [{ type: 'render-theme', activeTheme: 'light', theme: 'light', override: true, accessibleLabel: 'Toggle color theme: Light' }]);

  const ignoredSystemChange = themeReducer(toggled.state, { type: 'system-theme.changed', theme: 'dark' });
  assert.deepEqual(ignoredSystemChange.effects, []);
  assert.equal(ignoredSystemChange.state.activeTheme, 'light');
});

test('theme render effect keeps the visible theme label inside the accessible name', () => {
  const attributes = {};
  const label = { textContent: 'System' };
  const button = {
    dataset: {},
    setAttribute(name, value) {
      attributes[name] = value;
    },
    querySelector(selector) {
      return selector === '.theme-toggle-label' ? label : null;
    }
  };
  const root = {
    dataset: {},
    removeAttribute(name) {
      delete this.dataset[name];
    }
  };

  applyThemeEffect({ type: 'render-theme', activeTheme: 'system-light', theme: 'light', override: false, accessibleLabel: 'Toggle color theme: Light' }, { root, button });

  assert.equal(label.textContent, 'Light');
  assert.equal(attributes['aria-label'], 'Toggle color theme: Light');
  assert.equal(attributes['aria-pressed'], 'false');
});

test('pretext polish reducer emits a layered type current from archive language', () => {
  const initial = createPretextState({ archive, isMobile: false });
  const step = pretextReducer(initial, { type: 'pretext.mounted' });

  assert.deepEqual(initial, createPretextState({ archive, isMobile: false }));
  assert.equal(step.state.phase, 'ready');
  assert.equal(step.effects.length, 1);
  const effect = step.effects[0];
  assert.equal(effect.type, 'render-pretext-type-current');
  assert.equal(effect.scene, 'pretext-type-current');
  assert.deepEqual(effect.links, []);
  assert.deepEqual(effect.lanes, []);
  assert.equal(effect.microRows.length, 4);
  assert.ok(effect.microRows.every((row) => row.text.includes('·') || row.text.includes('/')));
  assert.ok(effect.tokens.length >= 15);
  assert.ok(effect.tokens.length <= 20);
  assert.ok(effect.tokens.filter((token) => token.kind === 'focus-word').length >= 3);
  assert.ok(effect.tokens.filter((token) => token.kind === 'type-phrase').length >= 6);
  assert.ok(effect.tokens.filter((token) => token.kind === 'type-punctuation').length >= 3);
  assert.ok(effect.tokens.some((token) => token.label === 'open RAN'));
  assert.ok(effect.tokens.some((token) => token.label === 'Rust'));
  assert.ok(effect.tokens.some((token) => token.label === 'semantic'));
  assert.ok(effect.tokens.every((token) => token.label.length <= 24));
  assert.ok(effect.tokens.every((token) => token.url === ''));
  assert.ok(effect.tokens.every((token) => token.x.endsWith('%') && token.y.endsWith('%')));
  assert.ok(effect.tokens.every((token) => token.depth >= 0 && token.depth <= 1));
  assert.ok(effect.tokens.every((token) => token.variant.startsWith('type-')));
});

test('news desk reducer controls search/draft/download states without DOM effects', () => {
  const initial = createNewsDeskState({ date: '2026-06-09' });
  const search = newsDeskReducer(initial, {
    type: 'search.submitted',
    query: 'Gemma open RAN',
    queryMode: 'gemma-expand',
    date: '2026-06-09',
    sources: ['google-news-rss', 'arxiv']
  });

  assert.equal(search.state.phase, 'searching');
  assert.equal(search.state.downloadEnabled, false);
  assert.deepEqual(search.effects.find((effect) => effect.type === 'post-json'), {
    type: 'post-json',
    path: '/api/news-search',
    body: { query: 'Gemma open RAN', queryMode: 'gemma-expand', date: '2026-06-09', sources: ['google-news-rss', 'arxiv'], limit: 12 },
    onSuccess: 'search.succeeded',
    onError: 'request.failed'
  });
  assert.ok(search.effects.some((effect) => effect.type === 'render-status' && effect.kind === 'loading'));
  assert.ok(search.effects.some((effect) => effect.type === 'clear-output'));

  const ready = newsDeskReducer(search.state, {
    type: 'search.succeeded',
    data: { candidates, searched: ['google-news-rss', 'arxiv'], keywords: ['Gemma open RAN', 'O-RAN automation'], searchQuery: 'Gemma open RAN OR O-RAN automation' }
  });
  assert.equal(ready.state.phase, 'candidates-ready');
  assert.equal(ready.state.draftEnabled, true);
  assert.ok(ready.effects.some((effect) => effect.type === 'render-candidates' && effect.candidates === candidates));
  assert.ok(ready.effects.some((effect) => effect.type === 'set-draft-enabled' && effect.enabled === true));
  assert.deepEqual(ready.state.selectedCandidateIndexes, [0, 1]);

  const draft = newsDeskReducer(ready.state, { type: 'draft.requested' });
  assert.equal(draft.state.phase, 'drafting');
  assert.deepEqual(draft.effects.find((effect) => effect.type === 'post-json'), {
    type: 'post-json',
    path: '/api/focused-issue',
    body: { date: '2026-06-09', keywords: ['Gemma open RAN', 'O-RAN automation'], candidates, limit: 2 },
    onSuccess: 'draft.succeeded',
    onError: 'request.failed'
  });

  const complete = newsDeskReducer(draft.state, {
    type: 'draft.succeeded',
    data: { ok: true, issue: { title: 'Selected Brief', markdown: '## Selected Brief' }, sources: candidates }
  });
  assert.equal(complete.state.phase, 'draft-ready');
  assert.equal(complete.state.downloadEnabled, true);
  assert.equal(complete.effects[0].type, 'render-draft');
});

test('news desk effect runner dispatches success and error events from injected IO', async () => {
  const successEvent = await runNewsDeskEffect(
    { type: 'post-json', path: '/api/news-search', body: { query: 'Gemma' }, onSuccess: 'search.succeeded', onError: 'request.failed' },
    { postJson: async (path, body) => ({ path, body, candidates: [] }) }
  );
  assert.deepEqual(successEvent, {
    type: 'search.succeeded',
    data: { path: '/api/news-search', body: { query: 'Gemma' }, candidates: [] }
  });

  const errorEvent = await runNewsDeskEffect(
    { type: 'post-json', path: '/api/news-search', body: {}, onSuccess: 'search.succeeded', onError: 'request.failed' },
    { postJson: async () => { throw new Error('network down'); } }
  );
  assert.deepEqual(errorEvent, { type: 'request.failed', error: 'network down' });
});
