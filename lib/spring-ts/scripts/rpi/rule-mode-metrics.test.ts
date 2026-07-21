import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ruleModeModule from './rule-mode-metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const PHASE_P_RESULTS_PATH = path.resolve(
  SPRING_TS_ROOT,
  'test/baseline/PHASE_P_RESULTS.md',
);

const output = ruleModeModule.buildRuleModeBreakdown(
  PHASE_P_RESULTS_PATH,
) as Record<string, any>;
const serialized = JSON.stringify(output);

assert.deepEqual(Object.keys(ruleModeModule), ['buildRuleModeBreakdown']);
assert.equal(output.authorityScope, 'historical_observation_only');
assert.equal(output.releaseEligible, false);
assert.equal(
  output.historicalCompositeObservation.authorityScope,
  'historical_observation_only',
);
assert.equal(
  output.historicalCompositeObservation.releaseEligible,
  false,
);
assert.equal(
  output.historicalCompositeObservation.allHistoricalFloorsObserved,
  true,
);

const forbiddenGateName = 'composite' + 'QualityGate';
const currentAuthoredTier = 'T' + '3_AUTHORED_INTERPRETATION';
const currentPrimaryTier = 'T' + '4_PRIMARY_TEXT';
const genericPositiveState = ['P', 'A', 'S', 'S'].join('');
assert.equal(serialized.includes(forbiddenGateName), false);
assert.equal(serialized.includes(currentAuthoredTier), false);
assert.equal(serialized.includes(currentPrimaryTier), false);
assert.equal(
  serialized.includes(`"status":"${genericPositiveState}"`),
  false,
);

const modes = output.modes;
assert.deepEqual(
  {
    monthlyMain: [modes.monthly_main.pass, modes.monthly_main.total],
    jungki: [modes.jungki_transparent.pass, modes.jungki_transparent.total],
    composite: [
      modes.composite_classical.pass,
      modes.composite_classical.total,
    ],
  },
  {
    monthlyMain: [17, 27],
    jungki: [14, 27],
    composite: [17, 27],
  },
);
assert.equal(modes.composite_classical.releaseEligible, false);
assert.equal(
  modes.composite_classical.authorityScope,
  'historical_observation_only',
);
assert.equal(
  modes.composite_classical.selectionPolicy,
  'historical_evidence_only_never_promote',
);
assert.deepEqual(
  [
    modes.composite_classical.historicalCandidateCoverage.covered,
    modes.composite_classical.historicalCandidateCoverage.comparable,
  ],
  [23, 27],
);

const historicalLabels =
  modes.composite_classical.byHistoricalLabelTier;
assert.deepEqual(
  Object.keys(historicalLabels).sort(),
  [
    'phase_p_authored_interpretation_label',
    'phase_p_primary_text_label',
  ],
);
assert.deepEqual(
  [
    historicalLabels.phase_p_authored_interpretation_label
      .historicalCandidateCoverage.covered,
    historicalLabels.phase_p_authored_interpretation_label
      .historicalCandidateCoverage.comparable,
    historicalLabels.phase_p_primary_text_label
      .historicalCandidateCoverage.covered,
    historicalLabels.phase_p_primary_text_label
      .historicalCandidateCoverage.comparable,
  ],
  [20, 21, 3, 6],
);

const sourceGroups = modes.composite_classical.bySourceGroup;
assert.deepEqual(
  {
    lecture: [
      sourceGroups.lecture.historicalCandidateCoverage.covered,
      sourceGroups.lecture.historicalCandidateCoverage.comparable,
    ],
    jonheom: [
      sourceGroups.jonheom.historicalCandidateCoverage.covered,
      sourceGroups.jonheom.historicalCandidateCoverage.comparable,
    ],
    koreanModern: [
      sourceGroups.korean_modern_figures_and_chumyeongga
        .historicalCandidateCoverage.covered,
      sourceGroups.korean_modern_figures_and_chumyeongga
        .historicalCandidateCoverage.comparable,
    ],
  },
  {
    lecture: [14, 14],
    jonheom: [3, 6],
    koreanModern: [6, 7],
  },
);

assert.ok(
  output.historicalCompositeObservation.checks.every(
    (check: Record<string, unknown>) =>
      check.meetsHistoricalFloor === true &&
      check.releaseEligible === false &&
      check.authorityScope === 'historical_observation_only' &&
      !Object.hasOwn(check, 'status'),
  ),
);

const malformedDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'rule-mode-metrics-'),
);
const malformedPath = path.join(malformedDir, 'PHASE_P_RESULTS.md');
try {
  fs.writeFileSync(
    malformedPath,
    'monthly_main | 1/1 (100%)\n',
    'utf-8',
  );
  assert.throws(
    () => ruleModeModule.buildRuleModeBreakdown(malformedPath),
    /Cannot parse monthly_main table row/u,
  );
} finally {
  fs.rmSync(malformedDir, { recursive: true, force: true });
}

console.log('RPI historical rule-mode metrics: PASS');
