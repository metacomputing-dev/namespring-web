import type { EngineConfig } from '../api/types.js';
import type { DetectedRelation, RelationType } from '../core/branchRelations.js';
import { relationResolutionUnits, samhapGroup } from '../core/branchRelations.js';
import type { BranchIdx, Element, StemIdx } from '../core/cycle.js';
import { branchElement, stemElement } from '../core/cycle.js';
import { controls, generates } from '../core/elements.js';
import { hiddenStemsOfBranch } from '../core/hiddenStems.js';
import { lifeStageOf } from '../core/lifeStage.js';
import type { LifeStage, LifeStagePolicy } from '../core/lifeStage.js';
import { mod } from '../core/mod.js';
import { seasonalStateOf } from '../core/seasonalStates.js';
import type { SeasonalState } from '../core/seasonalStates.js';
import type { TenGodScore } from '../core/scoring.js';
import { tenGodOf } from '../core/tenGod.js';
import type { TenGod } from '../core/tenGod.js';
import { computeStrengthBase } from './strengthBase.js';
import type { StrengthComponents } from './strengthComponents.js';
import type { SeasonGroup } from './season.js';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface StrengthFacts {
  /** [-1, +1] where negative = weak, positive = strong (in this model). */
  index: number;
  support: number;
  pressure: number;
  total: number;
  /** Pre-adjustment strength contributions under the selected strength policy. */
  components: StrengthComponents;
  /** Contributions reconciled to the final support and pressure totals. */
  effectiveComponents?: StrengthComponents;

  /** Strength model id used for this run (e.g., 'base', 'seasonalRoots'). */
  model?: string;

  /**
   * Optional decomposition for advanced models.
   * Kept optional to preserve API stability and allow schools to evolve.
   */
  details?: {
    season?: {
      monthElement: Element;
      seasonGroup: SeasonGroup;
      dayMasterElement: Element;
      /** Signed score in [-1,+1] roughly indicating 得令/失令 for DM under month element. */
      score: number;
      /** Applied multiplicative factor for support adjustment (e.g. 0.12). */
      factor: number;
    };
    roots?: {
      /** Sum of hidden-stem weights where stem-element == DM element. */
      sameElement: number;
      /** Sum of hidden-stem weights where stem-element generates DM element. */
      resourceElement: number;
      /** Combined root support score (non-negative). */
      score: number;
      /** Applied multiplicative factor for support adjustment. */
      factor: number;
    };
    delingdiShi?: {
      deLing: { monthElement: Element; dayMasterElement: Element; score: number; factor: number };
      deDi: {
        sameElement: number;
        resourceElement: number;
        score: number;
        normalized: number;
        factor: number;
        lifeStageRoot?: {
          enabled: boolean;
          multipliers: Record<LifeStage, number>;
          branches: Array<{ position: 'year' | 'month' | 'day' | 'hour'; branch: BranchIdx; stage: LifeStage; multiplier: number }>;
        };
      };
      deShi: {
        sameElement: number;
        resourceElement: number;
        score: number;
        normalized: number;
        factor: number;
        positionWeights: { year: number; month: number; hour: number };
      };
      adjusted: { support: number; pressure: number; total: number };
      /** PR-5 (감사 B448/B510/B531): 합충 상호작용 보정 내역 (additive). */
      interaction?: {
        /** 지지별(년월일시) 통근 감쇠 계수 — 1.0 = 무손상. */
        branchDamageFactors: number[];
        /** 탐합망충으로 손상이 해소된 관계 목록. */
        resolved: Array<{ type: RelationType; members: BranchIdx[] }>;
        /** 회국(삼합/방합/반합) 보정. */
        hui: {
          supportBonus: number;
          pressureBonus: number;
          groups: Array<{ type: string; members: BranchIdx[]; element: Element; applied: number; side?: string; reason?: string }>;
        };
        /** 천간합 기반(羈絆)으로 감쇠된 투간 목록. */
        stemBinds: Array<{ pos: string; stem: StemIdx; factor: number }>;
        /** Visible officer stems whose pressure contribution was reduced by hap binding. */
        pressureStemBinds?: Array<{ pos: string; stem: StemIdx; tenGod: TenGod; factor: number; reduction: number }>;
        /**
         * 관성 기반 감쇠를 raw 십성 원장이 아닌 득세와 같은 정규화·배율 층에
         * 적용한 내역. factor는 pressure의 (1+f) 배율에서 차감된다.
         */
        pressureStemBindPenalty?: { score: number; normalized: number; factor: number };
      };
    };

    adjusted?: {
      support: number;
      pressure: number;
      total: number;
    };
  };
}

export function seasonSupportScore(monthEl: Element, dmEl: Element): number {
  // Rough "득령/실령" score in [-1,+1] based on 生/克 관계.
  if (monthEl === dmEl) return 1.0;
  if (generates(monthEl, dmEl)) return 0.6; // month supports DM
  if (generates(dmEl, monthEl)) return -0.6; // DM drains to season
  if (controls(monthEl, dmEl)) return -0.8; // season controls DM
  if (controls(dmEl, monthEl)) return -0.3; // DM controls season (mixed)
  return 0.0;
}

