import React from 'react';
import { V3Section } from './V3Section.jsx';
import { cx } from '../../../components/report/ReportPrimitives';
import { ExpertOnly } from '../../../components/ui/TierToggle.jsx';

export function FramesSection({ frames }) {
  if (!frames) return null;
  return (
    <V3Section
      id="sec-frames"
      kicker="Frames"
      title="획수가 쌓는 네 기둥"
      dek="한자 획수를 원형이정 네 격으로 묶어 삶의 시기별 수리를 봅니다."
    >
      <div className="cr-v3-frame-grid">
        {frames.frames.map((frame) => (
          <div key={frame.type} className="cr-v3-frame-card">
            <p className="cr-v3-frame-card__label">
              {frame.label}
              {frame.period ? <span className="ml-1 font-medium text-inkfaint">· {frame.period}</span> : null}
            </p>
            <p className="cr-v3-frame-card__value">{frame.strokeSum ?? '—'}</p>
            {frame.luckyLevelText ? (
              <span
                className={cx(
                  'cr-v3-grade-chip',
                  frame.grade === 'favorable' && 'cr-v3-grade-chip--favorable',
                  frame.grade === 'adverse' && 'cr-v3-grade-chip--adverse',
                )}
              >
                {frame.luckyLevelText}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        {frames.frames.map((frame) => (
          frame.summary ? (
            <div key={`${frame.type}-text`}>
              <h3 className="text-xs font-bold tracking-[0.04em] text-inkfaint">
                {frame.label}{frame.title ? ` · ${frame.title}` : ''}
              </h3>
              <p className="cr-v3-prose mt-1">{frame.summary}</p>
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
    </V3Section>
  );
}
