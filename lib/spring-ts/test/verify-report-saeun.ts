import { emptySaju } from '../src/saju-adapter.ts';
import type { ReportInput, ReportSectionId } from '../src/report/types.ts';
import type { SajuSummary } from '../src/types.ts';

const FIXED_VARIATION_SEED = 20260220;
const FIXED_TODAY_ISO = '2024-06-15T00:00:00.000Z';

interface SaeunPillarMock {
  readonly year: number;
  readonly stem: string;
  readonly branch: string;
}

const MOCK_SAEUN_PILLARS: readonly SaeunPillarMock[] = [
  { year: 2022, stem: 'IM', branch: 'IN' },
  { year: 2023, stem: 'GYE', branch: 'MYO' },
  { year: 2024, stem: 'GAP', branch: 'JIN' },
  { year: 2025, stem: 'EUL', branch: 'SA' },
  { year: 2026, stem: 'BYEONG', branch: 'O' },
];

let passCount = 0;
let failCount = 0;

interface IntegratedReportLike {
  readonly sections: Array<{ readonly id: ReportSectionId }>;
  readonly [key: string]: unknown;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatIds(ids: readonly ReportSectionId[]): string {
  return ids.length > 0 ? ids.join(', ') : '(none)';
}

function assertCheck(label: string, condition: boolean, details?: string): void {
  if (condition) {
    passCount += 1;
    console.log(`PASS ${label}`);
    return;
  }

  failCount += 1;
  console.error(`FAIL ${label}${details ? ` :: ${details}` : ''}`);
}

function containsSaeunToken(report: IntegratedReportLike): boolean {
  return JSON.stringify(report).toLowerCase().includes('saeun');
}

async function loadBuilder(): Promise<(input: ReportInput) => IntegratedReportLike> {
  const module = await import('../src/report/buildIntegratedReport.ts');
  const builder = (module as { buildIntegratedReport?: unknown }).buildIntegratedReport;
  if (typeof builder !== 'function') {
    throw new Error('buildIntegratedReport export is missing');
  }
  return builder as (input: ReportInput) => IntegratedReportLike;
}

function createDeterministicInput(): ReportInput {
  const baseSaju = emptySaju();

  const mockSaju: SajuSummary = {
    ...baseSaju,
    pillars: {
      year: {
        stem: { code: 'GAP', hangul: 'GAP', hanja: 'GAP' },
        branch: { code: 'JA', hangul: 'JA', hanja: 'JA' },
      },
      month: {
        stem: { code: 'EUL', hangul: 'EUL', hanja: 'EUL' },
        branch: { code: 'CHUK', hangul: 'CHUK', hanja: 'CHUK' },
      },
      day: {
        stem: { code: 'BYEONG', hangul: 'BYEONG', hanja: 'BYEONG' },
        branch: { code: 'IN', hangul: 'IN', hanja: 'IN' },
      },
      hour: {
        stem: { code: 'JEONG', hangul: 'JEONG', hanja: 'JEONG' },
        branch: { code: 'MYO', hangul: 'MYO', hanja: 'MYO' },
      },
    },
    dayMaster: { stem: 'GAP', element: 'WOOD', polarity: 'YANG' },
    strength: {
      level: 'BALANCED',
      isStrong: false,
      totalSupport: 54,
      totalOppose: 46,
      deukryeong: 20,
      deukji: 18,
      deukse: 16,
      details: ['deterministic-mock'],
    },
    yongshin: {
      element: 'FIRE',
      heeshin: 'WOOD',
      gishin: 'WATER',
      gushin: 'METAL',
      confidence: 0.8,
      agreement: 'RANKING',
      recommendations: [
        {
          type: 'RANKING',
          primaryElement: 'FIRE',
          secondaryElement: null,
          confidence: 0.8,
          reasoning: 'deterministic-mock',
        },
      ],
    },
    gyeokguk: {
      type: 'JEONG_GWAN',
      category: 'NORMAL',
      baseTenGod: 'JEONG_GWAN',
      confidence: 0.6,
      reasoning: 'deterministic-mock',
    },
    elementDistribution: {
      WOOD: 28,
      FIRE: 22,
      EARTH: 18,
      METAL: 16,
      WATER: 16,
    },
    saeunPillars: MOCK_SAEUN_PILLARS,
  };

  return {
    saju: mockSaju,
    name: 'Report Section Verify',
    gender: 'neutral',
    birthInfo: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    },
    today: new Date(FIXED_TODAY_ISO),
    options: {
      variationSeed: FIXED_VARIATION_SEED,
      includeSections: ['saeun'],
    },
  };
}

async function main(): Promise<void> {
  console.log('=== verify-report-saeun ===');

  let buildIntegratedReport: (input: ReportInput) => IntegratedReportLike;
  try {
    buildIntegratedReport = await loadBuilder();
    assertCheck('buildIntegratedReport module loads', true);
  } catch (error) {
    assertCheck('buildIntegratedReport module loads', false, toErrorMessage(error));
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
    return;
  }

  const input = createDeterministicInput();
  const saeunPillarsRaw = (input.saju as Record<string, unknown>).saeunPillars;
  const saeunPillars = Array.isArray(saeunPillarsRaw) ? saeunPillarsRaw : [];

  assertCheck(
    'deterministic mock has saeunPillars data',
    saeunPillars.length > 0,
    `saeunPillars=${saeunPillars.length}`,
  );

  let report: IntegratedReportLike;
  try {
    report = buildIntegratedReport(input);
    assertCheck("includeSections=['saeun'] does not throw", true);
  } catch (error) {
    assertCheck("includeSections=['saeun'] does not throw", false, toErrorMessage(error));
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
    return;
  }

  const sectionIds = report.sections.map((section) => section.id);
  const hasOnlySaeunSections = sectionIds.every((id) => id === 'saeun');
  assertCheck(
    "includeSections=['saeun'] does not include unrelated sections",
    hasOnlySaeunSections,
    `sections=${formatIds(sectionIds)}`,
  );

  const hasSaeunSection = sectionIds.includes('saeun');
  const hasSaeunInPayload = containsSaeunToken(report);
  assertCheck(
    'report contains saeun output when saeun data is available',
    hasSaeunSection || hasSaeunInPayload,
    `sections=${formatIds(sectionIds)}; hasSaeunToken=${hasSaeunInPayload}; saeunPillars=${saeunPillars.length}`,
  );

  if (failCount > 0) {
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
  }

  console.log(`PASS summary: pass=${passCount}, fail=${failCount}`);
}

try {
  main().catch((error) => {
    console.error(`FAIL unexpected async error: ${toErrorMessage(error)}`);
    process.exit(1);
  });
} catch (error) {
  console.error(`FAIL unexpected error: ${toErrorMessage(error)}`);
  process.exit(1);
}