// ── 삼합/방합 국(局) 오행 조견 (buildRuleFacts 로컬에서 호이스트 — 회국 보정과 공유) ──
export function samhapElementOf(members: BranchIdx[]): Element | null {
  const key = [...members].sort((a, b) => a - b).join(',');
  // 申子辰(水), 巳酉丑(金), 寅午戌(火), 亥卯未(木)
  if (key === '0,4,8') return 'WATER';
  if (key === '1,5,9') return 'METAL';
  if (key === '2,6,10') return 'FIRE';
  if (key === '3,7,11') return 'WOOD';
  return null;
}

export function banghapElementOf(members: BranchIdx[]): Element | null {
  const key = [...members].sort((a, b) => a - b).join(',');
  // 寅卯辰(木), 巳午未(火), 申酉戌(金), 亥子丑(水)
  if (key === '2,3,4') return 'WOOD';
  if (key === '5,6,7') return 'FIRE';
  if (key === '8,9,10') return 'METAL';
  if (key === '0,1,11') return 'WATER';
  return null;
}

// ── 감사 B448/B510/B531 · PR-5: 합충 상호작용 → 신강약(deLingDiShi) 주입 ──
//
// 설계 원칙:
// - 감쇠·보정은 deLingDiShi의 (1+f) 배율 층에만 주입한다. hiddenStemsOfBranch·
//   elementDistribution·tenGodScores는 절대 건드리지 않는다(이중 감쇠 + κ 파급 방지).
// - 기본 경로는 값 기반 균일 감쇠로 기존 판정을 보존한다.
//   positional.enabled=true일 때만 pillarIndexes 기반 거리 차등을 적용한다.
// - seasonal.enabled=true일 때만 왕상휴수 비대칭 감쇠를 적용한다.
//   두 확장 경로는 전문가 승인 전까지 명시적 opt-in이다.

interface StrengthInteractionPolicy {
  enabled: boolean;
  root: {
    enabled: boolean;
    damageFactors: Partial<Record<RelationType, number>>;
    floor: number;
    resolveByHap: boolean;
    resolveTypes: RelationType[];
    samePairHapResolves: boolean;
    /** PR-10-2: 궁위 pairs 기반 인접/원격 차등 손상 — 명시 opt-in, 권위 캘리브레이션 대기. */
    positional: {
      enabled: boolean;
      /** 기둥 거리별 손상 강도 배율 — d1 인접 / d2 한 칸 건너 / d3 원격(년-시) */
      distanceScales: { d1: number; d2: number; d3: number };
    };
  };
  hui: {
    enabled: boolean;
    scales: { SAMHAP: number; BANGHAP: number; BANHAP: number };
    resAlpha: number;
    applyToPressure: boolean;
    max: number;
    banhapBrokenByDamage: boolean;
  };
  stemBind: {
    enabled: boolean;
    factor: number;
    jaenghapFactor: number;
    applyToPressure: boolean;
  };
  /** PR-10-1: 왕상휴수 연동 비대칭 뿌리 손상 — 명시 opt-in, 권위 캘리브레이션 대기. */
  seasonal: {
    enabled: boolean;
    /** 손상 강도 배율 — eff = 1 − (1 − f) × mult(state). mult<1 경감(왕상), >1 가중(수사). */
    multipliers: Record<SeasonalState, number>;
  };
}

