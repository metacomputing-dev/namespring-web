/**
 * elementInteractionAdjust.ts — 합충 보정 오행 분포 (감사 B448 · PR-5 옵션 틀).
 *
 * ⚠ 기본 off (strategies.elements.interactionAdjusted=true 옵트인).
 * 기본 분포(elements.distribution)는 바이트 단위 불변 — 보정 분포는 별도 노드
 * (elements.distributionAdjusted)로만 additive 산출된다. 소비 전환(부족/과다 →
 * 작명 풀·κ nameEffect)은 코퍼스 재생성 계획과 세트인 별도 결정 — 여기서는
 * 스위치를 만들지 않는다.
 *
 * v0 정책(옵션 틀 — 신강약 쪽 상호작용과 별개 배선):
 * - 충 참여 지지의 지장간 기여 × chungDamping (값 매칭 — 궁위 세분은 후속)
 * - 삼합/방합/반합 성립 시 국 오행 가산 (hoegukBonus × 유형 배율)
 * - 천간합(HAP) 참여 천간 기여 × hapgeoDamping (일간 제외 특례)
 * - 왕상휴수 미구현 동안 대칭 감쇠 — 구현 시 chungDamping을 오행 상태 함수로 확장.
 */
import type { BranchIdx, Element, PillarIdx, StemIdx } from './cycle.js';
import { stemElement } from './cycle.js';
import { mod } from './mod.js';
import type { DetectedRelation } from './branchRelations.js';
import { samhapGroup } from './branchRelations.js';
import type { StemRelation } from './stemRelations.js';
import type {
  ElementDistribution,
  ElementDistributionPosition,
  ElementDistributionPositionWeights,
} from './elementDistribution.js';
import type { HiddenStemWeightPolicy } from './hiddenStems.js';
import { hiddenStemsOfBranch } from './hiddenStems.js';

export interface ElementInteractionPolicy {
  /** 충 참여 지지의 지장간 기여 배율 (기본 0.5). */
  chungDamping: number;
  /** 회국 가산치 기준값 (기본 0.6). 삼합 ×1.0, 방합 ×0.8, 반합 ×0.5. */
  hoegukBonus: number;
  /** 합(HAP) 참여 천간 기여 배율 (기본 0.5). 일간은 감쇠 불가 특례. */
  hapgeoDamping: number;
}

export const DEFAULT_ELEMENT_INTERACTION_POLICY: ElementInteractionPolicy = {
  chungDamping: 0.5,
  hoegukBonus: 0.6,
  hapgeoDamping: 0.5,
};

export interface DistributionAdjustment {
  kind: 'CHUNG_DAMAGE' | 'HOEGUK_BONUS' | 'HAPGEO_DAMPING';
  element: Element;
  /** total 벡터에 실제 가감된 양 (감쇠는 음수). */
  delta: number;
  source: string;
}

export interface AdjustedElementDistribution extends ElementDistribution {
  adjustments: DistributionAdjustment[];
}

const SAMHAP_EL: Record<string, Element> = { '0,4,8': 'WATER', '1,5,9': 'METAL', '2,6,10': 'FIRE', '3,7,11': 'WOOD' };
const BANGHAP_EL: Record<string, Element> = { '2,3,4': 'WOOD', '5,6,7': 'FIRE', '8,9,10': 'METAL', '0,1,11': 'WATER' };
const POSITIONS: readonly ElementDistributionPosition[] = ['year', 'month', 'day', 'hour'];

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function positionWeight(
  weights: ElementDistributionPositionWeights | undefined,
  position: ElementDistributionPosition,
  fallback: number,
): number {
  return finiteNonNegative(weights?.[position], fallback);
}

function assertFiniteAdjustedDistribution(
  vectors: Array<Record<Element, number>>,
  adjustments: DistributionAdjustment[],
): void {
  const values = [...vectors.flatMap((vector) => Object.values(vector)), ...adjustments.map((item) => item.delta)];
  if (!values.every(Number.isFinite)) {
    throw new RangeError('interaction-adjusted element distribution produced a non-finite value');
  }
}

function keyOf(members: BranchIdx[]): string {
  return [...members].sort((a, b) => a - b).join(',');
}

