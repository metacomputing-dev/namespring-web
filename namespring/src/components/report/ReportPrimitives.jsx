import React from 'react';

export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

function elementTextClassName(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'wood') return 'ns-element-text--wood';
  if (key === '목') return 'ns-element-text--wood';
  if (key === 'fire') return 'ns-element-text--fire';
  if (key === '화') return 'ns-element-text--fire';
  if (key === 'earth') return 'ns-element-text--earth';
  if (key === '토') return 'ns-element-text--earth';
  if (key === 'metal') return 'ns-element-text--metal';
  if (key === '금') return 'ns-element-text--metal';
  if (key === 'water') return 'ns-element-text--water';
  if (key === '수') return 'ns-element-text--water';
  return 'ns-element-text--neutral';
}

const ELEMENT_LABEL_BY_KEY = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};

const STEM_HANJA_BY_HANGUL = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸',
};

const BRANCH_HANJA_BY_HANGUL = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥',
};

const STEM_HANGUL_BY_HANJA = Object.fromEntries(Object.entries(STEM_HANJA_BY_HANGUL).map(([hangul, hanja]) => [hanja, hangul]));
const BRANCH_HANGUL_BY_HANJA = Object.fromEntries(Object.entries(BRANCH_HANJA_BY_HANGUL).map(([hangul, hanja]) => [hanja, hangul]));

function normalizeElementKey(value) {
  const raw = String(value ?? '').trim();
  const upper = raw.toUpperCase();
  if (raw === '목' || upper === 'WOOD' || upper === 'WOODEN') return 'WOOD';
  if (raw === '화' || upper === 'FIRE') return 'FIRE';
  if (raw === '토' || upper === 'EARTH') return 'EARTH';
  if (raw === '금' || upper === 'METAL') return 'METAL';
  if (raw === '수' || upper === 'WATER') return 'WATER';
  return upper;
}

function formatElementLabel(value) {
  const key = normalizeElementKey(value);
  return ELEMENT_LABEL_BY_KEY[key] || String(value || '-');
}

function formatGanjiSymbol(part, type) {
  const rawSymbol = String(part?.symbol ?? part?.large ?? part ?? '').trim();
  const hangul = String(part?.hangul ?? '').trim();
  const hanja = String(part?.hanja ?? '').trim();
  if (hangul && hanja && hangul !== hanja) return `${hangul}(${hanja})`;

  const raw = rawSymbol || hangul || hanja || '-';
  if (raw.length === 1) {
    const hanjaByHangul = type === 'branch' ? BRANCH_HANJA_BY_HANGUL : STEM_HANJA_BY_HANGUL;
    const hangulByHanja = type === 'branch' ? BRANCH_HANGUL_BY_HANJA : STEM_HANGUL_BY_HANJA;
    if (hanjaByHangul[raw]) return `${raw}(${hanjaByHangul[raw]})`;
    if (hangulByHanja[raw]) return `${hangulByHanja[raw]}(${raw})`;
  }
  return raw;
}

