import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { ExpertOnly } from '../../../components/ui/TierToggle.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const GRADE_CHIP = {
  favorable: 'bg-sagesoft text-sage',
  adverse: 'bg-rosesoft text-rose2',
};

export function FramesSection({ frames }) {
  if (!frames) return null;
  return (
    <RevealOnScroll as="section" id="sec-frames" className="scroll-mt-32 pt-14">
      <div className="rounded-[2rem] border border-hairline bg-parchment/60 p-6 sm:p-8">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">이름 분석 02</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">획수(수리) 분석</h2>
        <p className="mt-1 text-xs text-inkfaint">획수 조합으로 인생 네 시기의 흐름을 보는 수리사격이에요</p>
        {frames.charStrokes ? (
          <p className="mt-5 rounded-2xl bg-card/70 px-4 py-2.5 text-center text-xs text-inksoft">
            원획 기준{' '}
            <b>{frames.charStrokes.map((char) => `${char.hanja} ${char.strokes}획`).join(' · ')}</b>
            {' '}— 네 가지 조합으로 네 기둥을 세워요
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {frames.frames.map((frame) => (
            <div key={frame.type} className="rounded-3xl border border-hairline bg-card p-5">
              <div className="flex items-baseline justify-between">
                <b className="text-smd">{frame.label}</b>
                <span className="text-xs text-inkfaint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <b className="text-inksoft">{frame.strokeSum ?? '—'}수</b>
                </span>
              </div>
              {frame.period ? <p className="mt-0.5 text-xs text-inkfaint">{frame.period}의 흐름</p> : null}
              {frame.luckyLevelText ? (
                <span className={cx(
                  'mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold',
                  GRADE_CHIP[frame.grade] || 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]',
                )}
                >
                  {frame.luckyLevelText}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-6 max-w-[62ch] space-y-4 text-smd leading-relaxed text-inksoft">
          {frames.frames.map((frame) => (
            frame.summary ? (
              <div key={`${frame.type}-text`}>
                <h3 className="text-xs font-bold tracking-[0.04em] text-inkfaint">
                  {frame.label}{frame.title ? ` · ${frame.title}` : ''}
                </h3>
                <p className="mt-1">{frame.summary}</p>
                <ExpertOnly>
                  {frame.lifePeriodInfluence ? (
                    <p className="mt-1 text-sm text-inkfaint">{frame.lifePeriodInfluence}</p>
                  ) : null}
                  {frame.cautionPoints ? (
                    <p className="mt-1 text-sm text-inkfaint">{frame.cautionPoints}</p>
                  ) : null}
                </ExpertOnly>
              </div>
            ) : null
          ))}
        </div>
        <p className="mt-4 text-xs text-inkfaint">
          획수 풀이는 현행 엔진 기준이에요. 자세한 기준은 맨 아래 '근거와 기준'에서 확인할 수 있어요.
        </p>
      </div>
    </RevealOnScroll>
  );
}