function readStrengthInteractionPolicy(pol: any): StrengthInteractionPolicy {
  const raw: any = pol?.interaction ?? {};
  const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const unit = (v: any, d: number) => (
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : d
  );
  const enabled = raw.enabled !== false; // PR-5 기본 on — 판정 변경(계측 절차 동반)
  const rootRaw: any = raw.root ?? {};
  const huiRaw: any = raw.hui ?? {};
  const bindRaw: any = raw.stemBind ?? {};
  const seasonalRaw: any = raw.seasonal ?? {};
  return {
    enabled,
    root: {
      enabled: enabled && rootRaw.enabled !== false,
      // 기본: 충 0.5(충거·충손 — 30~70% 감쇄 서술대의 중앙값), 형 0.7(조정·불안정 —
      // 격국 damageWeights CHUNG 1.0 : HYEONG 0.8 비율과 방향 정합).
      // 파·해·원진·귀문은 기본 미감쇠(뿌리 손상 불인정이 다수).
      damageFactors: {
        CHUNG: num(rootRaw.damageFactors?.CHUNG, 0.5),
        HYEONG: num(rootRaw.damageFactors?.HYEONG, 0.7),
        JA_HYEONG: num(rootRaw.damageFactors?.JA_HYEONG, 0.7),
        SAMHYEONG: num(rootRaw.damageFactors?.SAMHYEONG, 0.7),
        ...(rootRaw.damageFactors && typeof rootRaw.damageFactors === 'object' ? rootRaw.damageFactors : {}),
      },
      floor: num(rootRaw.floor, 0.3),
      resolveByHap: rootRaw.resolveByHap !== false, // 탐합망충 (감사 B510과 공유 규칙)
      resolveTypes: Array.isArray(rootRaw.resolveTypes)
        ? (rootRaw.resolveTypes.filter((t: any) => typeof t === 'string') as RelationType[])
        : (['YUKHAP', 'SAMHAP'] as RelationType[]), // 반합의 해충력은 이설 커서 기본 제외 (hui 파국 판정과의 순환 방지)
      samePairHapResolves: rootRaw.samePairHapResolves !== false, // 巳申 동일쌍 합+형 → 형합 유정
      positional: {
        // PR-10-2 (감사 B524) — 인접/원격 차등은 전문가 승인 전 명시적 opt-in.
        // enabled:true일 때만 적용하며, 미지정/false는 기존 판정을 보존한다.
        enabled: rootRaw.positional?.enabled === true,
        // 인접(d=1) 완전 성립 / 한 칸 건너(d=2) 절반 / 원격 년-시(d=3) 1/4 —
        // 자평 실무 인접성 통설의 보수 개시값 (계측 후 조정 전제).
        distanceScales: {
          d1: num(rootRaw.positional?.distanceScales?.d1, 1.0),
          d2: num(rootRaw.positional?.distanceScales?.d2, 0.5),
          d3: num(rootRaw.positional?.distanceScales?.d3, 0.25),
        },
      },
    },
    hui: {
      enabled: enabled && huiRaw.enabled !== false,
      // 삼합 완전체 0.10 / 방합 0.08 / 반합 0.05 — lingScale 0.18 대비 보수 개시(계측 후 조정 전제).
      scales: {
        SAMHAP: num(huiRaw.scales?.SAMHAP, 0.10),
        BANGHAP: num(huiRaw.scales?.BANGHAP, 0.08),
        BANHAP: num(huiRaw.scales?.BANHAP, 0.05),
      },
      resAlpha: num(huiRaw.resAlpha, 0.6), // 인성국은 0.6배 (rootResAlpha 정합)
      applyToPressure: huiRaw.applyToPressure !== false, // 식·재·관 국 → pressure 가산
      max: num(huiRaw.max, 0.15),
      banhapBrokenByDamage: huiRaw.banhapBrokenByDamage !== false, // 반합은 약해서 미해소 충/형에 깨진다
    },
    stemBind: {
      enabled: enabled && bindRaw.enabled !== false,
      // 합이불화 = 기반(묶임) — 역할 절반 상실 (감사 B531 표준: 현대 주류는 합화 거의 불인정).
      factor: unit(bindRaw.factor, 0.5),
      jaenghapFactor: unit(bindRaw.jaenghapFactor, 0.75), // 쟁합·투합은 합력 분산 → 감쇠 완화
      // Pressure damping remains experimental until authority calibration and
      // must be requested explicitly. Support-side stem binding is unchanged.
      applyToPressure: bindRaw.applyToPressure === true,
    },
    seasonal: {
      // PR-10-1 (감사 B434) — 왕상휴수 비대칭 감쇠는 전문가 승인 전 명시적 opt-in.
      // enabled:true일 때만 적용하며, 미지정/false는 기존 판정을 보존한다.
      enabled: enabled && seasonalRaw.enabled === true,
      // 왕한 오행의 뿌리는 충·형 손상을 30% 경감, 사(死)한 오행은 30% 가중 —
      // "왕상한 쪽이 덜 상한다"는 통설의 보수적 개시값 (계측 후 조정 전제).
      multipliers: {
        WANG: num(seasonalRaw.multipliers?.WANG, 0.7),
        SANG: num(seasonalRaw.multipliers?.SANG, 0.85),
        HYU: num(seasonalRaw.multipliers?.HYU, 1.0),
        SU: num(seasonalRaw.multipliers?.SU, 1.15),
        SA: num(seasonalRaw.multipliers?.SA, 1.3),
      },
    },
  };
}

/** 충/형 손상 → 지지별 통근 감쇠 계수 (1.0 = 무손상). 탐합망충 해소 판정 포함.
 *  seasonal이 주어지고 enabled면 왕상휴수 비대칭(감사 B434)을 적용한다.
 *  pol.positional.enabled + relationsDetailed(pairs 보존)면 인접/원격 차등(감사 B524)을 적용한다.
 *  둘 다 명시 opt-in이며, 미지정/false일 때 기존 균일 감쇠 경로를 유지한다. */
