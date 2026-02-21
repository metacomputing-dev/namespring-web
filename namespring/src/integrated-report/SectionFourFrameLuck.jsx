import React from 'react';
import {
  elShort, elementBadgeClass,
  luckyLevelColor, luckyLevelBgColor,
} from './constants';
import CollapsibleDetail from './CollapsibleDetail';

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{children}</h3>
      {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-0.5 break-keep">{subtitle}</p> : null}
    </div>
  );
}

function FrameMeaningDetail({ meaning, fullHangul }) {
  if (!meaning) return null;

  const hasContent = meaning.summary || meaning.personality_traits?.length > 0
    || meaning.suitable_career?.length > 0 || meaning.caution_points
    || meaning.life_period_influence;

  if (!hasContent) return null;

  const r = (text) => replaceName(text, fullHangul);

  return (
    <CollapsibleDetail label="수리 풀이 보기">
      {meaning.summary ? (
        <p className="text-sm text-[var(--ns-text)] leading-relaxed break-keep">{r(meaning.summary)}</p>
      ) : null}

      {meaning.personality_traits?.length > 0 ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">성격 특성</p>
          <div className="flex flex-wrap gap-1">
            {meaning.personality_traits.map((trait, i) => (
              <span key={`pt-${i}`} className="px-2 py-0.5 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[11px] text-[var(--ns-text)]">
                {trait}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {meaning.suitable_career?.length > 0 ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">적합한 분야</p>
          <div className="flex flex-wrap gap-1">
            {meaning.suitable_career.map((career, i) => (
              <span key={`sc-${i}`} className="px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-[11px] text-blue-700">
                {career}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {meaning.positive_aspects ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">긍정적 측면</p>
          <p className="text-xs text-[var(--ns-text)] leading-relaxed break-keep">{r(meaning.positive_aspects)}</p>
        </div>
      ) : null}

      {meaning.caution_points ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">주의 사항</p>
          <p className="text-xs text-amber-800 leading-relaxed break-keep">{r(meaning.caution_points)}</p>
        </div>
      ) : null}

      {meaning.life_period_influence ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">시기별 영향</p>
          <p className="text-xs text-[var(--ns-text)] leading-relaxed break-keep">{r(meaning.life_period_influence)}</p>
        </div>
      ) : null}

      {meaning.challenge_period ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">도전 시기</p>
          <p className="text-xs text-[var(--ns-text)] leading-relaxed break-keep">{r(meaning.challenge_period)}</p>
        </div>
      ) : null}

      {meaning.opportunity_area ? (
        <div>
          <p className="text-[11px] font-black text-[var(--ns-muted)] mb-0.5">기회 영역</p>
          <p className="text-xs text-[var(--ns-text)] leading-relaxed break-keep">{r(meaning.opportunity_area)}</p>
        </div>
      ) : null}
    </CollapsibleDetail>
  );
}

function replaceName(text, name) {
  if (!text || !name) return text || '';
  return text.replace(/\[성함\]/g, name);
}

export default function SectionFourFrameLuck({ fourFrameAnalysis, fullHangul }) {
  if (!fourFrameAnalysis) return null;
  const { frames, flowNarrative } = fourFrameAnalysis;

  return (
    <section className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
      <SectionTitle subtitle="원격→형격→이격→정격, 인생 단계별 수리 운세에요.">
        획수가 그리는 운세 흐름
      </SectionTitle>

      {/* 4격 타임라인 */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {frames.map((frame, i) => (
          <div
            key={`ff-${frame.type}`}
            className={`rounded-xl border px-2 py-2.5 text-center ${luckyLevelBgColor(frame.luckyLevel)}`}
          >
            <p className="text-[10px] font-black text-[var(--ns-muted)] mb-0.5">
              {frame.label}
            </p>
            <p className="text-[10px] text-[var(--ns-muted)]">{frame.period}</p>
            <p className="text-lg font-black mt-1">{frame.strokeSum}</p>
            <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[10px] font-black mt-1 ${elementBadgeClass(frame.element)}`}>
              {elShort(frame.element)}
            </span>
            <p className={`text-xs font-black mt-1 ${luckyLevelColor(frame.luckyLevel)}`}>
              {frame.luckyLabel}
            </p>
            {frame.yongshinTone === 'good' ? (
              <p className="text-[9px] font-bold text-emerald-600 mt-0.5">용신 부합</p>
            ) : frame.yongshinTone === 'caution' ? (
              <p className="text-[9px] font-bold text-rose-600 mt-0.5">용신 상극</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* 화살표 연결선 */}
      <div className="flex items-center justify-center gap-1 mb-3 text-[var(--ns-muted)]">
        {frames.map((frame, i) => (
          <React.Fragment key={`arrow-${i}`}>
            <span className="text-[10px] font-black">{frame.label}</span>
            {i < frames.length - 1 ? (
              <svg viewBox="0 0 16 8" fill="none" className="w-4 h-2" aria-hidden="true">
                <path d="M0 4H12M12 4L9 1M12 4L9 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {/* 흐름 서술문 */}
      {flowNarrative ? (
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2.5">
          <p className="text-sm leading-relaxed break-keep text-[var(--ns-text)]">
            {flowNarrative}
          </p>
        </div>
      ) : null}

      {/* 격별 상세 풀이 (접이식) */}
      {frames.some(f => f.meaning) ? (
        <div className="mt-3 space-y-2">
          {frames.map(frame => {
            if (!frame.meaning) return null;
            return (
              <div key={`ff-detail-${frame.type}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                <p className="text-xs font-black text-[var(--ns-accent-text)]">
                  {frame.label} ({frame.period}) — {frame.strokeSum}수
                </p>
                <FrameMeaningDetail meaning={frame.meaning} fullHangul={fullHangul} />
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
