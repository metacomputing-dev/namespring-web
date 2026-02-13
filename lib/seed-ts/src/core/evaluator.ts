import {
  DEFAULT_POLARITY_BY_PARITY,
  LAST_DIGIT_ELEMENT,
  ELEMENT_INDEX,
} from "./constants.js";
import type {
  BirthInfo,
  Element,
  FourFrame,
  Frame,
  FrameInsight,
  LuckyLevel,
  NameInput,
  NameStatistics,
  Polarity,
  ResolvedName,
  SeedResponse,
  StatsRepository,
  Status,
} from "./types.js";
import { clamp } from "./utils.js";

const W_MAJOR = 0.2;
const W_MINOR = 0.15;

const FORTUNE_TOP = "\uCD5C\uC0C1\uC6B4\uC218";
const FORTUNE_HIGH = "\uC0C1\uC6B4\uC218";
const FORTUNE_GOOD = "\uC591\uC6B4\uC218";
const FORTUNE_WORST = "\uCD5C\uD749\uC6B4\uC218";
const FORTUNE_BAD = "\uD749\uC6B4\uC218";

const ELEMENT_KEYS: Element[] = ["\u6728", "\u706B", "\u571F", "\u91D1", "\u6C34"];

interface SajuContext {
  sajuDistribution: Record<Element, number>;
}

function statusFromPass(pass: boolean): Status {
  return pass ? "POSITIVE" : "NEGATIVE";
}

function createInsight(
  frame: Frame,
  score: number,
  isPassed: boolean,
  arrangement: string,
  details: Record<string, unknown> = {},
): FrameInsight {
  const normalizedScore = Math.trunc(clamp(score, 0, 100));
  return {
    frame,
    domain: frame,
    score: normalizedScore,
    isPassed,
    status: statusFromPass(isPassed),
    arrangement,
    details,
  };
}

function distributionFromArrangement(arrangement: readonly Element[]): Record<Element, number> {
  const out: Record<Element, number> = {
    "\u6728": 0,
    "\u706B": 0,
    "\u571F": 0,
    "\u91D1": 0,
    "\u6C34": 0,
  };
  for (const value of arrangement) {
    out[value] += 1;
  }
  return out;
}

export function isSangSaeng(first: Element, second: Element): boolean {
  return (ELEMENT_INDEX[first] + 1) % 5 === ELEMENT_INDEX[second];
}

export function isSangGeuk(first: Element, second: Element): boolean {
  const a = ELEMENT_INDEX[first];
  const b = ELEMENT_INDEX[second];
  return (a + 2) % 5 === b || (b + 2) % 5 === a;
}

export function calculateArrayScore(arrangement: readonly Element[], surnameLength = 1): number {
  if (arrangement.length < 2) {
    return 100;
  }
  let sangSaeng = 0;
  let sangGeuk = 0;
  let same = 0;
  for (let i = 0; i < arrangement.length - 1; i += 1) {
    if (surnameLength === 2 && i === 0) {
      continue;
    }
    const a = arrangement[i] as Element;
    const b = arrangement[i + 1] as Element;
    if (isSangSaeng(a, b)) {
      sangSaeng += 1;
    } else if (isSangGeuk(a, b)) {
      sangGeuk += 1;
    } else if (a === b) {
      same += 1;
    }
  }
  return clamp(70 + sangSaeng * 15 - sangGeuk * 20 - same * 5, 0, 100);
}

export function calculateBalanceScore(distribution: Readonly<Record<Element, number>>): number {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
  if (total === 0) {
    return 0;
  }
  const avg = total / 5;
  let deviation = 0;
  for (const key of ELEMENT_KEYS) {
    deviation += Math.abs((distribution[key] ?? 0) - avg);
  }
  if (deviation <= 2) return 100;
  if (deviation <= 4) return 85;
  if (deviation <= 6) return 70;
  if (deviation <= 8) return 55;
  if (deviation <= 10) return 40;
  return 25;
}

export function checkPolarityHarmony(arrangement: readonly Polarity[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }
  const eum = arrangement.filter((value) => value === "\u9670").length;
  const yang = arrangement.length - eum;
  if (eum === 0 || yang === 0) {
    return false;
  }
  if (surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]) {
    return false;
  }
  return true;
}

