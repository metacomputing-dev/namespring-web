import React, { useState } from 'react';
import { interpretedInsightFacts } from '../../report/fortune/insight-facts';

/**
 * 전문 인사이트 — 엔진이 계산한 신살·공망·합충형파해 등의 원자료(fact) 중
 * 해석(interpretation)이 충전된 항목만 렌더한다. 해석 파일이 비어 있는 초기
 * 상태에서는 아무것도 그리지 않아 화면 무회귀. (성인 대상자에게만 카드가 실림)
 *
 * Extracted from the legacy combined report for the saju page; the legacy
 * renderer keeps its own copy so the ?reportLegacy=1 path stays untouched.
 * Styles reuse the tokenized .cr-insight-* rules in report-ui.css.
 */
const INSIGHT_GROUP_ORDER = [
  { key: 'boon', title: '도움의 신호', desc: '귀인과 합 — 힘이 되어 주는 배치' },
  { key: 'tension', title: '완급의 신호', desc: '살·충·형 — 속도를 챙기면 무기가 되는 배치' },
  { key: 'space', title: '여백의 신호', desc: '공망·지장간 — 비움과 잠재의 배치' },
];

function insightChips(fact) {
  const chips = [`#${(fact.label || '').replace(/\s+/g, '')}`];
  if (fact.members?.length) chips.push(fact.members.join('·'));
  else if (fact.detail) chips.push(fact.detail);
  return chips;
}

/** 접힌 목록의 칩 라벨 — 관계는 고전 표기(병임충·인사형)로 압축. */
function insightChipText(fact) {
  if (fact.kind === 'stemRelation' || fact.kind === 'branchRelation') {
    const typeWord = (fact.label || '').replace(/^(천간|지지)\s*/u, '');
    return `${(fact.members || []).join('')}${typeWord}`;
  }
  return fact.label || fact.factId;
}

const INSIGHT_GROUP_RGB = { boon: '47, 107, 79', tension: '176, 108, 38', space: '90, 96, 120' };

/** 주요도(salience 0~1) → 테두리·배경 농도. 글자는 항상 진하게(가독성·비활성 오독 방지). */
function insightSalienceStyle(groupKey, salience) {
  const rgb = INSIGHT_GROUP_RGB[groupKey] || INSIGHT_GROUP_RGB.tension;
  const s = Number.isFinite(salience) ? Math.max(0, Math.min(1, salience)) : 0.5;
  return {
    '--ins-border': `rgba(${rgb}, ${(0.10 + s * 0.90).toFixed(3)})`,
    '--ins-bg': `rgba(${rgb}, ${(0.02 + s * 0.26).toFixed(3)})`,
  };
}

export function InsightFactsBody({ insightFacts }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState(null);
  const interpreted = interpretedInsightFacts(insightFacts);
  if (!interpreted.length) return null;

  // 엔진이 가중치로 고른 하이라이트(최대 6) = 기본 노출. 나머지는 접힘.
  const highlights = interpreted.filter((fact) => fact.highlight);
  const rest = interpreted.filter((fact) => !fact.highlight);
  const lead = highlights.length ? highlights : interpreted.slice(0, 4);
  const folded = highlights.length ? rest : interpreted.slice(4);

  return (
    <div className="space-y-4">
      <div className="cr-insight-highlights">
        {lead.map((fact) => (
          <article
            key={fact.factId}
            className="cr-insight-item cr-insight-item--highlight"
            style={{ borderLeftColor: `rgba(47, 107, 79, ${(0.22 + (fact.salience ?? 0.5) * 0.78).toFixed(3)})` }}
          >
            <p className="cr-insight-item__headline">{fact.interpretation.text}</p>
            {fact.interpretation.expertText ? (
              <p className="cr-insight-item__expert">{fact.interpretation.expertText}</p>
            ) : null}
            <div className="cr-insight-item__chips" aria-label="전문태그">
              {insightChips(fact).map((chip) => (
                <span key={`${fact.factId}-${chip}`}>{chip}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {folded.length ? (
        <div className="cr-insight-rest">
          <button
            type="button"
            className="cr-insight-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '원국 신호 접기' : `원국 신호 전체 보기 (${folded.length})`}
          </button>
          {expanded ? (
            <div className="cr-insight-groups">
              {INSIGHT_GROUP_ORDER.map((group) => {
                const items = folded.filter((fact) => (fact.group || 'tension') === group.key);
                if (!items.length) return null;
                const selected = items.find((fact) => fact.factId === selectedFactId) || null;
                return (
                  <div key={group.key} className="cr-insight-group">
                    <h4>{group.title}<span className="cr-insight-group__desc"> — {group.desc}</span></h4>
                    <div className="cr-insight-chiprow" role="group" aria-label={group.title}>
                      {items.map((fact) => {
                        const isSelected = fact.factId === selectedFactId;
                        return (
                          <button
                            key={fact.factId}
                            type="button"
                            aria-pressed={isSelected}
                            className={`cr-insight-chip cr-insight-chip--${group.key}${isSelected ? ' is-selected' : ''}`}
                            style={insightSalienceStyle(group.key, fact.salience)}
                            onClick={() => setSelectedFactId(isSelected ? null : fact.factId)}
                          >
                            {insightChipText(fact)}
                          </button>
                        );
                      })}
                    </div>
                    {selected ? (
                      <article className={`cr-insight-detail cr-insight-detail--${group.key}`}>
                        <h5>
                          {selected.label}
                          {selected.detail ? <span className="cr-insight-item__where"> · {selected.detail}</span> : null}
                        </h5>
                        <p>{selected.interpretation.text}</p>
                        {selected.interpretation.expertText ? (
                          <p className="cr-insight-item__expert">{selected.interpretation.expertText}</p>
                        ) : null}
                      </article>
                    ) : null}
                  </div>
                );
              })}
              <p className="cr-insight-hint">신호를 누르면 풀이가 열립니다.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
