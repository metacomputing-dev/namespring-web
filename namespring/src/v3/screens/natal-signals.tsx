/**
 * 원국에서 눈에 띄는 신호 — 엔진 insight_facts를 소비하는 공유 컴포넌트.
 * 사주 보고서(전체 모드)와 궁합 사주 상세(사람별 접힘 모드)가 함께 쓴다.
 * 각 신호는 엔진이 실어 준 개별 풀이(reading)를 그대로 보여준다.
 */
import { useState } from 'react';
import type { ReportFactV1 } from '@spring/report/delivery/types';
import { factOfKind, type DeliveryIndex } from '../model/facts';
import { branchWithElement, stemWithElement } from '../model/saju-labels';
import { QuoteCard } from '../ui/primitives';

type SignalWeight = 'strong' | 'mid' | 'soft';

type InsightItem = Extract<ReportFactV1, { kind: 'insight_facts' }>['items'][number];

const GROUP_META: Record<InsightItem['group'], { id: string; title: string; sub: string }> = {
  boon: { id: 'help', title: '도움의 신호', sub: '귀인과 합 — 힘이 되어 주는 배치' },
  tension: { id: 'pace', title: '완급의 신호', sub: '살·충·형 — 속도를 챙기면 무기가 되는 배치' },
  space: { id: 'blank', title: '여백의 신호', sub: '공망·지장간 — 비움과 잠재의 배치' },
};
const GROUP_ORDER: InsightItem['group'][] = ['boon', 'tension', 'space'];

/** 엔진 salience(0~1)를 색 농도 3단계로 옮긴다. */
function salienceWeight(salience: number): SignalWeight {
  if (salience >= 0.6) return 'strong';
  if (salience >= 0.32) return 'mid';
  return 'soft';
}

/** 칩에 걸 짧은 라벨 — 관계는 글자를 오행까지 붙여 부른다 (묘목·유금 충). */
function signalChipLabel(item: InsightItem): string {
  if (item.signalKind === 'stemRelation' || item.signalKind === 'branchRelation') {
    const typeWord = item.label.replace(/^(천간|지지)\s*/u, '');
    const named = item.members.map(item.signalKind === 'stemRelation' ? stemWithElement : branchWithElement);
    if (named.length > 0) return `${named.join('·')} ${typeWord}`;
  }
  return item.label;
}

/** delivery에 원국 신호가 있는지 (없으면 섹션 자체를 숨기는 데 쓴다). */
export function hasNatalSignals(index: DeliveryIndex): boolean {
  return (factOfKind(index, 'insight_facts')?.items.length ?? 0) > 0;
}

/**
 * @param collapsed 하이라이트를 숨기고 브라우저를 접은 채로 둔다 (궁합 사람별 참고용).
 * @param title     접힘 모드의 요약 라벨 (예: "김민준님의 원국 신호").
 */
export function NatalSignals({
  index,
  collapsed = false,
  title,
}: {
  index: DeliveryIndex;
  collapsed?: boolean;
  title?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const fact = factOfKind(index, 'insight_facts');
  const items = fact?.items ?? [];
  if (items.length === 0) return null;

  // 엔진이 salience 내림차순으로 정렬해 보낸다 — 하이라이트는 그 순서를 따른다.
  const highlights = items.filter(item => item.highlight);
  const lead = highlights.length > 0 ? highlights : items.slice(0, Math.min(4, items.length));

  // 눈에 띄는 배치를 먼저 풀어 주는 하이라이트 (접힘 모드에서도 카드 안에 들어간다).
  const highlightsBlock = (
    <div className="v3-signal-highlights">
      {lead.map(item => (
        <QuoteCard key={item.signalId} main={item.reading} expertNote={item.readingExpert ?? undefined} />
      ))}
    </div>
  );

  // 그룹별 신호 칩 + 누르면 열리는 풀이.
  const browserBody = (
    <div className="v3-signal-browser-body">
      {GROUP_ORDER.map(groupKey => {
        const groupItems = items.filter(item => item.group === groupKey);
        if (groupItems.length === 0) return null;
        const meta = GROUP_META[groupKey];
        return (
          <div key={groupKey} className="v3-signal-group">
            <p className="v3-signal-title">
              {meta.title} <span className="v3-hint">— {meta.sub}</span>
            </p>
            <div className="v3-signal-pills">
              {groupItems.map(item => (
                <button
                  key={item.signalId}
                  type="button"
                  className={`v3-signal-pill v3-signal-pill--${meta.id} v3-signal-pill--${salienceWeight(item.salience)}`}
                  aria-expanded={selected === item.signalId}
                  onClick={() => setSelected(selected === item.signalId ? null : item.signalId)}
                >
                  {signalChipLabel(item)}
                </button>
              ))}
            </div>
            {groupItems
              .filter(item => item.signalId === selected)
              .map(item => (
                <div key={item.signalId} style={{ marginTop: '0.6rem' }}>
                  <QuoteCard main={item.reading} expertNote={item.readingExpert ?? undefined} />
                </div>
              ))}
          </div>
        );
      })}
      <p className="v3-hint" style={{ margin: '0.7rem 0 0', textAlign: 'center' }}>
        신호를 누르면 풀이가 열려요.
      </p>
    </div>
  );

  // 접힘 모드(궁합 사람별): 이름과 하이라이트(풀이)는 항상 보이고, 긴 신호 목록만 접는다.
  if (collapsed) {
    return (
      <div className="v3-card">
        {title ? <p className="v3-kicker">{title}</p> : null}
        {highlightsBlock}
        <details className="v3-signal-browser">
          <summary>신호 전체 보기 ({items.length})</summary>
          {browserBody}
        </details>
      </div>
    );
  }

  // 전체 모드(사주 보고서): 하이라이트를 먼저 보여주고, 그 아래 신호 브라우저를 편다.
  return (
    <div className="v3-card">
      {highlightsBlock}
      <details className="v3-signal-browser" open>
        <summary>원국 신호 전체 ({items.length})</summary>
        {browserBody}
      </details>
    </div>
  );
}
