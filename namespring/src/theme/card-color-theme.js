const WHITE = '#FFFFFF';

export const HOME_CARD_COLOR_THEME = {
  report: {
    base: '#EEF8F1',
    border: '#DCE8DF',
  },
  naming: {
    base: '#F8F2F8',
    border: '#E7DDE7',
  },
  gratitude: {
    base: '#FBF7EC',
    border: '#ECE4D2',
  },
  info: {
    base: '#F1F4F8',
    border: '#DFE6EE',
  },
  surface: WHITE,
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

export function buildSoftCardGradient(baseHex, options = {}) {
  const direction = options.direction || '90deg';
  const startAlpha = Number.isFinite(Number(options.startAlpha)) ? Number(options.startAlpha) : 0.78;
  const middleAlpha = Number.isFinite(Number(options.middleAlpha)) ? Number(options.middleAlpha) : 0.42;
  const endColor = options.endColor || WHITE;
  return `linear-gradient(${direction}, ${toRgba(baseHex, startAlpha)} 0%, ${toRgba(baseHex, middleAlpha)} 56%, ${endColor} 100%)`;
}

export function buildTileStyle(theme) {
  if (!theme) return undefined;
  return {
    borderColor: theme.border,
    backgroundImage: buildSoftCardGradient(theme.base, { direction: '135deg', startAlpha: 0.88, middleAlpha: 0.5 }),
  };
}

export function buildReportCardStyle(theme) {
  if (!theme) return undefined;
  return {
    borderColor: theme.border,
    backgroundImage: buildSoftCardGradient(theme.base),
  };
}

export function buildTintedBoxStyle(theme, options = {}) {
  if (!theme) return undefined;
  const bgAlpha = Number.isFinite(Number(options.bgAlpha)) ? Number(options.bgAlpha) : 0.26;
  return {
    borderColor: options.borderColor || theme.border,
    backgroundColor: toRgba(theme.base, bgAlpha),
  };
}
