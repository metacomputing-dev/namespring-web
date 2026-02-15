export type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export const ELEMENT_KEYS: readonly ElementKey[] = [
  'Wood', 'Fire', 'Earth', 'Metal', 'Water',
] as const;

export function generates(el: ElementKey): ElementKey {
  return ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(el) + 1) % 5];
}

export function generatedBy(el: ElementKey): ElementKey {
  return ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(el) + 4) % 5];
}

export function controls(el: ElementKey): ElementKey {
  return ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(el) + 2) % 5];
}

export function controlledBy(el: ElementKey): ElementKey {
  return ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(el) + 3) % 5];
}

export function isSangSaeng(a: ElementKey, b: ElementKey): boolean {
  return generates(a) === b;
}

export function isSangGeuk(a: ElementKey, b: ElementKey): boolean {
  return controls(a) === b || controls(b) === a;
}

export function elementFromSajuCode(
  value: string | null | undefined,
): ElementKey | null {
  switch (value) {
    case 'WOOD':  return 'Wood';
    case 'FIRE':  return 'Fire';
    case 'EARTH': return 'Earth';
    case 'METAL': return 'Metal';
    case 'WATER': return 'Water';
    case 'Wood': case 'Fire': case 'Earth': case 'Metal': case 'Water':
      return value as ElementKey;
    default: return null;
  }
}

export function elementCount(
  dist: Record<ElementKey, number>,
  el: ElementKey | null,
): number {
  return el ? (dist[el] ?? 0) : 0;
}

export function totalCount(dist: Record<ElementKey, number>): number {
  return ELEMENT_KEYS.reduce((acc, k) => acc + (dist[k] ?? 0), 0);
}

export function weightedElementAverage(
  distribution: Record<ElementKey, number>,
  selector: (el: ElementKey) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) return 0;
  let w = 0;
  for (const el of ELEMENT_KEYS) {
    const c = distribution[el] ?? 0;
    if (c > 0) w += selector(el) * c;
  }
  return w / total;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeSignedScore(value: number): number {
  return clamp((value + 1) * 50, 0, 100);
}

