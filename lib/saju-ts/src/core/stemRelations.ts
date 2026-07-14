import type { Element, StemIdx } from './cycle.js';
import { mod } from './mod.js';

export type StemRelationType = 'HAP' | 'CHUNG' | 'GEUK';

export interface StemRelation {
  type: StemRelationType;
  /**
   * Sorted ascending. GEUK의 경우 방향이 고정된다: 6쌍 모두 작은 인덱스가
   * 극하는 쪽이다 (갑→무, 을→기, 병→경, 정→신, 무→임, 기→계).
   */
  members: [StemIdx, StemIdx]; // sorted — 천간 '값' (기존 소비자 계약, 불변)
  /** For HAP (天干合), traditional resulting element.
   * Some schools apply additional “化” conditions; we only report the classical mapping here.
   */
  resultElement?: Element;
  /**
   * additive (감사 B538·B524·B531): 참여 기둥 인덱스 전체 — 입력 배열 기준
   * (관례상 0=년 1=월 2=일 3=시). dedupe·오름차순.
   */
  pillarIndexes?: number[];
  /**
   * additive: 값-dedupe로 접히기 전 성립 기둥쌍 목록. length가 곧 중복도 —
   * 쟁합·투합(甲2+己1 등)은 pairs.length>=2로 판별된다. 각 쌍은 i<j 보장.
   */
  pairs?: Array<[number, number]>;
}

const STEM_RELATION_ORDER: readonly StemRelationType[] = ['HAP', 'CHUNG', 'GEUK'] as const;

const STEM_RELATION_RANK: Record<StemRelationType, number> = Object.fromEntries(
  STEM_RELATION_ORDER.map((t, i) => [t, i]),
) as Record<StemRelationType, number>;

function compareStemRelation(a: StemRelation, b: StemRelation): number {
  const ra = STEM_RELATION_RANK[a.type] ?? 999;
  const rb = STEM_RELATION_RANK[b.type] ?? 999;
  if (ra !== rb) return ra - rb;
  const [a0, a1] = a.members;
  const [b0, b1] = b.members;
  if (a0 !== b0) return a0 - b0;
  if (a1 !== b1) return a1 - b1;
  return 0;
}

export function stemHapPartner(i: StemIdx): StemIdx {
  return mod(i + 5, 10);
}

export function stemHapResultElement(a: StemIdx, b: StemIdx): Element | undefined {
  const x = Math.min(mod(a, 10), mod(b, 10));
  const y = Math.max(mod(a, 10), mod(b, 10));
  // 甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火
  if (x === 0 && y === 5) return 'EARTH';
  if (x === 1 && y === 6) return 'METAL';
  if (x === 2 && y === 7) return 'WATER';
  if (x === 3 && y === 8) return 'WOOD';
  if (x === 4 && y === 9) return 'FIRE';
  return undefined;
}

export function isStemChung(a: StemIdx, b: StemIdx): boolean {
  const x = Math.min(mod(a, 10), mod(b, 10));
  const y = Math.max(mod(a, 10), mod(b, 10));
  // 甲庚冲, 乙辛冲, 丙壬冲, 丁癸冲
  return (
    (x === 0 && y === 6) ||
    (x === 1 && y === 7) ||
    (x === 2 && y === 8) ||
    (x === 3 && y === 9)
  );
}

/**
 * 천간 극(剋) — 같은 음양의 상극 쌍 중 충 4쌍을 제외한 6쌍 (감사 B2):
 * 甲剋戊, 乙剋己 (木剋土) · 丙剋庚, 丁剋辛 (火剋金) · 戊剋壬, 己剋癸 (土剋水).
 * 인덱스로는 정확히 거리 4인 쌍이다 (충은 거리 6, 합은 거리 5).
 * 작은 인덱스가 항상 극하는 쪽.
 */
export function isStemGeuk(a: StemIdx, b: StemIdx): boolean {
  const x = Math.min(mod(a, 10), mod(b, 10));
  const y = Math.max(mod(a, 10), mod(b, 10));
  return y - x === 4;
}

export function detectStemRelations(stems: StemIdx[]): StemRelation[] {
  const ss = stems.map((s) => mod(s, 10));

  // 값-dedupe(members·건수·정렬 불변) 유지 + 접힌 인스턴스의 기둥쌍을
  // pairs/pillarIndexes에 병렬 보존 (감사 B538 additive — branchRelations와 동형).
  const relMap = new Map<string, StemRelation>();
  const pushRel = (type: StemRelationType, a: number, b: number, i: number, j: number, resultElement?: Element): void => {
    const lo = Math.min(a, b) as StemIdx;
    const hi = Math.max(a, b) as StemIdx;
    const key = `${type}:${lo}-${hi}`;
    const existing = relMap.get(key);
    if (existing) {
      existing.pairs!.push([i, j]);
      if (!existing.pillarIndexes!.includes(i)) existing.pillarIndexes!.push(i);
      if (!existing.pillarIndexes!.includes(j)) existing.pillarIndexes!.push(j);
      existing.pillarIndexes!.sort((x, y) => x - y);
      return;
    }
    relMap.set(key, {
      type,
      members: [lo, hi],
      ...(resultElement ? { resultElement } : {}),
      pillarIndexes: [i, j],
      pairs: [[i, j]],
    });
  };

  for (let i = 0; i < ss.length; i++) {
    for (let j = i + 1; j < ss.length; j++) {
      const a = ss[i];
      const b = ss[j];

      if (stemHapPartner(a) === b) pushRel('HAP', a, b, i, j, stemHapResultElement(a, b));
      if (isStemChung(a, b)) pushRel('CHUNG', a, b, i, j);
      if (isStemGeuk(a, b)) pushRel('GEUK', a, b, i, j);
    }
  }

  return [...relMap.values()].sort(compareStemRelation);
}
