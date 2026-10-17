export function createNewsDeskState({ date = new Date().toISOString().slice(0, 10) } = {}) {
  return {
    phase: 'idle',
    requestId: 0,
    date,
    query: '',
    queryMode: 'exact',
    searchQuery: '',
    searchKeywords: [],
    sources: [],
    candidates: [],
    selectedCandidateIndexes: [],
    currentDraft: null,
    draftEnabled: false,
    downloadEnabled: false,
    status: { message: '', kind: '' },
  };
}

function statusEffect(message, kind = '') {
  return { type: 'render-status', message, kind };
}

function selectedCandidates(state) {
  return state.selectedCandidateIndexes
    .map((index) => state.candidates[index])
    .filter(Boolean)
    .slice(0, 8);
}

function defaultSelectedIndexes(candidates) {
  return candidates.map((_candidate, index) => index).slice(0, 5);
}

export function newsDeskReducer(state, event) {
  if (['search.succeeded', 'draft.succeeded', 'request.failed'].includes(event.type) && event.requestId !== state.requestId)
    return { state, effects: [] };
  if (event.type === 'lab.mounted') {
    return {
      state: { ...state, phase: 'idle', downloadEnabled: false, draftEnabled: false },
      effects: [
        { type: 'set-download-enabled', enabled: false },
        { type: 'set-draft-enabled', enabled: false },
      ],
    };
  }

  if (event.type === 'search.submitted') {
    const query = String(event.query || '').trim();
    if (!query) {
      const next = { ...state, status: { message: 'Enter a search query first.', kind: 'error' } };
      return { state: next, effects: [statusEffect(next.status.message, next.status.kind)] };
    }
    const sources = Array.isArray(event.sources) ? event.sources.filter(Boolean) : [];
    if (!sources.length) {
      const next = { ...state, query, status: { message: 'Select at least one news source.', kind: 'error' } };
      return { state: next, effects: [statusEffect(next.status.message, next.status.kind)] };
    }
    const date = String(event.date || state.date);
    const queryMode = String(event.queryMode || 'exact') === 'gemma-expand' ? 'gemma-expand' : 'exact';
    const next = {
      ...state,
      phase: 'searching',
      requestId: state.requestId + 1,
      date,
      query,
      queryMode,
      searchQuery: query,
      searchKeywords: [query],
      sources,
      candidates: [],
      selectedCandidateIndexes: [],
      currentDraft: null,
      draftEnabled: false,
      downloadEnabled: false,
      status: {
        message:
          queryMode === 'gemma-expand'
            ? `Expanding keywords with Gemma 4, then searching ${sources.length} source${sources.length === 1 ? '' : 's'}…`
            : `Searching ${sources.length} selected source${sources.length === 1 ? '' : 's'}…`,
        kind: 'loading',
      },
    };
    return {
      state: next,
      effects: [
        statusEffect(next.status.message, next.status.kind),
        { type: 'clear-output' },
        { type: 'set-download-enabled', enabled: false },
        { type: 'set-draft-enabled', enabled: false },
        { type: 'render-candidates', candidates: [] },
        {
          type: 'post-json',
          requestId: next.requestId,
          path: '/api/news-search',
          body: { query, queryMode, date, sources, limit: 12 },
          onSuccess: 'search.succeeded',
          onError: 'request.failed',
        },
      ].slice(0),
    };
  }

  if (event.type === 'search.succeeded') {
    const candidates = Array.isArray(event.data?.candidates) ? event.data.candidates : [];
    const selectedCandidateIndexes = defaultSelectedIndexes(candidates);
    const searched = Array.isArray(event.data?.searched) ? event.data.searched.join(', ') : 'sources';
    const searchKeywords = Array.isArray(event.data?.keywords) && event.data.keywords.length ? event.data.keywords : [state.query];
    const searchQuery = String(event.data?.searchQuery || state.query);
    const warning = event.data?.warning;
    const draftEnabled = selectedCandidateIndexes.length > 0;
    const next = {
      ...state,
      phase: 'candidates-ready',
      candidates,
      selectedCandidateIndexes,
      searchKeywords,
      searchQuery,
      draftEnabled,
      downloadEnabled: false,
      status: {
        message:
          warning ||
          `Found ${candidates.length} candidates from ${searched}${searchKeywords.length > 1 ? ` using ${searchKeywords.length} keywords` : ''}. Select sources, then draft.`,
        kind: warning ? 'warning' : 'ready',
      },
    };
    return {
      state: next,
      effects: [
        { type: 'render-candidates', candidates },
        { type: 'set-draft-enabled', enabled: draftEnabled },
        statusEffect(next.status.message, next.status.kind),
      ].slice(0),
    };
  }

  if (event.type === 'candidate.selection.changed') {
    const selectedCandidateIndexes = Array.isArray(event.selectedIndexes)
      ? event.selectedIndexes
          .map(Number)
          .filter((index) => Number.isInteger(index) && index >= 0 && index < state.candidates.length)
          .slice(0, 8)
      : [];
    const changed = selectedCandidateIndexes.join(',') !== state.selectedCandidateIndexes.join(',');
    const invalidate = changed && (state.phase === 'drafting' || Boolean(state.currentDraft));
    const draftEnabled = selectedCandidateIndexes.length > 0 && (invalidate || state.phase !== 'drafting');
    return {
      state: {
        ...state,
        selectedCandidateIndexes,
        draftEnabled,
        ...(invalidate ? { phase: 'candidates-ready', requestId: state.requestId + 1, currentDraft: null, downloadEnabled: false } : {}),
      },
      effects: [
        ...(invalidate
          ? [
              { type: 'cancel-request' },
              { type: 'clear-output' },
              { type: 'set-download-enabled', enabled: false },
              statusEffect('Selection changed. Draft the selected sources again.', 'ready'),
            ]
          : []),
        { type: 'set-draft-enabled', enabled: draftEnabled },
      ],
    };
  }

  if (event.type === 'draft.requested') {
    if (state.phase === 'drafting' || state.phase === 'searching') return { state, effects: [] };
    const candidates = selectedCandidates(state);
    if (!candidates.length) {
      const next = { ...state, status: { message: 'Select at least one news candidate.', kind: 'error' } };
      return { state: next, effects: [statusEffect(next.status.message, next.status.kind)] };
    }
    const next = {
      ...state,
      phase: 'drafting',
      requestId: state.requestId + 1,
      currentDraft: null,
      draftEnabled: false,
      downloadEnabled: false,
      status: { message: 'Drafting selected sources with Gemma 4…', kind: 'loading' },
    };
    return {
      state: next,
      effects: [
        statusEffect(next.status.message, next.status.kind),
        { type: 'clear-output' },
        { type: 'set-download-enabled', enabled: false },
        { type: 'set-draft-enabled', enabled: false },
        {
          type: 'post-json',
          requestId: next.requestId,
          path: '/api/focused-issue',
          body: {
            date: state.date,
            keywords: state.searchKeywords.length ? state.searchKeywords : state.query,
            candidates,
            limit: candidates.length,
          },
          onSuccess: 'draft.succeeded',
          onError: 'request.failed',
        },
      ].slice(0),
    };
  }

  if (event.type === 'draft.succeeded') {
    const warning = event.data?.warning;
    const next = {
      ...state,
      phase: 'draft-ready',
      currentDraft: event.data,
      draftEnabled: state.selectedCandidateIndexes.length > 0,
      downloadEnabled: true,
      status: {
        message: warning || 'Draft ready from selected search results. Review before publishing.',
        kind: warning ? 'warning' : 'ready',
      },
    };
    return {
      state: next,
      effects: [
        { type: 'render-draft', data: event.data },
        { type: 'set-download-enabled', enabled: true },
        { type: 'set-draft-enabled', enabled: next.draftEnabled },
        statusEffect(next.status.message, next.status.kind),
      ],
    };
  }

  if (event.type === 'request.failed') {
    const next = {
      ...state,
      phase: 'error',
      draftEnabled: state.selectedCandidateIndexes.length > 0,
      status: { message: event.error || 'Request failed.', kind: 'error' },
    };
    return {
      state: next,
      effects: [statusEffect(next.status.message, next.status.kind), { type: 'set-draft-enabled', enabled: next.draftEnabled }],
    };
  }

  return { state, effects: [] };
}

export async function runNewsDeskEffect(effect, io) {
  if (effect.type !== 'post-json') return null;
  try {
    const data = await io.postJson(effect.path, effect.body);
    return { type: effect.onSuccess, requestId: effect.requestId, data };
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    return { type: effect.onError, requestId: effect.requestId, error: error?.message || String(error) };
  }
}
