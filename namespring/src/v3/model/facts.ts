/**
 * ReportDeliveryV1의 facts/interpretations를 화면에서 다루기 쉽게 인덱싱한다.
 * 화면의 모든 숫자·별점·오행 수치는 여기서 찾은 실제 fact 하나를 가리켜야 한다.
 * 값이 없으면 해당 행을 생략한다 — 중립값이나 추정 문장을 만들지 않는다.
 */
import type {
  ReportDeliveryV1,
  ReportFactV1,
  ReportInterpretationV1,
  ReportSurfaceV1,
} from '@spring/report/delivery/types';

export interface DeliveryIndex {
  delivery: ReportDeliveryV1;
  factById: Map<string, ReportFactV1>;
  factsByKind: Map<ReportFactV1['kind'], ReportFactV1[]>;
  interpretationById: Map<string, ReportInterpretationV1>;
  surfaceById: Map<ReportSurfaceV1['id'], ReportSurfaceV1>;
}

export function indexDelivery(delivery: ReportDeliveryV1): DeliveryIndex {
  const factById = new Map<string, ReportFactV1>();
  const factsByKind = new Map<ReportFactV1['kind'], ReportFactV1[]>();
  for (const fact of delivery.facts) {
    factById.set(fact.id, fact);
    const list = factsByKind.get(fact.kind);
    if (list) list.push(fact);
    else factsByKind.set(fact.kind, [fact]);
  }
  const interpretationById = new Map<string, ReportInterpretationV1>();
  for (const interpretation of delivery.interpretations) {
    interpretationById.set(interpretation.id, interpretation);
  }
  const surfaceById = new Map<ReportSurfaceV1['id'], ReportSurfaceV1>();
  for (const surface of delivery.surfaces) {
    surfaceById.set(surface.id, surface);
  }
  return { delivery, factById, factsByKind, interpretationById, surfaceById };
}

export function factOfKind<K extends ReportFactV1['kind']>(
  index: DeliveryIndex,
  kind: K,
): Extract<ReportFactV1, { kind: K }> | null {
  const list = index.factsByKind.get(kind);
  if (!list || list.length === 0) return null;
  return list[0] as Extract<ReportFactV1, { kind: K }>;
}

export function factsOfKind<K extends ReportFactV1['kind']>(
  index: DeliveryIndex,
  kind: K,
): Extract<ReportFactV1, { kind: K }>[] {
  return (index.factsByKind.get(kind) ?? []) as Extract<ReportFactV1, { kind: K }>[];
}

/** metric fact를 id로 찾아 숫자 값을 돌려준다. 없으면 null. */
export function metricValue(index: DeliveryIndex, id: string): number | null {
  const fact = index.factById.get(id);
  if (!fact || fact.kind !== 'metric') return null;
  return fact.value;
}

export const ELEMENT_KO: Record<string, string> = {
  wood: '목',
  fire: '화',
  earth: '토',
  metal: '금',
  water: '수',
};

export const ELEMENT_HANJA: Record<string, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};
