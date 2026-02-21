import { buildSajuOnlyReport } from '../src/report/buildIntegratedReport.js';
import type { SajuSummary } from '../src/types.js';

const mockPillar = {
  stem: { code: 'GAP', hangul: '°©', hanja: 'Ë£' },
  branch: { code: 'JA', hangul: 'ÀÚ', hanja: 'í­' },
};

const mockSaju: SajuSummary = {
  pillars: {
    year: mockPillar,
    month: mockPillar,
    day: mockPillar,
    hour: mockPillar,
  },
  timeCorrection: {
    standardYear: 1990,
    standardMonth: 1,
    standardDay: 1,
    standardHour: 0,
    standardMinute: 0,
    adjustedYear: 1990,
    adjustedMonth: 1,
    adjustedDay: 1,
    adjustedHour: 0,
    adjustedMinute: 0,
    dstCorrectionMinutes: 0,
    longitudeCorrectionMinutes: 0,
    equationOfTimeMinutes: 0,
  },
  dayMaster: { stem: 'GAP', element: 'WOOD', polarity: 'YANG' },
  strength: {
    level: 'BALANCED',
    isStrong: false,
    totalSupport: 50,
    totalOppose: 50,
    deukryeong: 20,
    deukji: 15,
    deukse: 15,
    details: ['mock-strength'],
  },
  yongshin: {
    element: 'FIRE',
    heeshin: 'WOOD',
    gishin: 'WATER',
    gushin: null,
    confidence: 0.75,
    agreement: 'RANKING',
    recommendations: [
      {
        type: 'RANKING',
        primaryElement: 'FIRE',
        secondaryElement: null,
        confidence: 0.75,
        reasoning: 'mock-recommendation',
      },
    ],
  },
  gyeokguk: {
    type: 'JEONG_GWAN',
    category: 'NORMAL',
    baseTenGod: 'JEONG_GWAN',
    confidence: 0.5,
    reasoning: 'mock-gyeokguk',
  },
  elementDistribution: {
    WOOD: 25,
    FIRE: 20,
    EARTH: 20,
    METAL: 15,
    WATER: 20,
  },
  deficientElements: [],
  excessiveElements: [],
  cheonganRelations: [],
  jijiRelations: [],
  tenGodAnalysis: null,
  shinsalHits: [],
  gongmang: null,
};

const excludedSections = [
  'nameBasic',
  'nameElement',
  'fourFrame',
  'nameHarmony',
  'nameComparison',
  'sajuNameSynergy',
] as const;

let passCount = 0;
let failCount = 0;

function assertCheck(label: string, condition: boolean, details?: string): void {
  if (condition) {
    passCount += 1;
    console.log(`PASS ${label}`);
    return;
  }

  failCount += 1;
  console.error(`FAIL ${label}${details ? ` :: ${details}` : ''}`);
}

function main(): void {
  console.log('=== verify-report-saju-only ===');

  const report = buildSajuOnlyReport(mockSaju, {
    name: 'Test User',
    gender: 'neutral',
    birthInfo: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
    },
    today: new Date('2026-02-20T00:00:00.000Z'),
    variationSeed: 12345,
  });

  const sectionIds = report.sections.map((section) => section.id);
  const sectionIdSet = new Set(sectionIds);

  assertCheck('report object created', !!report);
  assertCheck('has at least one section', report.sections.length > 0, `count=${report.sections.length}`);

  for (const sectionId of excludedSections) {
    assertCheck(
      `excluded section not present: ${sectionId}`,
      !sectionIdSet.has(sectionId),
      `actual sections=${sectionIds.join(',')}`,
    );
  }

  if (failCount > 0) {
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
  }

  console.log(`PASS summary: pass=${passCount}, fail=${failCount}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`FAIL unexpected error: ${message}`);
  process.exit(1);
}
