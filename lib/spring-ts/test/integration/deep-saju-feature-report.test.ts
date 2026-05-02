import { buildDeepSajuFeatureReport } from '../../tools/deep_saju_feature_report.ts';

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

console.log('Deep saju feature report\n');

const report = await buildDeepSajuFeatureReport({ generatedAt: 'test-run' });
const rows = report.rows as any[];
const fix01 = rows.find((row) => row.id === 'fix-01');

check('schema version is stable',
  report.schemaVersion === 'spring-ts.deep-saju-feature-report.v1',
  report.schemaVersion);
check('all baseline fixtures are summarized',
  report.fixtureCount >= 12 && rows.length === report.fixtureCount,
  `rows=${rows.length}`);
check('fix-01 row exists',
  fix01 != null);
check('pillar labels are exposed for deep fixture audit',
  typeof fix01?.pillars?.year?.hanja === 'string' &&
    typeof fix01?.pillars?.month?.hanja === 'string' &&
    typeof fix01?.pillars?.day?.hanja === 'string' &&
    typeof fix01?.pillars?.hour?.hanja === 'string',
  JSON.stringify(fix01?.pillars));
check('yongshin consensus carries method-level elements',
  fix01?.yongshin?.consensus?.axes?.eokbu?.element &&
    fix01?.yongshin?.consensus?.axes?.johu?.element &&
    fix01?.yongshin?.consensus?.final?.conflictLevel,
  JSON.stringify(fix01?.yongshin?.consensus?.final));
check('ten-god group counts are surfaced',
  Object.keys(fix01?.tenGod?.groupCounts ?? {}).length >= 5 &&
    typeof fix01?.tenGod?.dominantGroup === 'string',
  JSON.stringify(fix01?.tenGod?.groupCounts));
check('ten-god position groups include month and hidden-stem mass',
  fix01?.tenGod?.positionGroups?.month &&
    Object.keys(fix01?.tenGod?.hiddenStemGroupMass ?? {}).length >= 5,
  JSON.stringify(fix01?.tenGod?.positionGroups?.month));
check('gyeokguk candidates preserve weighted feature trace',
  Array.isArray(fix01?.gyeokguk?.topCandidates) &&
    Array.isArray(fix01?.gyeokguk?.topCandidates?.[0]?.compositeTopFeatures),
  JSON.stringify(fix01?.gyeokguk?.topCandidates?.[0]));
check('shinsal summary uses weighted ordering',
  Array.isArray(fix01?.shinsal?.topWeighted) &&
    fix01.shinsal.topWeighted.length > 0 &&
    Number.isFinite(fix01.shinsal.topWeighted[0].weightedScore),
  JSON.stringify(fix01?.shinsal?.topWeighted?.[0]));
check('coverage includes consensus conflict levels',
  Object.keys(report.coverage.consensusConflictLevel).length > 0,
  JSON.stringify(report.coverage.consensusConflictLevel));
check('at least one fixture has high yongshin-method conflict',
  report.totals.highConsensusConflictCount > 0,
  String(report.totals.highConsensusConflictCount));
check('pending authority notes are counted for known disagreement rows',
  report.totals.pendingAuthorityNoteCount > 0,
  String(report.totals.pendingAuthorityNoteCount));

console.log(`\nDeep saju feature report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
