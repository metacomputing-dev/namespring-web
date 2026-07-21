import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as qualityGateFacade from './quality_gate.mjs';
import {
  evaluateD1 as evaluateD1WithPolicy,
  evaluateD2 as evaluateD2WithPolicy,
  evaluateD3 as evaluateD3WithPolicy,
  evaluateD4 as evaluateD4WithPolicy,
  evaluateD5 as evaluateD5WithPolicy,
  extractStrengthBands,
  resolveNarrativeEntry,
  strengthLevelMatches,
} from './quality_gate.mjs';
import { classifyD1TruthCoverage } from './quality-gate/d1.mjs';
import { AUTHORITY_SCOPES } from './source_tier_policy.mjs';

const TEST_AUTHORITY_OPTIONS = {
  authorityEligibility(record, requiredScope) {
    return Array.isArray(record?._testAuthorityScopes) &&
      record._testAuthorityScopes.includes(requiredScope);
  },
};

const evaluateD1 = (...args) => evaluateD1WithPolicy(...args, TEST_AUTHORITY_OPTIONS);
const evaluateD2 = (...args) => evaluateD2WithPolicy(...args, TEST_AUTHORITY_OPTIONS);
const evaluateD3 = (...args) => evaluateD3WithPolicy(...args, TEST_AUTHORITY_OPTIONS);
const evaluateD4 = (...args) => evaluateD4WithPolicy(...args, TEST_AUTHORITY_OPTIONS);
const evaluateD5 = (...args) => evaluateD5WithPolicy(...args, TEST_AUTHORITY_OPTIONS);

const QUALITY_GATE_MODULE_DEPENDENCIES = Object.freeze({
  'authority-context.mjs': [],
  'shared.mjs': [],
  'source-tier-audit.mjs': [],
  'd1.mjs': ['authority-context.mjs', 'shared.mjs'],
  'd2.mjs': ['authority-context.mjs', 'shared.mjs'],
  'd3.mjs': ['authority-context.mjs', 'shared.mjs'],
  'd4.mjs': ['authority-context.mjs', 'shared.mjs'],
  'd5.mjs': ['d1.mjs'],
});

function qualityGateModuleSource(fileName) {
  return fs.readFileSync(new URL(`./quality-gate/${fileName}`, import.meta.url), 'utf8');
}

function authority(expected, extra = {}, scopes = Object.values(AUTHORITY_SCOPES)) {
  const quote = 'Short public-domain classical quotation.';
  return {
    case_id: 'quality-gate-authority-case',
    source: {
      text: 'Public classical source',
      author: 'Historical author',
      compilation: 'Reviewed page-image compilation',
      page_in_compilation: 1,
    },
    prose_quote: {
      verbatim: quote,
      extracted_from: 'Reviewed page image',
      page_image: 'evidence/page-1.png',
    },
    sourceTier: {
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      sourceUrl: 'https://zh.wikisource.org/wiki/Test_authority',
      accessedAt: '2026-07-10',
      quoteShort: quote,
      humanInterpretation: 'Primary-text authority fixture.',
      copyrightNote: 'Short paraphrase only.',
      authorityTruthEligible: true,
    },
    expected,
    ...extra,
    _testAuthorityScopes: scopes,
  };
}

/** Minimal narrative-golden entry mirroring the shape captured by
 *  tools/narrative_baseline.ts (실측 default-mode wording).
 *  `overviewOverrides` shallow-merges into overviewSummary; `cardOverrides`
 *  shallow-merges into the cards object. */
function narrativeEntry(overviewOverrides = {}, cardOverrides = {}) {
  const overviewSummary = {
    title: '총평 요약',
    pillars: [
      { position: '년주', stem: '을', branch: '해', element: '나무/물' },
      { position: '시주', stem: '무', branch: '오', element: '흙/불' },
    ],
    dayMasterDescription: '일간은 무예요.',
    strengthDescription: '에너지 균형은 중화(신강 경향)예요.',
    yongshinDescription: '사주의 균형을 맞춰주는 용신 후보는 불(화) 기운이에요.',
    elementBalance: '오행 중 흙 기운이 가장 강해요.',
    overallSummary: '전체 에너지는 중화(신강 경향) 수준이고, 불 기운은 중요한 보완 후보로 참고하면 좋아요.',
    evidence: [
      {
        axis: 'gyeokguk',
        claim: '월령에 칠살(편관)이 자리하여 일간을 강하게 압박한다.',
        supportingFeatures: ['격국: 편관격'],
        weakness: null,
      },
    ],
    expertText: null,
    plainText: null,
    counselorText: null,
    counterexamples: [],
    ...overviewOverrides,
  };
  const cards = {
    overviewSummary,
    cautions: [],
    personality: { summary: '', traits: [] },
    strengthsWeaknesses: { strengths: [], weaknesses: [] },
    categoryFortunes: {},
    ...cardOverrides,
  };
  return { entry: { id: 'fix-test', cards }, reason: null };
}

