// NS-G: manual light/dark theme control layered over the system preference.
// An inline boot script in index.html sets the initial data-theme to avoid a
// flash of the wrong theme; this module keeps it in sync after hydration and
// exposes a toggle for the masthead control.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'namespring_theme_mode';
const DARK = 'dark';
const LIGHT = 'light';

const listeners = new Set();

function systemPrefersDark() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

// Returns the explicit user choice, or null when following the system theme.
export function getStoredMode() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === LIGHT || raw === DARK ? raw : null;
  } catch {
    return null;
  }
}

export function getEffectiveTheme() {
  return getStoredMode() || (systemPrefersDark() ? DARK : LIGHT);
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

function notify(theme) {
  listeners.forEach((fn) => fn(theme));
}

export function setThemeMode(mode) {
  try {
    if (mode === LIGHT || mode === DARK) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, etc.) — the in-memory apply still runs.
  }
  const effective = getEffectiveTheme();
  applyTheme(effective);
  notify(effective);
}

export function toggleTheme() {
  setThemeMode(getEffectiveTheme() === DARK ? LIGHT : DARK);
}

export function subscribeTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Re-asserts the attribute after boot and tracks system changes while the user
// has not made an explicit choice.
export function initTheme() {
  if (typeof window === 'undefined') return;
  applyTheme(getEffectiveTheme());
  if (typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (getStoredMode()) return; // an explicit choice overrides the system theme
    const effective = getEffectiveTheme();
    applyTheme(effective);
    notify(effective);
  };
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onSystemChange);
  } else if (typeof query.addListener === 'function') {
    query.addListener(onSystemChange);
  }
}

export function useThemeMode() {
  const [theme, setTheme] = useState(getEffectiveTheme);
  useEffect(() => {
    setTheme(getEffectiveTheme());
    return subscribeTheme(setTheme);
  }, []);
  return { theme, toggle: toggleTheme };
}
