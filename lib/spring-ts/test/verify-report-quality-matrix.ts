import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../src/spring-engine.ts';
import { buildIntegratedReport } from '../src/report/buildIntegratedReport.ts';
import type {
  BirthInfo,
  NameCharInput,
  SajuTimePolicyOptions,
  SpringReport,
} from '../src/types.ts';
import type { IntegratedReport, ReportSection, ReportSectionId } from '../src/report/types.ts';

type GenderCode = 'male' | 'female' | 'neutral';
type CalendarCode = 'solar' | 'lunar';

interface BaseBirthCase {
  readonly id: string;
  readonly surname: NameCharInput[];
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly timezone: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface PolicyCase {
  readonly id: string;
  readonly policy: SajuTimePolicyOptions;
}

interface Scenario {
  readonly id: string;
  readonly birthCaseId: string;
  readonly gender: GenderCode;
  readonly calendarType: CalendarCode;
  readonly policyCaseId: string;
  readonly surname: NameCharInput[];
  readonly birth: BirthInfo;
  readonly policy: SajuTimePolicyOptions;
}

interface QualityIssue {
  readonly code: string;
  readonly detail: string;
  readonly penalty: number;
}

interface QualityResult {
  readonly score: number;
  readonly issues: QualityIssue[];
  readonly sectionCount: number;
  readonly missingSections: ReportSectionId[];
  readonly shortParagraphRatio: number;
  readonly repeatedParagraphRatio: number;
  readonly candidateCount: number;
}

interface ScenarioRunResult {
  readonly scenario: Scenario;
  readonly quality: QualityResult;
}

const FIXED_TODAY = new Date('2024-06-15T00:00:00.000Z');
const FIXED_VARIATION_SEED = 20260221;

const REQUIRED_SECTION_IDS: readonly ReportSectionId[] = [
  'pillars',
  'dayMaster',
  'hiddenStems',
  'elements',
  'deficiency',
  'tongguan',
  'climate',
  'tenGods',
  'lifeStages',
  'strength',
  'gyeokguk',
  'yongshin',
  'yongshinLife',
  'stemRelations',
  'branchRelations',
  'shinsalGood',
  'shinsalBad',
  'daeun',
  'yearlyFortune',
  'saeun',
  'monthlyFortune',
  'weeklyFortune',
  'dailyFortune',
  'nameBasic',
  'nameElement',
  'fourFrame',
  'nameHarmony',
  'nameComparison',
  'sajuNameSynergy',
  'summary',
  'elementLifestyle',
  'luckItems',
  'health',
  'career',
  'relationships',
  'actionPlan',
];

const KEY_SECTION_IDS: readonly ReportSectionId[] = [
  'pillars',
  'elements',
  'tenGods',
  'yongshin',
  'yearlyFortune',
  'nameHarmony',
  'nameComparison',
  'sajuNameSynergy',
  'summary',
  'actionPlan',
];

const BASE_BIRTH_CASES: readonly BaseBirthCase[] = [
  {
    id: 'B1',
    surname: [{ hangul: '김', hanja: '金' }],
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.978,
  },
  {
    id: 'B2',
    surname: [{ hangul: '이', hanja: '李' }],
    year: 1990,
    month: 7,
    day: 15,
    hour: 10,
    minute: 30,
    timezone: 'Asia/Seoul',
    latitude: 35.1796,
    longitude: 129.0756,
  },
  {
    id: 'B3',
    surname: [{ hangul: '박', hanja: '朴' }],
    year: 2001,
    month: 10,
    day: 23,
    hour: 23,
    minute: 20,
    timezone: 'Asia/Seoul',
    latitude: 33.4996,
    longitude: 126.5312,
  },
  {
    id: 'B4',
    surname: [{ hangul: '최', hanja: '崔' }],
    year: 1977,
    month: 12,
    day: 28,
    hour: 0,
    minute: 20,
    timezone: 'Asia/Seoul',
    latitude: 35.8714,
    longitude: 128.6014,
  },
  {
    id: 'B5',
    surname: [{ hangul: '정', hanja: '鄭' }],
    year: 2011,
    month: 2,
    day: 17,
    hour: 13,
    minute: 10,
    timezone: 'Asia/Seoul',
    latitude: 36.3504,
    longitude: 127.3845,
  },
  {
    id: 'B6',
    surname: [{ hangul: '제갈', hanja: '諸葛' }, { hangul: '갈', hanja: '葛' }],
    year: 1968,
    month: 3,
    day: 8,
    hour: 1,
    minute: 10,
    timezone: 'Asia/Seoul',
    latitude: 37.4563,
    longitude: 126.7052,
  },
];

const POLICY_CASES: readonly PolicyCase[] = [
  {
    id: 'P1',
    policy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'off',
      yaza: 'off',
      yazaMode: '23:00',
    },
  },
  {
    id: 'P2',
    policy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'on',
      yaza: 'off',
      yazaMode: '23:00',
    },
  },
  {
    id: 'P3',
    policy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'off',
      yaza: 'off',
      yazaMode: '23:00',
    },
  },
  {
    id: 'P4',
    policy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
      yaza: 'off',
      yazaMode: '23:00',
    },
  },
  {
    id: 'P5',
    policy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'on',
      yaza: 'on',
      yazaMode: '23:00',
    },
  },
  {
    id: 'P6',
    policy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'on',
      yaza: 'on',
      yazaMode: '23:30',
    },
  },
  {
    id: 'P7',
    policy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
      yaza: 'on',
      yazaMode: '23:00',
    },
  },
  {
    id: 'P8',
    policy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
      yaza: 'on',
      yazaMode: '23:30',
    },
  },
];

