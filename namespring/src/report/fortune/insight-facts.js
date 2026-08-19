import { asArray } from './fortune-periods';

// 해석(interpretation)이 충전된 fact만 남기고, 같은 factId(예: 지살이
// 년주·일주 양쪽 히트)는 한 항목으로 병합 — 위치만 합산.
export function interpretedInsightFacts(insightFacts) {
  const raw = asArray(insightFacts?.facts).filter((fact) => fact?.interpretation?.text);
  const byId = new Map();
  raw.forEach((fact) => {
    const prev = byId.get(fact.factId);
    if (!prev) byId.set(fact.factId, { ...fact });
    else if (fact.detail && prev.detail && !prev.detail.includes(fact.detail)) {
      prev.detail = `${prev.detail} · ${fact.detail}`;
    }
  });
  return [...byId.values()];
}

export function hasInterpretedInsights(insightFacts) {
  return interpretedInsightFacts(insightFacts).length > 0;
}
