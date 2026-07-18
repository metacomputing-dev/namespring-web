/**
 * test/integration/naming-explanation.test.ts
 *
 * Verifies PR-6.4 deterministic naming explanations without DB access.
 *
 * Run: npm run test:naming-explanation
 * Update snapshot: npx tsx test/integration/naming-explanation.test.ts --update
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EvaluationResult, FrameInsight } from '../../src/core/evaluator.js';
import { buildNamingExplanation, selectNamingPhraseMode } from '../../src/naming-explanation.js';
import type {
  CandidateStrengthProfile,
  NamingExplanation,
  NamingScoreVector,
  SourceTierMetadata,
} from '../../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/naming_explanation_snapshot.json');
const UPDATE = process.argv.includes('--update');

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

function insight(frame: string, score: number, isPassed: boolean): FrameInsight {
  return { frame, score, isPassed, label: frame, details: {} };
}

function evaluationResult(): EvaluationResult {
  const categories = [
    insight('FOURFRAME_LUCK', 88, true),
    insight('HANGUL_ELEMENT', 42, false),
    insight('HANGUL_POLARITY', 82, true),
  ];
  return {
    score: 72,
    isPassed: true,
    categoryMap: Object.fromEntries([
      ['TOTAL', insight('TOTAL', 72, true)],
      ...categories.map((category) => [category.frame, category] as const),
    ]),
    categories,
  };
}

function vector(overrides: Partial<NamingScoreVector>): NamingScoreVector {
  return {
    legal: 90,
    sajuFit: 58,
    yongshinFit: null,
    elementBalance: 84,
    hanjaMeaning: 88,
    phonetic: 92,
    eraFit: null,
    familyFit: 86,
    risk: 18,
    ...overrides,
  };
}

const profile: CandidateStrengthProfile = {
  id: 'phonetic_stability',
  label: '발음 안정형',
  primaryAxis: 'phonetic',
  reasons: ['phonetic 92', 'familyFit 86', 'riskQuality 82'],
  paretoFrontier: false,
};

const t5: SourceTierMetadata = {
  tier: 'T5_OFFICIAL',
  sourceType: 'official_data',
  sourceUrl: 'https://example.test/source',
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'Official fixture for phrase mode tests.',
  copyrightNote: 'No copied source text.',
  authorityTruthEligible: true,
};
const t3 = { ...t5, tier: 'T3_AUTHORED_INTERPRETATION', sourceType: 'authored_rule' };
const t1 = { ...t5, tier: 'T1_HYPOTHESIS', sourceType: 'hypothesis', authorityTruthEligible: false };

function stableExplanation(explanation: NamingExplanation): object {
  return {
    summary: explanation.summary,
    strengths: explanation.strengths,
    cautions: explanation.cautions,
    signals: explanation.signals.map((signal) => ({
      axis: signal.axis,
      kind: signal.kind,
      phraseMode: signal.phraseMode,
      value: signal.value,
      sourceTier: {
        tier: signal.sourceTier.tier,
        authorityTruthEligible: signal.sourceTier.authorityTruthEligible,
      },
      phrase: signal.phrase,
    })),
  };
}

function normalizeJson(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

console.log('PR-6.4 deterministic naming explanations\n');

check('T1 definite source is capped to displayOnly',
  selectNamingPhraseMode({ sourceTier: t1, strength: 'definite' }) === 'displayOnly');
check('T5 definite source can be assertive',
  selectNamingPhraseMode({ sourceTier: t5, strength: 'definite' }) === 'assertive');
check('T3 authored authority source caps at practical',
  selectNamingPhraseMode({ sourceTier: t3, strength: 'definite' }) === 'practical');
check('candidate confidence caps official source',
  selectNamingPhraseMode({ sourceTier: t5, strength: 'candidate' }) === 'candidate');
check('high risk caps official source',
  selectNamingPhraseMode({ sourceTier: t5, strength: 'definite', risk: 72 }) === 'candidate');

const lowRiskExplanation = buildNamingExplanation({
  evaluationResult: evaluationResult(),
  scoreVector: vector({}),
  strengthProfile: profile,
});
const highRiskExplanation = buildNamingExplanation({
  evaluationResult: evaluationResult(),
  scoreVector: vector({ risk: 72, sajuFit: 42, yongshinFit: null, eraFit: null }),
  strengthProfile: { ...profile, id: 'risk_managed', label: '위험 관리형', primaryAxis: 'risk' },
});
const fallbackExplanation = buildNamingExplanation({ evaluationResult: evaluationResult() });
const provenanceIsolationInput = {
  evaluationResult: evaluationResult(),
  scoreVector: vector({ sajuFit: 84, yongshinFit: 83 }),
  strengthProfile: profile,
};
const firstProvenanceExplanation = buildNamingExplanation(provenanceIsolationInput);
const firstSajuFitSignal = firstProvenanceExplanation.signals
  .find((signal) => signal.axis === 'sajuFit');
const firstYongshinFitSignal = firstProvenanceExplanation.signals
  .find((signal) => signal.axis === 'yongshinFit');

check('low-risk explanation uses template summary',
  lowRiskExplanation.summary.includes('주요 후보 성향은 발음 안정형이에요.'));
check('null axis is unavailable, not failed',
  highRiskExplanation.signals.some((signal) =>
    signal.axis === 'yongshinFit' &&
    signal.kind === 'unavailable' &&
    signal.phrase.includes('근거가 부족')));
check('high risk produces explicit caution',
  highRiskExplanation.cautions.some((phrase) => phrase.includes('더 안전한 후보와 비교')));
check('fallback explanation avoids detailed diagnosis',
  fallbackExplanation.cautions.some((phrase) => phrase.includes('점수 벡터 근거가 없어')));
check('derived-axis provenance is owned by each signal',
  Boolean(firstSajuFitSignal) &&
    Boolean(firstYongshinFitSignal) &&
    firstSajuFitSignal?.sourceTier !== firstYongshinFitSignal?.sourceTier);

if (firstSajuFitSignal) {
  const mutableSourceTier = firstSajuFitSignal.sourceTier as {
    tier: string;
    authorityTruthEligible: boolean;
  };
  mutableSourceTier.tier = 'T5_OFFICIAL';
  mutableSourceTier.authorityTruthEligible = true;
}
const secondProvenanceExplanation = buildNamingExplanation(provenanceIsolationInput);
const secondSajuFitSignal = secondProvenanceExplanation.signals
  .find((signal) => signal.axis === 'sajuFit');
check('caller mutation cannot promote a later explanation to official authority',
  secondSajuFitSignal?.sourceTier.tier === 'T2_REFERENCE_IMPLEMENTATION' &&
    secondSajuFitSignal.sourceTier.authorityTruthEligible === false &&
    secondSajuFitSignal.phraseMode === 'displayOnly' &&
    secondSajuFitSignal.phrase.startsWith('표시용 점수 기준으로는') &&
    !secondSajuFitSignal.phrase.includes('공식 자료 기준으로는'));

const snapshot = {
  lowRisk: stableExplanation(lowRiskExplanation),
  highRisk: stableExplanation(highRiskExplanation),
  fallback: stableExplanation(fallbackExplanation),
};
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
if (UPDATE) {
  fs.writeFileSync(SNAPSHOT_PATH, serialized);
  console.log(`  UPDATED ${path.relative(SPRING_TS_ROOT, SNAPSHOT_PATH)}`);
} else {
  const expected = normalizeJson(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  check('naming explanation snapshot matches',
    normalizeJson(serialized) === expected,
    path.relative(SPRING_TS_ROOT, SNAPSHOT_PATH));
}

console.log(`\nNaming explanation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
