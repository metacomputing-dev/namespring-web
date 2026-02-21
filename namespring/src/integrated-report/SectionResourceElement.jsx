import React from 'react';
import { elShort, elFull, elementBadgeClass } from './constants';

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

function VerdictBadge({ verdict, tone }) {
  const toneClass =
    tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'caution' ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-black ${toneClass}`}>
      {verdict}
    </span>
  );
}

export default function SectionResourceElement({ resourceElementDetails }) {
  if (!resourceElementDetails || resourceElementDetails.length === 0) return null;

  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="각 한자의 고유 오행이 사주와 어떻게 맞물리는지 보여드려요.">
        한자 하나하나의 기운
      </SectionTitle>

      <div className="space-y-2.5">
        {resourceElementDetails.map((item, i) => (
          <div
            key={`res-el-${i}`}
            className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3.5 py-3"
          >
            {/* 헤더: 한자, 획수, 음양 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[var(--ns-accent-text)]">
                  {item.hanja || '?'}
                </span>
                <span className="text-sm text-[var(--ns-muted)]">
                  ({item.hangul})
                </span>
                <span className="text-xs text-[var(--ns-muted)]">
                  {item.strokes}획 · {item.polarity === 'yang' || item.polarity === '양' || item.polarity === 'positive' ? '양' : '음'}
                </span>
              </div>
              <VerdictBadge verdict={item.verdict} tone={item.tone} />
            </div>

            {/* 오행 뱃지 행 */}
            <div className="flex items-center gap-2 mb-2">
              {item.resourceEl ? (
                <span className={`px-2 py-0.5 rounded-full border text-xs font-black ${elementBadgeClass(item.resourceEl)}`}>
                  자원오행 {elShort(item.resourceEl)}
                </span>
              ) : null}
              {item.strokeEl ? (
                <span className={`px-2 py-0.5 rounded-full border text-xs font-black ${elementBadgeClass(item.strokeEl)}`}>
                  획수오행 {elShort(item.strokeEl)}
                </span>
              ) : null}
              {item.elMatch === false ? (
                <span className="text-[10px] text-[var(--ns-muted)]">(불일치)</span>
              ) : item.elMatch === true ? (
                <span className="text-[10px] text-emerald-600">(일치)</span>
              ) : null}
            </div>

            {/* 서술문 */}
            <p className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep pl-3 border-l-2 border-[var(--ns-border)]">
              {item.narrative}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
