export const REPORT_THEME_MODE = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const REPORT_THEME_PALETTE = {
  light: {
    surface: 'var(--color-paper)',
    surfaceSoft: 'var(--color-paper-3)',
    border: 'var(--color-rule)',
    text: 'var(--color-ink)',
    muted: 'var(--color-ink-3)',
    accentText: 'var(--color-accent)',
    success: { bg: 'var(--color-success-bg)', border: 'var(--color-success-line)', text: 'var(--color-success)' },
    warn: { bg: 'var(--color-warn-bg)', border: 'var(--color-warn-line)', text: 'var(--color-warn)' },
    info: { bg: 'var(--color-info-bg)', border: 'var(--color-info-line)', text: 'var(--color-info)' },
    danger: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger-line)', text: 'var(--color-danger)' },
  },
  dark: {
    surface: 'var(--color-paper)',
    surfaceSoft: 'var(--color-paper-3)',
    border: 'var(--color-rule)',
    text: 'var(--color-ink)',
    muted: 'var(--color-ink-3)',
    accentText: 'var(--color-accent)',
    success: { bg: 'var(--color-success-bg)', border: 'var(--color-success-line)', text: 'var(--color-success)' },
    warn: { bg: 'var(--color-warn-bg)', border: 'var(--color-warn-line)', text: 'var(--color-warn)' },
    info: { bg: 'var(--color-info-bg)', border: 'var(--color-info-line)', text: 'var(--color-info)' },
    danger: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger-line)', text: 'var(--color-danger)' },
  },
};

export const REPORT_PAGE_CLASS = {
  outer: 'ns-page-main ns-page-main--wide',
  container: 'grid gap-4',
  headerTitle: 'ns-title ns-title--small',
  homeButton: 'ns-icon-button',
  loadingCard: 'ns-card ns-card--large flex flex-col items-center justify-center gap-3 min-h-40',
  loadingText: 'text-sm font-bold text-[var(--color-ink-2)]',
  errorCard: 'ns-card ns-card--padded ns-tone-neutral',
  errorText: 'text-sm font-bold text-current text-center',
  primaryButton: 'ns-primary-button w-full',
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
