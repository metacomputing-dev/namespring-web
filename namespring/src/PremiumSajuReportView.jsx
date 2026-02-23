import React, { useCallback, useMemo, useRef, useState } from 'react';
import NamingResultRenderer from './NamingResultRenderer';
import { buildRenderMetricsFromSajuReport } from './naming-result-render-metrics';
import { computeDateFortune } from '@spring/report/common/dateFortune.js';
import {
  generateDetailedYearFortune,
  generateDetailedMonthFortune,
  generateDetailedDayFortune,
} from '@spring/report/sections/section-dateFortune.js';
import { SeededRandom } from '@spring/report/common/sentenceUtils.js';
import {
  ReportActionButtons,
  ReportPrintOverlay,
  ReportScrollTopFab,
  ReportShareDialog,
  useReportActions,
} from './report-common-ui';

/* ──── Constants ──── */

const ELEMENT_CODE_ORDER = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
const POSITION_ORDER = ['YEAR', 'MONTH', 'DAY', 'HOUR'];
const POSITION_LABEL = { YEAR: '년주', MONTH: '월주', DAY: '일주', HOUR: '시주' };
const POSITION_KEY_BY_CODE = { YEAR: 'year', MONTH: 'month', DAY: 'day', HOUR: 'hour' };

const STEM_ELEMENT = {
  GAP: 'WOOD', EUL: 'WOOD', BYEONG: 'FIRE', JEONG: 'FIRE', MU: 'EARTH',
  GI: 'EARTH', GYEONG: 'METAL', SIN: 'METAL', IM: 'WATER', GYE: 'WATER',
};
const BRANCH_ELEMENT = {
  JA: 'WATER', CHUK: 'EARTH', IN: 'WOOD', MYO: 'WOOD', JIN: 'EARTH', SA: 'FIRE',
  O: 'FIRE', MI: 'EARTH', SIN: 'METAL', YU: 'METAL', SUL: 'EARTH', HAE: 'WATER',
};

const CHART_COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#64748b', '#3b82f6', '#8b5cf6', '#ec4899'];

const SECTION_DEFAULT_OPEN = new Set([
  'dayMaster', 'elementBalance', 'gyeokgukYongshin',
  'tenGodPersonality', 'fortuneCycles', 'lifeGuide',
]);

/* ──── Helpers ──── */

function toElementKey(v) {
  const raw = String(v ?? '').trim().toUpperCase();
  if (!raw) return '';
  const map = { '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER' };
  return map[raw] ?? (ELEMENT_CODE_ORDER.includes(raw) ? raw : raw);
}

function elementLabel(v) {
  const labels = { WOOD: '목', FIRE: '화', EARTH: '토', METAL: '금', WATER: '수' };
  return labels[toElementKey(v)] ?? '-';
}

