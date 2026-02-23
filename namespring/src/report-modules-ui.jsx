import React from 'react';

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
  const resolvedTone = toneMap && tone ? toneMap[tone] : null;
  const resolvedClassName = resolvedTone?.className || '';
  const resolvedStyle = style || resolvedTone?.style;
  return (
    <section
      className={`rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface)] shadow-lg overflow-hidden ${resolvedClassName} ${className}`}
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
}) {
  return (
    <article className={`rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] ${className}`}>
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
}) {
  const width = 520;
  const height = 140;
  const pad = 14;
  const safePoints = Array.isArray(points) && points.length ? points : [50, 50, 50, 50];
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = max - min || 1;
  const coords = safePoints.map((value, index) => {
    const x = pad + (index / Math.max(1, safePoints.length - 1)) * (width - pad * 2);
    const ratio = (value - min) / range;
    const y = height - pad - ratio * (height - pad * 2);
    return { x, y, value };
  });
  const polyline = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]/60 p-2.5">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
        <polyline fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        {coords.map((point, idx) => (
          <g key={`ts-point-${idx}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill={stroke} />
            {showPointLabels ? (
              <text x={point.x} y={point.y - 8} textAnchor="middle" fontSize="10" fill="var(--ns-muted)" style={{ fontWeight: 700 }}>
                {valueFormatter(point.value)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