test('quality-gate facade and internal dependency graph stay bounded', () => {
  assert.deepEqual(Object.keys(qualityGateFacade).sort(), [
    'evaluateD1',
    'evaluateD2',
    'evaluateD3',
    'evaluateD4',
    'evaluateD5',
    'extractStrengthBands',
    'resolveNarrativeEntry',
    'runCli',
    'runGate',
    'strengthLevelMatches',
  ]);
  assert.equal('classifyD1TruthCoverage' in qualityGateFacade, false);

  const internalNames = new Set(Object.keys(QUALITY_GATE_MODULE_DEPENDENCIES));
  for (const [fileName, expectedDependencies] of Object.entries(QUALITY_GATE_MODULE_DEPENDENCIES)) {
    const source = qualityGateModuleSource(fileName);
    const dependencies = [...source.matchAll(/\bfrom\s+['"]\.\/([^'"]+)['"]/gu)]
      .map((match) => match[1])
      .filter((dependency) => internalNames.has(dependency))
      .sort();
    assert.deepEqual(
      dependencies,
      [...expectedDependencies].sort(),
      `${fileName} has an unexpected internal dependency`,
    );
    assert.equal(
      source.includes('quality_gate.mjs'),
      false,
      `${fileName} must not import the facade`,
    );
    assert.ok(
      source.trimEnd().split(/\r?\n/u).length < 600,
      `${fileName} must stay below 600 lines`,
    );
  }

  const facadeSource = fs.readFileSync(new URL('./quality_gate.mjs', import.meta.url), 'utf8');
  assert.ok(facadeSource.trimEnd().split(/\r?\n/u).length < 600);
  assert.match(facadeSource, /if \(isMain\) process\.exit\(runCli\(\)\);/u);
});

test('plain middle strength does not pass weak or strong authority labels', () => {
  assert.equal(strengthLevelMatches('\uC911\uD654', '\uC2E0\uC57D'), false);
  assert.equal(strengthLevelMatches('\uC911\uD654', '\uC2E0\uAC15'), false);
  assert.equal(strengthLevelMatches('\uC911\uD654', '\uC911\uD654'), true);
});

test('D1 fails when authority expects numerical output that is missing', () => {
  const result = evaluateD1(
    { allowedDiff: [] },
    { output: { sajuReport: {}, namingReport: {} } },
    authority({ scores: { hangul: 20 }, totalScore: 70 }),
    null,
  );
  assert.equal(result.status, 'FAIL');
  assert.ok(result.checks.some((check) =>
    check.field === 'namingReport.totalScore' &&
    check.reason?.includes('missing')));
  assert.ok(result.checks.some((check) =>
    check.field === 'namingReport.scores.hangul' &&
    check.reason?.includes('missing')));
});

test('D1 never reports complete accuracy from doctrine-only truth', () => {
  const result = evaluateD1(
    { allowedDiff: [] },
    {
      output: {
        sajuReport: {
          gyeokgukType: '\uC815\uAD00\uACA9',
          yongshinElement: 'FIRE',
          strengthLevel: 'WEAK',
        },
        namingReport: { totalScore: 70 },
      },
    },
    authority(
      {
        gyeokguk: '\uC815\uAD00\uACA9',
        yongshinElement: 'FIRE',
        strengthLevel: 'WEAK',
      },
      {},
      [AUTHORITY_SCOPES.SAJU_DOCTRINE],
    ),
    null,
  );
  assert.equal(result.status, 'N/A');
  assert.equal(result.componentStatus.sajuDoctrine, 'PASS');
  assert.equal(result.componentStatus.namingScoreCalibration, 'N/A');
  assert.deepEqual(result.missingComponents, ['naming_score_calibration']);
});

