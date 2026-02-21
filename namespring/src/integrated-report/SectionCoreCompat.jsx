import React from 'react';
import {
  ELEMENT_GENERATES, ELEMENT_CONTROLS,
  elShort, elementBadgeClass, scoreBadgeColor,
} from './constants';

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

function ElementRelationVisual({ yongshinEl, nameElements }) {
  if (!yongshinEl) return null;

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap py-3">
      <div className={`rounded-xl border px-3 py-2 text-center ${elementBadgeClass(yongshinEl)}`}>
        <p className="text-[10px] font-black mb-0.5">용신 (필요한 기운)</p>
        <p className="text-lg font-black">{elShort(yongshinEl)}</p>
      </div>
      <svg viewBox="0 0 24 12" fill="none" className="w-8 h-4 text-[var(--ns-muted)]" aria-hidden="true">
        <path d="M0 6H20M20 6L15 1M20 6L15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex gap-1.5">
        {nameElements.length > 0 ? nameElements.map((el, i) => {
          const isMatch = el === yongshinEl;
          const generates = ELEMENT_GENERATES[el] === yongshinEl;
          const controls = ELEMENT_CONTROLS[el] === yongshinEl;
          const ringClass = isMatch ? 'ring-2 ring-emerald-400'
            : generates ? 'ring-1 ring-blue-300'
            : controls ? 'ring-1 ring-rose-300'
            : '';
          return (
            <div key={`name-el-${i}`} className={`rounded-xl border px-2.5 py-2 text-center ${elementBadgeClass(el)} ${ringClass}`}>
              <p className="text-[10px] font-black mb-0.5">이름 {i + 1}자</p>
              <p className="text-lg font-black">{elShort(el)}</p>
              {isMatch ? <p className="text-[9px] font-bold mt-0.5">일치</p>
                : generates ? <p className="text-[9px] font-bold mt-0.5">상생</p>
                : controls ? <p className="text-[9px] font-bold text-rose-600 mt-0.5">상극</p>
                : null}
            </div>
          );
        }) : (
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-center">
            <p className="text-sm text-[var(--ns-muted)]">이름 오행 정보 없음</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SectionCoreCompat({
  yongshinEl, heeshinEl, gishinEl,
  nameElements, yongshinNameRelation,
  harmonySummary, subScores,
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="이름 오행이 사주의 용신과 어떤 관계인지 한눈에 보여드려요.">
        이름과 사주, 어떤 관계일까요?
      </SectionTitle>

      {/* 용신↔이름 오행 시각화 */}
      <ElementRelationVisual yongshinEl={yongshinEl} nameElements={nameElements} />

      {/* 항목별 소점수 뱃지 */}
      {subScores && subScores.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-1 mb-3">
          {subScores.map((item, i) => (
            <span
              key={`sub-${i}`}
              className={`px-2.5 py-1 rounded-full border text-xs font-black ${scoreBadgeColor(item.value)}`}
            >
              {item.label} {item.value}
            </span>
          ))}
        </div>
      ) : null}

      {/* 조화 요약 */}
      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5 mt-2">
        <p className="text-sm leading-relaxed break-keep text-[var(--ns-text)]">
          {harmonySummary || '이름과 사주의 관계를 분석 중입니다.'}
        </p>
      </div>

      {/* 용신-이름 관계 상세 */}
      {yongshinNameRelation && yongshinNameRelation.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {yongshinNameRelation.map((text, i) => (
            <p key={`yong-rel-${i}`} className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep pl-3 border-l-2 border-[var(--ns-border)]">
              {text}
            </p>
          ))}
        </div>
      ) : null}

      {/* 용신/희신/기신 뱃지 */}
      <div className="flex flex-wrap gap-2 mt-3">
        {yongshinEl ? (
          <span className={`px-2.5 py-1 rounded-full border text-xs font-black ${elementBadgeClass(yongshinEl)}`}>
            용신 {elShort(yongshinEl)}
          </span>
        ) : null}
        {heeshinEl ? (
          <span className={`px-2.5 py-1 rounded-full border text-xs font-black ${elementBadgeClass(heeshinEl)}`}>
            희신 {elShort(heeshinEl)}
          </span>
        ) : null}
        {gishinEl ? (
          <span className={`px-2.5 py-1 rounded-full border text-xs font-black ${elementBadgeClass(gishinEl)}`}>
            기신 {elShort(gishinEl)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
