/**
 * part7-saeun.ts -- 세운(歲運) 요약 섹션
 *
 * 입력 데이터에 세운 기둥(saeunPillars)이 있으면 우선 사용하고,
 * 없으면 현재 연도 기준으로 세운을 자동 계산해 요약합니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  STEMS,
  BRANCHES,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  getElementRelation,
  getYongshinMatchGrade,
  lookupStemInfo,
  lookupBranchInfo,
} from '../common/elementMaps.js';

import {
  narrative,
  tip,
  emphasis,
  encouraging,
} from '../common/sentenceUtils.js';

import {
  getYearlyFortune,
  getYearlyFortuneRange,
  type YearlyFortune,
} from '../common/fortuneCalculator.js';

type SaeunSource = 'input' | 'fallback';

type ElementRelation = ReturnType<typeof getElementRelation>;

const ELEMENT_CODES: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const SCORE_LABEL: Record<number, string> = {
  1: '주의',
  2: '조심',
  3: '보통',
  4: '좋음',
  5: '매우 좋음',
};

const RELATION_SCORE: Record<ElementRelation, number> = {
  same: 3,
  generates: 4,
  generated_by: 2,
  controls: 1,
  controlled_by: 4,
};

interface SaeunEntry {
  readonly year: number;
  readonly ganziHangul: string;
  readonly ganziHanja: string;
  readonly stemElement: ElementCode;
  readonly branchElement: ElementCode;
  readonly source: SaeunSource;
}

interface YongshinSystem {
  readonly yongEl: ElementCode | null;
  readonly heeEl: ElementCode | null;
  readonly giEl: ElementCode | null;
  readonly guEl: ElementCode | null;
  readonly hanEl: ElementCode | null;
  readonly dayMasterEl: ElementCode | null;
}

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && (ELEMENT_CODES as readonly string[]).includes(value);
}

function normalizeElement(value: unknown): ElementCode | null {
  return isElementCode(value) ? value : null;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const v = Math.trunc(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function elementText(element: ElementCode): string {
  const short = ELEMENT_KOREAN_SHORT[element] ?? element;
  const hanja = ELEMENT_HANJA[element] ?? '?';
  return `${short}(${hanja})`;
}

function deriveHansin(
  yongEl: ElementCode | null,
  heeEl: ElementCode | null,
  giEl: ElementCode | null,
  guEl: ElementCode | null,
): ElementCode | null {
  const assigned = new Set<ElementCode | null>([yongEl, heeEl, giEl, guEl]);
  const remaining = ELEMENT_CODES.filter(el => !assigned.has(el));
  return remaining.length === 1 ? remaining[0] : null;
}

function buildYongshinSystem(input: ReportInput): YongshinSystem {
  const yongshinRaw = input.saju.yongshin as {
    element?: unknown;
    heeshin?: unknown;
    gishin?: unknown;
    gushin?: unknown;
  } | null | undefined;

  const yongEl = normalizeElement(yongshinRaw?.element);
  const heeEl = normalizeElement(yongshinRaw?.heeshin);
  const giEl = normalizeElement(yongshinRaw?.gishin);
  const guEl = normalizeElement(yongshinRaw?.gushin);
  const hanEl = deriveHansin(yongEl, heeEl, giEl, guEl);

  const dayMasterRaw = (input.saju as { dayMaster?: { element?: unknown } | null }).dayMaster;
  const dayMasterEl = normalizeElement(dayMasterRaw?.element);

  return { yongEl, heeEl, giEl, guEl, hanEl, dayMasterEl };
}

function fromYearlyFortune(yearly: YearlyFortune, source: SaeunSource): SaeunEntry {
  return {
    year: yearly.year,
    ganziHangul: yearly.ganzhiHangul,
    ganziHanja: yearly.ganzhiHanja,
    stemElement: yearly.stemElement,
    branchElement: yearly.branchElement,
    source,
  };
}

function lookupStemFlexible(raw: string) {
  if (!raw) return null;
  return lookupStemInfo(raw) ?? STEMS.find(stem => stem.hanja === raw) ?? null;
}

function lookupBranchFlexible(raw: string) {
  if (!raw) return null;
  return lookupBranchInfo(raw) ?? BRANCHES.find(branch => branch.hanja === raw) ?? null;
}

function parseInputSaeunPillars(input: ReportInput): SaeunEntry[] {
  const raw = (input.saju as { saeunPillars?: unknown }).saeunPillars;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const byYear = new Map<number, SaeunEntry>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;

    const year = normalizeYear(record.year);
    if (year == null || year < 1 || year > 9999) continue;

    const nestedPillar = record.pillar as Record<string, unknown> | null | undefined;
    const stemRaw = normalizeText(record.stem) || normalizeText(nestedPillar?.cheongan);
    const branchRaw = normalizeText(record.branch) || normalizeText(nestedPillar?.jiji);

    const stemInfo = lookupStemFlexible(stemRaw);
    const branchInfo = lookupBranchFlexible(branchRaw);
    const fallback = getYearlyFortune(year);

    const entry: SaeunEntry = {
      year,
      ganziHangul: stemInfo && branchInfo
        ? `${stemInfo.hangul}${branchInfo.hangul}`
        : fallback.ganzhiHangul,
      ganziHanja: stemInfo && branchInfo
        ? `${stemInfo.hanja}${branchInfo.hanja}`
        : fallback.ganzhiHanja,
      stemElement: stemInfo?.element ?? fallback.stemElement,
      branchElement: branchInfo?.element ?? fallback.branchElement,
      source: 'input',
    };

    byYear.set(year, entry);
  }

  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

function buildFallbackSaeun(currentYear: number, range: number): SaeunEntry[] {
  const fortunes = getYearlyFortuneRange(currentYear, range, range);
  return fortunes.map(yearly => fromYearlyFortune(yearly, 'fallback'));
}

function computeFlowScore(entry: SaeunEntry, system: YongshinSystem): number {
  if (system.yongEl) {
    return getYongshinMatchGrade(
      entry.stemElement,
      system.yongEl,
      system.heeEl,
      system.hanEl,
      system.guEl,
      system.giEl,
    );
  }

  if (system.dayMasterEl) {
    const rel = getElementRelation(entry.stemElement, system.dayMasterEl);
    return RELATION_SCORE[rel];
  }

  return 3;
}

function scoreLabel(score: number): string {
  return SCORE_LABEL[score] ?? '보통';
}

function scoreComment(score: number): string {
  if (score >= 5) return '확장 계획을 과감하게 추진해도 좋아요.';
  if (score >= 4) return '새로운 시도에 힘이 붙는 해예요.';
  if (score === 3) return '기본을 지키면서 천천히 가면 좋아요.';
  if (score === 2) return '속도를 줄이고 점검을 늘려보세요.';
  return '무리한 결정은 피하고 안정에 집중하세요.';
}

function scoreSentiment(score: number): 'good' | 'caution' | 'neutral' {
  if (score >= 4) return 'good';
  if (score <= 2) return 'caution';
  return 'neutral';
}

function pickFocusEntry(entries: SaeunEntry[], currentYear: number): SaeunEntry | null {
  if (entries.length === 0) return null;
  const exact = entries.find(entry => entry.year === currentYear);
  if (exact) return exact;

  let nearest = entries[0];
  let distance = Math.abs(entries[0].year - currentYear);
  for (const entry of entries) {
    const d = Math.abs(entry.year - currentYear);
    if (d < distance) {
      nearest = entry;
      distance = d;
    }
  }
  return nearest;
}

export function generateSaeunSection(input: ReportInput): ReportSection | null {
  const currentYear = (input.today ?? new Date()).getFullYear();
  const range = clampInt(input.options?.saeunRange, 1, 12, 5);

  const parsedInputEntries = parseInputSaeunPillars(input);
  const entries = parsedInputEntries.length > 0
    ? parsedInputEntries
    : buildFallbackSaeun(currentYear, range);

  if (entries.length === 0) return null;

  const source: SaeunSource = parsedInputEntries.length > 0 ? 'input' : 'fallback';
  const sourceText = source === 'input' ? '입력된 세운 기둥' : '자동 계산 세운';

  const system = buildYongshinSystem(input);
  const name = safeName(input);

  const scored = entries.map(entry => ({
    entry,
    score: computeFlowScore(entry, system),
  }));

  const startYear = entries[0].year;
  const endYear = entries[entries.length - 1].year;
  const focusEntry = pickFocusEntry(entries, currentYear);
  const focusScore = focusEntry
    ? scored.find(item => item.entry.year === focusEntry.year)?.score ?? 3
    : 3;

  let best = scored[0];
  let worst = scored[0];
  for (const item of scored) {
    if (item.score > best.score) best = item;
    if (item.score < worst.score) worst = item;
  }

  const paragraphs: ReportParagraph[] = [
    narrative(
      `${name}님의 세운 흐름을 쉬운 말로 정리했어요. `
      + `${sourceText} 기준으로 ${startYear}년부터 ${endYear}년까지 살펴봤습니다.`,
    ),
    tip(
      '점수는 1~5로 표시했어요. '
      + '4~5는 확장, 3은 유지, 1~2는 점검 모드로 보시면 이해가 쉬워요.',
    ),
    emphasis(
      focusEntry
        ? `기준 연도 ${currentYear}년은 ${focusEntry.ganziHangul}(${focusEntry.ganziHanja})이고 `
          + `흐름 점수는 ${focusScore}점(${scoreLabel(focusScore)})입니다.`
        : `기준 연도 ${currentYear}년과 가장 가까운 데이터로 흐름을 안내했어요.`,
    ),
    encouraging(
      '세운은 흐름 지도예요. 좋은 해에는 확장하고, 조심 해에는 속도를 조절하면 훨씬 안정적으로 갈 수 있어요.',
    ),
  ];

  const table: ReportTable = {
    title: '세운 연도별 요약표',
    headers: ['연도', '간지', '천간/지지 오행', '흐름 점수', '한 줄 가이드'],
    rows: scored.map(({ entry, score }) => [
      entry.year === currentYear ? `${entry.year}(기준)` : String(entry.year),
      `${entry.ganziHangul}(${entry.ganziHanja})`,
      `${elementText(entry.stemElement)} / ${elementText(entry.branchElement)}`,
      `${score}점 (${scoreLabel(score)})`,
      scoreComment(score),
    ]),
  };

  const chartData: Record<string, number | string> = {};
  for (const { entry, score } of scored) {
    chartData[`${entry.year} ${entry.ganziHangul}`] = score;
  }

  const chart: ReportChart = {
    type: 'line',
    title: '세운 흐름 점수 추이',
    data: chartData,
    meta: {
      source: sourceText,
      scale: '1~5',
      anchorYear: currentYear,
    },
  };

  const highlights: ReportHighlight[] = [
    {
      label: '기준 연도',
      value: `${currentYear}년`,
      sentiment: 'neutral',
    },
    {
      label: '가장 좋은 흐름',
      value: `${best.entry.year}년 ${best.entry.ganziHangul} (${best.score}점)`,
      element: best.entry.stemElement,
      sentiment: 'good',
    },
    {
      label: '주의가 필요한 해',
      value: `${worst.entry.year}년 ${worst.entry.ganziHangul} (${worst.score}점)`,
      element: worst.entry.stemElement,
      sentiment: scoreSentiment(worst.score),
    },
    {
      label: '데이터 출처',
      value: sourceText,
      sentiment: 'neutral',
    },
  ];

  if (system.yongEl) {
    highlights.push({
      label: '용신 기준',
      value: elementText(system.yongEl),
      element: system.yongEl,
      sentiment: 'good',
    });
  }

  return {
    id: 'saeun',
    title: '세운(歲運) 한눈에 보기',
    subtitle: '연도별 흐름을 쉽고 빠르게 확인하는 요약',
    paragraphs,
    tables: [table],
    charts: [chart],
    highlights,
  };
}