test('D1 measures totalScore but keeps a partial naming contract incomplete', () => {
  const result = evaluateD1(
    { allowedDiff: [] },
    { output: { sajuReport: { strengthLevel: 'WEAK' }, namingReport: { totalScore: 70 } } },
    authority({ strengthLevel: 'WEAK', totalScore: 70 }),
    null,
  );
  assert.equal(result.status, 'N/A');
  assert.equal(result.componentStatus.namingScoreCalibration, 'N/A');
  assert.ok(result.checks.some((check) => check.field === 'namingReport.totalScore'));
  assert.ok(result.missingRequiredFields.includes('namingReport.scores.hangul'));
  assert.ok(result.missingRequiredFields.includes('namingReport.scores.hanja'));
  assert.ok(result.missingRequiredFields.includes('namingReport.scores.fourFrame'));
});

test('D1 passes only when every doctrine and naming-score field is measured', () => {
  const result = evaluateD1(
    { allowedDiff: [] },
    {
      output: {
        sajuReport: {
          gyeokgukType: '\uC815\uAD00\uACA9',
          yongshinElement: 'FIRE',
          strengthLevel: 'WEAK',
        },
        namingReport: {
          totalScore: 70,
          scores: { hangul: 20, hanja: 21, fourFrame: 29 },
        },
      },
    },
    authority({
      gyeokguk: '\uC815\uAD00\uACA9',
      yongshinElement: 'FIRE',
      strengthLevel: 'WEAK',
      totalScore: 70,
      scores: { hangul: 20, hanja: 21, fourFrame: 29 },
    }),
    null,
  );
  assert.equal(result.status, 'PASS');
  assert.equal(result.componentStatus.sajuDoctrine, 'PASS');
  assert.equal(result.componentStatus.namingScoreCalibration, 'PASS');
  assert.deepEqual(result.missingRequiredFields, []);
});

test('D1 truth coverage combines only scope-eligible authority and oracle fields', () => {
  const authorityCase = authority(
    {
      gyeokguk: '\uC815\uAD00\uACA9',
      yongshinElement: 'FIRE',
      strengthLevel: 'WEAK',
    },
    {},
    [AUTHORITY_SCOPES.SAJU_DOCTRINE],
  );
  const oracleCase = authority(
    {
      totalScore: 70,
      scores: { hangul: 20, hanja: 21, fourFrame: 29 },
    },
    {},
    [AUTHORITY_SCOPES.NAMING_SCORE_CALIBRATION],
  );

  const coverage = classifyD1TruthCoverage(
    authorityCase,
    oracleCase,
    TEST_AUTHORITY_OPTIONS,
  );

  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.missingRequiredFields, []);
  assert.deepEqual(
    coverage.doctrineFields.map(({ field, source }) => [field, source]),
    [
      ['sajuReport.gyeokgukType', 'authority'],
      ['sajuReport.yongshinElement', 'authority'],
      ['sajuReport.strengthLevel', 'authority'],
    ],
  );
  assert.deepEqual(
    coverage.namingFields.map(({ field, source }) => [field, source]),
    [
      ['namingReport.totalScore', 'oracle'],
      ['namingReport.scores.hangul', 'oracle'],
      ['namingReport.scores.hanja', 'oracle'],
      ['namingReport.scores.fourFrame', 'oracle'],
    ],
  );
});

test('D1 truth coverage preserves authority precedence and reports missing fields', () => {
  const authorityCase = authority({
    gyeokguk: '\uC815\uAD00\uACA9',
    yongshinElement: null,
    totalScore: 70,
    scores: { hangul: 20 },
  });
  const oracleCase = authority({
    gyeokgukType: '\uD3B8\uAD00\uACA9',
    yongshinElement: 'FIRE',
    strengthLevel: 'WEAK',
    totalScore: 71,
    scores: { hangul: 22, hanja: 23, fourFrame: 26 },
  });

  const coverage = classifyD1TruthCoverage(
    authorityCase,
    oracleCase,
    TEST_AUTHORITY_OPTIONS,
  );

  assert.equal(coverage.complete, false);
  assert.deepEqual(coverage.missingRequiredFields, [
    'sajuReport.yongshinElement',
    'namingReport.scores.hanja',
    'namingReport.scores.fourFrame',
  ]);
  assert.deepEqual(
    coverage.doctrineFields.map(({ field, expected, source }) => [field, expected, source]),
    [
      ['sajuReport.gyeokgukType', '\uC815\uAD00\uACA9', 'authority'],
      ['sajuReport.strengthLevel', 'WEAK', 'oracle'],
    ],
  );
  assert.deepEqual(
    coverage.namingFields.map(({ field, expected, source }) => [field, expected, source]),
    [
      ['namingReport.totalScore', 70, 'authority'],
      ['namingReport.scores.hangul', 20, 'authority'],
    ],
  );
});