export function computeBranchInteractionFactors(
  branches: BranchIdx[],
  byType: Partial<Record<RelationType, BranchIdx[][]>>,
  pol: StrengthInteractionPolicy['root'],
  seasonal?: { pol: StrengthInteractionPolicy['seasonal']; monthBranch: BranchIdx },
  relationsDetailed?: DetectedRelation[],
): { factors: number[]; resolved: Array<{ type: RelationType; members: BranchIdx[] }> } {
  const factors = branches.map(() => 1);
  const resolved: Array<{ type: RelationType; members: BranchIdx[] }> = [];
  if (!pol.enabled) return { factors, resolved };

  const seasonalMultOf = (i: number): number => {
    if (!seasonal?.pol.enabled) return 1;
    const st = seasonalStateOf(branchElement(mod(branches[i]!, 12) as BranchIdx), seasonal.monthBranch);
    return seasonal.pol.multipliers[st] ?? 1;
  };

  const hapGroups: BranchIdx[][] = pol.resolveTypes.flatMap((t) => (byType[t] ?? []) as BranchIdx[][]);

  const isResolved = (g: BranchIdx[]): boolean => {
    if (!pol.resolveByHap) return false;
    const gs = new Set<number>(g as number[]);
    for (const h of hapGroups) {
      const hs = new Set<number>(h as number[]);
      const samePair = g.length === h.length && (g as number[]).every((x) => hs.has(x));
      if (samePair) {
        if (pol.samePairHapResolves) return true; // 巳申처럼 동일쌍이 합이자 형
        continue;
      }
      const shares = (g as number[]).some((x) => hs.has(x)); // 당사자 1인 이상 합 참여
      const hasThird = [...hs].some((x) => !gs.has(x)); // 제3의 글자와의 합 (탐합망충)
      if (shares && hasThird) return true;
    }
    return false;
  };

  // ── PR-10-2 (감사 B524/B538): 궁위 pairs 기반 인접/원격 차등 경로 ──
  // 해소(탐합망충)는 값 수준 그대로 둔다 — 탐지 자체가 값 기반이라 동일 값 중복에서
  // 위치별 해소 차이는 원리상 발생하지 않는다. 차등은 손상 강도(거리)에만 적용.
  if (pol.positional?.enabled === true && Array.isArray(relationsDetailed)) {
    const ds = pol.positional.distanceScales;
    const dScaleOf = (d: number): number => (d <= 1 ? ds.d1 : d === 2 ? ds.d2 : ds.d3);
    for (const rel of relationsDetailed) {
      const f = (pol.damageFactors as any)[rel.type];
      if (!(typeof f === 'number' && Number.isFinite(f) && f >= 0 && f < 1)) continue;
      const triplePairs = rel.type === 'SAMHYEONG'
        ? relationResolutionUnits(rel)
        : null;
      const unresolvedTriplePairs = triplePairs?.filter((pair) => !isResolved(pair));
      const unresolvedTriplePairKeys = new Set(
        unresolvedTriplePairs?.map((pair) => pair.join(',')) ?? [],
      );
      if (triplePairs && unresolvedTriplePairs!.length === 0) {
        resolved.push({ type: rel.type, members: rel.members as BranchIdx[] });
        continue;
      }
      if (triplePairs) {
        for (const pair of triplePairs) {
          if (!unresolvedTriplePairKeys.has(pair.join(','))) {
            resolved.push({ type: 'HYEONG', members: pair });
          }
        }
      }
      if (!triplePairs && isResolved(rel.members as BranchIdx[])) {
        resolved.push({ type: rel.type, members: rel.members as BranchIdx[] });
        continue;
      }
      // 인덱스별로 가장 강한(최저 eff) 인스턴스 하나만 적용 — 다중 인스턴스 중첩(f^n)은
      // 별도 판정 강화 결정이므로 현행 1회 적용 크기를 유지한다.
      const effByIdx = new Map<number, number>();
      const noteEff = (i: number, scale: number): void => {
        // m===1이면 f 그대로 — 부동소수점 왕복(1-(1-f))로 인한 바이트 표류 방지.
        const m = scale * seasonalMultOf(i);
        const eff = m === 1 ? f : clamp01(1 - (1 - f) * m);
        effByIdx.set(i, Math.min(effByIdx.get(i) ?? 1, eff));
      };
      const pairs = Array.isArray(rel.pairs) && rel.pairs.length > 0 ? rel.pairs : null;
      if (triplePairs) {
        // 삼형은 canonical relation 하나로 점수화하되, 탐합망형 해소는
        // 세 구성쌍별로 평가한다. 남은 쌍에 참여하는 기둥만 한 번 감쇠한다.
        for (const [a, b] of unresolvedTriplePairs!) {
          for (let i = 0; i < branches.length; i++) {
            for (let j = i + 1; j < branches.length; j++) {
              const bi = mod(branches[i]!, 12);
              const bj = mod(branches[j]!, 12);
              if (!((bi === a && bj === b) || (bi === b && bj === a))) continue;
              const scale = dScaleOf(Math.abs(i - j));
              noteEff(i, scale);
              noteEff(j, scale);
            }
          }
        }
      } else if (pairs) {
        for (const [i, j] of pairs as Array<[number, number]>) {
          const scale = dScaleOf(Math.abs(i - j));
          noteEff(i, scale);
          noteEff(j, scale);
        }
      } else if (Array.isArray(rel.pillarIndexes) && rel.pillarIndexes.length > 0) {
        // triple(삼합·방합·삼형)은 거리 차등 없이 완전 적용 (현행 크기 유지)
        for (const i of rel.pillarIndexes) noteEff(i, 1);
      } else {
        // 궁위 정보 없는 구형 입력 — 값 매칭 폴백
        for (let i = 0; i < branches.length; i++) {
          if ((rel.members as number[]).includes(mod(branches[i]!, 12))) noteEff(i, 1);
        }
      }
      for (const [i, eff] of effByIdx) factors[i]! *= eff;
    }
    return { factors: factors.map((x) => Math.max(pol.floor, x)), resolved };
  }

  // ── 기존 값 매칭 경로 (positional off — 바이트 불변) ──
  for (const [t, f] of Object.entries(pol.damageFactors) as Array<[RelationType, number]>) {
    if (!(typeof f === 'number' && Number.isFinite(f) && f >= 0 && f < 1)) continue;
    for (const g of byType[t] ?? []) {
      if (t === 'SAMHYEONG') {
        const pairs = relationResolutionUnits({ type: t, members: g as BranchIdx[] });
        const unresolvedPairs = pairs.filter((pair) => !isResolved(pair));
        const unresolvedPairKeys = new Set(unresolvedPairs.map((pair) => pair.join(',')));
        if (unresolvedPairs.length === 0) {
          resolved.push({ type: t, members: g as BranchIdx[] });
          continue;
        }
        for (const pair of pairs) {
          if (!unresolvedPairKeys.has(pair.join(','))) {
            resolved.push({ type: 'HYEONG', members: pair });
          }
        }
        const activeMembers = new Set(unresolvedPairs.flat() as number[]);
        for (let i = 0; i < branches.length; i++) {
          if (!activeMembers.has(mod(branches[i]!, 12))) continue;
          const mult = seasonalMultOf(i);
          factors[i]! *= mult === 1 ? f : clamp01(1 - (1 - f) * mult);
        }
        continue;
      }
      if (isResolved(g as BranchIdx[])) {
        resolved.push({ type: t, members: g as BranchIdx[] });
        continue;
      }
      for (let i = 0; i < branches.length; i++) {
        // 값 매칭 (동일 지지 과감쇠 한계 — positional 경로가 인접/원격 차등으로 보완)
        if (!(g as number[]).includes(mod(branches[i]!, 12))) continue;
        // 왕상휴수 비대칭 (감사 B434): 왕상한 오행의 뿌리는 손상을 덜 받고(mult<1),
        // 수사(囚死)한 오행은 더 받는다(mult>1). eff = 1 − (1 − f) × mult.
        // mult===1이면 f 그대로 — 부동소수점 왕복으로 인한 기본 경로 바이트 표류 방지.
        const mult = seasonalMultOf(i);
        factors[i]! *= mult === 1 ? f : clamp01(1 - (1 - f) * mult);
      }
    }
  }
  return { factors: factors.map((x) => Math.max(pol.floor, x)), resolved };
}

