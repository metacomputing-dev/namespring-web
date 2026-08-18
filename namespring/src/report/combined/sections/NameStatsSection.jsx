import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';

export function NameStatsSection({ stats }) {
  if (!stats) return null;
  const items = [];
  if (stats.popularityRank !== null) {
    items.push({ label: '출생신고 인기', value: `${stats.popularityRank.toLocaleString()}위` });
  }
  if (stats.nameGender) {
    items.push({ label: '성별 경향', value: stats.nameGender === 'male' ? '남성 쪽' : '여성 쪽' });
  } else if (stats.maleRatio !== null) {
    const malePercent = Math.round(stats.maleRatio * 100);
    items.push({ label: '남녀 비율', value: `${malePercent}:${100 - malePercent}` });
  }
  if (!items.length) return null;
  return (
    <RevealOnScroll as="section" id="sec-stats" className="scroll-mt-32 pt-14">
      <div className="mb-4 px-1">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">참고 정보</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">이름 통계</h2>
      </div>
      <div className="flex flex-wrap items-stretch gap-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-[8rem] flex-1 rounded-3xl border border-hairline bg-card p-5 text-center">
            <p className="text-xs text-inkfaint">{item.label}</p>
            <b className="mt-1 block text-xl" style={{ fontVariantNumeric: 'tabular-nums' }}>{item.value}</b>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-2xs text-inkfaint">이름 통계는 참고 재미 요소예요.</p>
    </RevealOnScroll>
  );
}
