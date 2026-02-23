import React from 'react';
import { HOME_CARD_COLOR_THEME, buildTileStyle } from './theme/card-color-theme';

export const REPORT_NESTED_ALPHA = '20';

export function getNestedToneBgClass(tone = 'surface') {
  if (tone === 'success') return `bg-[var(--ns-tone-success-bg)]/${REPORT_NESTED_ALPHA}`;
  if (tone === 'warn') return `bg-[var(--ns-tone-warn-bg)]/${REPORT_NESTED_ALPHA}`;
  if (tone === 'info') return `bg-[var(--ns-tone-info-bg)]/${REPORT_NESTED_ALPHA}`;
  if (tone === 'danger') return `bg-[var(--ns-tone-danger-bg)]/${REPORT_NESTED_ALPHA}`;
  if (tone === 'cyan') return `bg-[var(--ns-tone-cyan-bg)]/${REPORT_NESTED_ALPHA}`;
  if (tone === 'neutral') return `bg-[var(--ns-tone-neutral-bg)]/${REPORT_NESTED_ALPHA}`;
  if (tone === 'indigo') return `bg-[var(--ns-tone-indigo-bg)]/${REPORT_NESTED_ALPHA}`;
  return `bg-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA}`;
}

export function getNestedGradientClass(tone = 'surface') {
  if (tone === 'success') return `bg-gradient-to-r from-[var(--ns-tone-success-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  if (tone === 'warn') return `bg-gradient-to-r from-[var(--ns-tone-warn-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  if (tone === 'info') return `bg-gradient-to-r from-[var(--ns-tone-info-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  if (tone === 'danger') return `bg-gradient-to-r from-[var(--ns-tone-danger-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  if (tone === 'cyan') return `bg-gradient-to-r from-[var(--ns-tone-cyan-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  if (tone === 'neutral') return `bg-gradient-to-r from-[var(--ns-tone-neutral-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  if (tone === 'indigo') return `bg-gradient-to-r from-[var(--ns-tone-indigo-bg)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
  return `bg-gradient-to-r from-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} via-[var(--ns-surface-soft)]/${REPORT_NESTED_ALPHA} to-[var(--ns-report-grad-end)]`;
}

export function getNestedMiniCardClass(tone = 'surface') {
  if (tone === 'success') return `border-[var(--ns-tone-success-border)] ${getNestedToneBgClass('success')}`;
  if (tone === 'warn') return `border-[var(--ns-tone-warn-border)] ${getNestedToneBgClass('warn')}`;
  if (tone === 'info') return `border-[var(--ns-tone-info-border)] ${getNestedToneBgClass('info')}`;
  if (tone === 'danger') return `border-[var(--ns-tone-danger-border)] ${getNestedToneBgClass('danger')}`;
  if (tone === 'cyan') return `border-[var(--ns-tone-cyan-border)] ${getNestedToneBgClass('cyan')}`;
  if (tone === 'neutral') return `border-[var(--ns-tone-neutral-border)] ${getNestedToneBgClass('neutral')}`;
  if (tone === 'indigo') return `border-[var(--ns-tone-indigo-border)] ${getNestedToneBgClass('indigo')}`;
  return `border-[var(--ns-border)] ${getNestedToneBgClass('surface')}`;
}

export function createHomeTileTone(theme) {
  return {
    className: 'bg-gradient-to-br',
    style: buildTileStyle(theme),
  };
}

export const REPORT_HOME_CARD_TONE_MAP = {
  report: createHomeTileTone(HOME_CARD_COLOR_THEME.report),
  naming: createHomeTileTone(HOME_CARD_COLOR_THEME.naming),
  gratitude: createHomeTileTone(HOME_CARD_COLOR_THEME.gratitude),
  info: createHomeTileTone(HOME_CARD_COLOR_THEME.info),
  default: createHomeTileTone(HOME_CARD_COLOR_THEME.report),
};

export function CollapsibleCard({
  title,
  subtitle = '',
  open = false,
  onToggle,
  children,
  className = '',
  bodyClassName = '',
  titleClassName = '',
  style,
  tone = '',
  toneMap = null,
}) {
  const effectiveToneMap = toneMap || REPORT_HOME_CARD_TONE_MAP;
  const resolvedTone = tone
    ? effectiveToneMap[tone] || null
    : effectiveToneMap.default || null;
  const resolvedClassName = resolvedTone?.className || '';
  const resolvedStyle = style || resolvedTone?.style;

  return (
    <section
      className={`rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface)]/80 shadow-lg overflow-hidden ${resolvedClassName} ${className}`}
      style={resolvedStyle}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <h3 className={`text-lg font-black text-[var(--ns-accent-text)] ${titleClassName}`}>{title}</h3>
          {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className={`px-3 pb-3 ${bodyClassName}`}>{children}</div> : null}
    </section>
  );
}

export function CollapsibleMiniCard({
  title,
  subtitle = '',
  open = false,
  onToggle,
  children,
  className = '',
  hideToggle = false,
}) {
  if (hideToggle) {
    return (
      <article className={`rounded-xl border ${getNestedMiniCardClass('surface')} shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${className}`}>
        {(title || subtitle) ? (
          <div className="px-3 pt-2.5">
            {title ? <p className="text-sm font-black text-[var(--ns-accent-text)]">{title}</p> : null}
            {subtitle ? <p className="text-xs text-[var(--ns-muted)] mt-0.5 break-keep whitespace-normal">{subtitle}</p> : null}
          </div>
        ) : null}
        <div className="px-3 pb-3 pt-2">{children}</div>
      </article>
    );
  }

  return (
    <article className={`rounded-xl border ${getNestedMiniCardClass('surface')} shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--ns-accent-text)]">{title}</p>
          {subtitle ? <p className="text-xs text-[var(--ns-muted)] mt-0.5 break-keep whitespace-normal">{subtitle}</p> : null}
        </div>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </article>
  );
}

