import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createFocusedIssueState,
  focusedIssueReducer,
  runFocusedIssueMachine
} from '../../functions/api/focused-issue-machine.js';

const selectedCandidate = {
  title: 'Photonics compiler release notes',
  url: 'https://selected.example/photonics-compiler',
  source: 'Selected Wire',
  summary: 'A selected search result about photonics compilers, not agent products.',
  origin: 'live-search',
  score: 0
};

const archive = [
  {
    title: 'Agent workflow archive brief',
    excerpt: 'Archive context about unrelated agent workflows.',
    folder: 'news',
    url: '/posts/agent-workflow/',
    date: '2026-06-08',
    primary_tag: 'agents'
  }
];

const feed = {
  all: [
    {
      title: 'Unrelated agent automation launch',
      url: 'https://feed.example/agents',
      source: 'Feed Wire',
      summary: 'This feed item is about unrelated agent products.',
      publishedAt: '2026-06-09T00:00:00Z'
    }
  ]
};

test('focused issue state machine keeps reducer pure and selected sources authoritative', () => {
  const request = {
    date: '2026-06-09',
    keywords: ['agent'],
    candidates: [selectedCandidate],
    limit: 4,
    nowMs: Date.parse('2026-06-09T00:00:00Z')
  };
  const initial = createFocusedIssueState(request);

  const loadStep = focusedIssueReducer(initial, { type: 'request.accepted' });
  assert.equal(loadStep.state.phase, 'reading-context');
  assert.deepEqual(loadStep.effects, [{ type: 'read-context-assets' }]);
  assert.deepEqual(initial, createFocusedIssueState(request));

  const draftStep = focusedIssueReducer(loadStep.state, {
    type: 'context.loaded',
    archive,
    feed
  });
  assert.equal(draftStep.state.phase, 'drafting');
  assert.equal(draftStep.effects.length, 1);
  assert.equal(draftStep.effects[0].type, 'call-gemma');
  assert.deepEqual(draftStep.effects[0].payload.ranked_news_items.map((item) => item.url), [selectedCandidate.url]);
  assert.deepEqual(draftStep.effects[0].payload.blog_archive_context, []);
  assert.ok(!JSON.stringify(draftStep.effects[0].payload).includes('Agent workflow archive brief'));
  assert.ok(!JSON.stringify(draftStep.effects[0].payload).includes('Unrelated agent automation launch'));
});

test('focused issue machine runs effects outside the reducer and returns sanitized response', async () => {
  const effectLog = [];
  const result = await runFocusedIssueMachine({
    request: {
      date: '2026-06-09',
      keywords: ['photonics compiler'],
      candidates: [selectedCandidate],
      limit: 1
    },
    effects: {
      async readContextAssets() {
        effectLog.push('read-context-assets');
        return { archive, feed };
      },
      async callGemma(payload) {
        effectLog.push(['call-gemma', payload]);
        return {
          text: '<think>private reasoning about agents</think>{"title":"Clean Source Brief","summary":"Selected only.","markdown":"## Clean Source Brief\\nSelected source only.","bullets":["Selected source only"]}',
          usedGemma: true
        };
      }
    }
  });

  assert.deepEqual(effectLog.map((entry) => Array.isArray(entry) ? entry[0] : entry), ['read-context-assets', 'call-gemma']);
  assert.equal(result.ok, true);
  assert.equal(result.usedGemma, true);
  assert.deepEqual(result.sources.map((item) => item.url), [selectedCandidate.url]);
  assert.equal(result.sources[0].origin, 'live-search');
  assert.match(result.issue.markdown, /Clean Source Brief/);
  assert.ok(!result.issue.markdown.includes('<think>'));
  assert.ok(!result.issue.markdown.toLowerCase().includes('private reasoning'));
  assert.ok(!JSON.stringify(result).includes('Agent workflow archive brief'));
});
