import React from 'react';
import { V3Section } from './V3Section.jsx';
import { SajuPillarTable, StatusPanel } from '../../../components/report/ReportPrimitives';
import { StrengthMeter, DeukBars } from '../../../components/report/StrengthMeter.jsx';
import { YongshinMedallion } from '../../../components/report/YongshinMedallion.jsx';
import { ExpertOnly, TierText } from '../../../components/ui/TierToggle.jsx';

export function SajuSummarySection({ saju }) {
  if (!saju) return null;

  const pillarColumns = (saju.pillarColumns || []).map((column) => ({
    key: column.key,
    label: column.label,
    stem: { symbol: column.stem, element: column.stemElement || '' },
    branch: { symbol: column.branch, element: column.branchElement || '' },
  }));

  return (
    <V3Section
      id="sec-saju"
      kicker="Target"
      title="내 사주라는 과녁"
      dek="이름이 맞춰야 할 대상인 사주의 뼈대만 요약합니다. 깊은 풀이는 사주 보고서에 있습니다."
    >
      {saju.uncertaintyMessage ? (
        <StatusPanel tone="warn" title="출생 시각 정보가 불완전합니다.">
          {saju.uncertaintyMessage}
        </StatusPanel>
      ) : null}

      {saju.analysisStatus ? (
        <StatusPanel tone="neutral" title="사주 분석이 일부 제한되었습니다.">
          입력 정보 범위에서 계산 가능한 항목만 표시합니다.
        </StatusPanel>
      ) : null}

      {pillarColumns.length ? (
        <div className="mt-4">
          <SajuPillarTable columns={pillarColumns} compact />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <YongshinMedallion element={saju.yongshin?.element} />
        <div className="space-y-3">
          {saju.texts.dayMaster ? <p className="cr-v3-prose">{saju.texts.dayMaster}</p> : null}
          {saju.texts.yongshin ? <p className="cr-v3-prose">{saju.texts.yongshin}</p> : null}
        </div>
      </div>

      {saju.strength ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-bold tracking-[0.04em] text-inkfaint">일간의 힘</h3>
            {saju.strength.level ? <span className="text-sm font-bold">{saju.strength.level}</span> : null}
          </div>
          <div className="mt-2">
            <StrengthMeter position={saju.strength.meterPosition} levelLabel={saju.strength.level} />
          </div>
          {saju.texts.strength ? <p className="cr-v3-prose mt-2">{saju.texts.strength}</p> : null}
          <ExpertOnly>
            <div className="mt-3">
              <DeukBars strength={saju.strength} />
            </div>
          </ExpertOnly>
        </div>
      ) : null}

      {saju.texts.plain || saju.texts.expert ? (
        <div className="mt-5">
          <TierText
            as="p"
            className="cr-v3-prose"
            plain={saju.texts.plain || saju.texts.expert}
            expert={saju.texts.expert || saju.texts.plain}
          />
        </div>
      ) : null}

      <ExpertOnly>
        <dl className="mt-4 space-y-1 text-sm text-inkfaint">
          {saju.gyeokguk?.type ? (
            <div className="flex gap-2">
              <dt className="font-semibold">격국</dt>
              <dd>
                {saju.gyeokguk.type}
                {saju.gyeokguk.category ? ` (${saju.gyeokguk.category})` : ''}
              </dd>
            </div>
          ) : null}
          {saju.yongshin?.confidence !== null && saju.yongshin ? (
            <div className="flex gap-2">
              <dt className="font-semibold">용신 신뢰도</dt>
              <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(saju.yongshin.confidence)}점</dd>
            </div>
          ) : null}
        </dl>
      </ExpertOnly>
    </V3Section>
  );
}
