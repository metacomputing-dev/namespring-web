export const REPORT_THEME_MODE = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const REPORT_THEME_PALETTE = {
  light: {
    surface: '#ffffff',
    surfaceSoft: '#f3f3f1',
    border: '#e8e5e0',
    text: '#1a1a1a',
    muted: '#6b7280',
    accentText: '#2d4b2a',
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
    warn: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    danger: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
  },
  dark: {
    surface: '#172215',
    surfaceSoft: '#1f2d1d',
    border: '#2d3b2b',
    text: '#f0f0f0',
    muted: '#a0a7a0',
    accentText: '#d7f4c6',
    success: { bg: '#153528', border: '#2f5e4a', text: '#86e2bf' },
    warn: { bg: '#3b321f', border: '#5e5133', text: '#f3ca7a' },
    info: { bg: '#172a40', border: '#2f4663', text: '#91beff' },
    danger: { bg: '#3a1f2a', border: '#5c3342', text: '#ff9cb8' },
  },
};

export const REPORT_PAGE_CLASS = {
  outer: 'min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]',
  container: 'bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden',
  headerTitle: 'text-3xl font-black text-[var(--ns-accent-text)]',
  homeButton: 'w-10 h-10 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-bold inline-flex items-center justify-center',
  loadingCard: 'h-40 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex flex-col items-center justify-center gap-3',
  loadingText: 'text-sm font-bold text-[var(--ns-muted)]',
  errorCard: 'rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-4',
  errorText: 'text-sm font-bold text-[var(--ns-muted)] text-center',
  primaryButton: 'w-full py-3 bg-[var(--ns-share-btn-bg)] text-[var(--ns-share-btn-text)] border border-[var(--ns-share-btn-border)] rounded-2xl font-black',
};

export function getElementToneClass(key) {
  const value = String(key || '').toUpperCase();
  if (value === 'WOOD') return 'border-[var(--ns-tone-wood-border)] bg-[var(--ns-tone-wood-bg)] text-[var(--ns-tone-wood-text)]';
  if (value === 'FIRE') return 'border-[var(--ns-tone-fire-border)] bg-[var(--ns-tone-fire-bg)] text-[var(--ns-tone-fire-text)]';
  if (value === 'EARTH') return 'border-[var(--ns-tone-earth-border)] bg-[var(--ns-tone-earth-bg)] text-[var(--ns-tone-earth-text)]';
  if (value === 'METAL') return 'border-[var(--ns-tone-metal-border)] bg-[var(--ns-tone-metal-bg)] text-[var(--ns-tone-metal-text)]';
  if (value === 'WATER') return 'border-[var(--ns-tone-water-border)] bg-[var(--ns-tone-water-bg)] text-[var(--ns-tone-water-text)]';
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

export function getMetaToneClass(tone) {
  if (tone === 'emerald' || tone === 'success') {
    return 'border-[var(--ns-tone-success-border)] bg-[var(--ns-tone-success-bg)] text-[var(--ns-tone-success-text)]';
  }
  if (tone === 'amber' || tone === 'warn') {
    return 'border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)] text-[var(--ns-tone-warn-text)]';
  }
  if (tone === 'blue' || tone === 'info') {
    return 'border-[var(--ns-tone-info-border)] bg-[var(--ns-tone-info-bg)] text-[var(--ns-tone-info-text)]';
  }
  if (tone === 'danger') {
    return 'border-[var(--ns-tone-danger-border)] bg-[var(--ns-tone-danger-bg)] text-[var(--ns-tone-danger-text)]';
  }
  if (tone === 'indigo') {
    return 'border-[var(--ns-tone-indigo-border)] bg-[var(--ns-tone-indigo-bg)] text-[var(--ns-tone-indigo-text)]';
  }
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

export function getPolarityToneClass(polarity) {
  if (polarity === '양') return getMetaToneClass('warn');
  if (polarity === '음') return getMetaToneClass('indigo');
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-text)]';
}
