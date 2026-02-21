import { emptySaju } from '../src/saju-adapter.ts';
import type { ReportInput, ReportSection, ReportSectionId } from '../src/report/types.ts';
import type { SajuSummary } from '../src/types.ts';

const FIXED_VARIATION_SEED = 20260220;
const FIXED_TODAY_ISO = '2024-06-15T00:00:00.000Z';
const ACTION_PLAN_SECTION_ID: ReportSectionId = 'actionPlan';

let passCount = 0;
let failCount = 0;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatSectionIds(sections: readonly ReportSection[]): string {
  if (sections.length === 0) return '(none)';
  return sections.map((section) => String(section.id)).join(', ');
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

function collectionSize(collection: unknown): number {
  return Array.isArray(collection) ? collection.length : 0;
}

interface IntegratedReportLike {
  readonly sections: ReportSection[];
  readonly [key: string]: unknown;
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
    dayMaster: { stem: 'BYEONG', element: 'FIRE', polarity: 'YANG' },
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
      element: 'WOOD',
      heeshin: 'FIRE',
      gishin: 'WATER',
      gushin: 'METAL',
      confidence: 0.81,
      agreement: 'RANKING',
      recommendations: [
        {
          type: 'RANKING',
          primaryElement: 'WOOD',
          secondaryElement: 'FIRE',
          confidence: 0.81,
          reasoning: 'deterministic-mock',
        },
      ],
    },
    gyeokguk: {
      type: 'JEONG_GWAN',
      category: 'NORMAL',
      baseTenGod: 'JEONG_GWAN',
      confidence: 0.63,
      reasoning: 'deterministic-mock',
    },
    elementDistribution: {
      WOOD: 27,
      FIRE: 24,
      EARTH: 20,
      METAL: 14,
      WATER: 15,
    },
    deficientElements: ['METAL'],
    excessiveElements: ['WOOD'],
  };

  return {
    saju: mockSaju,
    name: 'Action Plan Verify',
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
      includeSections: ['actionPlan'],
    },
  };
}

async function main(): Promise<void> {
  console.log('=== verify-report-action-plan ===');

  const input = createDeterministicInput();

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

  let report: IntegratedReportLike;
  try {
    report = buildIntegratedReport(input);
    assertCheck("includeSections=['actionPlan'] does not throw", true);
  } catch (error) {
    assertCheck("includeSections=['actionPlan'] does not throw", false, toErrorMessage(error));
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
    return;
  }

  const actionPlanSection = report.sections.find(
    (section) => String(section.id) === String(ACTION_PLAN_SECTION_ID),
  );

  assertCheck(
    'actionPlan section exists',
    Boolean(actionPlanSection),
    `sections=${formatSectionIds(report.sections)}`,
  );

  const tableCount = collectionSize(actionPlanSection?.tables);
  const chartCount = collectionSize(actionPlanSection?.charts);
  const highlightCount = collectionSize(actionPlanSection?.highlights);

  assertCheck(
    'actionPlan section includes table',
    tableCount > 0,
    `tables=${tableCount}; sections=${formatSectionIds(report.sections)}`,
  );
  assertCheck(
    'actionPlan section includes chart',
    chartCount > 0,
    `charts=${chartCount}; sections=${formatSectionIds(report.sections)}`,
  );
  assertCheck(
    'actionPlan section includes highlights',
    highlightCount > 0,
    `highlights=${highlightCount}; sections=${formatSectionIds(report.sections)}`,
  );

  if (failCount > 0) {
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
  }

  console.log(`PASS summary: pass=${passCount}, fail=${failCount}`);
}

main().catch((error) => {
  console.error(`FAIL unexpected async error: ${toErrorMessage(error)}`);
  process.exit(1);
});
