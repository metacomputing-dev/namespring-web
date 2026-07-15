/**
 * test/integration/insight-registry-content.test.ts
 *
 * Verifies newly-authored insight text for PR-2/5/6 surfaces:
 *   - gyeokguk seongpae verdict x usage entries
 *   - heavenly-stem hapState entries
 *   - resolved branch relation / 반합 / 귀문 entries
 *   - shinsal palace-position and residual type entries
 *
 * Run: npx tsx test/integration/insight-registry-content.test.ts
 */
import { buildInsightFactsCard } from '../../src/report/cards/insight-facts-card.js';
import {
  _clearInsightCacheForTesting,
  getInsightInterpretation,
  type InsightInterpretation,
} from '../../src/report/tiered/insight-registry.js';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function hasT1Provenance(entry: InsightInterpretation | null): boolean {
  return entry?.aiGenerated === true &&
    entry.sourceTier?.tier === 'T1_HYPOTHESIS' &&
    entry.sourceTier?.authorityTruthEligible === false;
}

const sibiUnseongStages = [
  '장생', '목욕', '관대', '건록', '제왕', '쇠',
  '병', '사', '묘', '절', '태', '양',
] as const;

const sibiUnseongSourceTier = {
  tier: 'T1_HYPOTHESIS',
  sourceType: 'ai_authored_insight_text',
  sourceUrl: null,
  accessedAt: '2026-07-08',
  quoteShort: null,
  humanInterpretation: 'AI-authored Korean narrative for display-only sibi-unseong insight text. expertText denotes detail level, not expert validation.',
  copyrightNote: 'No third-party prose copied.',
  authorityTruthEligible: false,
} as const;

function hasExactSibiUnseongProvenance(entry: InsightInterpretation | null): boolean {
  if (entry?.aiGenerated !== true || !entry.sourceTier) return false;
  const expectedEntries = Object.entries(sibiUnseongSourceTier);
  return Object.keys(entry.sourceTier).length === expectedEntries.length &&
    expectedEntries.every(([key, value]) =>
      entry.sourceTier?.[key as keyof typeof sibiUnseongSourceTier] === value);
}

const seongpaeVerdicts = [
  'SEONGGYEOK',
  'PAGYEOK',
  'PAJUNG_YUGU',
  'SEONGJUNG_YUPA',
  'UNDETERMINED',
];
const usages = ['SUNYONG', 'YEOKYONG'];

const requiredIds = [
  ...seongpaeVerdicts.flatMap((verdict) =>
    usages.map((usage) => `gyeokgukSeongpae.${verdict}.${usage}`)),
  'stemHapState.HUA',
  'stemHapState.HAPGEO',
  'stemHapState.JAENGHAP',
  'stemHapState.YOHAP',
  'branchRelation.반합',
  'branchRelation.귀문',
  'branchRelation.resolved.해소',
  'shinsal.귀인@year',
  'shinsal.귀인@month',
  'shinsal.귀인@day',
  'shinsal.귀인@hour',
  'shinsal.귀문관살',
  'shinsal.고신살',
  'shinsal.과숙살',
];

console.log('Insight registry authored-content coverage\n');
_clearInsightCacheForTesting();

for (const id of requiredIds) {
  const entry = getInsightInterpretation(id);
  check(`${id} resolves`, entry != null);
  check(`${id} has T1 aiGenerated provenance`, hasT1Provenance(entry));
}

for (const stage of sibiUnseongStages) {
  const id = `sibiUnseong.${stage}`;
  const entry = getInsightInterpretation(id);
  check(`${id} resolves`, entry != null);
  check(`${id} has exact display-only T1 provenance`, hasExactSibiUnseongProvenance(entry));
  check(`${id} has detailed display text`,
    typeof entry?.expertText === 'string' && entry.expertText.length > 0);

  const stageCard = buildInsightFactsCard({
    sibiUnseong: { year: stage },
  } as any);
  const stageFact = stageCard?.facts.find((fact) => fact.factId === `${id}.year`);
  check(`${id} provenance and expertText survive buildInsightFactsCard`,
    JSON.stringify(stageFact?.interpretation) === JSON.stringify(entry));
}

const synthetic: any = {
  gyeokguk: {
    type: '정관격',
    category: 'regular',
    baseTenGod: '정관',
    confidence: 0.8,
    reasoning: '',
    seongpae: {
      verdict: 'SEONGGYEOK',
      usage: 'SUNYONG',
      sangshin: '정관',
      sangshinStemHanja: null,
      pagyeokFactor: null,
      gueung: null,
      reasons: [],
    },
  },
  shinsalHits: [
    {
      type: '천을귀인',
      position: 'DAY_STEM',
      grade: 'A',
      baseWeight: 100,
      positionMultiplier: 1,
      weightedScore: 100,
      seatPillars: ['month'],
    },
    {
      type: '귀문관살',
      position: 'DAY_BRANCH',
      grade: 'B',
      baseWeight: 70,
      positionMultiplier: 1,
      weightedScore: 70,
      seatPillars: [],
    },
  ],
  gongmang: null,
  cheonganRelations: [
    {
      type: '합',
      stems: ['갑', '기'],
      resultElement: '토',
      note: '갑기합',
      score: null,
      hapState: 'HUA',
      hapStateKo: '합화',
      resultConfirmed: true,
    },
  ],
  jijiRelations: [
    { type: '반합', branches: ['묘', '미'], note: '묘미 반합', outcome: null, reasoning: null },
    { type: '충', branches: ['자', '오'], note: '자오충', outcome: '해소', reasoning: '합으로 해소' },
  ],
};

const card = buildInsightFactsCard(synthetic);
const facts = card?.facts ?? [];

function interpretedFact(id: string): boolean {
  return facts.some((fact) => fact.factId === id && fact.interpretation?.text);
}

check('consumer emits interpreted gyeokguk seongpae fact',
  interpretedFact('gyeokgukSeongpae.SEONGGYEOK.SUNYONG'));
check('consumer emits interpreted hapState fact',
  interpretedFact('stemHapState.HUA'));
check('consumer emits interpreted 반합 relation via type fallback',
  interpretedFact('branchRelation.반합.묘-미'));
check('consumer emits interpreted resolved relation fact',
  interpretedFact('branchRelation.resolved.해소'));
check('consumer emits interpreted shinsal palace fact via 귀인@pillar fallback',
  interpretedFact('shinsal.천을귀인@month'));
check('consumer emits interpreted residual shinsal type fact',
  interpretedFact('shinsal.귀문관살'));

console.log(`\nInsight registry authored-content coverage: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
