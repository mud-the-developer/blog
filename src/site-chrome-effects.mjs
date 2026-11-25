export const THEME_STORAGE_KEY = 'mud-blog-theme';

export function readStoredTheme(storage) {
  try {
    const value = storage?.getItem?.(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function applyThemeEffect(effect, { root, button, storage } = {}) {
  if (effect.type !== 'render-theme') return;
  if (effect.override) {
    root.dataset.theme = effect.theme;
    try {
      storage?.setItem?.(THEME_STORAGE_KEY, effect.theme);
    } catch {
      // Ignore storage quota / privacy-mode errors.
    }
  } else {
    root.removeAttribute('data-theme');
  }
  button.dataset.activeTheme = effect.activeTheme;
  button.setAttribute('aria-pressed', effect.override ? 'true' : 'false');
  const label = button.querySelector('.theme-toggle-label');
  const labelText = effect.theme === 'dark' ? 'Dark' : 'Light';
  if (label) label.textContent = labelText;
  button.setAttribute('aria-label', effect.accessibleLabel || `Toggle color theme: ${labelText}`);
}