/** 회국(삼합/방합/반합) → support/pressure 별도 항 보정.
 *  得地 보너스가 아니라 별도 항인 이유: diNormed의 clamp 포화(rootNorm 2.2) 때문에
 *  통근이 강한 명식(정확히 회국이 잘 서는 명식)에서 보너스가 먹히지 않는다. */
function computeHuiBonus(
  byType: Partial<Record<RelationType, BranchIdx[][]>>,
  dmEl: Element,
  pol: StrengthInteractionPolicy['hui'],
  branchDamageFactors: number[],
  branches: BranchIdx[],
): {
  supportBonus: number;
  pressureBonus: number;
  groups: Array<{ type: string; members: BranchIdx[]; element: Element; applied: number; side?: string; reason?: string }>;
} {
  if (!pol.enabled) return { supportBonus: 0, pressureBonus: 0, groups: [] };
  let sup = 0;
  let prs = 0;
  const groups: Array<{ type: string; members: BranchIdx[]; element: Element; applied: number; side?: string; reason?: string }> = [];
  const damagedValues = new Set(
    branches.filter((_, i) => (branchDamageFactors[i] ?? 1) < 1).map((b) => mod(b, 12)),
  );

  const push = (type: 'SAMHAP' | 'BANGHAP' | 'BANHAP', members: BranchIdx[], el: Element | null): void => {
    if (!el) return;
    // 반합은 약해서 미해소 충/형 손상 멤버가 있으면 파국 (삼합 완전체는 안 깨진다 — 2규칙 체계).
    if (type === 'BANHAP' && pol.banhapBrokenByDamage && (members as number[]).some((m) => damagedValues.has(m))) {
      groups.push({ type, members, element: el, applied: 0, reason: 'BROKEN_BY_DAMAGE' });
      return;
    }
    const scale = pol.scales[type];
    if (el === dmEl) {
      sup += scale;
      groups.push({ type, members, element: el, applied: scale, side: 'support' });
    } else if (generates(el, dmEl)) {
      sup += scale * pol.resAlpha;
      groups.push({ type, members, element: el, applied: scale * pol.resAlpha, side: 'support' });
    } else if (pol.applyToPressure) {
      // 식·재·관 국 성립 → 신약 방향 (pressure 가산이 표준 방향)
      prs += scale;
      groups.push({ type, members, element: el, applied: scale, side: 'pressure' });
    }
  };
  for (const m of byType.SAMHAP ?? []) push('SAMHAP', m, samhapElementOf(m));
  for (const m of byType.BANGHAP ?? []) push('BANGHAP', m, banghapElementOf(m));
  // 반합은 소속 삼합군의 국 오행 (삼합 완전체 존재 시 BANHAP은 탐지 단계에서 억제됨 — branchRelations)
  for (const m of byType.BANHAP ?? []) push('BANHAP', m, samhapElementOf(samhapGroup(m[0]!)));

  return { supportBonus: Math.min(pol.max, sup), pressureBonus: Math.min(pol.max, prs), groups };
}

/** 천간합 기반(羈絆) 감쇠 — 得势 루프의 개별 천간 기여 배율.
 *  판정 재료는 patterns.transformations.candidates(present/counts)만 사용한다 —
 *  factor는 이미 破合 감쇠가 곱해져 있어 그걸 쓰면 같은 충이 두 채널로 계상된다.
 *  일간 특례는 자동 성립: 일간의 합 상대는 항상 정재/정관(압력 측)이라 비겁·인성만
 *  세는 得势 루프에 애초에 들어오지 않는다. */
function stemHapBindFactor(
  stem: StemIdx,
  transformations: any,
  pol: StrengthInteractionPolicy['stemBind'],
): number {
  if (!pol.enabled || !Array.isArray(transformations?.candidates)) return 1;
  for (const c of transformations.candidates as any[]) {
    if (!c?.present) continue;
    if (c?.stems?.a !== stem && c?.stems?.b !== stem) continue;
    const jaenghap = (c?.counts?.a ?? 0) >= 2 || (c?.counts?.b ?? 0) >= 2;
    return jaenghap ? pol.jaenghapFactor : pol.factor;
  }
  return 1;
}

