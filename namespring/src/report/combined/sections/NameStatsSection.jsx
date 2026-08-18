import React from 'react';
import { V3Section } from './V3Section.jsx';
import { StatTiles } from '../../../components/report/ReportV3Bits.jsx';

export function NameStatsSection({ stats }) {
  if (!stats) return null;
  const items = [];
  if (stats.popularityRank !== null) {
    items.push({ label: '인기 순위', value: `${stats.popularityRank}위`, caption: '통계 데이터 기준' });
  }
  if (stats.maleRatio !== null) {
    const malePercent = Math.round(stats.maleRatio * 100);
    items.push({ label: '남녀 비율', value: `${malePercent}:${100 - malePercent}`, caption: '남성:여성' });
  }
  if (stats.nameGender) {
    items.push({ label: '이름 성향', value: stats.nameGender === 'male' ? '남성적' : '여성적' });
  }
  if (!items.length) return null;
  return (
    <V3Section
      id="sec-stats"
      kicker="Stats"
      title="이름 통계"
      dek="같은 이름이 실제로 얼마나, 어떻게 쓰였는지 봅니다."
    >
      <StatTiles items={items} />
    </V3Section>
  );
}
