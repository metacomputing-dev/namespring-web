import React from 'react';
import { V3Section } from './V3Section.jsx';
import { RecapList } from '../../../components/report/ReportV3Bits.jsx';
import { TierText } from '../../../components/ui/TierToggle.jsx';

export function FinalSection({ final, isPremiumUnlocked, onShare, onRecommend, onOpenPremium }) {
  const closing = final.closing;
  return (
    <V3Section
      id="sec-final"
      kicker="Verdict"
      title="종합 평가"
      dek="앞의 세 갈래 판정을 한 자리에 모았습니다."
    >
      <RecapList rows={final.recap.map((row) => ({ ...row, key: row.key }))} />

      {closing.plain || closing.expert || closing.summary ? (
        <blockquote className="ns-close-quote mt-6">
          <TierText
            as="p"
            plain={closing.plain || closing.summary}
            expert={closing.expert || closing.summary}
          />
        </blockquote>
      ) : null}

      {final.guide.strengths.length || final.guide.cautions.length ? (
        <div className="cr-v3-guide-panel mt-6">
          {final.guide.strengths.length ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.1em]">기대할 수 있는 힘</h3>
              <ul className="mt-1.5 space-y-1 text-sm">
                {final.guide.strengths.map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {final.guide.cautions.length ? (
            <div className={final.guide.strengths.length ? 'mt-4' : ''}>
              <h3 className="text-xs font-bold uppercase tracking-[0.1em]">살펴 둘 신호</h3>
              <ul className="mt-1.5 space-y-1 text-sm">
                {final.guide.cautions.map((item) => (
                  <li key={item.signal}>
                    {item.signal}
                    {item.response ? ` — ${item.response}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3" data-pdf-exclude="true">
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
    </V3Section>
  );
}
