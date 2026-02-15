export type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export const ELEMENT_KEYS: readonly ElementKey[] = [
  'Wood', 'Fire', 'Earth', 'Metal', 'Water',
] as const;

const elementAt = (el: ElementKey, offset: number): ElementKey =>
  ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(el) + offset) % 5];
const generates = (el: ElementKey) => elementAt(el, 1);
export const generatedBy = (el: ElementKey) => elementAt(el, 4);
const controls = (el: ElementKey) => elementAt(el, 2);

export const isSangGeuk = (a: ElementKey, b: ElementKey): boolean =>
  controls(a) === b || controls(b) === a;

export const elementCount = (dist: Record<ElementKey, number>, el: ElementKey | null): number =>
  el ? (dist[el] ?? 0) : 0;

export const totalCount = (dist: Record<ElementKey, number>): number =>
  ELEMENT_KEYS.reduce((acc, k) => acc + (dist[k] ?? 0), 0);

export function weightedElementAverage(
  distribution: Record<ElementKey, number>,
  selector: (el: ElementKey) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) return 0;
  return ELEMENT_KEYS.reduce((w, el) => w + selector(el) * (distribution[el] ?? 0), 0) / total;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizeSignedScore = (value: number): number =>
  clamp((value + 1) * 50, 0, 100);

export const emptyDistribution = (): Record<ElementKey, number> =>
  ({ Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 });

export function distributionFromArrangement(arr: readonly ElementKey[]): Record<ElementKey, number> {
  const d = emptyDistribution();
  for (const el of arr) d[el]++;
  return d;
}

export const sum = (v: readonly number[]): number => v.reduce((a, x) => a + x, 0);

export const adjustTo81 = (v: number): number =>
  v <= 81 ? v : ((v - 1) % 81) + 1;

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

export function calculateBalanceScore(dist: Readonly<Record<ElementKey, number>>): number {
  const total = totalCount(dist);
  if (total === 0) return 0;
  const avg = total / 5;
  let dev = 0;
  for (const k of ELEMENT_KEYS) dev += Math.abs((dist[k] ?? 0) - avg);
  return Math.max(25, 100 - 15 * Math.ceil(Math.max(0, dev - 2) / 2));
}

export function checkElementSangSaeng(
  arrangement: readonly ElementKey[],
  surnameLength: number,
): boolean {
  if (arrangement.length < 2) return true;
  const s2 = surnameLength === 2;
  const startIdx = s2 ? 1 : 0;
  for (let i = startIdx; i < arrangement.length - 1; i++)
    if (isSangGeuk(arrangement[i], arrangement[i + 1])) return false;
  const cStart = startIdx + 1;
  let cons = 1;
  for (let i = cStart; i < arrangement.length; i++) {
    cons = arrangement[i] === arrangement[i - 1] ? cons + 1 : 1;
    if (cons >= 3) return false;
  }
  if (!(s2 && arrangement.length === 3))
    if (isSangGeuk(arrangement[0], arrangement[arrangement.length - 1])) return false;
  let relCount = 0, ssCount = 0;
  for (let i = 0; i < arrangement.length - 1; i++) {
    if (s2 && i === 0) continue;
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
  for (let i = 0; i < len - 1; i++)
    if (isSangGeuk(arrangement[i], arrangement[i + 1])) return false;
  if (isSangGeuk(arrangement[len - 1], arrangement[0])) return false;
  return new Set(arrangement.slice(0, len)).size > 1;
}

export function countDominant(distribution: Record<ElementKey, number>): boolean {
  const total = totalCount(distribution);
  return ELEMENT_KEYS.some(k => distribution[k] > total / 2);
}

export function computePolarityResult(
  arrangement: readonly PolarityValue[],
  surnameLength: number,
): { score: number; isPassed: boolean } {
  if (arrangement.length === 0) return { score: 0, isPassed: true };
  const neg = arrangement.filter(v => v === 'Negative').length;
  const ratio = Math.min(neg, arrangement.length - neg) / arrangement.length;
  const rs = ratio >= 0.4 ? 50 : ratio >= 0.3 ? 35 : ratio >= 0.2 ? 20 : 10;
  const isPassed = arrangement.length >= 2 && neg > 0 && neg < arrangement.length
    && !(surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]);
  return { score: 40 + rs, isPassed };
}

const FORTUNE_BUCKETS: [string, number][] = [
  ['최상', 25], ['상', 20], ['양', 15], ['최흉', 0], ['흉', 5],
];

export function bucketFromFortune(fortune: string): number {
  return FORTUNE_BUCKETS.find(([k]) => (fortune ?? '').includes(k))?.[1] ?? 10;
}
