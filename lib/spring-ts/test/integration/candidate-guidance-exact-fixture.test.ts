import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: unknown) => {
  const urlText = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlText.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlText.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlText.includes('sql-wasm.wasm') || urlText === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  throw new Error(`unexpected network access in exact fixture: ${urlText}`);
};

const engine = new SpringEngine();
try {
  for (const repository of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
    if (repository) repository.wasmUrl = WASM_PATH;
  }
  await engine.init();

  let observedSajuReport: any;
  const getNameCandidateSummariesInternal =
    (engine as any).getNameCandidateSummariesInternal.bind(engine);
  (engine as any).getNameCandidateSummariesInternal = async (
    request: unknown,
    requireSajuGuidedRecommendation: boolean,
    onSajuReport?: (report: unknown) => void,
  ) => getNameCandidateSummariesInternal(
    request,
    requireSajuGuidedRecommendation,
    (report: unknown) => {
      observedSajuReport = report;
      onSajuReport?.(report);
    },
  );

  const startedAt = performance.now();
  const result = await engine.getCandidateSearch({
    birth: {
      year: 1986,
      month: 4,
      day: 19,
      hour: 5,
      minute: 45,
      gender: 'male',
      region: '서울',
      latitude: 37.5665,
      longitude: 126.978,
      timezone: 'Asia/Seoul',
    },
    surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
    givenNameLength: 2,
    mode: 'recommend',
    options: {
      limit: 100,
      pureHangulNameMode: 'off',
      precisionConfig: {
        surfaceNamingScoreVector: true,
        surfaceNameTrend: true,
        surfacePhoneticEvidence: true,
      },
      sajuTimePolicy: {
        trueSolarTime: 'on',
        longitudeCorrection: 'on',
        longitudeReference: 'civilOffsetMeridian',
        yaza: 'on',
        yazaMode: '23:00',
      },
    },
  });
  const elapsedMilliseconds = performance.now() - startedAt;

  assert.deepEqual({
    year: observedSajuReport?.timeCorrection?.adjustedYear,
    month: observedSajuReport?.timeCorrection?.adjustedMonth,
    day: observedSajuReport?.timeCorrection?.adjustedDay,
    hour: observedSajuReport?.timeCorrection?.adjustedHour,
    minute: observedSajuReport?.timeCorrection?.adjustedMinute,
  }, {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 13,
  });
  assert.ok(Math.abs(
    observedSajuReport.timeCorrection.longitudeCorrectionMinutes - (-32.088),
  ) < 1e-9);
  assert.ok(Math.abs(
    observedSajuReport.timeCorrection.equationOfTimeMinutes - 0.686756,
  ) < 1e-6);
  assert.deepEqual(observedSajuReport.timeCorrection.provenance, {
    location: {
      inputLabel: '서울',
      resolvedRegionCode: 'SEOUL',
      latitude: 37.5665,
      longitude: 126.978,
      timezone: 'Asia/Seoul',
      source: 'explicit',
      coordinatesApplied: true,
    },
    referenceMeridianDegrees: 135,
    referenceMeridianBasis: {
      kind: 'civil_offset_at_birth',
      utcOffsetMinutes: 540,
    },
    policy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
      longitudeReference: 'civilOffsetMeridian',
      explicitLocationRequired: true,
      yaza: 'on',
      yazaMode: '23:00',
    },
    input: {
      calendarType: 'solar',
      providedLocalDateTime: {
        year: 1986,
        month: 4,
        day: 19,
        hour: 5,
        minute: 45,
      },
      effectiveSolarDate: {
        year: 1986,
        month: 4,
        day: 19,
      },
      timePrecision: 'exact',
    },
    inputUncertainty: null,
    lunarConversion: null,
  });

  // These are regression-characterization oracles for the current approved
  // calculation contract, not a claim that one school or numeric confidence is
  // an externally certified universal answer.
  assert.deepEqual(
    ['year', 'month', 'day', 'hour'].map((position) => {
      const pillar = observedSajuReport.pillars[position];
      return `${pillar.stem.hanja}${pillar.branch.hanja}`;
    }),
    ['丙寅', '壬辰', '癸巳', '乙卯'],
  );
  assert.deepEqual(observedSajuReport.dayMaster, {
    stem: '계',
    element: 'WATER',
    polarity: '음',
  });
  assert.equal(observedSajuReport.strength.level, '신약');
  assert.equal(observedSajuReport.strength.levelCode, 'WEAK');
  assert.equal(observedSajuReport.gyeokguk.type, '식신격');
  assert.ok(Math.abs(
    observedSajuReport.gyeokguk.confidence - 0.538903743315508,
  ) < 1e-12);
  assert.equal(observedSajuReport.yongshin.element, 'METAL');
  assert.equal(observedSajuReport.yongshinConsensus.final.conflictLevel, 'high');
  assert.equal(result.evaluation.natalSajuSemantics, 'birth_chart_invariant');
  assert.equal(result.evaluation.candidateSemantics, 'name_conditioned_interaction');
  assert.equal(result.evaluation.natalEvidence.status, 'limited');
  assert.ok(result.evaluation.natalEvidence.reasonCodes.includes(
    'YONGSHIN_CONSENSUS_CONFLICT',
  ));
  assert.equal(result.items.length, 100);
  assert.ok(result.items.every((item) =>
    item.name.givenCharacters.length === 2
    && item.name.givenCharacters.every((character) =>
      typeof character.hanja === 'string' && character.hanja.length > 0)));
  assert.ok(result.items.every((item) => item.score.vector !== undefined));
  const surfacedTendencies = new Set(result.items.map((item) => item.popularity.tendency));
  assert.ok(
    surfacedTendencies.has('male') && surfacedTendencies.has('female'),
    'birth gender must not hard-filter cross-gender usage tendencies from candidate recall',
  );

  const variantsByHangul = new Map<string, Set<string>>();
  for (const item of result.items) {
    const variants = variantsByHangul.get(item.name.fullHangul) ?? new Set<string>();
    variants.add(item.name.fullHanja);
    variantsByHangul.set(item.name.fullHangul, variants);
  }
  assert.ok([...variantsByHangul.values()].every((variants) => variants.size <= 3));
  assert.ok([...variantsByHangul.values()].some((variants) => variants.size >= 2));
  const firstPage = result.items.slice(0, 20);
  assert.deepEqual(firstPage
    .filter((item) => item.presentationEvidence?.meaningConfidence !== 100)
    .map((item) => ({
      rank: item.rank,
      name: item.name.fullHanja,
      meaningConfidence: item.presentationEvidence?.meaningConfidence,
    })),
  [],
  'the exact fixture first page must not surface soft-deferred Hanja meanings');
  const hardRejectedHanja = new Set([
    '匕', '刀', '刃', '亡', '不', '倒', '滓', '竄', '湮', '蕪',
  ]);
  assert.ok(result.items.every((item) =>
    Array.from(item.name.givenHanja).every((hanja) => !hardRejectedHanja.has(hanja))),
  'clearly unsafe or negative Hanja must be absent from the browsable result');

  console.log(
    `Exact saju-guided candidate fixture: PASS `
    + `(${Math.round(elapsedMilliseconds)}ms; `
    + `${result.items.slice(0, 5).map((item) => `${item.name.fullHangul}(${item.name.fullHanja})`).join(', ')})`,
  );
  console.log(result.items.map((item) =>
    `${item.rank}. ${item.name.fullHangul}(${item.name.fullHanja}) `
    + `score=${item.score.final} pop=${item.popularity.rank} `
    + `meaning=${item.presentationEvidence?.meaningConfidence} `
    + `risk=${item.presentationEvidence?.risk} `
    + `phonetic=${item.presentationEvidence?.phonetic} `
    + `family=${item.presentationEvidence?.familyFit} `
    + `era=${item.presentationEvidence?.eraFit} `
    + `${item.name.givenCharacters.map((character) => character.meaning).join(' / ')}`,
  ).join('\n'));
} finally {
  engine.close();
  globalThis.fetch = originalFetch;
}
