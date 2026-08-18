import React from 'react';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { TierText } from '../../../components/ui/TierToggle.jsx';
import { cx } from '../../../components/report/ReportPrimitives';

const STATE_NOTES = {
  good: '음절 사이의 소리 기운이 서로를 살리는 방향으로 이어져요.',
  mixed: '살리는 구간과 부딪히는 구간이 함께 있어요. 또렷하게 불러 주면 자연스럽게 풀리는 정도예요.',
  bad: '음절 사이의 소리 기운이 서로 부딪히는 흐름이에요.',
};

function elementScope(element) {
  return `cr-v3-el-${element || 'neutral'}`;
}

export function SoundFlowSection({ flow }) {
  if (!flow) return null;
  const expertSummary = [
    flow.edges.map((edge) => edge?.label).filter(Boolean).join(' · '),
    flow.elementScore !== null ? `오행 조화 ${flow.elementScore}/100` : null,
    flow.polarityScore !== null ? `음양 균형 ${flow.polarityScore}/100` : null,
  ].filter(Boolean).join(' — ');
  return (
    <RevealOnScroll as="section" id="sec-sound" className="scroll-mt-32 pt-14">
      <div className="rounded-[2rem] bg-bezel p-1.5 shadow-[var(--shadow-float)]">
        <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[var(--shadow-inset-card)] sm:p-8">
          <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">이름 분석 01</p>
          <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">발음오행 분석</h2>
          <p className="mt-1 text-xs text-inkfaint">이름을 부를 때 소리 기운이 어떻게 이어지는지 봐요</p>
          <div className="my-8 flex flex-wrap items-center justify-center gap-y-4">
            {flow.nodes.map((node, index) => (
              <React.Fragment key={`${node.hangul}-${index}`}>
                <div className={cx('flex min-w-[5.5rem] flex-col items-center gap-2', elementScope(node.element))}>
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--el)] bg-[var(--el-bg)] font-serif text-2xl font-bold text-[var(--el)]">
                    {node.hangul}
                  </span>
                  <span className="rounded-full bg-[var(--el-bg)] px-2.5 py-0.5 text-2xs font-bold text-[var(--el)]">
                    {node.onset ? `${node.onset} · ` : ''}{node.elementNoun || '—'}
                  </span>
                </div>
                {index < flow.nodes.length - 1 && flow.edges[index] ? (
                  <div className="flex min-w-[4.5rem] flex-col items-center gap-1 px-1">
                    <span
                      className={cx('text-lg', flow.edges[index].favorable ? 'text-sage' : 'text-amber2')}
                      aria-hidden="true"
                    >
                      {flow.edges[index].favorable ? '─ ─ ▶' : '─ ✕ ─'}
                    </span>
                    <span
                      className={cx(
                        'rounded-full px-2.5 py-0.5 text-2xs font-bold',
                        flow.edges[index].favorable ? 'bg-sagesoft text-sage' : 'bg-ambersoft text-amber2',
                      )}
                    >
                      <TierText plain={flow.edges[index].plainLabel} expert={flow.edges[index].label} />
                    </span>
                    <span className="text-[10.5px] text-inkfaint">{flow.edges[index].zone}</span>
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
          <div className="max-w-[62ch] text-smd leading-relaxed text-inksoft">
            <TierText
              as="p"
              plain={STATE_NOTES[flow.state] || STATE_NOTES.mixed}
              expert={expertSummary || STATE_NOTES[flow.state]}
            />
          </div>
        </div>
      </div>
    </RevealOnScroll>
  );
}
