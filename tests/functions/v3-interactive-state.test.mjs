import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createV3State,
  filterCommandItems,
  v3Reducer,
} from '../../src/v3-interactive-state.mjs';

const sampleCommands = [
  { label: 'Home', section: 'page', url: '/', shortcut: 'h' },
  { label: 'Projects', section: 'page', url: '/projects/', shortcut: 'p' },
  { label: 'MWC 2026 AI-RAN', section: 'project', url: '/posts/mwc26-ai-ran-beamforming/' },
];

test('command palette opens, filters, wraps navigation index, and closes cleanly', () => {
  let state = createV3State({ commandItems: sampleCommands });
  const opened = v3Reducer(state, { type: 'cmd.open' });
  state = opened.state;
  assert.equal(state.commandOpen, true);
  assert.deepEqual(opened.effects, [{ type: 'render-command', focusInput: true }]);

  const wrappedBack = v3Reducer(state, { type: 'cmd.move', delta: -1 });
  state = wrappedBack.state;
  assert.equal(state.commandActiveIndex, 2);

  state = v3Reducer(state, { type: 'cmd.query', query: 'mwc' }).state;
  assert.equal(state.commandActiveIndex, 0);
  const matches = filterCommandItems(state.commandItems, state.commandQuery);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].url, '/posts/mwc26-ai-ran-beamforming/');

  state = v3Reducer(state, { type: 'cmd.move', delta: 5 }).state;
  assert.equal(state.commandActiveIndex, 0);

  const closed = v3Reducer(state, { type: 'cmd.close' });
  assert.equal(closed.state.commandOpen, false);
  assert.deepEqual(closed.effects, [{ type: 'render-command', focusInput: false }]);

  const noopClose = v3Reducer(closed.state, { type: 'cmd.close' });
  assert.deepEqual(noopClose.effects, []);
});
