import React from 'react';
import { V3Section } from './V3Section.jsx';
import { FlowDiagram } from '../../../components/report/FlowDiagram.jsx';
import { ExpertOnly } from '../../../components/ui/TierToggle.jsx';
import { StateDot } from '../../../components/report/ReportV3Bits.jsx';

const STATE_NOTES = {
  good: '음절 사이의 오행이 서로를 살리는 방향으로 이어집니다.',
  mixed: '살리는 구간과 부딪히는 구간이 함께 있습니다.',
  bad: '음절 사이의 오행이 서로 부딪히는 흐름입니다.',
};

export function SoundFlowSection({ flow }) {
  if (!flow) return null;
  return (
    <V3Section
      id="sec-sound"
      kicker="Sound"
      title="발음이 만드는 흐름"
      dek="이름을 소리 내어 부를 때 오행이 이어지는 방향을 봅니다."
    >
      <FlowDiagram nodes={flow.nodes} edges={flow.edges} />
      <p className="mt-4 flex items-center gap-2 text-smd text-inksoft">
        <StateDot state={flow.state} />
        {STATE_NOTES[flow.state] || STATE_NOTES.mixed}
      </p>
      <ExpertOnly>
        <dl className="mt-3 flex gap-6 text-sm text-inkfaint">
          {flow.elementScore !== null ? (
            <div>
              <dt className="font-semibold">오행 조화 점수</dt>
              <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{flow.elementScore}/100</dd>
            </div>
          ) : null}
          {flow.polarityScore !== null ? (
            <div>
              <dt className="font-semibold">음양 균형 점수</dt>
              <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{flow.polarityScore}/100</dd>
            </div>
          ) : null}
        </dl>
      </ExpertOnly>
    </V3Section>
  );
}
