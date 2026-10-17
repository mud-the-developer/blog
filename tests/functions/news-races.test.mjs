import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNewsDeskState, newsDeskReducer, runNewsDeskEffect } from '../../src/blog-lab-machine.mjs';

const sources = ['google-news-rss'];
const candidates = [
  { title: 'First', url: 'https://example.test/a' },
  { title: 'Second', url: 'https://example.test/b' },
];

test('late search successes and failures cannot replace a newer search', () => {
  const first = newsDeskReducer(createNewsDeskState(), { type: 'search.submitted', query: 'first', sources }).state;
  const second = newsDeskReducer(first, { type: 'search.submitted', query: 'second', sources }).state;
  for (const type of ['search.succeeded', 'request.failed']) {
    const result = newsDeskReducer(second, { type, requestId: first.requestId, data: { candidates }, error: 'old error' });
    assert.equal(result.state, second);
    assert.deepEqual(result.effects, []);
  }
  const result = newsDeskReducer(second, { type: 'search.succeeded', requestId: second.requestId, data: { candidates } });
  assert.equal(result.state.query, 'second');
  assert.deepEqual(result.state.candidates, candidates);
});

test('draft requests cannot overlap and changing selection invalidates pending output', () => {
  let state = newsDeskReducer(createNewsDeskState(), { type: 'search.submitted', query: 'first', sources }).state;
  state = newsDeskReducer(state, { type: 'search.succeeded', requestId: state.requestId, data: { candidates } }).state;
  const draft = newsDeskReducer(state, { type: 'draft.requested' });
  assert.equal(draft.state.draftEnabled, false);
  assert.deepEqual(newsDeskReducer(draft.state, { type: 'draft.requested' }).effects, []);
  const selection = newsDeskReducer(draft.state, { type: 'candidate.selection.changed', selectedIndexes: [1] });
  assert(selection.effects.some((effect) => effect.type === 'cancel-request'));
  assert.equal(selection.state.currentDraft, null);
  const late = newsDeskReducer(selection.state, {
    type: 'draft.succeeded',
    requestId: draft.state.requestId,
    data: { issue: { title: 'old' } },
  });
  assert.equal(late.state, selection.state);
  assert.deepEqual(late.effects, []);
  const completed = newsDeskReducer(draft.state, {
    type: 'draft.succeeded',
    requestId: draft.state.requestId,
    data: { issue: { title: 'old' } },
  }).state;
  const changed = newsDeskReducer(completed, { type: 'candidate.selection.changed', selectedIndexes: [1] }).state;
  assert.equal(changed.draftEnabled, true);
  assert.equal(changed.downloadEnabled, false);
  assert.equal(changed.currentDraft, null);
});

test('cancelled requests do not become error banners', async () => {
  const event = await runNewsDeskEffect(
    { type: 'post-json', requestId: 1, onError: 'request.failed' },
    {
      postJson: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
    },
  );
  assert.equal(event, null);
});