test('D1 rejects a concealed panel record even when owner review is present', () => {
  const concealedPanel = {
    sourceTier: {
      tier: 'T3_AUTHORED_INTERPRETATION',
      sourceType: 'ai_panel_adjudicated_interpretation',
      sourceUrl: null,
      accessedAt: '2026-07-10',
      quoteShort: null,
      humanInterpretation: 'Panel-authored judgement.',
      copyrightNote: 'No quoted source text.',
      authorityTruthEligible: true,
      authorityReview: {
        status: 'approved',
        reviewedBy: 'owner@example.test',
        reviewedAt: '2026-07-10',
      },
    },
    expected: { totalScore: 70 },
  };
  const result = evaluateD1WithPolicy(
    { allowedDiff: [] },
    { output: { namingReport: { totalScore: 70 } } },
    concealedPanel,
    null,
  );
  assert.equal(result.status, 'N/A');
});

// ── strength-band extraction (D2 helper) ──────────────────────────────────

test('hedged strength labels mask their substrings during band extraction', () => {
  // "중화(신약 경향)" must resolve to the weak band only — the inner "중화"
  // and "신약" substrings must not register additional bands.
  const bands = extractStrengthBands('에너지 균형은 중화(신약 경향)예요.');
  assert.deepEqual([...bands], ['weak']);
  const plain = extractStrengthBands('에너지 균형은 중화예요.');
  assert.deepEqual([...plain], ['middle']);
  const contradictory = extractStrengthBands('신강이지만 사실 신약이에요.');
  assert.deepEqual([...contradictory].sort(), ['strong', 'weak']);
});

// ── D2 narrative agreement ────────────────────────────────────────────────

test('D2 is N/A without an eligible authority case or without the narrative golden', () => {
  const noAuthority = evaluateD2({}, {}, null, narrativeEntry());
  assert.equal(noAuthority.status, 'N/A');
  assert.match(noAuthority.reason, /authority-truth-eligible/);

  const t2Authority = {
    sourceTier: { tier: 'T2_REFERENCE_IMPL', authorityTruthEligible: false },
    expected: { strengthLevel: '신약' },
  };
  assert.equal(evaluateD2({}, {}, t2Authority, narrativeEntry()).status, 'N/A');

  const noNarrative = evaluateD2(
    {}, {},
    authority({ strengthLevel: '신약' }),
    { entry: null, reason: 'narrative golden unavailable — run `npm run narrative:capture`' },
  );
  assert.equal(noNarrative.status, 'N/A');
  assert.match(noNarrative.reason, /narrative golden unavailable/);
});

test('D2 passes when narrative agrees on strength band, yongshin element, and gyeokguk', () => {
  const result = evaluateD2(
    {}, {},
    authority({ strengthLevel: '신강', yongshinElement: 'FIRE', gyeokguk: '편관격' }),
    narrativeEntry(),
  );
  // '중화(신강 경향)' shares the strong band with expected '신강' (D1 rule).
  assert.equal(result.status, 'PASS');
  assert.equal(result.totalChecks, 3);
});

test('D2 fails on an opposite-band strength assertion and a missing yongshin token', () => {
  const result = evaluateD2(
    {}, {},
    authority({ strengthLevel: '신약', yongshinElement: 'WATER' }),
    narrativeEntry(),
  );
  assert.equal(result.status, 'FAIL');
  const strengthCheck = result.checks.find((c) => c.field === 'narrative.strength');
  assert.equal(strengthCheck.pass, false);
  const yongshinCheck = result.checks.find((c) => c.field === 'narrative.yongshin');
  assert.equal(yongshinCheck.pass, false);
});