export function checkElementSangSaeng(arrangement: readonly Element[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }

  const startIdx = surnameLength === 2 ? 1 : 0;
  for (let i = startIdx; i < arrangement.length - 1; i += 1) {
    if (isSangGeuk(arrangement[i] as Element, arrangement[i + 1] as Element)) {
      return false;
    }
  }

  const consecutiveStart = surnameLength === 2 ? 2 : 1;
  let consecutive = 1;
  for (let i = consecutiveStart; i < arrangement.length; i += 1) {
    if (arrangement[i] === arrangement[i - 1]) {
      consecutive += 1;
      if (consecutive >= 3) {
        return false;
      }
    } else {
      consecutive = 1;
    }
  }

  if (!(surnameLength === 2 && arrangement.length === 3)) {
    if (isSangGeuk(arrangement[0] as Element, arrangement[arrangement.length - 1] as Element)) {
      return false;
    }
  }

  let relationCount = 0;
  let sangSaengCount = 0;
  for (let i = 0; i < arrangement.length - 1; i += 1) {
    if (surnameLength === 2 && i === 0) {
      continue;
    }
    const a = arrangement[i] as Element;
    const b = arrangement[i + 1] as Element;
    if (a === b) {
      continue;
    }
    relationCount += 1;
    if (isSangSaeng(a, b)) {
      sangSaengCount += 1;
    }
  }

  if (relationCount > 0 && sangSaengCount / relationCount < 0.6) {
    return false;
  }
  return true;
}

export function checkFourFrameSuriElement(arrangement: readonly Element[], givenNameLength: number): boolean {
  const checked =
    givenNameLength === 1 && arrangement.length === 3
      ? arrangement.slice(0, 2)
      : arrangement.slice();
  if (checked.length < 2) {
    return false;
  }
  for (let i = 0; i < checked.length - 1; i += 1) {
    if (isSangGeuk(checked[i] as Element, checked[i + 1] as Element)) {
      return false;
    }
  }
  if (isSangGeuk(checked[checked.length - 1] as Element, checked[0] as Element)) {
    return false;
  }
  return new Set(checked).size > 1;
}

// Legacy export aliases
export const checkEumYangHarmony = checkPolarityHarmony;
export const checkOhaengSangSaeng = checkElementSangSaeng;
export const checkSagyeokSuriOhaeng = checkFourFrameSuriElement;

function bucketFromFortune(fortune: string): number {
  const f = fortune ?? "";
  if (f.includes(FORTUNE_TOP) || f.includes("\uCD5C\uC0C1")) return 25;
  if (f.includes(FORTUNE_HIGH) || f.includes("\uC0C1")) return 20;
  if (f.includes(FORTUNE_GOOD) || f.includes("\uC591")) return 15;
  if (f.includes(FORTUNE_WORST) || f.includes("\uCD5C\uD749")) return 0;
  if (f.includes(FORTUNE_BAD) || f.includes("\uD749")) return 5;
  return 10;
}

function adjustTo81(value: number): number {
  if (value <= 81) {
    return value;
  }
  return ((value - 1) % 81) + 1;
}

function calculateWonHyeongIJeong(surnameStrokeCounts: number[], givenStrokeCounts: number[]): FourFrame {
  const padded = [...givenStrokeCounts];
  if (padded.length === 1) {
    padded.push(0);
  }
  const mid = Math.floor(padded.length / 2);
  const myeongsangja = padded.slice(0, mid).reduce((a, b) => a + b, 0);
  const myeonghaja = padded.slice(mid).reduce((a, b) => a + b, 0);
  const surnameTotal = surnameStrokeCounts.reduce((a, b) => a + b, 0);
  const nameTotalOriginal = givenStrokeCounts.reduce((a, b) => a + b, 0);
  const paddedTotal = padded.reduce((a, b) => a + b, 0);
  return {
    won: adjustTo81(paddedTotal),
    hyeong: adjustTo81(surnameTotal + myeongsangja),
    i: adjustTo81(surnameTotal + myeonghaja),
    jeong: adjustTo81(surnameTotal + nameTotalOriginal),
  };
}

function levelToFortune(level: LuckyLevel): string {
  return level;
}

