/**
 * test/integration/baseline-metrics.test.ts
 *
 * Verifies Phase 0 baseline dashboard artifacts.
 *
 * Run: npm run test:baseline-metrics
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const METRICS_DIR = path.resolve(SPRING_TS_ROOT, 'metrics');

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

function readMetric(fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(METRICS_DIR, fileName), 'utf-8'));
}

console.log('Phase 0 baseline metrics test\n');

execSync('npm run metrics:baseline', {
  cwd: SPRING_TS_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

const bySourceTier = readMetric('bySourceTier.json');
const sourceTierSummary = readMetric('source-tier-summary.json');
const rpiSummary = readMetric('rpi-summary.json');

check('bySourceTier schema version is current',
  bySourceTier.schemaVersion === 'spring-ts.by-source-tier.v1');
check('source tier summary scans the Phase 0 source ledger',
  sourceTierSummary.scanned >= 51,
  `scanned=${sourceTierSummary.scanned}`);
check('source tier summary is PASS',
  sourceTierSummary.status === 'PASS',
  `status=${sourceTierSummary.status}`);

const qByTier = bySourceTier.qualityGateByReferenceTier ?? {};
const tierFixtureTotal = Object.values(qByTier)
  .reduce((sum: number, bucket: any) => sum + (bucket.fixtureCount ?? 0), 0);
check('reference-tier fixture buckets cover the full baseline',
  tierFixtureTotal === bySourceTier.baseline?.fixtureCount,
  `bucketed=${tierFixtureTotal}, baseline=${bySourceTier.baseline?.fixtureCount}`);
check('non-authority reference fixtures remain visible',
  !!qByTier.T2_REFERENCE_IMPLEMENTATION || !!qByTier.NO_REFERENCE,
  `tiers=${Object.keys(qByTier).join(', ')}`);

check('insufficient source truth is separated from engine rule failure',
  bySourceTier.truthSeparation?.engineRuleFailureCount === 0 &&
    bySourceTier.truthSeparation?.insufficientSourceTruthCount >= 0,
  JSON.stringify(bySourceTier.truthSeparation));

const modes = bySourceTier.ruleModeBreakdown?.modes ?? {};
check('monthly_main rule mode is present', !!modes.monthly_main);
check('jungki_transparent rule mode is present', !!modes.jungki_transparent);
check('composite_classical rule mode is present', !!modes.composite_classical);

const presets = bySourceTier.schoolPresetBreakdown?.presets ?? {};
check('korean schoolPreset breakdown is present', presets.korean?.fixtureCount === 15);
check('chinese schoolPreset breakdown is present', presets.chinese?.fixtureCount === 15);
check('modern schoolPreset breakdown is present', presets.modern?.fixtureCount === 15);

check('RPI summary has A-G axis scores',
  rpiSummary.axisScores &&
    Object.keys(rpiSummary.axisScores).length === 7);
check('RPI truth separation reports no current engine rule failures',
  rpiSummary.truthSeparation?.engineRuleFailureCount === 0,
  JSON.stringify(rpiSummary.truthSeparation));

console.log(`\nBaseline metrics: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
