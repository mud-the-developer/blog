import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { callGemma, modelNameFromEnv } from '../../functions/api/_shared.js';
import { onRequestPost as focusedIssuePost } from '../../functions/api/focused-issue.js';
import { onRequestPost as newsSearchPost } from '../../functions/api/news-search.js';

const archive = [
  {
    title: 'AI News Brief — 2026-04-14',
    excerpt: 'Open RAN inference chips and agent workflows shaped the day.',
    folder: 'news',
    url: '/posts/2026-04-14-ai-news-digest/',
    date: '2026-04-14',
    primary_tag: 'news'
  },
  {
    title: 'Rust Rendering Notes',
    excerpt: 'Askama, Tokio and static rendering notes.',
    folder: 'blog',
    url: '/posts/rust-rendering-notes/',
    date: '2026-02-11',
    primary_tag: 'rust'
  }
];

const newsFeed = {
  generatedAt: '2026-04-14T00:00:00Z',
  all: [
    {
      title: 'Open RAN accelerator stack adds Gemma planning hooks',
      url: 'https://example.test/oran-gemma',
      source: 'example.test',
      summary: 'A vendor connected O-RAN telemetry ranking with Gemma-based planning.',
      categories: ['open-ran', 'gemma'],
      publishedAt: '2026-04-14T08:00:00Z'
    },
    {
      title: 'General model serving update',
      url: 'https://example.test/model-serving',
      source: 'example.test',
      summary: 'Serving improvements for AI systems.',
      categories: ['inference'],
      publishedAt: '2026-04-14T09:00:00Z'
    },
    {
      title: 'Gemma paper implementation notes',
      url: 'https://huggingface.co/papers/2604.00002',
      source: 'huggingface.co',
      summary: 'A paper card from the existing digest snapshot sources.',
      categories: ['papers', 'gemma'],
      publishedAt: '2026-04-14T10:00:00Z'
    },
    {
      title: 'GeekNews open RAN agent thread',
      url: 'https://geeknews.example/ran-agent',
      source: 'geeknews',
      summary: 'Community discussion about open RAN agents.',
      categories: ['social', 'openran'],
      publishedAt: '2026-04-14T11:00:00Z'
    }
  ]
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonRequest(body) {
  return new Request('https://blog.example.test/api/focused-issue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function mockEnv() {
  return {
    GOOGLE_AI_API_KEY: 'unit-test-secret-key',
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/archive.json') {
          return Response.json(archive);
        }
        if (path === '/news/data/latest.json') {
          return Response.json(newsFeed);
        }
        return new Response('not found', { status: 404 });
      }
    }
  };
}

test('Gemma calls default to a Gemma 4 model unless overridden', () => {
  assert.equal(modelNameFromEnv({}), 'models/gemma-4-31b-it');
  assert.equal(modelNameFromEnv({ GOOGLE_AI_MODEL: 'gemma-4-26b-a4b-it' }), 'models/gemma-4-26b-a4b-it');
});

test('focused issue function ranks keyword news, calls Gemma server-side, and never leaks the key', async () => {
  let gemmaPayload;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    gemmaPayload = JSON.parse(init.body);
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: 'Open RAN + Gemma Brief — 2026-04-14',
                  summary: 'Open RAN and Gemma planning are converging.',
                  markdown: '## Open RAN + Gemma\nRanked sources show **O-RAN telemetry** feeding Gemma planning.',
                  bullets: ['O-RAN telemetry is the strongest match.', 'Gemma should receive ranked source context.']
                })
              }
            ]
          }
        }
      ]
    });
  };

  const response = await focusedIssuePost({
    request: jsonRequest({ date: '2026-04-14', keywords: 'open RAN, Gemma', limit: 4 }),
    env: mockEnv()
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  const serialized = JSON.stringify(body);
  assert.equal(body.ok, true);
  assert.deepEqual(body.keywords, ['open RAN', 'Gemma']);
  assert.match(body.issue.markdown, /Open RAN \+ Gemma/);
  assert.equal(body.overviewFigure, undefined);
  assert.equal(body.overview_figure, undefined);
  assert.equal(body.sources[0].url, 'https://example.test/oran-gemma');
  assert.ok(body.sources[0].thumbnail.includes('/assets/news/thumb-'));
  assert.ok(body.sources[0].score > body.sources[1].score);
  assert.ok(gemmaPayload.contents[0].parts[0].text.includes('ranked_news_items'));
  assert.ok(!gemmaPayload.contents[0].parts[0].text.includes('overview_figure'));
  assert.ok(gemmaPayload.contents[0].parts[0].text.includes('blog_archive_context'));
  assert.ok(!serialized.includes('unit-test-secret-key'));
});