const GENDERS: readonly GenderCode[] = ['male', 'female', 'neutral'];
const CALENDAR_TYPES: readonly CalendarCode[] = ['solar', 'lunar'];

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function collectParagraphTexts(report: IntegratedReport): string[] {
  const texts: string[] = [];
  for (const paragraph of report.introduction) {
    texts.push(normalizeText(paragraph.text));
  }
  for (const section of report.sections) {
    for (const paragraph of section.paragraphs) {
      texts.push(normalizeText(paragraph.text));
    }
    for (const subsection of section.subsections ?? []) {
      for (const paragraph of subsection.paragraphs) {
        texts.push(normalizeText(paragraph.text));
      }
    }
  }
  for (const paragraph of report.conclusion) {
    texts.push(normalizeText(paragraph.text));
  }
  return texts.filter((text) => text.length > 0);
}

function sectionMap(report: IntegratedReport): Map<ReportSectionId, ReportSection> {
  return new Map(report.sections.map((section) => [section.id, section]));
}

function countStructuredBlocks(report: IntegratedReport): number {
  let count = 0;
  for (const section of report.sections) {
    count += (section.tables?.length ?? 0);
    count += (section.charts?.length ?? 0);
    count += (section.highlights?.length ?? 0);
    for (const subsection of section.subsections ?? []) {
      count += (subsection.tables?.length ?? 0);
      count += (subsection.charts?.length ?? 0);
      count += (subsection.highlights?.length ?? 0);
    }
  }
  return count;
}