function computeSajuJawonScore(
  sajuDistribution: Record<Element, number>,
  jawonDistribution: Record<Element, number>,
): { score: number; isPassed: boolean; combined: Record<Element, number> } {
  const initial = ELEMENT_KEYS.map((key) => sajuDistribution[key] ?? 0);
  const jawon = ELEMENT_KEYS.map((key) => jawonDistribution[key] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, idx) => initial[idx] + jawon[idx]);
  const r = jawon.reduce((a, b) => a + b, 0);

  const delta = finalArr.map((value, idx) => value - initial[idx]);
  if (delta.some((value) => value < 0)) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }
  if (delta.reduce((a, b) => a + b, 0) !== r) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }

  const optimal = computeOptimalSorted(initial, r);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((value, idx) => value === optimal[idx]);
  const finalZero = finalArr.filter((value) => value === 0).length;
  const optZero = optimal.filter((value) => value === 0).length;
  const spread = spreadOf(finalArr);
  const optSpread = spreadOf(optimal);
  const l1 = finalSorted.reduce((acc, value, idx) => acc + Math.abs(value - optimal[idx]), 0);
  const moves = Math.floor(l1 / 2);

  let score = 0;
  if (r === 0 && finalArr.every((value, idx) => value === initial[idx])) {
    score = 100;
  } else if (isOptimal) {
    score = 100;
  } else {
    score = 100 - 20 * moves - 10 * Math.max(0, finalZero - optZero) - 5 * Math.max(0, spread - optSpread);
    score = clamp(score, 0, 100);
  }

  const isPassed = isOptimal || (finalZero <= optZero && spread <= optSpread && score >= 70);
  const combined: Record<Element, number> = {
    "\u6728": finalArr[0] ?? 0,
    "\u706B": finalArr[1] ?? 0,
    "\u571F": finalArr[2] ?? 0,
    "\u91D1": finalArr[3] ?? 0,
    "\u6C34": finalArr[4] ?? 0,
  };

  return { score, isPassed, combined };
}

function computeOptimalSorted(initial: number[], resourceCount: number): number[] {
  const s = [...initial].sort((a, b) => a - b);
  let rem = resourceCount;
  let i = 0;
  while (i < 4 && rem > 0) {
    const curr = s[i] ?? 0;
    const next = s[i + 1] ?? curr;
    const width = i + 1;
    const diff = next - curr;
    if (diff === 0) {
      i += 1;
      continue;
    }
    const cost = diff * width;
    if (rem >= cost) {
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + diff;
      }
      rem -= cost;
      i += 1;
    } else {
      const q = Math.floor(rem / width);
      const r = rem % width;
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + q;
      }
      for (let k = 0; k < r; k += 1) {
        s[k] = (s[k] ?? 0) + 1;
      }
      rem = 0;
    }
  }
  if (rem > 0) {
    const q = Math.floor(rem / 5);
    const r = rem % 5;
    for (let k = 0; k < 5; k += 1) {
      s[k] = (s[k] ?? 0) + q;
    }
    for (let k = 0; k < r; k += 1) {
      s[k] = (s[k] ?? 0) + 1;
    }
  }
  return s;
}

function spreadOf(values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min;
}

function countDominant(distribution: Record<Element, number>): boolean {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + distribution[key], 0);
  const threshold = Math.floor(total / 2) + 1;
  return ELEMENT_KEYS.some((key) => distribution[key] >= threshold);
}

function parityToPolarity(value: number): Polarity {
  return DEFAULT_POLARITY_BY_PARITY[(Math.abs(value) % 2) as 0 | 1];
}

function polarityScore(eumCount: number, yangCount: number): number {
  const total = Math.max(0, eumCount + yangCount);
  if (total === 0) {
    return 0;
  }
  const minSide = Math.min(eumCount, yangCount);
  const ratio = minSide / total;
  const ratioScore = ratio >= 0.4 ? 50 : ratio >= 0.3 ? 35 : ratio >= 0.2 ? 20 : 10;
  return 40 + ratioScore;
}

export class NameEvaluator {
  private readonly luckyMap: Map<number, LuckyLevel>;
  private readonly statsRepository: StatsRepository | null;
  private readonly includeSajuDefault: boolean;
  private readonly sajuBaseDistribution: Record<Element, number>;