function elementCardClass(v) {
  const map = {
    WOOD: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    FIRE: 'border-rose-200 bg-rose-50 text-rose-800',
    EARTH: 'border-amber-200 bg-amber-50 text-amber-800',
    METAL: 'border-slate-200 bg-slate-100 text-slate-800',
    WATER: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return map[toElementKey(v)] ?? 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

function elementHexColor(v) {
  const map = { WOOD: '#10b981', FIRE: '#f43f5e', EARTH: '#f59e0b', METAL: '#64748b', WATER: '#3b82f6' };
  return map[toElementKey(v)] ?? '#9ca3af';
}

function extractElementFromLabel(label) {
  const s = String(label ?? '').toUpperCase();
  for (const el of ELEMENT_CODE_ORDER) if (s.includes(el)) return el;
  const m = { '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER' };
  for (const [k, v] of Object.entries(m)) if (s.includes(k)) return v;
  return '';
}

function getChartColor(label, i) {
  const el = extractElementFromLabel(label);
  if (el) return elementHexColor(el);
  if (String(label).includes('길')) return '#10b981';
  if (String(label).includes('흉')) return '#f43f5e';
  return CHART_COLORS[i % CHART_COLORS.length];
}

function resolvePillarElement(part, type) {
  const direct = toElementKey(part?.element ?? part?.fiveElement ?? part?.ohaeng ?? '');
  if (direct && ELEMENT_CODE_ORDER.includes(direct)) return direct;
  const code = String(part?.code ?? '').trim().toUpperCase();
  return (type === 'stem' ? STEM_ELEMENT : BRANCH_ELEMENT)[code] ?? '';
}

/* ──── Shared UI ──── */

function CollapseCard({ title, subtitle, open, onToggle, children }) {
  return (
    <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{title}</h3>
          {subtitle && <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{subtitle}</p>}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
          <svg viewBox="0 0 20 20" fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

/* ──── Premium Content Renderers ──── */

function ParagraphBlock({ paragraph }) {
  const { type, text, tone } = paragraph;

  if (type === 'tip') return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
      <p className="text-[11px] font-black text-blue-600 mb-1">TIP</p>
      <p className="text-sm text-blue-900 leading-relaxed break-keep whitespace-normal">{text}</p>
    </div>
  );

  if (type === 'warning') return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <p className="text-[11px] font-black text-amber-600 mb-1">참고</p>
      <p className="text-sm text-amber-900 leading-relaxed break-keep whitespace-normal">{text}</p>
    </div>
  );

  if (type === 'quote') return (
    <div className="border-l-4 border-[var(--ns-border)] pl-4 py-1">
      <p className="text-sm italic text-[var(--ns-muted)] leading-relaxed break-keep whitespace-normal">{text}</p>
    </div>
  );

  if (type === 'emphasis') return (
    <p className="text-sm font-black text-[var(--ns-accent-text)] leading-relaxed break-keep whitespace-normal">{text}</p>
  );

  // narrative (default)
  const borderClass = tone === 'positive' ? 'border-l-4 border-emerald-300 pl-4'
    : tone === 'negative' ? 'border-l-4 border-rose-300 pl-4'
    : tone === 'encouraging' ? 'border-l-4 border-blue-300 pl-4' : '';

  return (
    <div className={borderClass}>
      <p className="text-sm text-[var(--ns-text)] leading-relaxed break-keep whitespace-normal">{text}</p>
    </div>
  );
}

function HighlightBadges({ highlights }) {
  if (!highlights?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {highlights.map((h, i) => {
        const cls = h.element ? elementCardClass(h.element)
          : h.sentiment === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : h.sentiment === 'caution' ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
        return (
          <div key={`hl-${i}`} className={`rounded-xl border px-3 py-2 ${cls}`}>
            <p className="text-[10px] font-black opacity-70">{h.label}</p>
            <p className="text-sm font-black">{h.value}</p>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({ table }) {
  if (!table?.headers?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--ns-border)] overflow-hidden">
      {table.title && (
        <div className="px-3 py-2 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)]">
          <p className="text-sm font-black text-[var(--ns-accent-text)]">{table.title}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--ns-surface-soft)]">
              {table.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-[11px] font-black text-[var(--ns-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows?.map((row, ri) => (
              <tr key={ri} className="border-t border-[var(--ns-border)]">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-[var(--ns-text)] break-keep whitespace-normal">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──── Chart Renderers ──── */

function PremiumBarChart({ chart }) {
  const entries = Object.entries(chart.data || {}).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      {chart.title && <p className="text-sm font-black text-[var(--ns-accent-text)]">{chart.title}</p>}
      {entries.map(([label, value], i) => {
        const pct = Math.max(Math.round((value / max) * 100), 2);
        const color = getChartColor(label, i);
        return (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-[var(--ns-text)]">{label}</span>
              <span className="text-[var(--ns-muted)]">{value}</span>
            </div>
            <div className="h-3 rounded-full bg-[var(--ns-surface-soft)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PremiumDonutChart({ chart }) {
  const entries = Object.entries(chart.data || {}).filter(([, v]) => typeof v === 'number' && v > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return null;

  const segments = [];
  let angle = 0;
  entries.forEach(([label, value], i) => {
    const pct = (value / total) * 100;
    const color = getChartColor(label, i);
    segments.push({ label, value, pct, startAngle: angle, color });
    angle += pct * 3.6;
  });

  const gradientParts = segments.map(s =>
    `${s.color} ${s.startAngle}deg ${s.startAngle + s.pct * 3.6}deg`
  );

  return (
    <div className="space-y-2">
      {chart.title && <p className="text-sm font-black text-[var(--ns-accent-text)]">{chart.title}</p>}
      <div className="flex items-center gap-6">
        <div className="relative w-28 h-28 shrink-0">
          <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${gradientParts.join(', ')})` }} />
          <div className="absolute inset-[30%] rounded-full bg-[var(--ns-surface)]" />
        </div>
        <div className="space-y-1.5">
          {segments.map(s => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[var(--ns-text)]">{s.label}: <strong>{s.value}</strong> ({Math.round(s.pct)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PremiumTimelineChart({ chart }) {
  const entries = Object.entries(chart.data || {});
  if (!entries.length) return null;

  return (
    <div className="space-y-2">
      {chart.title && <p className="text-sm font-black text-[var(--ns-accent-text)]">{chart.title}</p>}
      <div className="overflow-x-auto -mx-3 px-3">
        <div className="flex gap-2 min-w-max py-1">
          {entries.map(([label, grade]) => {
            const stars = typeof grade === 'number' ? Math.min(Math.max(grade, 1), 5) : 3;
            const bg = stars >= 4 ? 'border-emerald-200 bg-emerald-50'
              : stars === 3 ? 'border-slate-200 bg-slate-50'
              : 'border-rose-200 bg-rose-50';
            const textColor = stars >= 4 ? 'text-emerald-700'
              : stars === 3 ? 'text-slate-600'
              : 'text-rose-700';
            return (
              <div key={label} className={`rounded-xl border px-3 py-2 min-w-[110px] text-center ${bg}`}>
                <p className={`text-[10px] font-bold ${textColor} leading-tight break-keep`}>{label}</p>
                <p className={`text-sm mt-1 ${textColor}`}>
                  {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PremiumRadarChart({ chart }) {
  const entries = Object.entries(chart.data || {}).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;

  const n = entries.length;
  const cx = 150;
  const cy = 150;
  const radius = 100;
  const labelRadius = radius + 24;
  const maxValue = Math.max(...entries.map(([, v]) => v), 0);
  const gridLevels = [0.33, 0.66, 1.0];

  // Compute the angle for vertex i, starting from top (12-o'clock) going clockwise
  const angle = (i) => (2 * Math.PI * i) / n - Math.PI / 2;

  // Build a polygon points string for a given per-vertex radius array or uniform radius
  const polygonPoints = (radii) =>
    entries
      .map((_, i) => {
        const r = typeof radii === 'number' ? radii : radii[i];
        const x = cx + r * Math.cos(angle(i));
        const y = cy + r * Math.sin(angle(i));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  // Data radii: scale each value proportionally; if maxValue is 0, all radii are 0
  const dataRadii = entries.map(([, v]) => (maxValue > 0 ? (v / maxValue) * radius : 0));

  return (
    <div className="space-y-2">
      {chart.title && <p className="text-sm font-black text-[var(--ns-accent-text)]">{chart.title}</p>}
      <svg viewBox="0 0 300 300" className="w-full max-w-xs mx-auto" role="img">
        {/* Concentric grid polygons */}
        {gridLevels.map((level) => (
          <polygon
            key={`grid-${level}`}
            points={polygonPoints(radius * level)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines from center to each vertex */}
        {entries.map((_, i) => (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(angle(i))}
            y2={cy + radius * Math.sin(angle(i))}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Data polygon */}
        {maxValue > 0 && (
          <polygon
            points={polygonPoints(dataRadii)}
            fill="rgba(59, 130, 246, 0.3)"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        )}

        {/* Vertex labels */}
        {entries.map(([label], i) => {
          const lx = cx + labelRadius * Math.cos(angle(i));
          const ly = cy + labelRadius * Math.sin(angle(i));
          return (
            <text
              key={`label-${i}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#374151"
              fontSize="12"
              fontWeight="bold"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function ChartRenderer({ chart }) {
  if (!chart) return null;
  if (chart.type === 'donut') return <PremiumDonutChart chart={chart} />;
  if (chart.type === 'timeline') return <PremiumTimelineChart chart={chart} />;
  if (chart.type === 'radar') return <PremiumRadarChart chart={chart} />;
  return <PremiumBarChart chart={chart} />;
}

/* ──── Section Content ──── */

function SubsectionBlock({ sub }) {
  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 space-y-2">
      <h4 className="text-sm font-black text-[var(--ns-accent-text)]">{sub.title}</h4>
      <HighlightBadges highlights={sub.highlights} />
      {sub.paragraphs?.map((p, i) => <ParagraphBlock key={`sp-${i}`} paragraph={p} />)}
      {sub.tables?.map((t, i) => <DataTable key={`st-${i}`} table={t} />)}
      {sub.charts?.map((c, i) => <ChartRenderer key={`sc-${i}`} chart={c} />)}
    </div>
  );
}

function SectionContent({ section }) {
  return (
    <div className="space-y-3">
      <HighlightBadges highlights={section.highlights} />
      {section.paragraphs?.map((p, i) => <ParagraphBlock key={`p-${i}`} paragraph={p} />)}
      {section.tables?.map((t, i) => <DataTable key={`t-${i}`} table={t} />)}
      {section.charts?.map((c, i) => <ChartRenderer key={`c-${i}`} chart={c} />)}
      {section.subsections?.map((s, i) => <SubsectionBlock key={`sub-${i}`} sub={s} />)}
    </div>
  );
}

/* ──── Specific Date Fortune ──── */

const FORTUNE_MODES = [
  { key: 'year', label: '연운', desc: '한 해 운세' },
  { key: 'month', label: '월운', desc: '해당 월 운세' },
  { key: 'day', label: '일운', desc: '해당 일 운세' },
];

function FortuneModeTabs({ mode, onChange }) {
  return (
    <div className="flex rounded-xl border border-[var(--ns-border)] overflow-hidden">
      {FORTUNE_MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          className={`flex-1 py-2.5 px-2 text-center transition-colors ${
            mode === m.key
              ? 'bg-blue-500 text-white'
              : 'bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] hover:bg-[var(--ns-surface)]'
          }`}
        >
          <span className="block text-sm font-black">{m.label}</span>
          <span className={`block text-[10px] mt-0.5 ${mode === m.key ? 'text-blue-100' : 'opacity-60'}`}>{m.desc}</span>
        </button>
      ))}
    </div>
  );
}

function DetailedFortuneView({ fortune }) {
  if (!fortune) return null;
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Title + Subtitle */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-center">
        <p className="text-base font-black text-blue-800">{fortune.title}</p>
        <p className="text-xs text-blue-600 mt-1">{fortune.subtitle}</p>
      </div>

      {/* Highlights */}
      <HighlightBadges highlights={fortune.highlights} />

      {/* Top paragraphs */}
      {fortune.paragraphs?.map((p, i) => <ParagraphBlock key={`fp-${i}`} paragraph={p} />)}

      {/* Charts */}
      {fortune.charts?.map((c, i) => <ChartRenderer key={`fc-${i}`} chart={c} />)}

      {/* Tables */}
      {fortune.tables?.map((t, i) => <DataTable key={`ft-${i}`} table={t} />)}

      {/* Subsections */}
      {fortune.subsections?.map((s, i) => <SubsectionBlock key={`fs-${i}`} sub={s} />)}
    </div>
  );
}

function SpecificDateFortune({ report }) {
  const now = new Date();
  const [mode, setMode] = useState('year');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [detailedResult, setDetailedResult] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const yongshin = report?.yongshin;
  const hasYongshin = !!yongshin?.element;

  const handleCompute = useCallback(() => {
    if (!hasYongshin) return;

    const yongshinInfo = {
      element: yongshin.element,
      heeshin: yongshin.heeshin ?? null,
      gushin: yongshin.gushin ?? null,
      gishin: yongshin.gishin ?? null,
    };

    // Compute pillar data
    const fortune = computeDateFortune(
      yongshin.element,
      yongshin.heeshin ?? null,
      yongshin.gushin ?? null,
      yongshin.gishin ?? null,
      year,
      mode === 'year' ? null : month,
      mode === 'day' ? day : null,
    );

    // Generate detailed report based on mode
    let detailed;
    if (mode === 'year') {
      const seed = year;
      const rng = new SeededRandom(seed);
      detailed = generateDetailedYearFortune(fortune.year, yongshinInfo, year, rng);
    } else if (mode === 'month') {
      const seed = year * 100 + month;
      const rng = new SeededRandom(seed);
      // Need month pillar for month fortune
      const fullFortune = computeDateFortune(
        yongshin.element,
        yongshin.heeshin ?? null,
        yongshin.gushin ?? null,
        yongshin.gishin ?? null,
        year,
        month,
        null,
      );
      detailed = generateDetailedMonthFortune(fullFortune.year, fullFortune.month, yongshinInfo, year, month, rng);
    } else {
      const seed = year * 10000 + month * 100 + day;
      const rng = new SeededRandom(seed);
      const fullFortune = computeDateFortune(
        yongshin.element,
        yongshin.heeshin ?? null,
        yongshin.gushin ?? null,
        yongshin.gishin ?? null,
        year,
        month,
        day,
      );
      detailed = generateDetailedDayFortune(fullFortune.year, fullFortune.month, fullFortune.day, yongshinInfo, year, month, day, rng);
    }

    setDetailedResult(detailed);
    setIsOpen(true);
  }, [hasYongshin, yongshin, year, month, day, mode]);

  if (!hasYongshin) return null;

  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface)] shadow-lg overflow-hidden">
      <div className="px-3 py-2.5">
        <h3 className="text-lg font-black text-[var(--ns-accent-text)]">특정 시점 운세 조회</h3>
        <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">
          연운 / 월운 / 일운을 선택하여 상세 운세를 확인해 보세요
        </p>
      </div>

      <div className="px-3 pb-3 space-y-3">
        {/* Mode tabs */}
        <FortuneModeTabs mode={mode} onChange={(m) => { setMode(m); setIsOpen(false); setDetailedResult(null); }} />

        {/* Input fields based on mode */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[80px]">
            <label className="block text-[11px] font-black text-[var(--ns-muted)] mb-1">연도</label>
            <input type="number" value={year} min={1900} max={2100}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm text-[var(--ns-text)] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {(mode === 'month' || mode === 'day') && (
            <div className="flex-1 min-w-[60px]">
              <label className="block text-[11px] font-black text-[var(--ns-muted)] mb-1">월</label>
              <input type="number" value={month} min={1} max={12}
                onChange={e => setMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm text-[var(--ns-text)] focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}
          {mode === 'day' && (
            <div className="flex-1 min-w-[60px]">
              <label className="block text-[11px] font-black text-[var(--ns-muted)] mb-1">일</label>
              <input type="number" value={day} min={1} max={31}
                onChange={e => setDay(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm text-[var(--ns-text)] focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}
          <button type="button" onClick={handleCompute}
            className="shrink-0 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-black text-sm px-5 py-2 transition-colors">
            상세 운세 보기
          </button>
        </div>

        {/* Detailed Results */}
        {isOpen && detailedResult && (
          <>
            <DetailedFortuneView fortune={detailedResult} />
            <button type="button" onClick={() => setIsOpen(false)}
              className="w-full text-center text-sm text-[var(--ns-muted)] hover:text-[var(--ns-text)] py-1 transition-colors">
              접기 ▲
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ──── Pillar Grid ──── */

function PillarGrid({ report }) {
  const cells = useMemo(() =>
    POSITION_ORDER.map(posCode => {
      const p = report?.pillars?.[POSITION_KEY_BY_CODE[posCode]] ?? {};
      const stem = p?.stem ?? {};
      const branch = p?.branch ?? {};
      return {
        posCode,
        label: POSITION_LABEL[posCode],
        stem: { hangul: stem?.hangul || '-', hanja: stem?.hanja || '-', element: resolvePillarElement(stem, 'stem') },
        branch: { hangul: branch?.hangul || '-', hanja: branch?.hanja || '-', element: resolvePillarElement(branch, 'branch') },
      };
    }), [report]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1.5">천간</p>
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map(c => (
            <div key={`s-${c.posCode}`} className={`rounded-xl border px-2 py-2 text-center ${elementCardClass(c.stem.element)}`}>
              <p className="text-[10px] font-black opacity-80">{c.label}</p>
              <p className="text-lg font-black mt-0.5">
                {c.stem.hangul}
                <span className="text-[10px] ml-0.5">({c.stem.hanja})</span>
              </p>
              <p className="text-[10px] font-black mt-1">{elementLabel(c.stem.element)}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1.5">지지</p>
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map(c => (
            <div key={`b-${c.posCode}`} className={`rounded-xl border px-2 py-2 text-center ${elementCardClass(c.branch.element)}`}>
              <p className="text-[10px] font-black opacity-80">{c.label}</p>
              <p className="text-lg font-black mt-0.5">
                {c.branch.hangul}
                <span className="text-[10px] ml-0.5">({c.branch.hanja})</span>
              </p>
              <p className="text-[10px] font-black mt-1">{elementLabel(c.branch.element)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──── Main Premium View ──── */

function PremiumSajuView({ report, shareUserInfo }) {
  const reportRootRef = useRef(null);
  const premium = report.premiumReport;
  const sections = premium?.sections ?? [];

  const overallSection = sections.find(s => s.id === 'overallSummary');
  const pillarsSection = sections.find(s => s.id === 'myPillars');
  const collapsibleSections = useMemo(
    () => sections.filter(s => s.id !== 'overallSummary' && s.id !== 'myPillars'),
    [sections],
  );

  const [openCards, setOpenCards] = useState(() => {
    const init = {};
    collapsibleSections.forEach(s => { init[s.id] = SECTION_DEFAULT_OPEN.has(s.id); });
    return init;
  });

  const toggleCard = useCallback((id) => {
    setOpenCards(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const sajuRenderMetrics = useMemo(
    () => buildRenderMetricsFromSajuReport(report, { entryUserInfo: shareUserInfo }),
    [report, shareUserInfo],
  );

  const prepareBeforePrint = useCallback(() => {
    const prev = { ...openCards };
    const allOpen = {};
    collapsibleSections.forEach(s => { allOpen[s.id] = true; });
    setOpenCards(allOpen);
    return { prev };
  }, [openCards, collapsibleSections]);

  const restoreAfterPrint = useCallback((payload) => {
    if (payload?.prev) setOpenCards(payload.prev);
  }, []);

  const {
    isPdfSaving, isShareDialogOpen, shareLink, isLinkCopied,
    handleSavePdf, handleOpenShareDialog, closeShareDialog, handleCopyShareLink,
  } = useReportActions({ reportRootRef, shareUserInfo, prepareBeforePrint, restoreAfterPrint });

  return (
    <>
    <div ref={reportRootRef} data-pdf-root="true" className="space-y-4">
      {/* Hero Section */}
      {overallSection && (
        <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[var(--ns-accent-text)]">{overallSection.title}</h2>
              {overallSection.subtitle && (
                <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{overallSection.subtitle}</p>
              )}
            </div>
            <div className={`rounded-xl border px-3 py-2 text-right ${report.sajuEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-xs font-black ${report.sajuEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>분석 상태</p>
              <p className={`text-lg font-black ${report.sajuEnabled ? 'text-emerald-800' : 'text-amber-800'}`}>
                {report.sajuEnabled ? '활성' : '비활성'}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <HighlightBadges highlights={overallSection.highlights} />
          </div>
          <div className="mt-3 space-y-2">
            {overallSection.paragraphs?.map((p, i) => <ParagraphBlock key={`hero-p-${i}`} paragraph={p} />)}
          </div>
          <div className="mt-3 h-44 md:h-52 rounded-[1.6rem] overflow-hidden border border-[var(--ns-border)] shadow-md">
            <NamingResultRenderer
              renderMetrics={sajuRenderMetrics}
              birthDateTime={shareUserInfo?.birthDateTime ?? null}
              gender={shareUserInfo?.gender}
              isSolarCalendar={shareUserInfo?.isSolarCalendar}
              isBirthTimeUnknown={shareUserInfo?.isBirthTimeUnknown}
            />
          </div>
        </section>
      )}

      {/* Pillar Section */}
      {pillarsSection && (
        <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface)] p-3 md:p-4 shadow-lg">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{pillarsSection.title}</h3>
          {pillarsSection.subtitle && (
            <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{pillarsSection.subtitle}</p>
          )}
          <div className="mt-3">
            <PillarGrid report={report} />
          </div>
          {pillarsSection.paragraphs?.length > 0 && (
            <div className="mt-3 space-y-2">
              {pillarsSection.paragraphs.map((p, i) => <ParagraphBlock key={`pil-p-${i}`} paragraph={p} />)}
            </div>
          )}
          {pillarsSection.tables?.map((t, i) => (
            <div key={`pil-t-${i}`} className="mt-3"><DataTable table={t} /></div>
          ))}
          {pillarsSection.highlights?.length > 0 && (
            <div className="mt-3"><HighlightBadges highlights={pillarsSection.highlights} /></div>
          )}
        </section>
      )}

      {/* Collapsible Sections */}
      {collapsibleSections.map(section => (
        <CollapseCard
          key={section.id}
          title={section.title}
          subtitle={section.subtitle}
          open={!!openCards[section.id]}
          onToggle={() => toggleCard(section.id)}
        >
          <SectionContent section={section} />
        </CollapseCard>
      ))}

      {/* Specific Date Fortune */}
      <SpecificDateFortune report={report} />

      <ReportActionButtons
        isPdfSaving={isPdfSaving}
        onSavePdf={handleSavePdf}
        onShare={handleOpenShareDialog}
      />
    </div>
    <ReportPrintOverlay isPdfSaving={isPdfSaving} />
    <ReportShareDialog
      isOpen={isShareDialogOpen}
      shareLink={shareLink}
      isLinkCopied={isLinkCopied}
      onCopy={handleCopyShareLink}
      onClose={closeShareDialog}
    />
    <ReportScrollTopFab />
    </>
  );
}

export default PremiumSajuView;