export function StarRating({ score }) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  const full = Math.floor(safeScore);
  const hasHalf = safeScore - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="inline-flex items-center gap-1" aria-label={`별점 ${safeScore.toFixed(1)} / 5`}>
      {Array.from({ length: full }).map((_, index) => (
        <span key={`star-full-${index}`} className="text-[var(--ns-tone-warn-text)]">★</span>
      ))}
      {hasHalf ? <span className="text-[var(--ns-tone-warn-text)]">☆</span> : null}
      {Array.from({ length: empty }).map((_, index) => (
        <span key={`star-empty-${index}`} className="text-[var(--ns-muted)]/50">☆</span>
      ))}
      <span className="ml-1 text-xs font-black text-[var(--ns-muted)]">{safeScore.toFixed(1)} / 5.0</span>
    </div>
  );
}

export function TimeSeriesChart({
  points = [],
  valueFormatter = (value) => String(value),
  stroke = 'var(--ns-tone-info-text)',
  showPointLabels = true,
  invertMinToTop = false,
  smooth = false,
}) {
  const width = 520;
  const height = 172;
  const pad = 14;
  const normalized = Array.isArray(points) && points.length
    ? points.map((point, idx) => {
        if (typeof point === 'number') {
          return { label: String(idx + 1), value: Number(point) || 0 };
        }
        return {
          label: String(point?.label ?? idx + 1),
          value: Number(point?.value) || 0,
        };
      })
    : [
        { label: '1', value: 50 },
        { label: '2', value: 50 },
        { label: '3', value: 50 },
        { label: '4', value: 50 },
      ];
  const values = normalized.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = normalized.map((item, index) => {
    const x = pad + (index / Math.max(1, normalized.length - 1)) * (width - pad * 2);
    const value = item.value;
    const ratio = invertMinToTop ? (max - value) / range : (value - min) / range;
    const y = height - 34 - ratio * (height - pad * 2 - 26);
    return { x, y, value, label: item.label };
  });
  const polyline = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  const buildSmoothPath = (pointsForPath) => {
    if (!pointsForPath.length) return '';
    if (pointsForPath.length < 3) {
      return `M ${pointsForPath.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`;
    }

    const n = pointsForPath.length;
    const slopes = [];
    for (let i = 0; i < n - 1; i += 1) {
      const dx = pointsForPath[i + 1].x - pointsForPath[i].x || 1;
      slopes.push((pointsForPath[i + 1].y - pointsForPath[i].y) / dx);
    }

    const tangents = new Array(n).fill(0);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }

    for (let i = 0; i < n - 1; i += 1) {
      if (slopes[i] === 0) {
        tangents[i] = 0;
        tangents[i + 1] = 0;
      } else {
        const a = tangents[i] / slopes[i];
        const b = tangents[i + 1] / slopes[i];
        const s = a * a + b * b;
        if (s > 9) {
          const t = 3 / Math.sqrt(s);
          tangents[i] = t * a * slopes[i];
          tangents[i + 1] = t * b * slopes[i];
        }
      }
    }

    let d = `M ${pointsForPath[0].x.toFixed(1)} ${pointsForPath[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i += 1) {
      const p1 = pointsForPath[i];
      const p2 = pointsForPath[i + 1];
      const h = p2.x - p1.x;
      const cp1x = p1.x + h / 3;
      const cp1y = p1.y + (tangents[i] * h) / 3;
      const cp2x = p2.x - h / 3;
      const cp2y = p2.y - (tangents[i + 1] * h) / 3;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const smoothPath = buildSmoothPath(coords);

  return (
    <div className={`rounded-xl border border-[var(--ns-border)] ${getNestedToneBgClass('surface')} p-2.5`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
        {smooth ? (
          <path d={smoothPath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <polyline fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        )}
        {coords.map((point, idx) => (
          <g key={`ts-point-${idx}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill={stroke} />
            {showPointLabels ? (
              <text x={point.x} y={point.y - 8} textAnchor="middle" fontSize="10" fill="var(--ns-muted)" style={{ fontWeight: 700 }}>
                {valueFormatter(point.value)}
              </text>
            ) : null}
            <text
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ns-muted)"
              style={{ fontWeight: 700 }}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