export function applyInteractionAdjustments(args: {
  pillars: [PillarIdx, PillarIdx, PillarIdx, PillarIdx];
  branchRelations: DetectedRelation[];
  stemRelations: StemRelation[];
  hiddenStemPolicy?: HiddenStemWeightPolicy;
  heavenStemWeight?: number;
  branchTotalWeight?: number;
  positionWeights?: ElementDistributionPositionWeights;
  heavenPositionWeights?: ElementDistributionPositionWeights;
  branchPositionWeights?: ElementDistributionPositionWeights;
  policy?: Partial<ElementInteractionPolicy>;
}): AdjustedElementDistribution {
  const pol: ElementInteractionPolicy = { ...DEFAULT_ELEMENT_INTERACTION_POLICY, ...(args.policy ?? {}) };
  const heavenW = finiteNonNegative(args.heavenStemWeight, 1);
  const branchW = finiteNonNegative(args.branchTotalWeight, 1);

  const zero = (): Record<Element, number> => ({ WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 });
  const heaven = zero();
  const hidden = zero();
  const total = zero();
  const adjustments: DistributionAdjustment[] = [];

  const branches = args.pillars.map((p) => mod(p.branch, 12) as BranchIdx);
  const dayStem = args.pillars[2].stem;

  // 충 참여 지지 값 집합
  const chungValues = new Set<number>();
  for (const r of args.branchRelations) {
    if (r.type !== 'CHUNG') continue;
    for (const m of r.members) chungValues.add(mod(m, 12));
  }

  // 합 참여 천간 값 집합 (일간 값은 제외 — 값 매칭 한계로 동일 값 타주 천간도 보호됨을 주석화)
  const hapStems = new Set<number>();
  for (const r of args.stemRelations) {
    if (r.type !== 'HAP') continue;
    for (const m of r.members) if (mod(m, 10) !== mod(dayStem, 10)) hapStems.add(mod(m, 10));
  }

  // 천간 기여
  for (let i = 0; i < 4; i++) {
    const s = mod(args.pillars[i]!.stem, 10) as StemIdx;
    const el = stemElement(s);
    const position = POSITIONS[i]!;
    const sharedPositionWeight = positionWeight(args.positionWeights, position, 1);
    const baseWeight = heavenW * positionWeight(args.heavenPositionWeights, position, sharedPositionWeight);
    const damped = i !== 2 && hapStems.has(s);
    const w = baseWeight * (damped ? pol.hapgeoDamping : 1);
    heaven[el] += w;
    if (damped) {
      adjustments.push({ kind: 'HAPGEO_DAMPING', element: el, delta: -(baseWeight - w), source: `HAP@${i}` });
    }
  }

  // 지장간 기여
  for (let i = 0; i < 4; i++) {
    const b = branches[i]!;
    const position = POSITIONS[i]!;
    const sharedPositionWeight = positionWeight(args.positionWeights, position, 1);
    const basePositionWeight = branchW * positionWeight(args.branchPositionWeights, position, sharedPositionWeight);
    const damped = chungValues.has(b);
    const factor = damped ? pol.chungDamping : 1;
    for (const h of hiddenStemsOfBranch(b, args.hiddenStemPolicy ?? { scheme: 'standard' })) {
      const el = stemElement(h.stem);
      const baseWeight = basePositionWeight * h.weight;
      hidden[el] += baseWeight * factor;
      if (damped) {
        adjustments.push({ kind: 'CHUNG_DAMAGE', element: el, delta: -(baseWeight * (1 - factor)), source: `CHUNG@${i}` });
      }
    }
  }

  // 회국 가산
  for (const r of args.branchRelations) {
    let el: Element | null = null;
    let scale = 0;
    if (r.type === 'SAMHAP') { el = SAMHAP_EL[keyOf(r.members)] ?? null; scale = 1.0; }
    else if (r.type === 'BANGHAP') { el = BANGHAP_EL[keyOf(r.members)] ?? null; scale = 0.8; }
    else if (r.type === 'BANHAP') { el = SAMHAP_EL[keyOf(samhapGroup(r.members[0]!))] ?? null; scale = 0.5; }
    if (!el || scale <= 0) continue;
    const bonus = pol.hoegukBonus * scale;
    hidden[el] += bonus;
    adjustments.push({ kind: 'HOEGUK_BONUS', element: el, delta: bonus, source: `${r.type}[${r.members.join(',')}]` });
  }

  for (const el of Object.keys(total) as Element[]) {
    total[el] = Math.max(0, heaven[el] + hidden[el]);
  }
  assertFiniteAdjustedDistribution([heaven, hidden, total], adjustments);
  return { heaven, hidden, total, adjustments } as AdjustedElementDistribution;
}
