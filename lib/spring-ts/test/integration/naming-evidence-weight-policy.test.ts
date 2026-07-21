import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import scoringConfig from '../../config/saju-scoring.json';
import { computeSajuNameScore } from '../../src/saju-calculator.js';
import {
  NAMING_EVIDENCE_WEIGHT_POLICY,
  resolveNamingEvidenceScoringWeights,
} from '../../src/naming-evidence-weight-policy.js';
import { loadPreset, SCHOOL_PRESET_ORDER } from '../../src/preset-loader.js';
import type { ElementKey } from '../../src/core/scoring.js';
import type { SajuOutputSummary } from '../../src/types.js';

const empty: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };

test('keeps scoring contribution weights in one shared policy', () => {
  assert.equal('adaptiveWeights' in scoringConfig, false);
  assert.equal('yongshinTypeWeights' in scoringConfig, false);
  assert.equal('yongshinScoring' in scoringConfig, false);
  const weights = NAMING_EVIDENCE_WEIGHT_POLICY.adaptiveWeights;
  assert.equal(weights.balanceBase + weights.yongshinBase + weights.strengthFixed + weights.tenGodFixed, 1);
});

test('resolves every school override from the shared weight policy', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  for (const presetName of SCHOOL_PRESET_ORDER) {
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'config/presets', `${presetName}.json`), 'utf8'));
    assert.equal('adaptiveWeights' in metadata, false);
    assert.equal('yongshinTypeWeights' in metadata, false);
    const expected = resolveNamingEvidenceScoringWeights(presetName);
    const actual = loadPreset(presetName);
    assert.deepEqual(actual.adaptiveWeights, expected.adaptiveWeights);
    assert.deepEqual(actual.yongshinTypeWeights, expected.yongshinTypeWeights);
  }
});

test('keeps narrative priority in comparable final-score points', () => {
  const policy = NAMING_EVIDENCE_WEIGHT_POLICY;
  assert.equal(policy.narrativeEvidence.balance.maxScoreImpact, policy.adaptiveWeights.balanceMax * 100);
  assert.equal(policy.narrativeEvidence.yongshin.maxScoreImpact, policy.adaptiveWeights.yongshinMax * 100);
  assert.equal(policy.narrativeEvidence.strength.maxScoreImpact, policy.adaptiveWeights.strengthFixed * 100);
  assert.equal(policy.narrativeEvidence.tenGod.maxScoreImpact, policy.adaptiveWeights.tenGodFixed * 100);
  assert.equal(policy.narrativeEvidence.deficiency.maxScoreImpact, policy.bonuses.deficiencyMaximum);
  assert.equal(
    policy.narrativeEvidence.harmfulElement.maxScoreImpact,
    policy.yongshinScoring.penalties.gusinMultiplier,
  );
  assert.equal(policy.narrativeEvidence.gyeokgukProtection.maxScoreImpact, policy.penalties.gyeokgukMaximum);
});

test('surfaces the applied policy and raw evidence from the score computation', () => {
  const output: SajuOutputSummary = {
    dayMaster: { element: 'Wood' },
    strength: { isStrong: false, totalSupport: 2, totalOppose: 5 },
    deficientElements: ['WATER'],
    excessiveElements: ['FIRE'],
    yongshin: {
      finalYongshin: 'WATER', finalHeesin: 'METAL', gisin: 'FIRE', gusin: 'EARTH',
      finalConfidence: 0.9, recommendations: [],
    },
    tenGod: { groupCounts: { friend: 2, output: 0, wealth: 1, authority: 2, resource: 0 } },
  };
  const result = computeSajuNameScore(
    { ...empty, Wood: 3, Fire: 3, Earth: 1, Metal: 1 },
    { ...empty, Water: 1, Metal: 1 },
    output,
  );
  const evidence = result.breakdown.sourceEvidence;
  assert.equal(evidence.policyVersion, NAMING_EVIDENCE_WEIGHT_POLICY.modelVersion);
  assert.equal(evidence.appliedWeights.strength, NAMING_EVIDENCE_WEIGHT_POLICY.adaptiveWeights.strengthFixed);
  assert.equal(evidence.appliedWeights.tenGod, NAMING_EVIDENCE_WEIGHT_POLICY.adaptiveWeights.tenGodFixed);
  assert.equal(
    evidence.weightedContributions.balance,
    evidence.componentScores.balance * evidence.appliedWeights.balance,
  );
  assert.equal(
    evidence.decisionImpacts.yongshin,
    Math.abs(evidence.componentScores.yongshin - 50) * 2 * evidence.appliedWeights.yongshin,
  );
  assert.deepEqual(evidence.balance.filledDeficientElements, ['Water']);
  assert.equal(evidence.yongshin.matches.yongshin, 1);
  assert.equal(evidence.yongshin.matches.heesin, 1);
  assert.deepEqual(evidence.deficiency.matchedElements, ['Water']);
});
