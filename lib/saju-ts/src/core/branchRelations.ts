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
  | 'SAMHAP'
  | 'BANGHAP';

export interface DetectedRelation {
  type: RelationType;
  members: BranchIdx[]; // sorted
}

const RELATION_ORDER: readonly RelationType[] = [
  'CHUNG',
  'YUKHAP',
  'HYEONG',
  'JA_HYEONG',
  'SAMHYEONG',
  'HAE',
  'PA',
  'WONJIN',
  'SAMHAP',
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

export function detectBranchRelations(branches: BranchIdx[]): DetectedRelation[] {
  const bs = branches.map((b) => mod(b, 12));

  const rels: DetectedRelation[] = [];

  // Pair relations
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];

      if (chungPartner(a) === b) rels.push({ type: 'CHUNG', members: [a, b].sort((x, y) => x - y) });
      if (yukhapPartner(a) === b) rels.push({ type: 'YUKHAP', members: [a, b].sort((x, y) => x - y) });
      if (haePartner(a) === b) rels.push({ type: 'HAE', members: [a, b].sort((x, y) => x - y) });
      if (paPartner(a) === b) rels.push({ type: 'PA', members: [a, b].sort((x, y) => x - y) });
      if (wonjinPartner(a) === b) rels.push({ type: 'WONJIN', members: [a, b].sort((x, y) => x - y) });

      // Punishment (刑)
      if (a === b && isJaHyeongBranch(a)) rels.push({ type: 'JA_HYEONG', members: [a, b] });
      if (a !== b && isHyeongPair(a, b)) rels.push({ type: 'HYEONG', members: [a, b].sort((x, y) => x - y) });
    }
  }

  const pairDeduped = uniqByKey(
    rels.filter((r) => r.members.length === 2),
    (r) => `${r.type}:${pairKey(r.members[0], r.members[1])}`,
  );

  // Triple relations: 삼합, 방합 (only if all 3 are present)
  const set = new Set(bs);
  const tripleRels: DetectedRelation[] = [];
  for (const b of bs) {
    const s = samhapGroup(b);
    if (s.every((x) => set.has(x))) tripleRels.push({ type: 'SAMHAP', members: s });

    const f = banghapGroup(b);
    if (f.every((x) => set.has(x))) tripleRels.push({ type: 'BANGHAP', members: f });
  }

  // 삼형(三刑) full-set indicators
  const samhyeongTrio: BranchIdx[][] = [
    [2, 5, 8], // 寅巳申
    [1, 7, 10], // 丑未戌
  ];
  for (const trio of samhyeongTrio) {
    if (trio.every((x) => set.has(x))) tripleRels.push({ type: 'SAMHYEONG', members: [...trio].sort((a, b) => a - b) });
  }

  const tripleDeduped = uniqByKey(tripleRels, (r) => `${r.type}:${tripleKey(r.members)}`);

  return [...pairDeduped, ...tripleDeduped].sort(compareDetectedRelation);
}
