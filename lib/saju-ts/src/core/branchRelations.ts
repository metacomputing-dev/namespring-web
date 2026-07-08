import type { BranchIdx } from './cycle.js';
import { branchYinYang } from './cycle.js';
import { mod } from './mod.js';

export type RelationType =
  | 'YUKHAP'
  | 'CHUNG'
  | 'HYEONG'
  | 'JA_HYEONG'
  | 'SAMHYEONG'
  | 'HAE'
  | 'PA'
  | 'WONJIN'
  | 'GWIMUN'   // 귀문관살(鬼門關殺) 쌍 — 원진과 4조합 겹치나 별개 신살 (다수설 병기)
  | 'SAMHAP'
  | 'BANHAP'   // 반합(半合): 왕지 포함 삼합 2자 (주의: BANGHAP=방합과 다름)
  | 'BANGHAP';

export interface DetectedRelation {
  type: RelationType;
  members: BranchIdx[]; // sorted — 지지 '값' (기존 소비자 계약, 불변)
  /**
   * additive (감사 B538): 참여 기둥 인덱스 전체 — 입력 배열 기준(관례상
   * 0=년 1=월 2=일 3=시). dedupe·오름차순.
   */
  pillarIndexes?: number[];
  /**
   * additive (감사 B538): pair 관계 한정 — 값-dedupe로 접히기 전 성립 기둥쌍
   * 목록. length가 곧 중복도(예: 午2+子1 충 → pairs 2건). 각 쌍은 i<j 보장.
   * 인접성 판정(|i-j|===1)은 소비 측에서 파생 계산한다 (감사 B524).
   */
  pairs?: Array<[number, number]>;
}

/** 방출 가능한 지지 관계 타입 전수 (라벨 커버리지 테스트가 소비). */
export const RELATION_ORDER: readonly RelationType[] = [
  'CHUNG',
  'YUKHAP',
  'HYEONG',
  'JA_HYEONG',
  'SAMHYEONG',
  'HAE',
  'PA',
  'WONJIN',
  'GWIMUN',
  'SAMHAP',
  'BANHAP',
  'BANGHAP',
] as const;

const RELATION_RANK: Record<RelationType, number> = Object.fromEntries(
  RELATION_ORDER.map((t, i) => [t, i]),
) as Record<RelationType, number>;