test('D2 honours gyeokguk equivalence classes in the narrative corpus', () => {
  const entry = narrativeEntry({
    evidence: [{
      axis: 'gyeokguk',
      claim: '월지가 일간의 건록이라 격을 이룬다.',
      supportingFeatures: ['격국: 건록격'],
      weakness: null,
    }],
  });
  const result = evaluateD2({}, {}, authority({ gyeokguk: '비견격' }), entry);
  assert.equal(result.status, 'PASS');
});

test('D2 evaluates authority narrativeClaims fail-closed', () => {
  const pass = evaluateD2(
    {}, {},
    authority({}, {
      narrativeClaims: [
        { type: 'mustIncludeAny', patterns: ['용신 후보'] },
        { type: 'mustNotMatch', pattern: '반드시' },
      ],
    }),
    narrativeEntry(),
  );
  assert.equal(pass.status, 'PASS');

  const malformed = evaluateD2(
    {}, {},
    authority({}, { narrativeClaims: [{ type: 'unknownKind' }] }),
    narrativeEntry(),
  );
  assert.equal(malformed.status, 'FAIL');

  const badRegex = evaluateD2(
    {}, {},
    authority({}, { narrativeClaims: [{ type: 'mustNotMatch', pattern: '(' }] }),
    narrativeEntry(),
  );
  assert.equal(badRegex.status, 'FAIL');
});

// ── D3 truth-source precedence ────────────────────────────────────────────

test('D3 prefers eligible authority card truth and falls back to eligible oracle', () => {
  const snapshotResult = {
    qualityEvidence: { surfacedCardTypes: ['gyeokguk', 'yongshin', 'sipsin'] },
    output: {
      sajuReport: { sajuEnabled: true, gyeokgukType: '편관격', yongshinElement: 'FIRE' },
      fortuneReport: {},
    },
  };
  const authorityWithCards = authority({}, { cards: { surfacedCardTypes: ['gyeokguk', 'yongshin'] } });
  const oracleWithCards = authority({}, { cards: { surfacedCardTypes: ['gyeokguk', 'yongshin', 'sipsin'] } });

  const fromAuthority = evaluateD3({}, snapshotResult, authorityWithCards, oracleWithCards);
  assert.equal(fromAuthority.cardTruthSource, 'authority');
  assert.deepEqual(fromAuthority.expected, ['gyeokguk', 'yongshin']);
  assert.equal(fromAuthority.status, 'PASS');

  const fromOracle = evaluateD3({}, snapshotResult, null, oracleWithCards);
  assert.equal(fromOracle.cardTruthSource, 'oracle');
  assert.equal(fromOracle.status, 'PASS');

  const ineligibleOracle = {
    sourceTier: { tier: 'T2_REFERENCE_IMPL', authorityTruthEligible: false },
    cards: { surfacedCardTypes: ['gyeokguk'] },
  };
  assert.equal(evaluateD3({}, snapshotResult, null, ineligibleOracle).status, 'N/A');
});

test('D1 rejects numeric-looking strings instead of coercing authority scores', () => {
  const result = evaluateD1(
    { allowedDiff: [] },
    {
      output: {
        sajuReport: {},
        namingReport: { totalScore: '70', scores: { hangul: '20' } },
      },
    },
    authority({ scores: { hangul: 20 }, totalScore: 70 }),
    null,
  );
  assert.equal(result.status, 'FAIL');
  assert.ok(result.checks.filter((check) =>
    check.field === 'namingReport.totalScore' || check.field === 'namingReport.scores.hangul')
    .every((check) => check.pass === false && check.diff === null));
});

test('D3 requires explicit surfaced-card evidence and allowedDiff cannot waive authority mismatch', () => {
  const expected = authority({}, {
    cards: { surfacedCardTypes: ['gyeokguk', 'yongshin', 'sipsin', 'shinsal', 'johu'] },
  });
  const inferredOnly = {
    output: {
      sajuReport: { sajuEnabled: true, gyeokgukType: '편관격', yongshinElement: 'FIRE' },
      fortuneReport: { personalityTraitCount: 3 },
    },
  };
  const result = evaluateD3({
    allowedDiff: ['cards.surfacedCardTypes.shinsal', 'cards.surfacedCardTypes'],
  }, inferredOnly, expected, null);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.surfaced, []);
  assert.ok(result.missing.includes('shinsal'));
  assert.deepEqual(result.declaredMissing, ['shinsal']);
});

