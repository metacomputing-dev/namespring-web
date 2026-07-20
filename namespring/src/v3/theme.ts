import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'namespring_theme_mode';

function readStoredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark());

  useEffect(() => {
    applyMode(mode);
    try {
      if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable */
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode(prev => {
      const dark = prev === 'dark' || (prev === 'system' && systemPrefersDark());
      return dark ? 'light' : 'dark';
    });
  }, []);

  return { mode, isDark, toggle, setMode };
}
