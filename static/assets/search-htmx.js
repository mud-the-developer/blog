(() => {
  const input = document.getElementById('note-search-input');
  const results = document.getElementById('note-search-results');
  const shortcut = document.getElementById('note-search-shortcut');

  if (!(input instanceof HTMLInputElement && results instanceof HTMLElement)) return;

  const state = {
    rows: [],
    activeIndex: -1,
    fallbackMode: typeof window.htmx !== 'object',
    fallbackRecords: null,
    token: 0,
    debounceTimer: 0,
  };

  const isApplePlatform = /Mac|iPhone|iPad|iPod/i.test(
    [navigator.platform || '', navigator.userAgent || ''].join(' '),
  );

  if (shortcut) {
    shortcut.textContent = isApplePlatform ? 'CMD+K' : 'CTRL+K';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeUrl(value) {
    const path = String(value || '/').split(/[?#]/)[0] || '/';
    return path.endsWith('/') ? path : `${path}/`;
  }

  function clipExcerpt(value) {
    const normalized = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized.length <= 92 ? normalized : `${normalized.slice(0, 92).trimEnd()}...`;
  }

  function openResults() {
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function closeResults() {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    state.activeIndex = -1;
    state.rows = [];
  }

  function syncActiveRow() {
    state.rows.forEach((row, index) => {
      const isActive = index === state.activeIndex;
      row.classList.toggle('is-active', isActive);
      row.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (state.activeIndex < 0 || !state.rows[state.activeIndex]) {
      input.removeAttribute('aria-activedescendant');
      return;
    }

    const row = state.rows[state.activeIndex];
    input.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function refreshRows() {
    state.rows = Array.from(results.querySelectorAll('.search-result'));
    if (state.rows.length === 0) {
      state.activeIndex = -1;
    } else if (state.activeIndex >= state.rows.length) {
      state.activeIndex = state.rows.length - 1;
    }
    syncActiveRow();
  }

  function searchScore(record, tokens) {
    const title = String(record?.title || '').toLowerCase();
    const slug = String(record?.slug || '').toLowerCase();
    const excerpt = String(record?.excerpt || '').toLowerCase();
    const tags = Array.isArray(record?.tags)
      ? record.tags.map((tag) => String(tag).toLowerCase())
      : [];
    let score = 0;

    for (const token of tokens) {
      if (title.startsWith(token)) score += 32;
      if (title.includes(token)) score += 20;
      if (slug.includes(token)) score += 12;
      if (tags.some((tag) => tag.includes(token))) score += 10;
      if (excerpt.includes(token)) score += 5;
    }

    return score;
  }

  function renderResults(records, emptyLabel) {
    const safeRecords = records
      .map((record) => ({
        title: String(record?.title || record?.slug || 'Untitled'),
        url: normalizeUrl(record?.url || '/'),
        excerpt: clipExcerpt(record?.excerpt || ''),
        slug: String(record?.slug || ''),
        tags: Array.isArray(record?.tags) ? record.tags.slice(0, 3) : [],
      }))
      .filter((record) => record.url.length > 0);

    openResults();

    if (safeRecords.length === 0) {
      results.innerHTML = `<p class="search-empty">${escapeHtml(emptyLabel)}</p>`;
      refreshRows();
      return;
    }

    results.innerHTML = safeRecords
      .map((record, index) => {
        const meta = record.slug || record.url.replace(/^\/|\/$/g, '');
        const tags = record.tags.length
          ? `<span class="search-result-tags">${record.tags
              .map((tag) => `<span class="search-result-tag">#${escapeHtml(tag)}</span>`)
              .join('')}</span>`
          : '';

        return [
          `<a id="note-search-option-${index}" class="search-result" role="option" aria-selected="false" href="${escapeHtml(record.url)}">`,
          `<span class="search-result-title">${escapeHtml(record.title)}</span>`,
          `<span class="search-result-meta">${escapeHtml(meta)}</span>`,
          `<span class="search-result-excerpt">${escapeHtml(record.excerpt)}</span>`,
          tags,
          '</a>',
        ].join('');
      })
      .join('');

    refreshRows();
  }

  async function loadFallbackRecords() {
    if (Array.isArray(state.fallbackRecords)) return state.fallbackRecords;

    const response = await fetch('/search-index.json', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('failed to load local search index');
    }

    const payload = await response.json();
    state.fallbackRecords = Array.isArray(payload) ? payload : [];
    return state.fallbackRecords;
  }

  async function runFallbackSearch(showEmptyState) {
    const token = ++state.token;
    const query = input.value.trim();
    const isEmpty = query.length === 0;

    if (isEmpty && !showEmptyState) {
      results.innerHTML = '';
      closeResults();
      return;
    }

    try {
      const records = await loadFallbackRecords();
      if (token !== state.token) return;

      if (isEmpty) {
        renderResults(records.slice(0, 8), 'No notes available yet.');
        return;
      }

      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 6);

      const matches = records
        .map((record) => ({ record, score: searchScore(record, tokens) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8)
        .map((entry) => entry.record);

      renderResults(matches, 'No matching notes.');
    } catch (_error) {
      if (token !== state.token) return;
      openResults();
      results.innerHTML = '<p class="search-empty">Search is not available.</p>';
      refreshRows();
    }
  }

  function switchToFallbackMode() {
    if (state.fallbackMode) return;
    state.fallbackMode = true;
    input.removeAttribute('hx-get');
    input.removeAttribute('hx-trigger');
    input.removeAttribute('hx-target');
    input.removeAttribute('hx-swap');
    input.removeAttribute('hx-push-url');
    void runFallbackSearch(true);
  }

  input.addEventListener('focus', () => {
    if (state.fallbackMode) {
      void runFallbackSearch(true);
    }
  });

  input.addEventListener('input', () => {
    if (!state.fallbackMode) return;
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(() => {
      void runFallbackSearch(false);
    }, 110);
  });

  input.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.select();
      if (state.fallbackMode) {
        void runFallbackSearch(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (input.value.trim().length > 0) {
        input.value = '';
        if (state.fallbackMode) {
          void runFallbackSearch(false);
        } else {
          closeResults();
        }
      } else {
        closeResults();
        input.blur();
      }
      return;
    }

    if (state.rows.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.activeIndex = (state.activeIndex + 1) % state.rows.length;
        syncActiveRow();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.activeIndex = state.activeIndex <= 0 ? state.rows.length - 1 : state.activeIndex - 1;
        syncActiveRow();
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        state.activeIndex = 0;
        syncActiveRow();
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        state.activeIndex = state.rows.length - 1;
        syncActiveRow();
        return;
      }

      if (event.key === 'Enter') {
        const activeRow = state.activeIndex >= 0 ? state.rows[state.activeIndex] : state.rows[0];
        if (activeRow instanceof HTMLAnchorElement) {
          event.preventDefault();
          const href = activeRow.getAttribute('href') || '';
          if (href) {
            window.location.assign(href);
          }
        }
      }
      return;
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && state.fallbackMode) {
      event.preventDefault();
      void runFallbackSearch(true);
    }
  });

  results.addEventListener('mousemove', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest('.search-result');
    if (!(row instanceof Element)) return;
    const nextIndex = state.rows.indexOf(row);
    if (nextIndex >= 0 && nextIndex !== state.activeIndex) {
      state.activeIndex = nextIndex;
      syncActiveRow();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.site-search')) return;
    closeResults();
  });

  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    if (document.activeElement !== input) {
      input.focus();
      input.select();
    }
    if (state.fallbackMode) {
      void runFallbackSearch(true);
    } else if (results.hidden) {
      input.dispatchEvent(new Event('search', { bubbles: true }));
    }
  });

  if (typeof window.htmx === 'object') {
    document.addEventListener('htmx:beforeRequest', (event) => {
      if (event.detail?.elt !== input || state.fallbackMode) return;
      openResults();
    });

    document.addEventListener('htmx:afterSwap', (event) => {
      if (event.detail?.target !== results || state.fallbackMode) return;
      openResults();
      refreshRows();
    });

    document.addEventListener('htmx:afterRequest', (event) => {
      if (event.detail?.elt !== input || state.fallbackMode) return;
      if (!event.detail.successful) {
        switchToFallbackMode();
      }
    });

    document.addEventListener('htmx:responseError', (event) => {
      if (event.detail?.elt === input) switchToFallbackMode();
    });

    document.addEventListener('htmx:sendError', (event) => {
      if (event.detail?.elt === input) switchToFallbackMode();
    });
  }
})();