function evaluateReportQuality(report: IntegratedReport, candidateCount: number): QualityResult {
  const issues: QualityIssue[] = [];
  const sections = report.sections ?? [];
  const ids = new Set<ReportSectionId>(sections.map((section) => section.id));
  const missingSections = REQUIRED_SECTION_IDS.filter((id) => !ids.has(id));
  const sectionLookup = sectionMap(report);
  const texts = collectParagraphTexts(report);

  if (report.introduction.length < 2) {
    issues.push({
      code: 'INTRO_TOO_SHORT',
      detail: `introduction=${report.introduction.length}`,
      penalty: 6,
    });
  }

  if (report.conclusion.length < 2) {
    issues.push({
      code: 'CONCLUSION_TOO_SHORT',
      detail: `conclusion=${report.conclusion.length}`,
      penalty: 6,
    });
  }

  if (missingSections.length > 0) {
    issues.push({
      code: 'MISSING_SECTIONS',
      detail: missingSections.join(', '),
      penalty: clamp(missingSections.length * 2, 4, 30),
    });
  }

  const emptySections = sections
    .filter((section) => section.paragraphs.length === 0)
    .map((section) => section.id);
  if (emptySections.length > 0) {
    issues.push({
      code: 'EMPTY_SECTIONS',
      detail: emptySections.join(', '),
      penalty: clamp(emptySections.length * 2, 4, 20),
    });
  }

  const keySectionMisses = KEY_SECTION_IDS
    .filter((id) => {
      const section = sectionLookup.get(id);
      return !section || section.paragraphs.length < 2;
    });
  if (keySectionMisses.length > 0) {
    issues.push({
      code: 'KEY_SECTION_DEPTH_LOW',
      detail: keySectionMisses.join(', '),
      penalty: clamp(keySectionMisses.length * 2, 4, 16),
    });
  }

  if (candidateCount < 5) {
    issues.push({
      code: 'LOW_CANDIDATE_COUNT',
      detail: `candidateCount=${candidateCount}`,
      penalty: candidateCount === 0 ? 12 : 6,
    });
  }

  const shortParagraphCount = texts.filter((text) => text.length < 24).length;
  const shortParagraphRatio = texts.length > 0 ? shortParagraphCount / texts.length : 1;
  if (shortParagraphRatio > 0.15) {
    issues.push({
      code: 'SHORT_TEXT_RATIO_HIGH',
      detail: `ratio=${shortParagraphRatio.toFixed(3)}`,
      penalty: 8,
    });
  }

  const placeholderPattern = /\{\{|\}\}|undefined|null|NaN|\[object Object\]/;
  const brokenEncodingPattern = /�/;
  const placeholderHits = texts.filter((text) => placeholderPattern.test(text)).length;
  const brokenEncodingHits = texts.filter((text) => brokenEncodingPattern.test(text)).length;
  if (placeholderHits > 0) {
    issues.push({
      code: 'PLACEHOLDER_ARTIFACT',
      detail: `hits=${placeholderHits}`,
      penalty: clamp(placeholderHits * 2, 8, 20),
    });
  }
  if (brokenEncodingHits > 0) {
    issues.push({
      code: 'BROKEN_ENCODING_ARTIFACT',
      detail: `hits=${brokenEncodingHits}`,
      penalty: clamp(brokenEncodingHits * 2, 8, 20),
    });
  }

  const structuredBlockCount = countStructuredBlocks(report);
  if (structuredBlockCount < 20) {
    issues.push({
      code: 'STRUCTURED_BLOCKS_LOW',
      detail: `structuredBlocks=${structuredBlockCount}`,
      penalty: 8,
    });
  }

  const normalizedSet = new Set<string>();
  let duplicatedCount = 0;
  for (const text of texts) {
    if (normalizedSet.has(text)) {
      duplicatedCount += 1;
      continue;
    }
    normalizedSet.add(text);
  }
  const repeatedParagraphRatio = texts.length > 0 ? duplicatedCount / texts.length : 1;
  if (repeatedParagraphRatio > 0.28) {
    issues.push({
      code: 'REPETITION_TOO_HIGH',
      detail: `ratio=${repeatedParagraphRatio.toFixed(3)}`,
      penalty: 8,
    });
  }

  if (texts.length < 90) {
    issues.push({
      code: 'TOTAL_PARAGRAPHS_LOW',
      detail: `paragraphs=${texts.length}`,
      penalty: 10,
    });
  }

  const totalPenalty = issues.reduce((sum, issue) => sum + issue.penalty, 0);
  const score = clamp(100 - totalPenalty, 0, 100);

  return {
    score,
    issues,
    sectionCount: sections.length,
    missingSections,
    shortParagraphRatio,
    repeatedParagraphRatio,
    candidateCount,
  };
}