test('news search function searches live-style sources before Gemma drafting uses selected candidates', async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push(String(url));
    if (String(url).includes('news.google.com/rss/search')) {
      return new Response(`<?xml version="1.0"?><rss><channel>
        <item><title>Gemma agents reshape open RAN operations</title><link>https://news.example/oran-gemma</link><source>Example News</source><pubDate>Tue, 14 Apr 2026 08:00:00 GMT</pubDate><description>&lt;a href=&quot;https://news.example/oran-gemma&quot;&gt;Operators are testing Gemma agents&lt;/a&gt;&amp;nbsp;for O-RAN issue planning.</description></item>
      </channel></rss>`, { headers: { 'content-type': 'application/rss+xml' } });
    }
    if (String(url).includes('api.github.com/search/repositories')) {
      return Response.json({ items: [{ full_name: 'ran-lab/gemma-oran', html_url: 'https://github.com/ran-lab/gemma-oran', description: 'Gemma planning for open RAN labs', stargazers_count: 420, updated_at: '2026-04-14T09:00:00Z' }] });
    }
    if (String(url).includes('export.arxiv.org/api/query')) {
      return new Response(`<feed><entry><title>Gemma assisted RAN planning</title><id>https://arxiv.org/abs/2604.00001</id><summary>Open RAN planning with small language models.</summary><updated>2026-04-14T10:00:00Z</updated></entry></feed>`, { headers: { 'content-type': 'application/atom+xml' } });
    }
    if (String(url).includes('scholar.google.com/scholar')) {
      return new Response(`<html><body>
        <div class="gs_r gs_or gs_scl">
          <div class="gs_ri">
            <h3 class="gs_rt"><a href="https://scholar.example/gemma-ran">Gemma planning for Open RAN automation</a></h3>
            <div class="gs_a">A Researcher, B Author - Wireless AI Conference, 2026</div>
            <div class="gs_rs">Paper result from Google Scholar about Gemma planning in O-RAN operations.</div>
          </div>
        </div>
      </body></html>`, { headers: { 'content-type': 'text/html' } });
    }
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    const gemmaPayload = JSON.parse(init.body);
    const prompt = gemmaPayload.contents[0].parts[0].text;
    assert.ok(prompt.includes('searched_news_candidates'));
    assert.ok(prompt.includes('Gemma agents reshape open RAN operations'));
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Search-backed Gemma RAN Brief', summary: 'Drafted from selected search results.', markdown: '## Search-backed Gemma RAN Brief', bullets: [] }) }] } }]
    });
  };

  const searchResponse = await newsSearchPost({
    request: new Request('https://blog.example.test/api/news-search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Gemma open RAN', limit: 9, sources: ['google-news-rss', 'arxiv', 'google-scholar', 'huggingface-papers', 'x', 'linkedin', 'geeknews', 'endigest'] })
    }),
    env: mockEnv()
  });

  assert.equal(searchResponse.status, 200);
  const searchBody = await searchResponse.json();
  assert.equal(searchBody.ok, true);
  assert.equal(searchBody.query, 'Gemma open RAN');
  assert.ok(searchBody.candidates.length >= 2);
  assert.ok(searchBody.searched.includes('google-news-rss'));
  assert.ok(!searchBody.searched.includes('github-repositories'));
  assert.ok(searchBody.searched.includes('arxiv'));
  assert.ok(searchBody.searched.includes('google-scholar'));
  assert.ok(searchBody.searched.includes('huggingface-papers'));
  assert.ok(searchBody.searched.includes('x'));
  assert.ok(searchBody.searched.includes('linkedin'));
  assert.ok(searchBody.searched.includes('geeknews'));
  assert.ok(searchBody.searched.includes('endigest'));
  assert.ok(!requests.some((url) => url.includes('api.github.com/search/repositories')));
  assert.ok(requests.some((url) => url.includes('scholar.google.com/scholar')));
  assert.equal(searchBody.candidates[0].origin, 'live-search');
  assert.ok(!searchBody.candidates.some((candidate) => /<\/?a\b|&nbsp;/.test(candidate.summary)));
  assert.ok(searchBody.candidates.some((candidate) => candidate.source === 'huggingface.co' || candidate.source === 'geeknews'));
  assert.ok(searchBody.candidates.some((candidate) => candidate.source === 'Google Scholar' && candidate.type === 'paper'));
  assert.ok(searchBody.candidates.every((candidate) => candidate.thumbnail?.startsWith('/assets/news/thumb-')));

  const draftResponse = await focusedIssuePost({
    request: jsonRequest({ date: '2026-04-14', keywords: 'Gemma open RAN', candidates: searchBody.candidates.slice(0, 3), limit: 3 }),
    env: mockEnv()
  });
  const draftBody = await draftResponse.json();
  assert.equal(draftBody.ok, true);
  assert.equal(draftBody.sources[0].origin, 'live-search');
  assert.match(draftBody.issue.title, /Search-backed/);
  assert.ok(requests.some((url) => url.includes('news.google.com/rss/search')));
});