function computeOfficerBindPenalty(args: {
  dayMasterStem: StemIdx;
  stems: Array<{ pos: 'year' | 'month' | 'hour'; stem: StemIdx; w: number }>;
  transformations: any;
  pol: StrengthInteractionPolicy['stemBind'];
  norm: number;
  scale: number;
}): {
  score: number;
  normalized: number;
  factor: number;
  binds: Array<{ pos: string; stem: StemIdx; tenGod: TenGod; factor: number; reduction: number }>;
} {
  if (!args.pol.enabled || !args.pol.applyToPressure) {
    return { score: 0, normalized: 0, factor: 0, binds: [] };
  }

  let score = 0;
  const binds: Array<{ pos: string; stem: StemIdx; tenGod: TenGod; factor: number; reduction: number }> = [];
  for (const s0 of args.stems) {
    const tenGod = tenGodOf(args.dayMasterStem, s0.stem);
    if (tenGod !== 'JEONG_GWAN' && tenGod !== 'PYEON_GWAN') continue;

    const factor = stemHapBindFactor(s0.stem, args.transformations, args.pol);
    if (factor >= 1) continue;

    const entryReduction = 1 - factor;
    score += s0.w * entryReduction;
    binds.push({ pos: s0.pos, stem: s0.stem, tenGod, factor, reduction: entryReduction });
  }

  const normalized = clamp01(score / Math.max(1e-9, args.norm));
  return {
    score,
    normalized,
    factor: normalized * Math.max(0, args.scale),
    binds,
  };
}

type StrengthRootPosition = 'year' | 'month' | 'day' | 'hour';

const STRENGTH_ROOT_POSITIONS: readonly StrengthRootPosition[] = ['year', 'month', 'day', 'hour'];

const DEFAULT_LIFE_STAGE_ROOT_MULTIPLIERS: Record<LifeStage, number> = {
  JANG_SAENG: 1.12,
  MOK_YOK: 0.92,
  GWAN_DAE: 1.08,
  GEON_ROK: 1.22,
  JE_WANG: 1.28,
  SWOE: 0.9,
  BYEONG: 0.78,
  SA: 0.7,
  MYO: 1.05,
  JEOL: 0.6,
  TAE: 0.88,
  YANG: 0.98,
};

interface LifeStageRootPolicy {
  enabled: boolean;
  multipliers: Record<LifeStage, number>;
}

function nonNegativeFinite(v: any, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d;
}

function readLifeStageRootPolicy(pol: any): LifeStageRootPolicy {
  const raw = pol?.lifeStageRoot ?? pol?.rootLifeStage ?? pol?.twelveStageRoot ?? {};
  const custom = raw?.multipliers ?? raw?.stageMultipliers ?? {};
  const multipliers = { ...DEFAULT_LIFE_STAGE_ROOT_MULTIPLIERS };
  for (const stage of Object.keys(multipliers) as LifeStage[]) {
    multipliers[stage] = nonNegativeFinite(custom?.[stage], multipliers[stage]);
  }
  return { enabled: raw?.enabled === true, multipliers };
}

