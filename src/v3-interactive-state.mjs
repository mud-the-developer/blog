export function createV3State({ commandItems = [] } = {}) {
  return {
    commandOpen: false,
    commandQuery: '',
    commandActiveIndex: 0,
    commandItems,
  };
}

export function filterCommandItems(items, query) {
  const needle = String(query || '')
    .trim()
    .toLowerCase();
  if (!needle) return items.slice(0, 10);
  return items
    .filter((item) => {
      const hay = `${item.label || ''} ${item.section || ''} ${item.url || ''}`.toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, 10);
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
