export function createV3State({ commandItems = [] } = {}) {
  return {
    commandOpen: false,
    commandQuery: '',
    commandActiveIndex: 0,
    commandItems,
  };
}

export function findShortcutItem(items, key) {
  const needle = String(key || '')
    .trim()
    .toLowerCase();
  if (needle.length !== 1) return null;
  return (
    items.find(
      (item) =>
        String(item?.shortcut || '')
          .trim()
          .toLowerCase() === needle,
    ) || null
  );
}

export function filterCommandItems(items, query) {
  const needle = String(query || '')
    .trim()
    .toLowerCase();
  if (!needle) return items.slice(0, 10);
  const exact = [];
  const rest = [];
  for (const item of items) {
    const shortcut = String(item.shortcut || '')
      .trim()
      .toLowerCase();
    if (shortcut && shortcut === needle) {
      exact.push(item);
      continue;
    }
    const hay = `${item.label || ''} ${item.section || ''} ${item.url || ''}`.toLowerCase();
    if (hay.includes(needle)) rest.push(item);
  }
  return exact.concat(rest).slice(0, 10);
}
export function v3Reducer(state, event) {
  switch (event.type) {
    case 'cmd.open': {
      return {
        state: {
          ...state,
          commandOpen: true,
          commandQuery: '',
          commandActiveIndex: 0,
        },
        effects: [{ type: 'render-command', focusInput: true }],
      };
    }
    case 'cmd.close': {
      if (!state.commandOpen) return { state, effects: [] };
      return {
        state: { ...state, commandOpen: false },
        effects: [{ type: 'render-command', focusInput: false }],
      };
    }
    case 'cmd.query': {
      return {
        state: {
          ...state,
          commandQuery: String(event.query || ''),
          commandActiveIndex: 0,
        },
        effects: [{ type: 'render-command', focusInput: false }],
      };
    }
    case 'cmd.move': {
      const matches = filterCommandItems(state.commandItems, state.commandQuery);
      if (matches.length === 0) return { state, effects: [] };
      const delta = Number(event.delta) || 0;
      const nextIndex = (state.commandActiveIndex + delta + matches.length) % matches.length;
      return {
        state: { ...state, commandActiveIndex: nextIndex },
        effects: [{ type: 'render-command', focusInput: false }],
      };
    }
    default:
      return { state, effects: [] };
  }
}