test('focused issue drafting treats selected search results as the authoritative source set', async () => {
  let promptPayload;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    const gemmaPayload = JSON.parse(init.body);
    promptPayload = JSON.parse(gemmaPayload.contents[0].parts[0].text);
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Selected Source Brief', summary: 'Only selected sources were used.', markdown: '## Selected Source Brief\n\nSelected source only.', bullets: [] }) }] } }]
    });
  };

  const selected = [
    {
      title: 'Photonics compiler release notes',
      url: 'https://selected.example/photonics-compiler',
      source: 'Selected Wire',
      summary: 'A selected search result about photonics compilers, not agent products.',
      origin: 'live-search',
      score: 0
    }
  ];

  const response = await focusedIssuePost({
    request: jsonRequest({ date: '2026-06-09', keywords: 'agent', candidates: selected, limit: 4 }),
    env: mockEnv()
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(promptPayload.ranked_news_items.map((item) => item.url), ['https://selected.example/photonics-compiler']);
  assert.deepEqual(body.sources.map((item) => item.url), ['https://selected.example/photonics-compiler']);
  assert.ok(!JSON.stringify(promptPayload.ranked_news_items).includes('agent workflows'));
  assert.ok(!JSON.stringify(promptPayload.blog_archive_context).includes('agent workflows'));
});

test('Gemma draft fallback and API response do not leak model thinking into markdown', async () => {
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    const gemmaPayload = JSON.parse(init.body);
    assert.equal(gemmaPayload.generationConfig.responseMimeType, 'application/json');
    return Response.json({
      candidates: [{ content: { parts: [{ text: '<think>I will ignore the selected source and write about agents.</think>\nDraft prose that is not JSON.' }] } }]
    });
  };

  const response = await focusedIssuePost({
    request: jsonRequest({
      date: '2026-06-09',
      keywords: 'photonics compiler',
      candidates: [{ title: 'Photonics compiler release notes', url: 'https://selected.example/photonics-compiler', source: 'Selected Wire', summary: 'Selected source summary.', origin: 'live-search' }],
      limit: 1
    }),
    env: mockEnv()
  });
  const body = await response.json();

  assert.equal(body.ok, true);
  assert.ok(!body.issue.markdown.includes('<think>'));
  assert.ok(!body.issue.markdown.toLowerCase().includes('ignore the selected source'));
});

test('selected source drafts reject Gemma no-match output when candidate cards exist', async () => {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: "No matching news found for 'deepseek ocr'",
        summary: 'No relevant information was found in the provided search results.',
        markdown: "No matching news found for 'deepseek ocr'\n\nNo relevant information was found in the provided search results.",
        bullets: []
      }) }] } }]
    });
  };

  const selected = [
    {
      title: 'DeepSeek OCR paper adds document parsing benchmark',
      url: 'https://selected.example/deepseek-ocr',
      source: 'Selected Wire',
      summary: 'Selected candidate card describes DeepSeek OCR for structured document extraction.',
      origin: 'live-search'
    },
    {
      title: 'DeepSeek OCR implementation notes',
      url: 'https://github.com/example/deepseek-ocr',
      source: 'GitHub',
      summary: 'Repository notes for running DeepSeek OCR examples.',
      origin: 'live-search'
    }
  ];

  const response = await focusedIssuePost({
    request: jsonRequest({ date: '2026-06-09', keywords: 'deepseek ocr', candidates: selected, limit: 2 }),
    env: mockEnv()
  });
  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.sources.length, 2);
  assert.ok(!/no matching news found/i.test(body.issue.title));
  assert.ok(!/no relevant information/i.test(body.issue.summary));
  assert.match(body.issue.markdown, /DeepSeek OCR paper adds document parsing benchmark/);
  assert.match(body.issue.markdown, /Selected candidate card describes DeepSeek OCR/);
  assert.equal(body.usedGemma, false);
  assert.match(body.warning, /Gemma returned a no-match draft/i);
});

test('Gemma API helper ignores thought parts returned by the model transport', async () => {
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({
      candidates: [{ content: { parts: [
        { text: 'private chain of thought about agents', thought: true },
        { text: '{"title":"Clean Draft","markdown":"## Clean Draft"}' }
      ] } }]
    });
  };

  const result = await callGemma(mockEnv(), { task: 'return json' });

  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
  assert.equal(result.text, '{"title":"Clean Draft","markdown":"## Clean Draft"}');
});