test('D1 records an exact declared diff but never turns it into authority PASS', () => {
  const result = evaluateD1(
    { allowedDiff: ['sajuReport.yongshinElement'] },
    {
      output: {
        sajuReport: {
          gyeokgukType: '정관격',
          yongshinElement: 'WATER',
          strengthLevel: 'WEAK',
        },
        namingReport: {
          totalScore: 70,
          scores: { hangul: 20, hanja: 21, fourFrame: 29 },
        },
      },
    },
    authority({
      gyeokguk: '정관격',
      yongshinElement: 'FIRE',
      strengthLevel: 'WEAK',
      totalScore: 70,
      scores: { hangul: 20, hanja: 21, fourFrame: 29 },
    }),
    null,
  );
  assert.equal(result.status, 'FAIL');
  assert.equal(result.checks.find((check) =>
    check.field === 'sajuReport.yongshinElement')?.declaredDiff, true);
});

// ── D4 hedge labeling ─────────────────────────────────────────────────────

test('D4 is N/A without eligible authority or narrative golden', () => {
  assert.equal(evaluateD4({}, {}, null, narrativeEntry()).status, 'N/A');
  const noNarrative = evaluateD4({}, {}, authority({}), { entry: null, reason: 'stale' });
  assert.equal(noNarrative.status, 'N/A');
  assert.equal(noNarrative.reason, 'stale');
});

test('D4 global assertion ban passes on hedged copy and fails on absolute claims', () => {
  const clean = evaluateD4({}, {}, authority({}), narrativeEntry());
  assert.equal(clean.status, 'PASS');

  const absolute = evaluateD4({}, {}, authority({}), narrativeEntry({
    overallSummary: '이 기운을 따르면 반드시 성공한다.',
  }));
  assert.equal(absolute.status, 'FAIL');
  assert.ok(absolute.checks.some((c) => c.field === 'narrative.noAbsoluteAssertions' && !c.pass));

  // Grounded confidence metrics ("신뢰도 100%") are 실측 output of the
  // gyeokguk-candidate evidence row (fix-05) and must not trip the ban;
  // a bare "100%" certainty claim must.
  const confidenceMetric = evaluateD4({}, {}, authority({}), narrativeEntry({
    evidence: [{
      axis: 'gyeokgukCandidates',
      claim: '격국 후보 간 이견이 있어요.',
      supportingFeatures: ['비견격 후보(점수 1.600, 신뢰도 100%): 월지 지장간: 계'],
      weakness: null,
    }],
  }));
  assert.equal(confidenceMetric.status, 'PASS');

  const bareCertainty = evaluateD4({}, {}, authority({}), narrativeEntry({
    overallSummary: '올해는 100% 좋아지는 해예요.',
  }));
  assert.equal(bareCertainty.status, 'FAIL');
});

test('D4 requireHedgedStrength demands the 실측 hedge marker (경향)', () => {
  const hedged = evaluateD4(
    {}, {},
    authority({}, { hedgePolicy: { requireHedgedStrength: true } }),
    narrativeEntry(),
  );
  assert.equal(hedged.status, 'PASS');

  const unhedged = evaluateD4(
    {}, {},
    authority({}, { hedgePolicy: { requireHedgedStrength: true } }),
    narrativeEntry({ strengthDescription: '에너지 균형은 신강이에요.' }),
  );
  assert.equal(unhedged.status, 'FAIL');
});

test('D4 requireHourUncertaintyNote accepts 시주(임시) pillar or inputTime claim', () => {
  const viaPillar = evaluateD4(
    {}, {},
    authority({}, { hedgePolicy: { requireHourUncertaintyNote: true } }),
    narrativeEntry({
      pillars: [{ position: '시주(임시)', stem: '무', branch: '오', element: '흙/불' }],
    }),
  );
  assert.equal(viaPillar.status, 'PASS');

  const viaClaim = evaluateD4(
    {}, {},
    authority({}, { hedgePolicy: { requireHourUncertaintyNote: true } }),
    narrativeEntry({
      evidence: [{
        axis: 'inputTime',
        claim: '출생 시각 정보가 없어 계산에는 낮 12시를 임시 기준으로 사용했어요.',
        supportingFeatures: [],
        weakness: null,
      }],
    }),
  );
  assert.equal(viaClaim.status, 'PASS');

  const missingNote = evaluateD4(
    {}, {},
    authority({}, { hedgePolicy: { requireHourUncertaintyNote: true } }),
    narrativeEntry(),
  );
  assert.equal(missingNote.status, 'FAIL');
});

