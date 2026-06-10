export function createThemeState({ systemTheme = 'light', overrideTheme = null } = {}) {
  const normalizedSystem = systemTheme === 'dark' ? 'dark' : 'light';
  const normalizedOverride = overrideTheme === 'dark' || overrideTheme === 'light' ? overrideTheme : null;
  return {
    phase: 'idle',
    systemTheme: normalizedSystem,
    overrideTheme: normalizedOverride,
    activeTheme: normalizedOverride || normalizedSystem
  };
}

function renderThemeEffect(state) {
  const themeLabel = state.activeTheme === 'dark' ? 'Dark' : 'Light';
  return {
    type: 'render-theme',
    activeTheme: state.overrideTheme ? state.activeTheme : `system-${state.activeTheme}`,
    theme: state.activeTheme,
    override: Boolean(state.overrideTheme),
    accessibleLabel: `Toggle color theme: ${themeLabel}`
  };
}

export function themeReducer(state, event) {
  if (event.type === 'chrome.mounted') {
    const next = { ...state, phase: 'ready', activeTheme: state.overrideTheme || state.systemTheme };
    return { state: next, effects: [renderThemeEffect(next)] };
  }

  if (event.type === 'theme.toggle') {
    const activeTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
    const next = { ...state, phase: 'ready', overrideTheme: activeTheme, activeTheme };
    return { state: next, effects: [renderThemeEffect(next)] };
  }

  if (event.type === 'system-theme.changed') {
    const systemTheme = event.theme === 'dark' ? 'dark' : 'light';
    if (state.overrideTheme) {
      return { state: { ...state, systemTheme }, effects: [] };
    }
    const next = { ...state, systemTheme, activeTheme: systemTheme };
    return { state: next, effects: [renderThemeEffect(next)] };
  }

  return { state, effects: [] };
}
