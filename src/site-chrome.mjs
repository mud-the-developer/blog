import { applyThemeEffect } from './site-chrome-effects.mjs';
import { createThemeState, themeReducer } from './site-chrome-state.mjs';

const iconPaths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/>',
  'list-tree': '<path d="M4 5h5"/><path d="M4 12h5"/><path d="M4 19h5"/><path d="M12 5h8"/><path d="M12 12h8"/><path d="M12 19h8"/>',
  newspaper: '<path d="M4 5h13a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M7 8h7"/><path d="M7 12h10"/><path d="M7 16h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2"/><path d="M12 19.5v2"/><path d="m4.6 4.6 1.4 1.4"/><path d="m18 18 1.4 1.4"/><path d="M2.5 12h2"/><path d="M19.5 12h2"/><path d="m4.6 19.4 1.4-1.4"/><path d="m18 6 1.4-1.4"/>',
  moon: '<path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  'folder-root': '<path d="M3 7.5h6l2 2h10v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5"/>',
  folder: '<path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"/>',
  'file-text': '<path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20Z"/><path d="M14 3.5V8h4"/><path d="M9 12h6"/><path d="M9 15h6"/><path d="M9 18h4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/>',
  sparkles: '<path d="m12 3 1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9Z"/><path d="m5 16 .8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8Z"/>',
  rss: '<path d="M5 5a14 14 0 0 1 14 14"/><path d="M5 11a8 8 0 0 1 8 8"/><circle cx="6" cy="18" r="1.5"/>',
  github: '<path d="M9 19c-4 1.2-4-2-5.5-2.5"/><path d="M15 21v-3.5c0-1 .2-1.7-.5-2.4 2.8-.3 5.8-1.4 5.8-6.1A4.8 4.8 0 0 0 19 5.6c.1-.3.6-1.7-.2-3.4 0 0-1.1-.3-3.5 1.3a12 12 0 0 0-6.3 0C6.6 1.9 5.5 2.2 5.5 2.2c-.8 1.7-.3 3.1-.2 3.4A4.8 4.8 0 0 0 4 9c0 4.7 3 5.8 5.8 6.1-.4.4-.7 1-.8 1.8V21"/>',
  'book-open': '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22Z"/><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20"/><path d="M12 3v17"/>',
  radio: '<path d="M4 11a8 8 0 0 1 16 0"/><path d="M7 14a5 5 0 0 1 10 0"/><path d="M10 17a2 2 0 0 1 4 0"/><path d="M12 19v2"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 10-13h-7Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  'calendar-plus': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M10 16h4"/><path d="M12 14v4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
};

function hydrateIcons() {
  document.querySelectorAll('.ui-icon[data-icon]').forEach((slot) => {
    if (slot.querySelector('svg')) return;
    const name = slot.getAttribute('data-icon') || '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = iconPaths[name] || iconPaths.sparkles;
    slot.append(svg);
  });
}

function setupThemeToggle() {
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const systemTheme = () => (media.matches ? 'dark' : 'light');
  let state = createThemeState({ systemTheme: systemTheme() });

  const dispatch = (event) => {
    const step = themeReducer(state, event);
    state = step.state;
    for (const effect of step.effects) {
      applyThemeEffect(effect, { root, button });
    }
  };

  button.addEventListener('click', () => dispatch({ type: 'theme.toggle' }));
  media.addEventListener?.('change', () => dispatch({ type: 'system-theme.changed', theme: systemTheme() }));
  dispatch({ type: 'chrome.mounted' });
}

hydrateIcons();
setupThemeToggle();
document.body.dataset.siteChromeReady = 'true';
