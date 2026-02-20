import { mod } from './mod.js';

export type Element = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';
export type YinYang = 'YANG' | 'YIN';

export type StemIdx = number; // 0..9
export type BranchIdx = number; // 0..11

export interface PillarIdx {
  stem: StemIdx;
  branch: BranchIdx;
}

export const STEM_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCH_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const STEM_ELEMENT: Element[] = ['WOOD', 'WOOD', 'FIRE', 'FIRE', 'EARTH', 'EARTH', 'METAL', 'METAL', 'WATER', 'WATER'];
const STEM_YINYANG: YinYang[] = ['YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN'];

const BRANCH_ELEMENT: Element[] = [
  'WATER', // 子
  'EARTH', // 丑
  'WOOD', // 寅
  'WOOD', // 卯
  'EARTH', // 辰
  'FIRE', // 巳
  'FIRE', // 午
  'EARTH', // 未
  'METAL', // 申
  'METAL', // 酉
  'EARTH', // 戌
  'WATER', // 亥
];
const BRANCH_YINYANG: YinYang[] = ['YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN', 'YANG', 'YIN'];

export function stemHanja(idx: StemIdx): string {
  return STEM_HANJA[mod(idx, 10)];
}

export function branchHanja(idx: BranchIdx): string {
  return BRANCH_HANJA[mod(idx, 12)];
}

export function stemElement(idx: StemIdx): Element {
  return STEM_ELEMENT[mod(idx, 10)];
}

export function branchElement(idx: BranchIdx): Element {
  return BRANCH_ELEMENT[mod(idx, 12)];
}

export function stemYinYang(idx: StemIdx): YinYang {
  return STEM_YINYANG[mod(idx, 10)];
}

export function branchYinYang(idx: BranchIdx): YinYang {
  return BRANCH_YINYANG[mod(idx, 12)];
}

export function pillar(stem: StemIdx, branch: BranchIdx): PillarIdx {
  return { stem: mod(stem, 10), branch: mod(branch, 12) };
}

export function ganzhiFromIndex(idx: number): PillarIdx {
  return pillar(mod(idx, 60) % 10, mod(idx, 60) % 12);
}

/**
 * Inverse of `ganzhiFromIndex` for valid 60갑자 pairs.
 *
 * Returns null if (stem, branch) is not a valid sexagenary pair.
 *
 * Math:
 *   i ≡ stem (mod 10)
 *   i ≡ branch (mod 12)
 * gcd(10,12)=2 ⇒ solution exists iff stem≡branch (mod 2)
 */
export function ganzhiIndex(p: PillarIdx): number | null {
  const s = mod(p.stem, 10);
  const b = mod(p.branch, 12);
  const d = s - b;
  if (d % 2 !== 0) return null;
  // Solve s + 10k ≡ b (mod 12) ⇒ -2k ≡ (b - s) (mod 12) ⇒ 2k ≡ (s - b) (mod 12)
  const k = mod(d / 2, 6);
  return mod(s + 10 * k, 60);
}

export function stemIdxFromHanja(hanja: string): StemIdx | null {
  const i = (STEM_HANJA as readonly string[]).indexOf(hanja);
  return i >= 0 ? (i as StemIdx) : null;
}

export function branchIdxFromHanja(hanja: string): BranchIdx | null {
  const i = (BRANCH_HANJA as readonly string[]).indexOf(hanja);
  return i >= 0 ? (i as BranchIdx) : null;
}
