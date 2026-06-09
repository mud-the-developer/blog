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
  return {
    type: 'render-theme',
    activeTheme: state.overrideTheme ? state.activeTheme : `system-${state.activeTheme}`,
    theme: state.activeTheme,
    override: Boolean(state.overrideTheme)
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

export function applyThemeEffect(effect, { root, button }) {
  if (effect.type !== 'render-theme') return;
  if (effect.override) {
    root.dataset.theme = effect.theme;
  } else {
    root.removeAttribute('data-theme');
  }
  button.dataset.activeTheme = effect.activeTheme;
  button.setAttribute('aria-pressed', effect.override ? 'true' : 'false');
  const label = button.querySelector('.theme-toggle-label');
  if (label) label.textContent = effect.theme === 'dark' ? 'Dark' : 'Light';
}