function buildScenarioMatrix(): Scenario[] {
  const scenarios: Scenario[] = [];
  for (const birthCase of BASE_BIRTH_CASES) {
    for (const gender of GENDERS) {
      for (const calendarType of CALENDAR_TYPES) {
        for (const policyCase of POLICY_CASES) {
          const id = [
            birthCase.id,
            gender,
            calendarType,
            policyCase.id,
          ].join('__');

          const birth: BirthInfo = {
            year: birthCase.year,
            month: birthCase.month,
            day: birthCase.day,
            hour: birthCase.hour,
            minute: birthCase.minute,
            gender,
            calendarType,
            timezone: birthCase.timezone,
            latitude: birthCase.latitude,
            longitude: birthCase.longitude,
          };

          scenarios.push({
            id,
            birthCaseId: birthCase.id,
            gender,
            calendarType,
            policyCaseId: policyCase.id,
            surname: birthCase.surname,
            birth,
            policy: policyCase.policy,
          });
        }
      }
    }
  }
  return scenarios;
}

async function gatherCandidates(
  engine: SpringEngine,
  scenario: Scenario,
  limit: number,
): Promise<SpringReport[]> {
  const request = {
    birth: scenario.birth,
    surname: scenario.surname,
    givenNameLength: 2,
    mode: 'recommend' as const,
    options: {
      limit,
      sajuTimePolicy: scenario.policy,
      pureHangulNameMode: 'off' as const,
    },
  };

  const candidates = await engine.getNameCandidates(request);
  if (candidates.length > 0) {
    return candidates;
  }

  // Fallback: evaluate a fixed name so quality tests can still inspect integrated sections.
  const fallback = await engine.getSpringReport({
    birth: scenario.birth,
    surname: scenario.surname,
    givenName: [
      { hangul: '민', hanja: '旻' },
      { hangul: '준', hanja: '俊' },
    ],
    mode: 'evaluate',
    options: {
      sajuTimePolicy: scenario.policy,
      pureHangulNameMode: 'off',
    },
  });

  return [fallback];
}

async function runOneScenario(engine: SpringEngine, scenario: Scenario): Promise<ScenarioRunResult> {
  let candidates = await gatherCandidates(engine, scenario, 12);

  let report = buildIntegratedReport({
    saju: candidates[0].sajuReport,
    spring: candidates[0],
    name: candidates[0].namingReport.name.fullHangul || scenario.id,
    gender: scenario.gender,
    birthInfo: {
      year: scenario.birth.year ?? null,
      month: scenario.birth.month ?? null,
      day: scenario.birth.day ?? null,
      hour: scenario.birth.hour ?? null,
      minute: scenario.birth.minute ?? null,
    },
    today: FIXED_TODAY,
    options: {
      variationSeed: FIXED_VARIATION_SEED,
    },
    ...( { candidates } as Record<string, unknown> ),
  } as any);

  let quality = evaluateReportQuality(report, candidates.length);

  // One retry with larger candidate pool when first pass is not perfect.
  if (quality.score < 100) {
    candidates = await gatherCandidates(engine, scenario, 24);
    report = buildIntegratedReport({
      saju: candidates[0].sajuReport,
      spring: candidates[0],
      name: candidates[0].namingReport.name.fullHangul || scenario.id,
      gender: scenario.gender,
      birthInfo: {
        year: scenario.birth.year ?? null,
        month: scenario.birth.month ?? null,
        day: scenario.birth.day ?? null,
        hour: scenario.birth.hour ?? null,
        minute: scenario.birth.minute ?? null,
      },
      today: FIXED_TODAY,
      options: {
        variationSeed: FIXED_VARIATION_SEED,
      },
      ...( { candidates } as Record<string, unknown> ),
    } as any);
    quality = evaluateReportQuality(report, candidates.length);
  }

  return {
    scenario,
    quality,
  };
}

function printSummary(results: readonly ScenarioRunResult[]): void {
  const total = results.length;
  const perfect = results.filter((result) => result.quality.score === 100).length;
  const scores = results.map((result) => result.quality.score);
  const avg = scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const nonPerfect = results
    .filter((result) => result.quality.score < 100)
    .sort((a, b) => a.quality.score - b.quality.score);

  console.log('\n=== verify-report-quality-matrix summary ===');
  console.log(`scenarios: ${total}`);
  console.log(`perfect(100): ${perfect}/${total}`);
  console.log(`score range: min=${min}, avg=${avg.toFixed(2)}, max=${max}`);

  if (nonPerfect.length > 0) {
    console.log('\nWorst scenarios (up to 12):');
    for (const item of nonPerfect.slice(0, 12)) {
      const issueText = item.quality.issues
        .map((issue) => `${issue.code}(-${issue.penalty})`)
        .join(', ');
      console.log(
        `- ${item.scenario.id} => ${item.quality.score} ` +
        `[sections=${item.quality.sectionCount}, candidates=${item.quality.candidateCount}] :: ${issueText}`,
      );
    }
  }
}

