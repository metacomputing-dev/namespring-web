import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { TierText } from '../../../components/ui/TierToggle.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const STATE_DOT = {
  good: 'bg-sage',
  mixed: 'bg-amber2',
  bad: 'bg-rose2',
};

export function FinalSection({ final, isPremiumUnlocked, onShare, onRecommend, onOpenPremium }) {
  const closing = final.closing;
  return (
    <RevealOnScroll as="section" id="sec-final" className="scroll-mt-32 pt-14">
      <div className="px-1">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">최종 결과</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">종합 평가</h2>
      </div>

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
        {!isPremiumUnlocked && typeof onOpenPremium === 'function' ? (
          <button type="button" className="ns-cta-pill ns-cta-pill--ghost" onClick={onOpenPremium}>
            통합 리포트 완성하기
          </button>
        ) : null}
      </div>
    </RevealOnScroll>
  );
}
