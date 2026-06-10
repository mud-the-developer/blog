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
  const labelText = effect.theme === 'dark' ? 'Dark' : 'Light';
  if (label) label.textContent = labelText;
  button.setAttribute('aria-label', effect.accessibleLabel || `Toggle color theme: ${labelText}`);
}