  constructor(
    luckyMap: Map<number, LuckyLevel>,
    statsRepository: StatsRepository | null,
    includeSajuDefault: boolean,
    sajuBaseDistribution?: Partial<Record<Element, number>>,
  ) {
    this.luckyMap = luckyMap;
    this.statsRepository = statsRepository;
    this.includeSajuDefault = includeSajuDefault;
    this.sajuBaseDistribution = {
      "\u6728": sajuBaseDistribution?.["\u6728"] ?? 3,
      "\u706B": sajuBaseDistribution?.["\u706B"] ?? 1,
      "\u571F": sajuBaseDistribution?.["\u571F"] ?? 2,
      "\u91D1": sajuBaseDistribution?.["\u91D1"] ?? 0,
      "\u6C34": sajuBaseDistribution?.["\u6C34"] ?? 2,
    };
  }

  evaluate(name: NameInput, resolved: ResolvedName, birth?: BirthInfo, includeSaju?: boolean): SeedResponse {
    const surnameLength = resolved.surname.length;
    const givenLength = resolved.given.length;
    const infos = [...resolved.surname, ...resolved.given];

    const surnameStrokeCounts = resolved.surname.map((entry) => entry.strokeCount ?? entry.hoeksu);
    const givenStrokeCounts = resolved.given.map((entry) => entry.strokeCount ?? entry.hoeksu);
    const sagyeok = calculateWonHyeongIJeong(surnameStrokeCounts, givenStrokeCounts);
    const wonFortune = levelToFortune(this.luckyMap.get(sagyeok.won) ?? "\uBBF8\uC815");
    const hyeongFortune = levelToFortune(this.luckyMap.get(sagyeok.hyeong) ?? "\uBBF8\uC815");
    const iFortune = levelToFortune(this.luckyMap.get(sagyeok.i) ?? "\uBBF8\uC815");
    const jeongFortune = levelToFortune(this.luckyMap.get(sagyeok.jeong) ?? "\uBBF8\uC815");
    const buckets = [bucketFromFortune(wonFortune), bucketFromFortune(hyeongFortune)];
    if (givenLength > 1) {
      buckets.push(bucketFromFortune(iFortune));
    }
    buckets.push(bucketFromFortune(jeongFortune));
    const sagyeokScore = buckets.reduce((a, b) => a + b, 0);
    const sagyeokPassed = buckets.length > 0 && buckets.every((value) => value >= 15);
    const sagyeokSuri = createInsight(
      "SAGYEOK_SURI",
      sagyeokScore,
      sagyeokPassed,
      `${sagyeok.won}/${wonFortune}-${sagyeok.hyeong}/${hyeongFortune}-${sagyeok.i}/${iFortune}-${sagyeok.jeong}/${jeongFortune}`,
      {
        won: sagyeok.won,
        hyeong: sagyeok.hyeong,
        i: sagyeok.i,
        jeong: sagyeok.jeong,
      },
    );

    const strokeElementArrangement = infos.map((entry) => entry.strokeElement ?? entry.hoeksuOhaeng);
    const strokeElementDistribution = distributionFromArrangement(strokeElementArrangement);
    const strokeElementAdjacency = calculateArrayScore(strokeElementArrangement, surnameLength);
    const strokeElementBalance = calculateBalanceScore(strokeElementDistribution);
    const strokeElementInsight = createInsight(
      "HOEKSU_OHAENG",
      strokeElementBalance,
      strokeElementBalance >= 60,
      strokeElementArrangement.join("-"),
      {
        distribution: strokeElementDistribution,
        adjacencyScore: strokeElementAdjacency,
      },
    );

    const sagyeokArrangement: Element[] = [
      LAST_DIGIT_ELEMENT[Math.abs(sagyeok.i) % 10] as Element,
      LAST_DIGIT_ELEMENT[Math.abs(sagyeok.hyeong) % 10] as Element,
      LAST_DIGIT_ELEMENT[Math.abs(sagyeok.won) % 10] as Element,
    ];
    const sagyeokDistribution = distributionFromArrangement(sagyeokArrangement);
    const sagyeokAdj = calculateArrayScore(sagyeokArrangement, surnameLength);
    const sagyeokBal = calculateBalanceScore(sagyeokDistribution);
    const sagyeokOhaengScore = (sagyeokBal + sagyeokAdj) / 2;
    const sagyeokDominant = countDominant(sagyeokDistribution);
    const sagyeokAdjThreshold = surnameLength === 2 ? 65 : 60;
    const sagyeokOhaengPassed =
      checkFourFrameSuriElement(sagyeokArrangement, givenLength) &&
      !sagyeokDominant &&
      sagyeokAdj >= sagyeokAdjThreshold &&
      sagyeokOhaengScore >= 65;
    const fourFrameElementInsight = createInsight(
      "SAGYEOK_OHAENG",
      sagyeokOhaengScore,
      sagyeokOhaengPassed,
      sagyeokArrangement.join("-"),
      {
        distribution: sagyeokDistribution,
        adjacencyScore: sagyeokAdj,
        balanceScore: sagyeokBal,
      },
    );

    const pronunciationElementArrangement = infos.map(
      (entry) => entry.pronunciationElement ?? entry.pronunciationOhaeng,
    );
    const pronunciationElementDistribution = distributionFromArrangement(pronunciationElementArrangement);
    const pronunciationElementAdj = calculateArrayScore(pronunciationElementArrangement, surnameLength);
    const pronunciationElementBalance = calculateBalanceScore(pronunciationElementDistribution);
    const pronunciationElementScore = (pronunciationElementBalance + pronunciationElementAdj) / 2;
    const pronunciationElementAdjThreshold = surnameLength === 2 ? 65 : 60;
    const pronunciationElementPassed =
      checkElementSangSaeng(pronunciationElementArrangement, surnameLength) &&
      !countDominant(pronunciationElementDistribution) &&
      pronunciationElementAdj >= pronunciationElementAdjThreshold &&
      pronunciationElementScore >= 70;
    const pronunciationElementInsight = createInsight(
      "BALEUM_OHAENG",
      pronunciationElementScore,
      pronunciationElementPassed,
      pronunciationElementArrangement.join("-"),
      {
        distribution: pronunciationElementDistribution,
        adjacencyScore: pronunciationElementAdj,
        balanceScore: pronunciationElementBalance,
      },
    );

    const strokePolarityArrangement = infos.map((entry) =>
      parityToPolarity(entry.strokePolarityBit ?? entry.hoeksuEumyang),
    );
    const strokeYinCount = strokePolarityArrangement.filter((value) => value === "\u9670").length;
    const strokeYangCount = strokePolarityArrangement.length - strokeYinCount;
    const strokePolarityScore = polarityScore(strokeYinCount, strokeYangCount);
    const strokePolarityPassed = checkPolarityHarmony(strokePolarityArrangement, surnameLength);
    const strokePolarityInsight = createInsight(
      "HOEKSU_EUMYANG",
      strokePolarityScore,
      strokePolarityPassed,
      strokePolarityArrangement.join(""),
      {
        arrangementList: strokePolarityArrangement,
      },
    );

    const pronunciationPolarityArrangement = infos.map((entry) =>
      parityToPolarity(entry.pronunciationPolarityBit ?? entry.pronunciationEumyang),
    );
    const pronunciationYinCount = pronunciationPolarityArrangement.filter((value) => value === "\u9670").length;
    const pronunciationYangCount = pronunciationPolarityArrangement.length - pronunciationYinCount;
    const pronunciationPolarityScore = polarityScore(pronunciationYinCount, pronunciationYangCount);
    const pronunciationPolarityPassed = checkPolarityHarmony(pronunciationPolarityArrangement, surnameLength);
    const pronunciationPolarityInsight = createInsight(
      "BALEUM_EUMYANG",
      pronunciationPolarityScore,
      pronunciationPolarityPassed,
      pronunciationPolarityArrangement.join(""),
      {
        arrangementList: pronunciationPolarityArrangement,
      },
    );

    const jawonArrangement = resolved.given.map((entry) => entry.rootElement ?? entry.jawonOhaeng);
    const jawonDistribution = distributionFromArrangement(jawonArrangement);
    const sajuCtx: SajuContext = {
      sajuDistribution: this.sajuBaseDistribution,
    };
    const sajuJawon = computeSajuJawonScore(sajuCtx.sajuDistribution, jawonDistribution);
    const sajuInsight = createInsight(
      "SAJU_JAWON_BALANCE",
      includeSaju ?? this.includeSajuDefault ? sajuJawon.score : sajuJawon.score,
      sajuJawon.isPassed,
      "SAJU+JAWON",
      {
        sajuDistribution: sajuCtx.sajuDistribution,
        jawonDistribution,
        combinedDistribution: sajuJawon.combined,
        birth,
      },
    );

    const rootScore =
      sagyeokSuri.score * W_MAJOR +
      sajuInsight.score * W_MAJOR +
      strokePolarityInsight.score * W_MINOR +
      pronunciationElementInsight.score * W_MINOR +
      pronunciationPolarityInsight.score * W_MINOR +
      fourFrameElementInsight.score * W_MINOR;

    const rootPassed =
      sagyeokSuri.isPassed &&
      sajuInsight.isPassed &&
      strokePolarityInsight.isPassed &&
      pronunciationElementInsight.isPassed &&
      pronunciationPolarityInsight.isPassed &&
      fourFrameElementInsight.isPassed &&
      rootScore >= 60;

    const seongmyeonghak = createInsight(
      "SEONGMYEONGHAK",
      rootScore,
      rootPassed,
      "ROOT",
      {},
    );

    const stats = this.statsRepository?.findByName(name.firstNameHangul) ?? null;
    const statsScore = stats ? clamp(60 + stats.similarNames.length, 0, 100) : 0;
    const statistics = createInsight(
      "STATISTICS",
      statsScore,
      true,
      "stats",
      { found: stats !== null },
    );

    const categoryMap: Record<Frame, FrameInsight> = {
      SEONGMYEONGHAK: seongmyeonghak,
      SAGYEOK_SURI: sagyeokSuri,
      SAGYEOK_OHAENG: fourFrameElementInsight,
      HOEKSU_OHAENG: strokeElementInsight,
      HOEKSU_EUMYANG: strokePolarityInsight,
      BALEUM_OHAENG: pronunciationElementInsight,
      BALEUM_EUMYANG: pronunciationPolarityInsight,
      SAJU_JAWON_BALANCE: sajuInsight,
      STATISTICS: statistics,
      JAWON_OHAENG: strokeElementInsight,
      EUMYANG: strokePolarityInsight,
    };

    const orderedCategories: FrameInsight[] = [
      seongmyeonghak,
      sagyeokSuri,
      sajuInsight,
      strokePolarityInsight,
      pronunciationElementInsight,
      pronunciationPolarityInsight,
      fourFrameElementInsight,
    ];

    return {
      name,
      interpretation: {
        score: seongmyeonghak.score,
        isPassed: seongmyeonghak.isPassed,
        status: seongmyeonghak.status,
        categories: orderedCategories,
      },
      categoryMap,
      statistics: stats as NameStatistics | null,
    };
  }
}

