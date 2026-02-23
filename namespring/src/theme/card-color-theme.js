const WHITE = '#FFFFFF';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

export const HOME_CARD_COLOR_THEME = {
  report: {
    base: '#EEF8F1',
    border: '#DCE8DF',
    darkBase: '#24463A',
    darkBorder: '#3B6858',
  },
  naming: {
    base: '#F8F2F8',
    border: '#E7DDE7',
    darkBase: '#2D3854',
    darkBorder: '#46597E',
  },
  gratitude: {
    base: '#FBF7EC',
    border: '#ECE4D2',
    darkBase: '#4A412B',
    darkBorder: '#6B5E3F',
  },
  info: {
    base: '#F1F4F8',
    border: '#DFE6EE',
    darkBase: '#244757',
    darkBorder: '#376981',
  },
  surface: WHITE,
};

export const HOME_CARD_COLOR_THEME_DARK = {
  report: {
    base: '#29513F',
    border: '#3A6E57',
    endColor: '#0B1110',
  },
  naming: {
    base: '#2E3856',
    border: '#43527D',
    endColor: '#0B1110',
  },
  gratitude: {
    base: '#4A3E27',
    border: '#6B5A39',
    endColor: '#0B1110',
  },
  info: {
    base: '#24465A',
    border: '#36657F',
    endColor: '#0B1110',
  },
  surface: '#172215',
};

export const REPORT_CARD_COLOR_THEME = {
  summary: HOME_CARD_COLOR_THEME.report,
  popularity: HOME_CARD_COLOR_THEME.info,
  lifeFlow: HOME_CARD_COLOR_THEME.gratitude,
  fourFrame: HOME_CARD_COLOR_THEME.report,
  hanja: HOME_CARD_COLOR_THEME.naming,
  hangul: HOME_CARD_COLOR_THEME.info,
};

export const NAMING_CANDIDATES_CARD_THEME = {
  compare: HOME_CARD_COLOR_THEME.naming,
  summary: HOME_CARD_COLOR_THEME.info,
  loading: HOME_CARD_COLOR_THEME.report,
  error: HOME_CARD_COLOR_THEME.gratitude,
  candidates: [
    HOME_CARD_COLOR_THEME.naming,
    HOME_CARD_COLOR_THEME.report,
    HOME_CARD_COLOR_THEME.gratitude,
    HOME_CARD_COLOR_THEME.info,
  ],
};

function hexToRgb(hex) {
  const normalized = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isDarkModeActive() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function buildSoftCardGradient(baseHex, options = {}) {
  const direction = options.direction || '90deg';
  const startAlpha = Number.isFinite(Number(options.startAlpha)) ? Number(options.startAlpha) : 0.78;
  const middleAlpha = Number.isFinite(Number(options.middleAlpha)) ? Number(options.middleAlpha) : 0.42;
  const endColor = options.endColor || TRANSPARENT;
  return `linear-gradient(${direction}, ${toRgba(baseHex, startAlpha)} 0%, ${toRgba(baseHex, middleAlpha)} 56%, ${endColor} 100%)`;
}

export function buildTileStyle(theme) {
  if (!theme) return undefined;
  const isDark = isDarkModeActive();
  const base = isDark ? (theme.darkBase || theme.base) : theme.base;
  const border = isDark ? (theme.darkBorder || theme.border) : theme.border;
  return {
    borderColor: border,
    backgroundImage: buildSoftCardGradient(base, {
      direction: '135deg',
      startAlpha: isDark ? 0.78 : 0.9,
      middleAlpha: isDark ? 0.32 : 0.46,
      endColor: TRANSPARENT,
    }),
  };
}

export function buildReportCardStyle(theme) {
  if (!theme) return undefined;
  const isDark = isDarkModeActive();
  const base = isDark ? (theme.darkBase || theme.base) : theme.base;
  const border = isDark ? (theme.darkBorder || theme.border) : theme.border;
  return {
    borderColor: border,
    backgroundImage: buildSoftCardGradient(base, {
      startAlpha: isDark ? 0.24 : 0.78,
      middleAlpha: isDark ? 0.1 : 0.42,
      endColor: TRANSPARENT,
    }),
  };
}

export function buildTintedBoxStyle(theme, options = {}) {
  if (!theme) return undefined;
  const isDark = isDarkModeActive();
  const bgAlpha = Number.isFinite(Number(options.bgAlpha)) ? Number(options.bgAlpha) : 0.26;
  const effectiveAlpha = isDark ? bgAlpha * 0.45 : bgAlpha;
  return {
    borderColor: options.borderColor || theme.border,
    backgroundColor: toRgba(theme.base, effectiveAlpha),
  };
}
