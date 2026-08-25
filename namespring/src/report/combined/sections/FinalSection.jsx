import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { ExpertOnly, TierText } from '../../../components/ui/TierToggle.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const STATE_DOT = {
  good: 'bg-sage',
  mixed: 'bg-amber2',
  bad: 'bg-rose2',
};

function partDetailBits(part) {
  const bits = [];
  if (part.polarity !== null && part.polarity !== undefined) bits.push(`음양 ${part.polarity}`);
  if (part.element !== null && part.element !== undefined) bits.push(`오행 ${part.element}`);
  if (part.luck !== null && part.luck !== undefined) bits.push(`길흉 ${part.luck}`);
  return bits.join(' · ');
}

function NameScorePanel({ nameScores }) {
  if (!nameScores) return null;
  return (
    <div className="mt-6 rounded-[2rem] bg-bezel p-1.5 shadow-[var(--shadow-float)]">
      <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[var(--shadow-inset-card)] sm:p-7">
        <div className="flex flex-wrap items-center gap-5">
          <span
            className="cr-v3-ring grid h-16 w-16 flex-none place-items-center rounded-full"
            style={{ '--score': nameScores.total }}
            role="img"
            aria-label={`이름 점수 ${nameScores.total}점`}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-full bg-cream text-sm font-bold text-ink"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {nameScores.total}
            </span>
          </span>
          <div>
            <p className="text-xs font-bold text-inkfaint">이름 점수</p>
            <b className="mt-0.5 block font-serif text-lg text-ink">{nameScores.grade}</b>
            <p className="mt-0.5 text-xs text-inkfaint">사주 궁합을 섞지 않은, 이름 자체의 평가 점수예요.</p>
          </div>
        </div>
        {nameScores.parts.length ? (
          <ExpertOnly>
            <div className="mt-5 space-y-2.5 border-t border-hairline pt-4">
              {nameScores.parts.map((part) => (
                <div key={part.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-xs">
                  <span className="font-bold text-inkfaint">{part.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-hairline">
                    <span
                      className="block h-full rounded-full bg-sage"
                      style={{ width: `${Math.max(0, Math.min(100, part.final ?? 0))}%` }}
                    />
                  </span>
                  <b className="text-right text-inksoft" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {part.final ?? '—'}
                  </b>
                </div>
              ))}
              <p className="pt-1 text-2xs leading-relaxed text-inkfaint">
                {nameScores.parts
                  .map((part) => `${part.label} ${partDetailBits(part)}`)
                  .join(' / ')}
              </p>
            </div>
          </ExpertOnly>
        ) : null}
      </div>
    </div>
  );
}

export function FinalSection({ final, nameScores, onShare, onRecommend }) {
  const closing = final.closing;
  return (
    <RevealOnScroll as="section" id="sec-final" className="scroll-mt-32 pt-14">
      <div className="px-1">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">최종 결과</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">종합 평가</h2>
      </div>

      <NameScorePanel nameScores={nameScores} />

      <div className="mt-6 space-y-3">
        {final.recap.map((row) => (
          <div key={row.key} className="flex items-start gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
            <span className={cx('mt-1.5 h-2.5 w-2.5 flex-none rounded-full', STATE_DOT[row.state] || STATE_DOT.mixed)} />
            <p className="text-smd leading-relaxed text-inksoft">
              <b className="text-ink">{row.label}</b>
              {row.stateLabel ? ` — ${row.stateLabel}. ` : ' — '}
              {row.sentence || ''}
            </p>
          </div>
        ))}
      </div>

      {closing.plain || closing.expert || closing.summary ? (
        <blockquote className="mt-8 border-l-[3px] border-sage pl-5 font-serif text-lg leading-relaxed text-ink">
          <TierText
            as="p"
            plain={closing.plain || closing.summary}
            expert={closing.expert || closing.summary}
          />
        </blockquote>
      ) : null}

      {final.guide.strengths.length || final.guide.cautions.length ? (
        <div className="mt-8 rounded-3xl bg-sagesoft p-6">
          <h3 className="mb-3 text-xs font-bold text-sage">생활에서 이렇게 살려요</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-inksoft">
            {final.guide.strengths.map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
            {final.guide.cautions.map((item) => (
              <li key={item.signal}>
                {item.signal}
                {item.response ? ` — ${item.response}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3" data-pdf-exclude="true">
        {final.cta === 'share' ? (
          <button type="button" className="ns-cta-pill ns-cta-pill--primary" onClick={onShare}>
            이 결과 공유하기
            <span className="ns-cta-pill__puck" aria-hidden="true">→</span>
          </button>
        ) : (
          <button type="button" className="ns-cta-pill ns-cta-pill--primary" onClick={onRecommend}>
            어울리는 이름 찾아보기
            <span className="ns-cta-pill__puck" aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </RevealOnScroll>
  );
}