async function setupNodeFetchBridge(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(__dirname, '../../../namespring/public/data');
  const wasmCandidates = [
    path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../../seed-ts/node_modules/sql.js/dist/sql-wasm.wasm'),
  ];
  const wasmPath = wasmCandidates.find((candidatePath) => fs.existsSync(candidatePath));
  if (!wasmPath) {
    throw new Error(`sql-wasm.wasm not found. candidates=${wasmCandidates.join(', ')}`);
  }

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string | URL | Request, options?: unknown) => {
    const urlStr = typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.toString()
        : '';

    if (urlStr.startsWith('/data/')) {
      const filePath = path.join(dataDir, urlStr.replace('/data/', ''));
      if (!fs.existsSync(filePath)) {
        return new Response(null, { status: 404, statusText: `Not found: ${filePath}` });
      }
      return new Response(fs.readFileSync(filePath), { status: 200 });
    }

    if (urlStr.includes('sql-wasm.wasm') || urlStr === wasmPath) {
      return new Response(fs.readFileSync(wasmPath), { status: 200 });
    }

    return originalFetch(url as any, options as any);
  };
}

async function main(): Promise<void> {
  console.log('=== verify-report-quality-matrix ===');
  console.log('quality target: every scenario must score 100');

  await setupNodeFetchBridge();

  const engine = new SpringEngine();
  const repoCandidates = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo] as Array<Record<string, unknown> | null>;
  const wasmCandidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../seed-ts/node_modules/sql.js/dist/sql-wasm.wasm'),
  ];
  const wasmPath = wasmCandidates.find((candidatePath) => fs.existsSync(candidatePath));
  if (wasmPath) {
    for (const repo of repoCandidates) {
      if (!repo) continue;
      (repo as any).wasmUrl = wasmPath;
    }
  }

  const scenarios = buildScenarioMatrix();
  console.log(`scenario matrix size: ${scenarios.length} (birth=${BASE_BIRTH_CASES.length}, gender=${GENDERS.length}, calendar=${CALENDAR_TYPES.length}, policy=${POLICY_CASES.length})`);

  const results: ScenarioRunResult[] = [];
  let processed = 0;

  for (const scenario of scenarios) {
    try {
      const result = await runOneScenario(engine, scenario);
      results.push(result);
    } catch (error) {
      const quality: QualityResult = {
        score: 0,
        issues: [
          {
            code: 'SCENARIO_RUNTIME_ERROR',
            detail: toErrorMessage(error),
            penalty: 100,
          },
        ],
        sectionCount: 0,
        missingSections: [...REQUIRED_SECTION_IDS],
        shortParagraphRatio: 1,
        repeatedParagraphRatio: 1,
        candidateCount: 0,
      };
      results.push({ scenario, quality });
    }

    processed += 1;
    if (processed % 24 === 0 || processed === scenarios.length) {
      const currentPerfect = results.filter((result) => result.quality.score === 100).length;
      console.log(`progress: ${processed}/${scenarios.length} (perfect=${currentPerfect})`);
    }
  }

  await engine.close();

  printSummary(results);

  const nonPerfectCount = results.filter((result) => result.quality.score < 100).length;
  if (nonPerfectCount > 0) {
    console.error(`FAIL: ${nonPerfectCount} scenario(s) are below quality 100.`);
    process.exit(1);
    return;
  }

  console.log('PASS: all scenarios reached quality 100.');
}

main().catch((error) => {
  console.error(`FAIL unexpected error: ${toErrorMessage(error)}`);
  process.exit(1);
});
