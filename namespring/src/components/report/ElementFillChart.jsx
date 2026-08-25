import React from 'react';
import { cx } from './ReportPrimitives';

// "What does the name fill?" — one row per element: the natal saju units
// (muted) first, then the units the name adds (vivid, ring + plus mark).
// Identity is carried by the row label, not color alone; saju vs name is
// encoded by position, opacity, ring, and the plus separator.

const ELEMENT_ROWS = [
  { key: 'wood', ko: '목' },
  { key: 'fire', ko: '화' },
  { key: 'earth', ko: '토' },
  { key: 'metal', ko: '금' },
  { key: 'water', ko: '수' },
];

const MAX_UNITS_PER_GROUP = 8;

function countOf(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

/** Compact per-element glyphs, drawn with the element tint tokens. */
const GLYPHS = {
  wood: (
    <>
      <rect x="10.5" y="12" width="3" height="8" rx="1.5" fill="var(--color-ink-3)" />
      <circle cx="12" cy="9.5" r="6" fill="var(--el-bg)" stroke="var(--el)" strokeWidth="1.5" />
    </>
  ),
  fire: (
    <>
      <path
        d="M12 3.5C15.5 8.5 17.5 11 17.5 14.5A5.5 5.5 0 1 1 6.5 14.5C6.5 11 8.5 8.5 12 3.5Z"
        fill="var(--el-bg)"
        stroke="var(--el)"
        strokeWidth="1.5"
      />
      <path
        d="M12 10C13.6 12.2 14.5 13.5 14.5 15A2.5 2.5 0 1 1 9.5 15C9.5 13.5 10.4 12.2 12 10Z"
        fill="var(--el)"
        opacity="0.55"
      />
    </>
  ),
  earth: (
    <path
      d="M3.5 19C3.5 12.5 7.5 8.5 12 8.5C16.5 8.5 20.5 12.5 20.5 19Z"
      fill="var(--el-bg)"
      stroke="var(--el)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
  metal: (
    <>
      <rect x="5.5" y="11" width="13" height="8.5" rx="1.5" fill="var(--el-bg)" stroke="var(--el)" strokeWidth="1.5" />
      <path d="M4 11L12 4.5L20 11Z" fill="var(--el-bg)" stroke="var(--el)" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  ),
  water: (
    <g fill="none" stroke="var(--el)" strokeWidth="2" strokeLinecap="round">
      <path d="M4 10C6.5 7.5 9 7.5 11.5 10C14 12.5 16.5 12.5 19 10" />
      <path d="M4 16C6.5 13.5 9 13.5 11.5 16C14 18.5 16.5 18.5 19 16" />
    </g>
  ),
};

function Unit({ element, kind }) {
  return (
    <span
      className={cx(
        'inline-grid h-6 w-6 place-items-center rounded-lg',
        kind === 'name' ? 'bg-[var(--el-bg)] ring-1 ring-[var(--el)]' : 'opacity-40',
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        {GLYPHS[element]}
      </svg>
    </span>
  );
}

function rowBadge(row) {
  if (row.isYongshin) {
    return row.nameCount > 0
      ? { text: '필요한 기운 · 이름이 채워요', className: 'bg-sagesoft text-sage' }
      : { text: '필요한 기운', className: 'bg-sagesoft/60 text-sage' };
  }
  if (row.isGishin) {
    return row.nameCount > 0
      ? { text: '피하는 기운 · 이름에 있어요', className: 'bg-rosesoft text-rose2' }
      : { text: '피하는 기운', className: 'bg-parchment text-inkfaint' };
  }
  return null;
}

export function ElementFillChart({ scene, className }) {
  if (!scene?.saju) return null;
  const rows = ELEMENT_ROWS.map(({ key, ko }) => ({
    key,
    ko,
    sajuCount: countOf(scene.saju[key]),
    nameCount: countOf(scene.elements?.[key]),
    isYongshin: scene.yongshin === key,
    isGishin: scene.gishin === key,
  }));
  const positive = countOf(scene.positive);
  const negative = countOf(scene.negative);
  const label = `사주 기운과 이름 기운 — ${rows
    .map((row) => `${row.ko} 사주 ${row.sajuCount} 이름 ${row.nameCount}`)
    .join(', ')}`;

  return (
    <figure className={cx('rounded-3xl border border-hairline bg-card p-5 text-left', className)} role="img" aria-label={label}>
      <p className="text-2xs font-bold uppercase tracking-[0.12em] text-inkfaint">사주 기운 × 이름 기운</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => {
          const badge = rowBadge(row);
          return (
            <div key={row.key} className={cx('flex flex-wrap items-center gap-x-2 gap-y-1', `cr-v3-el-${row.key}`)}>
              <span className="inline-grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--el-bg)] text-2xs font-bold text-[var(--el)]">
                {row.ko}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                {Array.from({ length: Math.min(row.sajuCount, MAX_UNITS_PER_GROUP) }).map((_, index) => (
                  <Unit key={`saju-${index}`} element={row.key} kind="saju" />
                ))}
                {row.nameCount > 0 ? (
                  <>
                    <span className="px-0.5 text-2xs font-black text-inkfaint" aria-hidden="true">+</span>
                    {Array.from({ length: Math.min(row.nameCount, MAX_UNITS_PER_GROUP) }).map((_, index) => (
                      <Unit key={`name-${index}`} element={row.key} kind="name" />
                    ))}
                  </>
                ) : null}
                {row.sajuCount === 0 && row.nameCount === 0 ? (
                  <span className="text-2xs text-inkfaint">—</span>
                ) : null}
              </span>
              <span className="w-10 flex-none text-right text-xs text-inksoft" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {row.sajuCount}
                {row.nameCount > 0 ? <b className="text-ink"> +{row.nameCount}</b> : null}
              </span>
              {badge ? (
                <span className={cx('rounded-full px-2 py-0.5 text-2xs font-bold', badge.className)}>
                  {badge.text}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 border-t border-hairline pt-3">
        <p className="text-2xs leading-relaxed text-inkfaint">
          옅은 조각은 타고난 사주 기운(여덟 글자), 테두리 있는 조각은 이름이 더하는 기운(한자 자원)이에요.
        </p>
        {positive + negative > 0 ? (
          <p className="mt-1.5 text-2xs leading-relaxed text-inkfaint" style={{ fontVariantNumeric: 'tabular-nums' }}>
            이름 소리의 음양 — 음 {negative} · 양 {positive} (한글 기준)
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