export function emptyDistribution(): Record<ElementKey, number> {
  return { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
}

export function distributionFromArrangement(
  arrangement: readonly ElementKey[],
): Record<ElementKey, number> {
  const d = emptyDistribution();
  for (const el of arrangement) d[el] = (d[el] ?? 0) + 1;
  return d;
}

export function sum(v: readonly number[]): number {
  let o = 0;
  for (const x of v) o += x;
  return o;
}

export function adjustTo81(v: number): number {
  return v <= 81 ? v : ((v - 1) % 81) + 1;
}

export type PolarityValue = 'Positive' | 'Negative';

export function calculateArrayScore(
  arrangement: readonly ElementKey[],
  surnameLength = 1,
): number {
  if (arrangement.length < 2) return 100;
  let ss = 0, sg = 0, sm = 0;
  for (let i = 0; i < arrangement.length - 1; i++) {
    if (surnameLength === 2 && i === 0) continue;
    const a = arrangement[i], b = arrangement[i + 1];
    if (isSangSaeng(a, b)) ss++;
    else if (isSangGeuk(a, b)) sg++;
    else if (a === b) sm++;
  }
  return clamp(70 + ss * 15 - sg * 20 - sm * 5, 0, 100);
}

export function calculateBalanceScore(
  distribution: Readonly<Record<ElementKey, number>>,
): number {
  const total = ELEMENT_KEYS.reduce((acc, k) => acc + (distribution[k] ?? 0), 0);
  if (total === 0) return 0;
  const avg = total / 5;
  let dev = 0;
  for (const k of ELEMENT_KEYS) dev += Math.abs((distribution[k] ?? 0) - avg);
  const thresholds: readonly (readonly [number, number])[] = [
    [2, 100], [4, 85], [6, 70], [8, 55], [10, 40],
  ];
  for (const [th, sc] of thresholds) {
    if (dev <= th) return sc;
  }
  return 25;
}

export function checkElementSangSaeng(
  arrangement: readonly ElementKey[],
  surnameLength: number,
): boolean {
  if (arrangement.length < 2) return true;

  const startIdx = surnameLength === 2 ? 1 : 0;
  for (let i = startIdx; i < arrangement.length - 1; i++) {
    if (isSangGeuk(arrangement[i], arrangement[i + 1])) return false;
  }

  const cStart = surnameLength === 2 ? 2 : 1;
  let cons = 1;
  for (let i = cStart; i < arrangement.length; i++) {
    cons = arrangement[i] === arrangement[i - 1] ? cons + 1 : 1;
    if (cons >= 3) return false;
  }

  if (!(surnameLength === 2 && arrangement.length === 3)) {
    if (isSangGeuk(arrangement[0], arrangement[arrangement.length - 1])) return false;
  }

  let relCount = 0, ssCount = 0;
  for (let i = 0; i < arrangement.length - 1; i++) {
    if (surnameLength === 2 && i === 0) continue;
    if (arrangement[i] === arrangement[i + 1]) continue;
    relCount++;
    if (isSangSaeng(arrangement[i], arrangement[i + 1])) ssCount++;
  }
  return relCount === 0 || ssCount / relCount >= 0.6;
}

export function checkFourFrameSuriElement(
  arrangement: readonly ElementKey[],
  givenNameLength: number,
): boolean {
  const checked =
    givenNameLength === 1 && arrangement.length === 3
      ? arrangement.slice(0, 2)
      : arrangement.slice();
  if (checked.length < 2) return false;
  for (let i = 0; i < checked.length - 1; i++) {
    if (isSangGeuk(checked[i], checked[i + 1])) return false;
  }
  if (isSangGeuk(checked[checked.length - 1], checked[0])) return false;
  return new Set(checked).size > 1;
}

export function countDominant(
  distribution: Record<ElementKey, number>,
): boolean {
  const total = ELEMENT_KEYS.reduce((acc, k) => acc + distribution[k], 0);
  const th = Math.floor(total / 2) + 1;
  return ELEMENT_KEYS.some(k => distribution[k] >= th);
}

function checkPolarityHarmony(
  arrangement: readonly PolarityValue[],
  surnameLength: number,
): boolean {
  if (arrangement.length < 2) return true;
  const neg = arrangement.filter(v => v === 'Negative').length;
  const pos = arrangement.length - neg;
  if (neg === 0 || pos === 0) return false;
  if (surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]) return false;
  return true;
}

function polarityScore(negCount: number, posCount: number): number {
  const total = Math.max(0, negCount + posCount);
  if (total === 0) return 0;
  const ratio = Math.min(negCount, posCount) / total;
  const thresholds: readonly (readonly [number, number])[] = [
    [0.4, 50], [0.3, 35], [0.2, 20],
  ];
  let rs = 10;
  for (const [th, sc] of thresholds) {
    if (ratio >= th) { rs = sc; break; }
  }
  return 40 + rs;
}

export function computePolarityResult(
  arrangement: readonly PolarityValue[],
  surnameLength: number,
): { score: number; isPassed: boolean } {
  const neg = arrangement.filter(v => v === 'Negative').length;
  const pos = arrangement.length - neg;
  return {
    score: polarityScore(neg, pos),
    isPassed: checkPolarityHarmony(arrangement, surnameLength),
  };
}

export function bucketFromFortune(fortune: string): number {
  const f = fortune ?? '';
  if (f.includes('최상운수') || f.includes('최상')) return 25;
  if (f.includes('상운수') || f.includes('상'))     return 20;
  if (f.includes('양운수') || f.includes('양'))     return 15;
  if (f.includes('최흉운수') || f.includes('최흉')) return 0;
  if (f.includes('흉운수') || f.includes('흉'))     return 5;
  return 10;
}