export function computeStrengthFacts(args: {
  config: EngineConfig;
  lifeStagePolicy: LifeStagePolicy;
  tenGods: TenGodScore;
  dayMasterDirectStemWeight: number;
  dayMasterStem: StemIdx;
  monthBranch: BranchIdx;
  stems: StemIdx[];
  branches: BranchIdx[];
  hiddenStemPolicy: any;
  seasonGroup: SeasonGroup;
  /** PR-5 (감사 B448): 합충 상호작용 재료 — 미전달 시 상호작용 보정 없음(직접 호출 하위호환). */
  relationsByType?: Partial<Record<RelationType, BranchIdx[][]>>;
  /** PR-10-2 (감사 B524): pairs 보존 원본 — positional 차등용. 미전달 시 값 매칭 경로. */
  relationsDetailed?: DetectedRelation[];
  transformations?: any;
}): StrengthFacts {
  const strengthPolicy = (args.config.strategies as any)?.strength ?? {};
  const excludedDayMasterDirectStemWeight =
    strengthPolicy.excludeDayMasterSelf === true ? args.dayMasterDirectStemWeight : 0;
  const base = computeStrengthBase(args.tenGods, {
    excludedDayMasterDirectStemWeight,
  });

  // [감사 B7] 기본 모델은 deLingDiShi(월지 가중). defaultConfig(api/config.ts)가 정본이며,
  // 이 폴백은 normalizeConfig를 우회한 직접 호출 방어용이다. 'base'는 명시 opt-out.
  const model = (strengthPolicy.model ?? 'deLingDiShi') as string;

  // --- Model: deLingDiShi (得令/得地/得势)
  if (model === 'deLingDiShi' || model === 'delingdiShi' || model === 'delingsh' || model === 'deLing') {
    const dmEl = stemElement(args.dayMasterStem);
    const monthEl = branchElement(args.monthBranch);

    const pol: any = (args.config.strategies as any)?.strength ?? {};
    const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

    const lingScale = num(pol.lingScale, 0.18);
    const diScale = num(pol.diScale, 0.14);
    const shiScale = num(pol.shiScale, 0.10);

    const rootNorm = num(pol.rootNorm, 2.2);
    const shiNorm = num(pol.shiNorm, 1.6);

    const rootResAlpha = num(pol.rootResAlpha, 0.6);
    const shiResAlpha = num(pol.shiResAlpha, 0.7);

    const posW = {
      year: num(pol.positionWeights?.year, 0.6),
      month: num(pol.positionWeights?.month, 1.0),
      hour: num(pol.positionWeights?.hour, 0.8),
    };

    // 得令: month element relative to DM element (signed)
    const lingScore = seasonSupportScore(monthEl, dmEl);
    const lingFactor = lingScore * lingScale;

    // 得地/通根: weighted hidden-stem roots across 4 branches (year,month,day,hour)
    const branchWeights = [
      num(pol.branchWeights?.year, 0.7),
      num(pol.branchWeights?.month, 1.1),
      num(pol.branchWeights?.day, 0.9),
      num(pol.branchWeights?.hour, 0.7),
    ];

    // PR-5 (감사 B448/B510): 충/형 손상 → 통근 감쇠 (탐합망충 해소 포함).
    // PR-10-1 (감사 B434): opt-in 왕상휴수 비대칭 보정 재료.
    const interactionPol = readStrengthInteractionPolicy(pol);
    const rootDamage = computeBranchInteractionFactors(
      args.branches,
      args.relationsByType ?? {},
      interactionPol.root,
      { pol: interactionPol.seasonal, monthBranch: args.monthBranch },
      args.relationsDetailed,
    );

    const lifeStageRootPol = readLifeStageRootPolicy(pol);
    const lifeStagePolicy = lifeStageRootPol.enabled ? args.lifeStagePolicy : null;
    const lifeStageRootBranches = lifeStageRootPol.enabled
      ? STRENGTH_ROOT_POSITIONS.map((position, i) => {
          const branch = mod(args.branches[i]!, 12) as BranchIdx;
          const detail = lifeStageOf(args.dayMasterStem, branch, lifeStagePolicy!);
          return {
            position,
            branch,
            stage: detail.stage,
            multiplier: lifeStageRootPol.multipliers[detail.stage] ?? 1,
          };
        })
      : [];

    let same = 0;
    let res = 0;
    for (let i = 0; i < args.branches.length; i++) {
      const b = args.branches[i]!;
      const lifeStageMultiplier = lifeStageRootPol.enabled ? (lifeStageRootBranches[i]?.multiplier ?? 1) : 1;
      const bw = (branchWeights[i] ?? 1) * (rootDamage.factors[i] ?? 1) * lifeStageMultiplier;
      for (const h of hiddenStemsOfBranch(b, args.hiddenStemPolicy ?? {})) {
        const el = stemElement(h.stem);
        if (el === dmEl) same += h.weight * bw;
        if (generates(el, dmEl)) res += h.weight * bw;
      }
    }
    const diScore = Math.max(0, same + rootResAlpha * res);
    if (![same, res, diScore].every(Number.isFinite)) {
      throw new RangeError('life-stage root multipliers produced a non-finite strength score');
    }
    const diNormed = clamp01(diScore / Math.max(1e-9, rootNorm));
    const diFactor = diNormed * diScale;

    // 得势/透干: supportive stems on heaven (year/month/hour; excluding day stem)
    const stemsOther: Array<{ pos: 'year' | 'month' | 'hour'; stem: StemIdx; w: number }> = [
      { pos: 'year', stem: args.stems[0]!, w: posW.year },
      { pos: 'month', stem: args.stems[1]!, w: posW.month },
      { pos: 'hour', stem: args.stems[3]!, w: posW.hour },
    ];

    let shiSame = 0;
    let shiRes = 0;
    const stemBinds: Array<{ pos: string; stem: StemIdx; factor: number }> = [];
    for (const s0 of stemsOther) {
      const el = stemElement(s0.stem);
      // PR-5 (감사 B531): 천간합 기반(羈絆) — 묶인 투간의 기여 감쇠.
      const bindF = stemHapBindFactor(s0.stem, args.transformations, interactionPol.stemBind);
      if (bindF < 1) stemBinds.push({ pos: s0.pos, stem: s0.stem, factor: bindF });
      if (el === dmEl) shiSame += s0.w * bindF;
      if (generates(el, dmEl)) shiRes += s0.w * bindF;
    }
    const shiScore = Math.max(0, shiSame + shiResAlpha * shiRes);
    const shiNormed = clamp01(shiScore / Math.max(1e-9, shiNorm));
    const shiFactor = shiNormed * shiScale;

    // PR-5 (감사 B448): 회국(삼합/방합/반합) 보정 — 별도 4번째 항.
    const hui = computeHuiBonus(
      args.relationsByType ?? {},
      dmEl,
      interactionPol.hui,
      rootDamage.factors,
      args.branches,
    );

    const supportAdj = Math.max(0, base.support * (1 + lingFactor + diFactor + shiFactor + hui.supportBonus));
    const officerBind = computeOfficerBindPenalty({
      dayMasterStem: args.dayMasterStem,
      stems: stemsOther,
      transformations: args.transformations,
      pol: interactionPol.stemBind,
      norm: shiNorm,
      scale: shiScale,
    });
    // 상호작용은 원장(base.components)을 바꾸지 않고 (1+f) 배율 층에서만 적용한다.
    // 관성 기반도 득세와 같은 position weight → shiNorm → shiScale 경로를 사용한다.
    const pressureBase = base.components.outputs + base.components.wealth + base.components.officers;
    const pressureAdj = Math.max(0, pressureBase * Math.max(0, 1 + hui.pressureBonus - officerBind.factor));
    const totalAdj = supportAdj + pressureAdj;
    const indexAdj = totalAdj <= 0 ? 0 : (supportAdj - pressureAdj) / totalAdj;
    const supportScale = base.support > 0 ? supportAdj / base.support : 0;
    const pressureScale = pressureBase > 0 ? pressureAdj / pressureBase : 0;
    const effectiveComponents: StrengthComponents = {
      companions: base.components.companions * supportScale,
      resources: base.components.resources * supportScale,
      outputs: base.components.outputs * pressureScale,
      wealth: base.components.wealth * pressureScale,
      officers: base.components.officers * pressureScale,
    };
    return {
      index: indexAdj,
      support: supportAdj,
      pressure: pressureAdj,
      total: totalAdj,
      components: base.components,
      effectiveComponents,
      model: 'deLingDiShi',
      details: {
        delingdiShi: {
          deLing: { monthElement: monthEl, dayMasterElement: dmEl, score: lingScore, factor: lingScale },
          deDi: {
            sameElement: same,
            resourceElement: res,
            score: diScore,
            normalized: diNormed,
            factor: diScale,
            ...(lifeStageRootPol.enabled
              ? { lifeStageRoot: { enabled: true, multipliers: lifeStageRootPol.multipliers, branches: lifeStageRootBranches } }
              : {}),
          },
          deShi: { sameElement: shiSame, resourceElement: shiRes, score: shiScore, normalized: shiNormed, factor: shiScale, positionWeights: posW },
          adjusted: { support: supportAdj, pressure: pressureAdj, total: totalAdj },
          // PR-5 (감사 B448/B510/B531): 상호작용 보정 내역 — 계측·서사 재료 (additive).
          interaction: interactionPol.enabled
            ? {
                branchDamageFactors: rootDamage.factors,
                resolved: rootDamage.resolved,
                hui: { supportBonus: hui.supportBonus, pressureBonus: hui.pressureBonus, groups: hui.groups },
                stemBinds,
                ...(interactionPol.stemBind.applyToPressure
                  ? {
                      pressureStemBinds: officerBind.binds,
                      pressureStemBindPenalty: {
                        score: officerBind.score,
                        normalized: officerBind.normalized,
                        factor: officerBind.factor,
                      },
                    }
                  : {}),
              }
            : undefined,
        },
      },
    };
  }

  // --- Model: seasonalRoots (legacy advanced)
  if (model !== 'seasonalRoots') {
    return { ...base, model: 'base' };
  }

  const dmEl = stemElement(args.dayMasterStem);
  const monthEl = branchElement(args.monthBranch);

  const seasonScaleRaw = (args.config.strategies as any)?.strength?.seasonScale;
  const rootScaleRaw = (args.config.strategies as any)?.strength?.rootScale;
  const seasonScale = typeof seasonScaleRaw === 'number' && Number.isFinite(seasonScaleRaw) ? seasonScaleRaw : 0.14;
  const rootScale = typeof rootScaleRaw === 'number' && Number.isFinite(rootScaleRaw) ? rootScaleRaw : 0.1;

  const seasonScore = seasonSupportScore(monthEl, dmEl);
  const seasonFactor = seasonScore * seasonScale;

  // Rooting (通根) proxy: sum hidden-stem weights across all 4 branches.
  let same = 0;
  let res = 0;
  for (const b of args.branches) {
    for (const h of hiddenStemsOfBranch(b, args.hiddenStemPolicy ?? {})) {
      const el = stemElement(h.stem);
      if (el === dmEl) same += h.weight;
      if (generates(el, dmEl)) res += h.weight;
    }
  }

  const rootScore = Math.max(0, same + 0.6 * res);
  const rootFactor = rootScore * rootScale;

  const supportAdj = Math.max(0, base.support * (1 + seasonFactor + rootFactor));
  const pressureAdj = base.pressure;
  const totalAdj = supportAdj + pressureAdj;
  const indexAdj = totalAdj <= 0 ? 0 : (supportAdj - pressureAdj) / totalAdj;
  const supportScale = base.support > 0 ? supportAdj / base.support : 0;
  const effectiveComponents: StrengthComponents = {
    companions: base.components.companions * supportScale,
    resources: base.components.resources * supportScale,
    outputs: base.components.outputs,
    wealth: base.components.wealth,
    officers: base.components.officers,
  };
  return {
    index: indexAdj,
    support: supportAdj,
    pressure: pressureAdj,
    total: totalAdj,
    components: base.components,
    effectiveComponents,
    model: 'seasonalRoots',
    details: {
      season: {
        monthElement: monthEl,
        seasonGroup: args.seasonGroup,
        dayMasterElement: dmEl,
        score: seasonScore,
        factor: seasonScale,
      },
      roots: {
        sameElement: same,
        resourceElement: res,
        score: rootScore,
        factor: rootScale,
      },
      adjusted: { support: supportAdj, pressure: pressureAdj, total: totalAdj },
    },
  };
}