// ── D5 scope semantics ────────────────────────────────────────────────────

test('D5 separates edge stability from truth-backed calculation accuracy', () => {
  const stableOutput = {
    output: {
      sajuReport: { sajuEnabled: true, gyeokgukType: '정관격', strengthLevel: '신약' },
      namingReport: { totalScore: 72.5, scores: { hangul: 20 } },
    },
  };
  stableOutput.output.sajuReport.yongshinElement = 'FIRE';
  stableOutput.output.namingReport.scores.hanja = 21;
  stableOutput.output.namingReport.scores.fourFrame = 31;
  const nonEdge = evaluateD5({ axis: ['normal', 'yang-earth'] }, stableOutput, null, null);
  assert.equal(nonEdge.status, 'NOT_APPLICABLE');

  for (const axis of ['jie-ipchun', 'yaza-window', 'lunar-input']) {
    const result = evaluateD5({ axis: [axis] }, stableOutput, null, null);
    assert.equal(result.status, 'N/A', `axis ${axis} has no eligible truth`);
    assert.equal(result.stabilityStatus, 'PASS');
    assert.equal(result.accuracyStatus, 'N/A');
  }

  const broken = evaluateD5(
    { axis: ['jie-ipchun'] },
    { output: { sajuReport: { sajuEnabled: true }, namingReport: {} } },
    null, null,
  );
  assert.equal(broken.status, 'FAIL');
  assert.equal(broken.stabilityStatus, 'FAIL');

  const matched = evaluateD5(
    { axis: ['jie-ipchun'], allowedDiff: [] },
    stableOutput,
    authority({
      gyeokguk: stableOutput.output.sajuReport.gyeokgukType,
      yongshinElement: stableOutput.output.sajuReport.yongshinElement,
      strengthLevel: stableOutput.output.sajuReport.strengthLevel,
      totalScore: 72.5,
      scores: { hangul: 20, hanja: 21, fourFrame: 31 },
    }),
    null,
  );
  assert.equal(matched.status, 'PASS');
  assert.equal(matched.stabilityStatus, 'PASS');
  assert.equal(matched.accuracyStatus, 'PASS');
  assert.equal(matched.referenceRate, 1);

  const mismatched = evaluateD5(
    { axis: ['jie-ipchun'], allowedDiff: [] },
    stableOutput,
    authority({
      gyeokguk: stableOutput.output.sajuReport.gyeokgukType,
      yongshinElement: stableOutput.output.sajuReport.yongshinElement,
      strengthLevel: stableOutput.output.sajuReport.strengthLevel,
      totalScore: 10,
      scores: { hangul: 20, hanja: 21, fourFrame: 31 },
    }),
    null,
  );
  assert.equal(mismatched.status, 'FAIL');
  assert.equal(mismatched.accuracyStatus, 'FAIL');
});

// ── narrative golden staleness guard ──────────────────────────────────────

test('resolveNarrativeEntry fails closed on missing, stale, or incomplete goldens', () => {
  const golden = {
    targetDate: '2026-04-30T00:00:00.000Z',
    results: [{ id: 'fix-01', cards: { overviewSummary: {} } }],
  };
  assert.match(
    resolveNarrativeEntry(null, 'fix-01', '2026-04-30T00:00:00.000Z').reason,
    /unavailable/,
  );
  assert.match(
    resolveNarrativeEntry(golden, 'fix-01', '2027-01-01T00:00:00.000Z').reason,
    /stale/,
  );
  assert.match(
    resolveNarrativeEntry(golden, 'fix-99', '2026-04-30T00:00:00.000Z').reason,
    /no entry/,
  );
  const ok = resolveNarrativeEntry(golden, 'fix-01', '2026-04-30T00:00:00.000Z');
  assert.equal(ok.reason, null);
  assert.equal(ok.entry.id, 'fix-01');
});
