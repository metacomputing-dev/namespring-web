import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import {
  asArray,
  buildCategoryItems,
  buildPeriodOptions,
  normalizeText,
} from '../../fortune/fortune-periods';

// Premium body for the combined report v3. Same data contract as the legacy
// premium ledger (?reportLegacy=1 keeps its own copy): previews come from the
// engine's yearly fortune cells and the name-compatibility lines; the thread
// copy below is the reviewed legacy wording, not new narrative.

function firstSentence(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const match = text.match(/^.+?[.!?。！？]|^.+?요\.|^.+?다\./u);
  return match ? match[0].trim() : text;
}

function categorySummary(categoryItems, id, fallback) {
  const item = asArray(categoryItems).find((category) => category?.id === id);
  return normalizeText(item?.summary) || fallback;
}

function buildThreads(fortuneReport) {
  const periods = buildPeriodOptions(fortuneReport);
  const yearPeriod = periods.find((option) => option.key === 'thisYear') || periods[0] || null;
  const categoryItems = yearPeriod ? buildCategoryItems(yearPeriod) : [];
  const periodLabel = yearPeriod?.periodLabel || '올해';
  const periodSummary = categorySummary(categoryItems, 'overall', '');

  const details = asArray(fortuneReport?.nameCompatibility?.details);
  const nameDetail = details.find((line) => normalizeText(line) && String(line).includes('용신'))
    || details.slice(1).find((line) => normalizeText(line))
    || firstSentence(fortuneReport?.nameCompatibility?.summary)
    || '이름과 사주의 조화가 이어지는 지점을 더 자세히 읽을 수 있습니다.';

  return [
    {
      key: 'future-flow',
      title: '숨겨진 미래 흐름',
      preview: periodSummary || `${periodLabel}의 흐름은 짧은 요약만으로는 다 읽히지 않습니다.`,
      detail: `${periodLabel} 안에서 반복되는 리듬을 관계, 일, 선택의 방향으로 나누어 이어 읽습니다.`,
    },
    {
      key: 'name-combination',
      title: '가장 잘 맞는 이름 조합',
      preview: nameDetail,
      detail: '추천 이름의 음양, 오행, 수리 흐름을 한 문장씩 연결해 왜 이 조합이 어울리는지 정리합니다.',
    },
    {
      key: 'relationship-money',
      title: '관계와 재물의 심화 해석',
      preview: categorySummary(categoryItems, 'romance', '관계 흐름은 마음이 먼저 움직이는 지점부터 천천히 읽습니다.'),
      detail: categorySummary(categoryItems, 'wealth', '재물 흐름은 무리한 확장보다 지켜야 할 리듬을 중심으로 봅니다.'),
    },
  ];
}

export function PremiumSection({ fortuneReport, isUnlocked, onOpenPremium }) {
  if (!fortuneReport) return null;
  const threads = buildThreads(fortuneReport);
  return (
    <RevealOnScroll as="section" id="sec-premium" className="scroll-mt-32 pt-14">
      <div className="rounded-[2rem] bg-bezel p-1.5 shadow-[var(--shadow-float)]">
        <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[var(--shadow-inset-card)] sm:p-8">
          <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">완성 리포트</p>
          <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">내 해석을 완성하는 부분</h2>
          <p className="mt-1 max-w-[52ch] text-xs text-inkfaint">
            무료 결과가 방향을 보여준다면, 완성 리포트는 왜 그 이름과 흐름이 나에게 맞는지 문장으로 이어 줍니다.
          </p>

          <div className="mt-6 space-y-3">
            {threads.map((thread) => (
              <article key={thread.key} className="rounded-3xl border border-hairline bg-parchment/60 p-5">
                <h3 className="text-smd font-bold text-ink">{thread.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-inksoft">{thread.preview}</p>
                {isUnlocked ? (
                  <p className="mt-2 text-sm leading-relaxed text-inksoft">{thread.detail}</p>
                ) : (
                  <div className="mt-3 space-y-1.5" aria-hidden="true">
                    <span className="block h-2.5 w-4/5 rounded-full bg-hairline" />
                    <span className="block h-2.5 w-3/5 rounded-full bg-hairline" />
                  </div>
                )}
              </article>
            ))}
          </div>

          {isUnlocked ? (
            <p className="mt-5 text-sm leading-relaxed text-inksoft">
              결제가 확인되어 심화 리포트 영역이 열렸습니다. PDF 저장과 공유 링크로 이 흐름을 다시 열어볼 수 있습니다.
            </p>
          ) : (
            <div className="mt-6 rounded-3xl bg-sagesoft p-5" role="note">
              <p className="text-xs font-bold text-sage">이 해석이 나에게 닿는 이유</p>
              <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed text-inksoft">
                지금 보신 결과가 방향을 잡아 주었다면, 완성 리포트는 그 방향이 왜 당신의 이름과 사주에
                닿는지 차분히 이어 줍니다. 이름 조합의 이유, 앞으로의 관계와 재물 흐름, 다시 읽을 수
                있는 PDF까지 한 번에 정리됩니다.
              </p>
              {typeof onOpenPremium === 'function' ? (
                <button
                  type="button"
                  onClick={onOpenPremium}
                  className="ns-cta-pill ns-cta-pill--primary mt-4"
                  data-pdf-exclude="true"
                >
                  내 해석 완성하기
                  <span className="ns-cta-pill__puck" aria-hidden="true">→</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </RevealOnScroll>
  );
}