export function toLegacyInterpretationText(response: SeedResponse): string {
  const c = response.categoryMap;
  return [
    `SAGYEOK_SURI:${c.SAGYEOK_SURI.score}/${c.SAGYEOK_SURI.isPassed ? "Y" : "N"}`,
    `SAJU_JAWON_BALANCE:${c.SAJU_JAWON_BALANCE.score}/${c.SAJU_JAWON_BALANCE.isPassed ? "Y" : "N"}`,
    `HOEKSU_EUMYANG:${c.HOEKSU_EUMYANG.score}/${c.HOEKSU_EUMYANG.isPassed ? "Y" : "N"}`,
    `BALEUM_OHAENG:${c.BALEUM_OHAENG.score}/${c.BALEUM_OHAENG.isPassed ? "Y" : "N"}`,
    `BALEUM_EUMYANG:${c.BALEUM_EUMYANG.score}/${c.BALEUM_EUMYANG.isPassed ? "Y" : "N"}`,
    `SAGYEOK_OHAENG:${c.SAGYEOK_OHAENG.score}/${c.SAGYEOK_OHAENG.isPassed ? "Y" : "N"}`,
  ].join(" | ");
}

export function sortResponsesByScore(items: SeedResponse[]): SeedResponse[] {
  return items.sort((a, b) => b.interpretation.score - a.interpretation.score);
}
