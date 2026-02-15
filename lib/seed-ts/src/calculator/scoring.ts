export type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export const ELEMENT_KEYS: readonly ElementKey[] = [
  'Wood', 'Fire', 'Earth', 'Metal', 'Water',
] as const;

const elementAt = (el: ElementKey, offset: number): ElementKey =>
  ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(el) + offset) % 5];
export const generates = (el: ElementKey) => elementAt(el, 1);
export const generatedBy = (el: ElementKey) => elementAt(el, 4);
export const controls = (el: ElementKey) => elementAt(el, 2);
export const controlledBy = (el: ElementKey) => elementAt(el, 3);

export const isSangGeuk = (a: ElementKey, b: ElementKey): boolean =>
  controls(a) === b || controls(b) === a;

const SAJU_CODE_MAP: Record<string, ElementKey> = {
  WOOD: 'Wood', FIRE: 'Fire', EARTH: 'Earth', METAL: 'Metal', WATER: 'Water',
};

export function elementFromSajuCode(value: string | null | undefined): ElementKey | null {
  return value != null ? (SAJU_CODE_MAP[value.toUpperCase()] ?? null) : null;
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
    if (generates(a) === b) ss++;
    else if (isSangGeuk(a, b)) sg++;
    else if (a === b) sm++;
  }
  return clamp(70 + ss * 15 - sg * 20 - sm * 5, 0, 100);
}

export function calculateBalanceScore(
  distribution: Readonly<Record<ElementKey, number>>,
): number {
  const total = totalCount(distribution);
  if (total === 0) return 0;
  const avg = total / 5;
  let dev = 0;
  for (const k of ELEMENT_KEYS) dev += Math.abs((distribution[k] ?? 0) - avg);
  return Math.max(25, 100 - 15 * Math.ceil(Math.max(0, dev - 2) / 2));
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
    if (generates(arrangement[i]) === arrangement[i + 1]) ssCount++;
  }
  return relCount === 0 || ssCount / relCount >= 0.6;
}

export function checkFourFrameSuriElement(
  arrangement: readonly ElementKey[],
  givenNameLength: number,
): boolean {
  const len = givenNameLength === 1 && arrangement.length === 3 ? 2 : arrangement.length;
  if (len < 2) return false;
  for (let i = 0; i < len - 1; i++) {
    if (isSangGeuk(arrangement[i], arrangement[i + 1])) return false;
  }
  if (isSangGeuk(arrangement[len - 1], arrangement[0])) return false;
  return new Set(arrangement.slice(0, len)).size > 1;
}

export function countDominant(distribution: Record<ElementKey, number>): boolean {
  const total = ELEMENT_KEYS.reduce((a, k) => a + distribution[k], 0);
  return ELEMENT_KEYS.some(k => distribution[k] > total / 2);
}

export function computePolarityResult(
  arrangement: readonly PolarityValue[],
  surnameLength: number,
): { score: number; isPassed: boolean } {
  const neg = arrangement.filter(v => v === 'Negative').length;
  if (arrangement.length === 0) return { score: 0, isPassed: true };
  const ratio = Math.min(neg, arrangement.length - neg) / arrangement.length;
  const rs = ratio >= 0.4 ? 50 : ratio >= 0.3 ? 35 : ratio >= 0.2 ? 20 : 10;
  const isPassed = arrangement.length >= 2 && neg > 0 && neg < arrangement.length
    && !(surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]);
  return { score: 40 + rs, isPassed };
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
