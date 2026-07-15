import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateD1,
  evaluateD2,
  evaluateD3,
  evaluateD4,
  evaluateD5,
  extractStrengthBands,
  resolveNarrativeEntry,
  strengthLevelMatches,
} from './quality_gate.mjs';

function authority(expected, extra = {}) {
  return {
    sourceTier: {
      tier: 'T4_PRIMARY_TEXT',
      authorityTruthEligible: true,
    },
    expected,
    ...extra,
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
    output: {
      sajuReport: { sajuEnabled: true, gyeokgukType: '편관격', yongshinElement: 'FIRE' },
      fortuneReport: { personalityTraitCount: 3 },
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

test('D5 marks non-edge fixtures NOT_APPLICABLE and evaluates boundary fixtures', () => {
  const stableOutput = {
    output: {
      sajuReport: { sajuEnabled: true, gyeokgukType: '정관격', strengthLevel: '신약' },
      namingReport: { totalScore: 72.5 },
    },
  };
  const nonEdge = evaluateD5({ axis: ['normal', 'yang-earth'] }, stableOutput, null, null);
  assert.equal(nonEdge.status, 'NOT_APPLICABLE');

  for (const axis of ['jie-ipchun', 'yaza-window', 'lunar-input']) {
    const result = evaluateD5({ axis: [axis] }, stableOutput, null, null);
    assert.equal(result.status, 'PASS', `axis ${axis} should be evaluated as edge`);
  }

  const broken = evaluateD5(
    { axis: ['jie-ipchun'] },
    { output: { sajuReport: { sajuEnabled: true }, namingReport: {} } },
    null, null,
  );
  assert.equal(broken.status, 'FAIL');
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