function compareDetectedRelation(a: DetectedRelation, b: DetectedRelation): number {
  const ra = RELATION_RANK[a.type] ?? 999;
  const rb = RELATION_RANK[b.type] ?? 999;
  if (ra !== rb) return ra - rb;

  const la = a.members.length;
  const lb = b.members.length;
  if (la !== lb) return la - lb;

  for (let i = 0; i < Math.min(la, lb); i++) {
    const da = a.members[i] ?? 0;
    const db = b.members[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function chungPartner(i: BranchIdx): BranchIdx {
  return mod(i + 6, 12);
}

export function yukhapPartner(i: BranchIdx): BranchIdx {
  return mod(1 - i, 12);
}

export function haePartner(i: BranchIdx): BranchIdx {
  return mod(7 - i, 12);
}

export function paPartner(i: BranchIdx): BranchIdx {
  const yang = branchYinYang(i) === 'YANG';
  return yang ? mod(i + 9, 12) : mod(i + 3, 12);
}

export function wonjinPartner(i: BranchIdx): BranchIdx {
  const yang = branchYinYang(i) === 'YANG';
  return yang ? mod(i + 7, 12) : mod(i + 5, 12);
}

/**
 * 귀문관살(鬼門關殺) 6조합 (다수설): 子酉·丑午·寅未·卯申·辰亥·巳戌.
 * 원진과 丑午·卯申·辰亥·巳戌 4조합이 겹치지만 별개 신살로 병기하는 것이
 * 다수설이며, 子酉·寅未는 귀문 전용 조합이다 (감사 B9).
 */
const GWIMUN_PARTNER: readonly number[] = [9, 6, 7, 8, 11, 10, 1, 2, 3, 0, 5, 4];

export function gwimunPartner(i: BranchIdx): BranchIdx {
  return GWIMUN_PARTNER[mod(i, 12)]! as BranchIdx;
}

// --- Punishment (刑)

function isHyeongPair(a: BranchIdx, b: BranchIdx): boolean {
  const x = Math.min(mod(a, 12), mod(b, 12));
  const y = Math.max(mod(a, 12), mod(b, 12));
  // 寅巳申 (2,5,8)
  if ((x === 2 && y === 5) || (x === 2 && y === 8) || (x === 5 && y === 8)) return true;
  // 丑未戌 (1,7,10)
  if ((x === 1 && y === 7) || (x === 1 && y === 10) || (x === 7 && y === 10)) return true;
  // 子卯 (0,3)
  if (x === 0 && y === 3) return true;
  return false;
}

function isJaHyeongBranch(b: BranchIdx): boolean {
  const x = mod(b, 12);
  // 辰辰, 午午, 酉酉, 亥亥
  return x === 4 || x === 6 || x === 9 || x === 11;
}

export function samhapGroup(i: BranchIdx): BranchIdx[] {
  const a = mod(i, 12);
  return [a, mod(a + 4, 12), mod(a + 8, 12)].sort((x, y) => x - y);
}

export function banghapGroup(i: BranchIdx): BranchIdx[] {
  const d = mod(i - 2, 12);
  const start = 2 + 3 * Math.floor(d / 3);
  return [mod(start, 12), mod(start + 1, 12), mod(start + 2, 12)].sort((x, y) => x - y);
}

function uniqByKey<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function pairKey(a: number, b: number): string {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}-${y}`;
}

function tripleKey(xs: number[]): string {
  return [...xs].sort((a, b) => a - b).join('-');
}

/** 왕지(旺支) 여부 — 子(0)·卯(3)·午(6)·酉(9). */
export function isWangji(i: BranchIdx): boolean {
  return mod(i, 12) % 3 === 0;
}

export function detectBranchRelations(branches: BranchIdx[]): DetectedRelation[] {
  const bs = branches.map((b) => mod(b, 12));
  const set = new Set(bs);

  // pair 관계: 값-dedupe(members·건수·정렬 불변)를 유지하되, 접힌 인스턴스의
  // 기둥쌍을 pairs/pillarIndexes에 병렬 보존한다 (감사 B538 additive).
  // Map 삽입 순서 = 기존 uniqByKey의 첫-등장 순서와 동일.
  const pairMap = new Map<string, DetectedRelation>();
  const pushPair = (type: RelationType, a: number, b: number, i: number, j: number): void => {
    const key = `${type}:${pairKey(a, b)}`;
    const existing = pairMap.get(key);
    if (existing) {
      existing.pairs!.push([i, j]);
      if (!existing.pillarIndexes!.includes(i)) existing.pillarIndexes!.push(i);
      if (!existing.pillarIndexes!.includes(j)) existing.pillarIndexes!.push(j);
      existing.pillarIndexes!.sort((x, y) => x - y);
      return;
    }
    pairMap.set(key, {
      type,
      members: type === 'JA_HYEONG' ? [a, b] : [a, b].sort((x, y) => x - y),
      pillarIndexes: [i, j],
      pairs: [[i, j]],
    });
  };

  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];

      if (chungPartner(a) === b) pushPair('CHUNG', a, b, i, j);
      if (yukhapPartner(a) === b) pushPair('YUKHAP', a, b, i, j);
      if (haePartner(a) === b) pushPair('HAE', a, b, i, j);
      if (paPartner(a) === b) pushPair('PA', a, b, i, j);
      if (wonjinPartner(a) === b) pushPair('WONJIN', a, b, i, j);
      if (a !== b && gwimunPartner(a) === b) pushPair('GWIMUN', a, b, i, j);

      // Punishment (刑)
      if (a === b && isJaHyeongBranch(a)) pushPair('JA_HYEONG', a, b, i, j);
      if (a !== b && isHyeongPair(a, b)) pushPair('HYEONG', a, b, i, j);

      // 반합(半合) — 같은 삼합군 2자 + 왕지 포함(생지반합·묘지반합)이 주류 성립 조건.
      // 왕지 없는 생지+고지(가합)는 불인정. 삼합 3자 완전체가 있으면 SAMHAP만 보고하고
      // 부분집합 반합은 억제한다 (감사 B3 — 운 경로 fortuneCalculator와 규칙 통일).
      if (a !== b && (mod(a - b, 12) === 4 || mod(a - b, 12) === 8) && (isWangji(a) || isWangji(b))) {
        const group = samhapGroup(a);
        if (!group.every((x) => set.has(x))) {
          pushPair('BANHAP', a, b, i, j);
        }
      }
    }
  }

  const pairDeduped = [...pairMap.values()];

  // Triple relations: 삼합, 방합 (only if all 3 are present)
  // pillarIndexes = 그룹 3값이 등장하는 모든 기둥 인덱스 (값별 세분은 후속 additive).
  const pillarsOfValues = (values: BranchIdx[]): number[] => {
    const vs = new Set<number>(values as number[]);
    const out: number[] = [];
    for (let i = 0; i < bs.length; i++) if (vs.has(bs[i]!)) out.push(i);
    return out;
  };
  const tripleRels: DetectedRelation[] = [];
  for (const b of bs) {
    const s = samhapGroup(b);
    if (s.every((x) => set.has(x))) tripleRels.push({ type: 'SAMHAP', members: s, pillarIndexes: pillarsOfValues(s) });

    const f = banghapGroup(b);
    if (f.every((x) => set.has(x))) tripleRels.push({ type: 'BANGHAP', members: f, pillarIndexes: pillarsOfValues(f) });
  }

  // 삼형(三刑) full-set indicators
  const samhyeongTrio: BranchIdx[][] = [
    [2, 5, 8], // 寅巳申
    [1, 7, 10], // 丑未戌
  ];
  for (const trio of samhyeongTrio) {
    if (trio.every((x) => set.has(x))) {
      tripleRels.push({ type: 'SAMHYEONG', members: [...trio].sort((a, b) => a - b), pillarIndexes: pillarsOfValues(trio) });
    }
  }

  const tripleDeduped = uniqByKey(tripleRels, (r) => `${r.type}:${tripleKey(r.members)}`);

  return [...pairDeduped, ...tripleDeduped].sort(compareDetectedRelation);
}
