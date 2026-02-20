import { emptySaju } from '../src/saju-adapter.ts';
import type { ReportInput, ReportSection, ReportSectionId } from '../src/report/types.ts';
import type { SajuSummary } from '../src/types.ts';

const FIXED_VARIATION_SEED = 20260220;
const FIXED_TODAY_ISO = '2024-06-15T00:00:00.000Z';
const INCLUDED_SECTION_IDS: readonly ReportSectionId[] = [
  'shinsalBad',
  'yearlyFortune',
  'nameHarmony',
  'actionPlan',
];

interface IntegratedReportLike {
  readonly sections: ReportSection[];
  readonly [key: string]: unknown;
}

interface SectionExpectation {
  readonly expectHighlights: boolean;
  readonly expectTables: boolean;
}

const EXPECTATIONS: Record<ReportSectionId, SectionExpectation> = {
  pillars: { expectHighlights: false, expectTables: false },
  dayMaster: { expectHighlights: false, expectTables: false },
  hiddenStems: { expectHighlights: false, expectTables: false },
  elements: { expectHighlights: false, expectTables: false },
  deficiency: { expectHighlights: false, expectTables: false },
  tongguan: { expectHighlights: false, expectTables: false },
  climate: { expectHighlights: false, expectTables: false },
  tenGods: { expectHighlights: false, expectTables: false },
  lifeStages: { expectHighlights: false, expectTables: false },
  strength: { expectHighlights: false, expectTables: false },
  gyeokguk: { expectHighlights: false, expectTables: false },
  yongshin: { expectHighlights: false, expectTables: false },
  yongshinLife: { expectHighlights: false, expectTables: false },
  stemRelations: { expectHighlights: false, expectTables: false },
  branchRelations: { expectHighlights: false, expectTables: false },
  shinsalGood: { expectHighlights: false, expectTables: false },
  shinsalBad: { expectHighlights: true, expectTables: true },
  daeun: { expectHighlights: false, expectTables: false },
  saeun: { expectHighlights: false, expectTables: false },
  monthlyFortune: { expectHighlights: false, expectTables: false },
  nameElement: { expectHighlights: false, expectTables: false },
  fourFrame: { expectHighlights: false, expectTables: false },
  nameHarmony: { expectHighlights: true, expectTables: true },
  summary: { expectHighlights: false, expectTables: false },
  actionPlan: { expectHighlights: true, expectTables: true },
  health: { expectHighlights: false, expectTables: false },
  career: { expectHighlights: false, expectTables: false },
  relationships: { expectHighlights: false, expectTables: false },
  luckItems: { expectHighlights: false, expectTables: false },
  yearlyFortune: { expectHighlights: true, expectTables: true },
  dailyFortune: { expectHighlights: false, expectTables: false },
  weeklyFortune: { expectHighlights: false, expectTables: false },
  nameBasic: { expectHighlights: false, expectTables: false },
  nameComparison: { expectHighlights: false, expectTables: false },
  sajuNameSynergy: { expectHighlights: false, expectTables: false },
  elementLifestyle: { expectHighlights: false, expectTables: false },
};

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

async function loadBuilder(): Promise<(input: ReportInput) => IntegratedReportLike> {
  const module = await import('../src/report/buildIntegratedReport.ts');
  const builder = (module as { buildIntegratedReport?: unknown }).buildIntegratedReport;
  if (typeof builder !== 'function') {
    throw new Error('buildIntegratedReport export is missing');
  }
  return builder as (input: ReportInput) => IntegratedReportLike;
}

function createSpringMock(): NonNullable<ReportInput['spring']> {
  return {
    finalScore: 86,
    sajuCompatibility: {
      yongshinElement: 'WOOD',
      heeshinElement: 'FIRE',
      gishinElement: 'WATER',
      nameElements: ['WOOD', 'FIRE', 'EARTH'],
      yongshinMatchCount: 2,
      gishinMatchCount: 0,
      dayMasterSupportScore: 77,
      affinityScore: 82,
    },
  } as unknown as NonNullable<ReportInput['spring']>;
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
    shinsalHits: [
      {
        type: 'CHUNG_SAL',
        position: 'DAY',
        grade: 'inauspicious',
        baseWeight: -1.8,
        positionMultiplier: 1.2,
        weightedScore: -2.1,
      },
      {
        type: 'BAEK_HO',
        position: 'HOUR',
        grade: 'C',
        baseWeight: -1.2,
        positionMultiplier: 1.0,
        weightedScore: -1.2,
      },
    ],
  };

  return {
    saju: mockSaju,
    spring: createSpringMock(),
    name: 'Knowledge Integration Verify',
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
      includeSections: [...INCLUDED_SECTION_IDS],
    },
  };
}

async function main(): Promise<void> {
  console.log('=== verify-report-knowledge-integration ===');

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

  let report: IntegratedReportLike;
  try {
    report = buildIntegratedReport(input);
    assertCheck(
      "includeSections=['shinsalBad','yearlyFortune','nameHarmony','actionPlan'] does not throw",
      true,
    );
  } catch (error) {
    assertCheck(
      "includeSections=['shinsalBad','yearlyFortune','nameHarmony','actionPlan'] does not throw",
      false,
      toErrorMessage(error),
    );
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
    return;
  }

  const sectionMap = new Map(report.sections.map((section) => [section.id, section]));

  for (const sectionId of INCLUDED_SECTION_IDS) {
    const section = sectionMap.get(sectionId);
    assertCheck(
      `${sectionId} section exists`,
      Boolean(section),
      `sections=${formatSectionIds(report.sections)}`,
    );

    if (!section) continue;

    const paragraphCount = collectionSize(section.paragraphs);
    assertCheck(
      `${sectionId} has at least one paragraph`,
      paragraphCount > 0,
      `paragraphs=${paragraphCount}`,
    );

    const expectation = EXPECTATIONS[sectionId];
    if (expectation.expectHighlights) {
      const highlightCount = collectionSize(section.highlights);
      assertCheck(
        `${sectionId} includes highlights`,
        highlightCount > 0,
        `highlights=${highlightCount}`,
      );
    }

    if (expectation.expectTables) {
      const tableCount = collectionSize(section.tables);
      assertCheck(
        `${sectionId} includes tables`,
        tableCount > 0,
        `tables=${tableCount}`,
      );
    }
  }

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
