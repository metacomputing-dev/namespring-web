import React from 'react';
import { elShort, elementBadgeClass } from './constants';

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

function InsightCard({ icon, text, tone = 'default' }) {
  const toneClass =
    tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'caution' ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'info' ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-text)]';

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <div className="flex items-start gap-2">
        {icon ? <span className="shrink-0 text-base leading-none mt-0.5">{icon}</span> : null}
        <p className="text-sm leading-relaxed break-keep whitespace-normal">{text}</p>
      </div>
    </div>
  );
}

function PronunciationRelationBadge({ relation }) {
  const colorMap = {
    '상생': 'text-emerald-600',
    '비화': 'text-blue-600',
    '역생': 'text-sky-600',
    '상극': 'text-rose-600',
    '역극': 'text-rose-500',
    '간접': 'text-[var(--ns-muted)]',
  };
  return (
    <span className={`text-[10px] font-black ${colorMap[relation] || 'text-[var(--ns-muted)]'}`}>
      {relation}
    </span>
  );
}

export default function SectionCombinedInsights({ insights, pronunciationFlow }) {
  const synergies = insights?.keySynergyStrengths || [];
  const cautions = insights?.keyCautionPoints || [];
  const hasPronunciation = pronunciationFlow && pronunciationFlow.elements.length >= 2;

  if (synergies.length === 0 && cautions.length === 0 && !hasPronunciation) return null;

  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="이름과 사주의 시너지, 발음 오행 흐름, 주의할 점을 한눈에 정리했어요.">
        종합 인사이트
      </SectionTitle>

      {/* 시너지 포인트 */}
      {synergies.length > 0 ? (
        <div className="mb-4">
          <p className="text-xs font-black text-emerald-700 mb-2">시너지 포인트</p>
          <div className="space-y-2">
            {synergies.map((text, i) => (
              <InsightCard key={`syn-${i}`} text={text} tone="good" />
            ))}
          </div>
        </div>
      ) : null}

      {/* 발음 오행 흐름 */}
      {hasPronunciation ? (
        <div className="mb-4">
          <p className="text-xs font-black text-blue-700 mb-2">발음 오행 흐름</p>
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3">
            {/* 초성 흐름 시각화 */}
            <div className="flex items-center justify-center gap-1 flex-wrap mb-2">
              {pronunciationFlow.elements.map((el, i) => (
                <React.Fragment key={`pron-${i}`}>
                  <div className={`rounded-lg border px-2 py-1 text-center ${elementBadgeClass(el.element)}`}>
                    <p className="text-xs font-black">{el.onset || el.hangul}</p>
                    <p className="text-[10px]">{elShort(el.element)}</p>
                  </div>
                  {i < pronunciationFlow.pairRelations.length ? (
                    <div className="flex flex-col items-center">
                      <svg viewBox="0 0 16 8" fill="none" className="w-4 h-2 text-[var(--ns-muted)]" aria-hidden="true">
                        <path d="M0 4H12M12 4L9 1M12 4L9 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <PronunciationRelationBadge relation={pronunciationFlow.pairRelations[i].relation} />
                    </div>
                  ) : null}
                </React.Fragment>
              ))}
            </div>
            <p className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep text-center">
              {pronunciationFlow.summary}
            </p>
          </div>
        </div>
      ) : null}

      {/* 주의할 점 */}
      {cautions.length > 0 ? (
        <div>
          <p className="text-xs font-black text-amber-700 mb-2">주의할 점</p>
          <div className="space-y-2">
            {cautions.map((text, i) => (
              <InsightCard key={`cau-${i}`} text={text} tone="caution" />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