export function HomeIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3 9.4 10 4l7 5.4v6.8h-4.4v-4.4H7.4v4.4H3V9.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EditIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3.7 13.8 13.3 4.2l2.5 2.5-9.6 9.6-3.1.6.6-3.1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m12 5.5 2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ShareIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M7.4 11.1 12.6 14M12.6 6 7.4 8.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5.5" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.5" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function DownloadIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 3v8m0 0 3-3m-3 3L7 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13.5v2.7h12v-2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M5 3.5h6.2L15 7.3v9.2H5v-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 3.7v4h3.7M7.5 11h5M7.5 13.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="8.8" cy="8.8" r="4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.4 12.4 3.4 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LeafMark({ className = 'ns-leaf-mark' }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true">
      <path d="M25 75C40 50 55 31 78 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 55c-11 0-19-7-22-18 12-1 21 4 26 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 40c-9-2-15-10-15-21 12 2 19 9 20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M64 31c3-10 11-16 22-17-2 11-9 18-20 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 71c-9 4-18 2-25-6 9-5 18-4 26 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReportCard({
  as: Component = 'section',
  title,
  subtitle,
  action,
  tone,
  children,
  className = '',
  bodyClassName = '',
}) {
  return (
    <Component className={cx('ns-card ns-card--padded', tone ? `ns-tone-${tone}` : '', className)}>
      {(title || subtitle || action) ? (
        <div className="ns-card__head">
          <div className="min-w-0">
            {title ? <h2 className="ns-card__title">{title}</h2> : null}
            {subtitle ? <p className="ns-card__body mt-1">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cx('ns-card__body', bodyClassName)}>{children}</div>
    </Component>
  );
}

export function PageHeading({ kicker, title, description, action, className = '' }) {
  return (
    <header className={cx('ns-page-heading', className)}>
      {kicker ? <p className="ns-kicker">{kicker}</p> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {title ? <h1 className="ns-title">{title}</h1> : null}
          {description ? <p className="ns-copy mt-3">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

export function ScoreRing({ value = 0, max = 100, label, className = '' }) {
  const safeMax = Number(max) > 0 ? Number(max) : 100;
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const score = Math.round((safeValue / safeMax) * 100);
  const displayValue = Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(1);

  return (
    <div className={cx('inline-grid justify-items-center gap-2', className)}>
      <div className="ns-score-ring" style={{ '--score': score }}>
        <div className="ns-score-ring__content">
          <span className="ns-score-ring__value">{displayValue}</span>
          <span className="ns-score-ring__max">/{safeMax}</span>
        </div>
      </div>
      {label ? <p className="text-sm font-bold text-[var(--color-accent)]">{label}</p> : null}
    </div>
  );
}

export function InfoList({ items = [], className = '' }) {
  return (
    <dl className={cx('ns-info-list', className)}>
      {items.map((item) => (
        <div key={item.label} className="ns-info-row">
          <dt className="ns-info-row__label">
            {item.icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{item.icon}</span> : null}
            {item.label}
          </dt>
          <dd className="ns-info-row__value">{item.value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricStrip({ items = [], className = '' }) {
  return (
    <div className={cx('ns-metric-strip', className)}>
      {items.map((item) => (
        <div className="ns-metric" key={item.label}>
          <p className="ns-metric__label">{item.label}</p>
          <p className="ns-metric__value">{item.value}</p>
          {item.caption ? <p className="mt-1 text-xs font-semibold text-[var(--color-ink-3)]">{item.caption}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function PillarTable({ columns = [], rows = [], className = '' }) {
  return (
    <div className={cx('ns-table-wrap', className)}>
      <table className="ns-pillar-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`pillar-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className={typeof cell === 'object' && cell?.elementKey ? elementTextClassName(cell.elementKey) : undefined}
                >
                  {typeof cell === 'object' && cell ? (
                    <>
                      {cell.large ? <span className="ns-pillar-table__hanja">{cell.large}</span> : null}
                      {cell.small ? <span className="ns-pillar-table__small">{cell.small}</span> : null}
                    </>
                  ) : (
                    <span className={rowIndex > 0 ? 'ns-pillar-table__hanja' : ''}>{cell}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SajuPillarTable({ columns = [], className = '', compact = false, ariaLabel = '사주팔자 4기둥' }) {
  const normalizedColumns = columns.slice(0, 4).map((column, index) => ({
    key: column?.key || `pillar-${index}`,
    label: column?.label || ['년주', '월주', '일주', '시주'][index],
    stem: column?.stem || null,
    branch: column?.branch || null,
  }));
  while (normalizedColumns.length < 4) {
    const index = normalizedColumns.length;
    normalizedColumns.push({
      key: `pillar-empty-${index}`,
      label: ['년주', '월주', '일주', '시주'][index],
      stem: null,
      branch: null,
    });
  }

  const renderCell = (column, type) => {
    const part = column[type] || {};
    const elementKey = normalizeElementKey(part?.elementKey || part?.element || '');
    return (
      <td key={`${column.key}-${type}`} className={elementTextClassName(elementKey)}>
        <div className="ns-saju-pillar-cell">
          <span className="ns-saju-pillar-cell__symbol">{formatGanjiSymbol(part, type)}</span>
          <span className="ns-saju-pillar-cell__element">{formatElementLabel(elementKey)}</span>
        </div>
      </td>
    );
  };

  return (
    <div className={cx('ns-table-wrap ns-saju-pillars', compact ? 'ns-saju-pillars--compact' : '', className)}>
      <table className="ns-pillar-table ns-saju-pillar-table" aria-label={ariaLabel}>
        <colgroup>
          <col className="ns-saju-pillar-table__axis-col" />
          {normalizedColumns.map((column) => <col key={`${column.key}-col`} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">구분</th>
            {normalizedColumns.map((column) => (
              <th key={`${column.key}-head`} scope="col">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">천간</th>
            {normalizedColumns.map((column) => renderCell(column, 'stem'))}
          </tr>
          <tr>
            <th scope="row">지지</th>
            {normalizedColumns.map((column) => renderCell(column, 'branch'))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ReportActionBar({ actions = [], className = '' }) {
  return (
    <div data-pdf-exclude="true" className={cx('ns-bottom-actions', className)}>
      {actions.filter(Boolean).map((action) => {
        const Component = action.href ? 'a' : 'button';
        return (
          <Component
            key={action.label}
            type={action.href ? undefined : 'button'}
            href={action.href}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cx(action.primary ? 'ns-primary-button' : 'ns-secondary-button', action.className)}
          >
            {action.icon ? action.icon : null}
            <span>{action.label}</span>
          </Component>
        );
      })}
    </div>
  );
}

export function StatusPanel({ tone = 'neutral', title, children, icon }) {
  return (
    <div className={cx('ns-card ns-card--padded', `ns-tone-${tone}`)}>
      <div className="flex items-start gap-3">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          {title ? <p className="font-bold text-current">{title}</p> : null}
          {children ? <div className="mt-1 text-sm font-semibold leading-relaxed">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
