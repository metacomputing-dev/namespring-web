/**
 * test/integration/pareto-candidates.test.ts
 *
 * Verifies PR-6.2 Pareto/diversity candidate ordering without initializing DBs.
 *
 * Run: npm run test:pareto-candidates
 */
import { SpringEngine, type NamingScoreVector, type SpringCandidateSummary } from '../../src/index.js';

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

const engine: any = new SpringEngine();

function vector(overrides: Partial<NamingScoreVector>): NamingScoreVector {
  return {
    legal: 70,
    sajuFit: 60,
    yongshinFit: 60,
    elementBalance: 60,
    hanjaMeaning: 70,
    phonetic: 70,
    eraFit: 60,
    familyFit: 70,
    risk: 35,
    ...overrides,
  };
}

function summary(
  givenHangul: string,
  givenHanja: string,
  finalScore: number,
  scoreVector: NamingScoreVector,
): SpringCandidateSummary {
  const strengthProfile = engine.deriveCandidateStrengthProfile(scoreVector);
  return {
    finalScore,
    scoreVector,
    strengthProfile,
    fullHangul: `\uCD5C${givenHangul}`,
    fullHanja: `\u5D14${givenHanja}`,
    givenHangul,
    givenName: Array.from(givenHangul).map((hangul, index) => ({
      hangul,
      hanja: Array.from(givenHanja)[index] ?? '',
    })),
    popularityRank: null,
    maleRatio: null,
    nameGender: 'unknown',
    rank: 0,
  };
}

console.log('PR-6.2 Pareto candidate ranking\n');

check('high saju axes classify as saju reinforcement',
  engine.deriveCandidateStrengthProfile(vector({
    sajuFit: 92,
    yongshinFit: 88,
    elementBalance: 90,
    phonetic: 65,
    eraFit: 60,
    familyFit: 60,
    risk: 20,
  })).id === 'saju_reinforcement');

check('high phonetic axes classify as phonetic stability',
  engine.deriveCandidateStrengthProfile(vector({
    sajuFit: 45,
    yongshinFit: 40,
    elementBalance: 55,
    phonetic: 96,
    familyFit: 94,
    risk: 10,
  })).id === 'phonetic_stability');

check('high era axis classifies as era balance',
  engine.deriveCandidateStrengthProfile(vector({
    sajuFit: 50,
    yongshinFit: 45,
    elementBalance: 55,
    phonetic: 60,
    eraFit: 97,
    familyFit: 60,
    risk: 8,
  })).id === 'era_balance');

const repeatedFiltered = engine.filterInternallyRepeatedCandidates([
  [{ hangul: '\uBBFC', hanja: '\u65FB' }, { hangul: '\uBBFC', hanja: '\u73C9' }],
  [{ hangul: '\uC218', hanja: '\u79C0' }, { hangul: '\uC544', hanja: '\u79C0' }],
  [{ hangul: '\uC11C', hanja: '\u745E' }, { hangul: '\uC724', hanja: '\u6F64' }],
]);
check('generated candidates reject repeated syllable or repeated normalized hanja',
  repeatedFiltered.length === 1 && repeatedFiltered[0]?.[0]?.hangul === '\uC11C',
  `remaining=${JSON.stringify(repeatedFiltered)}`);

const dominatedHighScore = summary('\uBBFC\uC900', '\u65FB\u4FCA', 95, vector({
  legal: 60,
  sajuFit: 55,
  yongshinFit: 55,
  elementBalance: 55,
  hanjaMeaning: 60,
  phonetic: 60,
  eraFit: 55,
  familyFit: 60,
  risk: 45,
}));
const sajuFrontier = summary('\uC11C\uC724', '\u745E\u6F64', 94, vector({
  legal: 82,
  sajuFit: 94,
  yongshinFit: 90,
  elementBalance: 91,
  hanjaMeaning: 80,
  phonetic: 82,
  eraFit: 72,
  familyFit: 84,
  risk: 18,
}));
const phoneticFrontier = summary('\uD558\uB9B0', '\u590F\u7433', 93, vector({
  legal: 78,
  sajuFit: 48,
  yongshinFit: 42,
  elementBalance: 58,
  hanjaMeaning: 80,
  phonetic: 98,
  eraFit: 54,
  familyFit: 96,
  risk: 8,
}));
const repeatedSyllableNeighbor = summary('\uBBFC\uC7AC', '\u73C9\u5BB0', 92.5, vector({
  legal: 68,
  sajuFit: 58,
  yongshinFit: 57,
  elementBalance: 58,
  hanjaMeaning: 68,
  phonetic: 62,
  eraFit: 58,
  familyFit: 60,
  risk: 38,
}));
const eraFrontier = summary('\uB3C4\uC724', '\u5EA6\u6F64', 92, vector({
  legal: 80,
  sajuFit: 50,
  yongshinFit: 48,
  elementBalance: 58,
  hanjaMeaning: 76,
  phonetic: 62,
  eraFit: 98,
  familyFit: 64,
  risk: 9,
}));
const fixture = [dominatedHighScore, sajuFrontier, phoneticFrontier, repeatedSyllableNeighbor, eraFrontier];

const defaultOrder = engine.orderCandidateSummaries(fixture, {});
check('default ordering remains final-score descending',
  defaultOrder.map((row: SpringCandidateSummary) => row.givenHangul).join(',') ===
    ['\uBBFC\uC900', '\uC11C\uC724', '\uD558\uB9B0', '\uBBFC\uC7AC', '\uB3C4\uC724'].join(','));

const paretoOrder = engine.orderCandidateSummaries(fixture, {
  precisionConfig: { paretoFrontierCandidates: true },
});
const topProfiles = paretoOrder.slice(0, 3).map((row: SpringCandidateSummary) => row.strengthProfile?.id);
check('Pareto selector can promote a frontier candidate over a dominated higher score',
  paretoOrder[0]?.givenHangul === '\uC11C\uC724' &&
    paretoOrder[0]?.strengthProfile?.paretoFrontier === true,
  paretoOrder.map((row: SpringCandidateSummary) => row.givenHangul).join(','));
check('top candidates carry distinct strength profiles',
  new Set(topProfiles).size === topProfiles.length,
  topProfiles.join(','));
check('diversity penalty avoids clustering repeated syllables in close scores',
  paretoOrder.findIndex((row: SpringCandidateSummary) => row.givenHangul === '\uB3C4\uC724') <
    paretoOrder.findIndex((row: SpringCandidateSummary) => row.givenHangul === '\uBBFC\uC7AC'),
  paretoOrder.map((row: SpringCandidateSummary) => row.givenHangul).join(','));
check('Pareto mode preserves raw final scores',
  paretoOrder.every((row: SpringCandidateSummary) =>
    fixture.some((source) => source.givenHangul === row.givenHangul && source.finalScore === row.finalScore)));

console.log(`\nPareto candidates: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
