import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { ExpertOnly } from '../../../components/ui/TierToggle.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const GRADE_CHIP = {
  favorable: 'bg-sagesoft text-sage',
  adverse: 'bg-rosesoft text-rose2',
};

function DetailMetaRow({ term, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm leading-relaxed">
      <dt className="w-16 flex-none font-bold text-inkfaint">{term}</dt>
      <dd className="text-inksoft">{value}</dd>
    </div>
  );
}

function FrameDetail({ frame }) {
  if (!frame.detail) return null;
  const detail = frame.detail;
  const metaRows = [
    { term: '성향', value: detail.personality.length ? detail.personality.join(', ') : null },
    { term: '적성 분야', value: detail.careers.length ? detail.careers.join(', ') : null },
    { term: '기회 영역', value: detail.opportunity },
    { term: '도전 구간', value: detail.challenge },
    { term: '특징', value: detail.special },
  ].filter((row) => row.value);
  return (
    <details className="cr-v3-disclosure mt-3 rounded-2xl border border-hairline bg-card/70 px-4 py-3">
      <summary>
        <span className="text-xs font-bold text-inksoft">자세한 풀이 보기</span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-hairline pt-3">
        {detail.explanation ? (
          <p className="text-sm leading-relaxed text-inksoft">{detail.explanation}</p>
        ) : null}
        {detail.positives ? (
          <div className="rounded-2xl bg-sagesoft px-4 py-3">
            <b className="block text-2xs font-bold uppercase tracking-[0.1em] text-sage">강점</b>
            <p className="mt-1 text-sm leading-relaxed text-inksoft">{detail.positives}</p>
          </div>
        ) : null}
        {detail.cautions ? (
          <div className="rounded-2xl bg-rosesoft px-4 py-3">
            <b className="block text-2xs font-bold uppercase tracking-[0.1em] text-rose2">유의점</b>
            <p className="mt-1 text-sm leading-relaxed text-inksoft">{detail.cautions}</p>
          </div>
        ) : null}
        {metaRows.length ? (
          <dl className="space-y-1.5">
            {metaRows.map((row) => (
              <DetailMetaRow key={row.term} term={row.term} value={row.value} />
            ))}
          </dl>
        ) : null}
      </div>
    </details>
  );
}

export function FramesSection({ frames }) {
  if (!frames) return null;
  const scoreChips = [
    frames.scores?.luck !== null && frames.scores?.luck !== undefined
      ? `길흉 ${frames.scores.luck}/100` : null,
    frames.scores?.element !== null && frames.scores?.element !== undefined
      ? `오행 ${frames.scores.element}/100` : null,
    frames.scores?.final !== null && frames.scores?.final !== undefined
      ? `수리 종합 ${frames.scores.final}/100` : null,
  ].filter(Boolean);
  return (
    <RevealOnScroll as="section" id="sec-frames" className="scroll-mt-32 pt-14">
      <div className="rounded-[2rem] border border-hairline bg-parchment/60 p-6 sm:p-8">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">이름 분석 02</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">획수 분석</h2>
        <p className="mt-1 text-xs text-inkfaint">획수 조합으로 인생 네 시기의 흐름을 보는 수리사격이에요</p>
        {scoreChips.length ? (
          <ExpertOnly>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {scoreChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-hairline bg-card px-3 py-1 text-2xs font-bold text-inksoft"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </ExpertOnly>
        ) : null}
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {frame.luckyLevelText ? (
                  <span className={cx(
                    'inline-block rounded-full px-3 py-1 text-xs font-bold',
                    GRADE_CHIP[frame.grade] || 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]',
                  )}
                  >
                    {frame.luckyLevelText}
                  </span>
                ) : null}
                <ExpertOnly>
                  {frame.elementKo ? (
                    <span className={cx(
                      'inline-block rounded-full px-2.5 py-1 text-xs font-bold',
                      `cr-v3-el-${frame.element || 'neutral'}`,
                      'bg-[var(--el-bg)] text-[var(--el)]',
                    )}
                    >
                      {frame.elementKo}
                    </span>
                  ) : null}
                  {frame.polarityKo ? (
                    <span className="inline-block rounded-full bg-parchment px-2.5 py-1 text-xs font-bold text-inksoft">
                      {frame.polarityKo}
                    </span>
                  ) : null}
                </ExpertOnly>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 max-w-[62ch] space-y-4 text-smd leading-relaxed text-inksoft">
          {frames.frames.map((frame) => (
            frame.summary ? (
              <div key={`${frame.type}-text`}>
                <h3 className="text-xs font-bold tracking-[0.04em] text-inkfaint">
                  {frame.label}{frame.period ? ` (${frame.period})` : ''}{frame.title ? ` · ${frame.title}` : ''}
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
                <FrameDetail frame={frame} />
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
