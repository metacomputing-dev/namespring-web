import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
let generatedPackFetches = 0;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlString.includes('/generated-packed/')) {
    generatedPackFetches += 1;
    throw new Error('ReportDeliveryV1 must not fetch generated packs.');
  }
  if (urlString.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlString.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlString.includes('sql-wasm.wasm') || urlString.startsWith('https://sql.js.org/') || urlString === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import {
  PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  REPORT_DELIVERY_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
  ReportDeliveryContractError,
  SpringEngine,
  assertPremiumReportRegistrationRequestV1,
  assertReportDeliveryV1,
  type PremiumReportRegistrationRequestV1,
  type ReportDeliveryRequestV1,
  type ReportDeliveryV1,
} from '../../src/index.js';
import { buildReportDeliveryV1 } from '../../src/report/delivery/build-report-delivery.js';
import { ENGINE_BUILD_IDENTITY_V1 } from '../../src/engine-build-identity.generated.js';

const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  targetDate: '2026-07-18',
  options: {
    precisionConfig: {
      surfaceNameTrend: true,
      surfacePhoneticEvidence: true,
      surfaceNamingScoreVector: true,
    },
  },
};

function assertJsonData(value: unknown, pathLabel = '$'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${pathLabel}: finite number`);
    return;
  }
  assert.notEqual(typeof value, 'function', `${pathLabel}: no function`);
  assert.notEqual(typeof value, 'undefined', `${pathLabel}: no undefined`);
  assert.ok(typeof value === 'object', `${pathLabel}: JSON-compatible`);
  assert.ok(!(value instanceof Date), `${pathLabel}: no Date instance`);
  assert.ok(!(value instanceof Map), `${pathLabel}: no Map instance`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonData(item, `${pathLabel}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertJsonData(child, `${pathLabel}.${key}`);
  }
}

function serializedKeys(value: unknown): Set<string> {
  const keys = new Set<string>();
  const walk = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      keys.add(key);
      walk(child);
    }
  };
  walk(value);
  return keys;
}

function findSurface(delivery: ReportDeliveryV1, id: string) {
  return delivery.surfaces.find((surface) => surface.id === id);
}

const engine = new SpringEngine();
const repositories: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repository of repositories) if (repository) repository.wasmUrl = WASM_PATH;
await engine.init();

const originalCandidateSummaries = (engine as any).getNameCandidateSummariesInternal.bind(engine);
let candidateSummaryBuilds = 0;
(engine as any).getNameCandidateSummariesInternal = async () => {
  candidateSummaryBuilds += 1;
  return [
  {
    finalScore: 92,
    fullHangul: '최성수',
    fullHanja: '崔成秀',
    givenHangul: '성수',
    givenName: baseRequest.givenName,
    popularityRank: 10,
    maleRatio: 0.8,
    nameGender: 'male',
    rank: 1,
  },
  {
    finalScore: 90,
    fullHangul: '최민수',
    fullHanja: '崔珉秀',
    givenHangul: '민수',
    givenName: [{ hangul: '민', hanja: '珉' }, { hangul: '수', hanja: '秀' }],
    popularityRank: 11,
    maleRatio: 0.8,
    nameGender: 'male',
    rank: 2,
  },
  ];
};
const candidatePage = await engine.getCandidateSearch({
  birth: baseRequest.birth,
  surname: [{ hangul: '최' }],
  mode: 'recommend',
  options: { limit: 1 },
});
assert.equal(candidatePage.ordering.authority, 'spring_engine');
assert.equal(candidatePage.ordering.clientInstruction, 'preserve_order_and_rank');
assert.equal(candidatePage.items.length, 1);
const selectedCandidate = candidatePage.items[0]!;
const secondCandidatePage = await engine.getCandidateSearch({
  birth: baseRequest.birth,
  surname: [{ hangul: '최' }],
  mode: 'recommend',
  options: { offset: 1, limit: 1 },
}, { queryId: candidatePage.query.queryId });
assert.equal(secondCandidatePage.query.queryId, candidatePage.query.queryId);
assert.equal(secondCandidatePage.items[0]?.rank, 2,
  'later pages reuse the original local ordering snapshot without recomputation');
assert.equal(candidateSummaryBuilds, 1,
  'later pages slice the bounded local snapshot instead of rescoring candidates');
(engine as any).getNameCandidateSummariesInternal = originalCandidateSummaries;
assert.deepEqual(selectedCandidate.reportInput.surname, [{ hangul: '최', hanja: '崔' }],
  'candidate continuation carries the resolved surname identity');

for (const givenName of [
  [
    { hangul: '\uBBFC', hanja: '\u73C9' },
    { hangul: '\uC900', hanja: '\u4FCA' },
    { hangul: '\uC11C', hanja: '\u745E' },
  ],
  [
    { hangul: '\uBBFC', hanja: '\u73C9' },
    { hangul: '\uC900', hanja: '\u4FCA' },
    { hangul: '\uC11C', hanja: '\u745E' },
    { hangul: '\uC724', hanja: '\u5141' },
  ],
]) {
  const explicitLongNameDelivery = await engine.getReportDelivery({
    ...baseRequest,
    surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
    givenName,
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [
        { id: 'integrated', depth: 'brief' },
        { id: 'naming', depth: 'brief' },
      ],
    },
  });
  assert.equal(
    explicitLongNameDelivery.subject.displayName,
    `\uAE40${givenName.map((character) => character.hangul).join('')}`,
    'explicit 3-4 syllable names remain analyzable through report delivery',
  );
  assert.deepEqual(
    explicitLongNameDelivery.surfaces.map((surface) => surface.id),
    ['integrated', 'naming'],
    'explicit 3-4 syllable names retain both naming and integrated analysis',
  );
}

const integratedRequest: ReportDeliveryRequestV1 = {
  ...baseRequest,
  ...selectedCandidate.reportInput,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{
      id: 'integrated',
      depth: 'standard',
      timeline: {
        periods: ['today'],
        categories: ['overall', 'wealth', 'health', 'academic', 'romance', 'family'],
      },
    }],
  },
};

const integrated = await engine.getReportDelivery(integratedRequest);
assert.equal(integrated.schemaVersion, REPORT_DELIVERY_SCHEMA_V1);
assert.match(integrated.analysisId, /^analysis_v1_[0-9a-f]{32}$/u);
assert.equal(integrated.anchorDate, '2026-07-18');
assert.deepEqual(integrated.surfaces.map((surface) => surface.id), ['integrated']);
assert.equal(integrated.subject.displayName, '최성수');
assert.equal(integrated.subject.candidateId, selectedCandidate.candidateId,
  'a selected naming candidate continues into the integrated report');
assert.match(integrated.subject.candidateId!, /^candidate_v1_[0-9a-f]{32}$/u);
const selectedCandidatePremiumHandoff: PremiumReportRegistrationRequestV1 = {
  schemaVersion: PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  requestId: 'premium_request_v1_selected_candidate_0123456789abcdef',
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  localAnalysisId: integrated.analysisId,
  candidateId: selectedCandidate.candidateId,
  analysisInput: {
    birth: baseRequest.birth,
    surname: selectedCandidate.reportInput.surname,
    givenName: selectedCandidate.reportInput.givenName,
    targetDate: baseRequest.targetDate,
  },
};
assert.doesNotThrow(
  () => assertPremiumReportRegistrationRequestV1(selectedCandidatePremiumHandoff),
  'the exact candidate identity must continue from local naming through free integrated analysis to paid registration',
);
assert.deepEqual(integrated.coverage.surfaces, integratedRequest.delivery.surfaces);
assert.deepEqual(integrated.provenance, {
  engine: 'spring-ts',
  facts: 'deterministic-engine-output',
  narratives: 'interpretive-not-fact-authority',
  cacheScope: 'engine_session',
  artifactIdentity: {
    manifestSchema: 'namespring.engine-build-input-manifest.v1',
    digest: ENGINE_BUILD_IDENTITY_V1.aggregateDigest,
    authority: 'build-time-artifact-identity-only',
    correctnessAuthority: false,
  },
  versions: {
    engine: '2.0.0',
    ruleset: ENGINE_BUILD_IDENTITY_V1.rulesetDigest,
    data: ENGINE_BUILD_IDENTITY_V1.dataDigest,
    deliveryTemplate: 'delivery-template-v1',
    timelineArticleTemplate: 'article-v1',
  },
  computation: {
    natalSaju: 'birth-derived-invariant',
    naming: 'name-derived',
    interaction: 'birth-and-name-conditioned',
  },
});
assert.equal(
  integrated.facts.some((fact) =>
    fact.domain === 'naming'
    && (fact.kind === 'name_character' || fact.kind === 'metric')),
  true,
  'integrated payload keeps a bounded deterministic name summary beside the natal summary',
);
assert.equal(
  integrated.facts.some((fact) =>
    fact.domain === 'naming'
    && (fact.kind === 'naming_frame' || fact.kind === 'element_distribution')),
  false,
  'integrated payload does not duplicate the specialist naming report',
);
assert.equal(
  integrated.interpretations.some((row) => row.domain === 'naming'),
  false,
  'integrated narratives do not duplicate the specialist naming surface',
);
const integratedYongshin = integrated.facts.find((fact) => fact.kind === 'yongshin');
assert.ok(integratedYongshin?.kind === 'yongshin');
assert.deepEqual(
  {
    schoolPreset: integratedYongshin.interpretationPolicy?.schoolPreset,
    schoolSelection: integratedYongshin.interpretationPolicy?.schoolSelection,
    yongshinMode: integratedYongshin.interpretationPolicy?.yongshinMode,
    yongshinModeSelection: integratedYongshin.interpretationPolicy?.yongshinModeSelection,
  },
  {
    schoolPreset: 'korean',
    schoolSelection: 'product_default',
    yongshinMode: 'chengbai_strict',
    yongshinModeSelection: 'product_default',
  },
  'an omitted interpretation choice resolves to an explicit, provenance-bound product default',
);
assert.deepEqual(
  integratedYongshin.methodCandidates?.map((candidate) => candidate.method),
  ['eokbu', 'johu', 'gyeokguk', 'tonggwan', 'byeongyak', 'siksangFlow'],
  'method disagreement remains inspectable instead of hiding the selected result',
);
assert.equal(
  integrated.facts.some((fact) => fact.kind === 'pillars'),
  true,
  'integrated conflict handling retains deterministic natal pillars',
);
assert.equal(
  integrated.facts.some((fact) => fact.kind === 'time_correction'),
  true,
  'integrated conflict handling retains deterministic time-correction provenance',
);
assertJsonData(integrated);

const alternateNameDelivery = await engine.getReportDelivery({
  ...baseRequest,
  surname: [{ hangul: '김', hanja: '金' }],
  givenName: [{ hangul: '종', hanja: '鍾' }, { hangul: '석', hanja: '石' }],
  delivery: integratedRequest.delivery,
});
const alternateInteraction = alternateNameDelivery.facts.find(
  (fact) => fact.kind === 'name_saju_interaction',
);
assert.ok(alternateInteraction?.kind === 'name_saju_interaction');
assert.equal(alternateInteraction.nameElementScope, 'surname_and_given_name');
assert.equal(alternateInteraction.nameElements.length, 3,
  'interaction evidence covers the surname and given name with one consistent scope');
assert.ok(alternateInteraction.yongshinMatchCount <= alternateInteraction.nameElements.length);
assert.ok(alternateInteraction.gishinMatchCount <= alternateInteraction.nameElements.length);
const alternateNameDistribution = alternateNameDelivery.facts.find(
  (fact) => fact.id === 'interaction.name-element-distribution',
);
assert.ok(alternateNameDistribution?.kind === 'element_distribution');
assert.equal(alternateNameDistribution.subjectScope, 'full_name');
assert.deepEqual(
  integrated.facts.filter((fact) => fact.domain === 'saju'),
  alternateNameDelivery.facts.filter((fact) => fact.domain === 'saju'),
  'changing the name must never change birth-derived saju facts',
);

const longCandidateDelivery = await engine.getReportDelivery({
  ...baseRequest,
  surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
  givenName: [
    { hangul: '\uBBFC', hanja: '\u73C9' },
    { hangul: '\uC900', hanja: '\u4FCA' },
    { hangul: '\uC11C', hanja: '\u745E' },
  ],
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [
      ...integratedRequest.delivery.surfaces,
      { id: 'naming', depth: 'expert' },
    ],
  },
});
const integratedInteraction = integrated.facts.find(
  (fact) => fact.kind === 'name_saju_interaction',
);
const longCandidateInteraction = longCandidateDelivery.facts.find(
  (fact) => fact.kind === 'name_saju_interaction',
);
assert.ok(integratedInteraction?.kind === 'name_saju_interaction');
assert.ok(longCandidateInteraction?.kind === 'name_saju_interaction');
assert.equal(integratedInteraction.nameElements.length, 3);
assert.equal(longCandidateInteraction.nameElements.length, 4,
  'interaction evidence covers every character of the selected candidate');
assert.notDeepEqual(
  longCandidateInteraction.nameElements,
  integratedInteraction.nameElements,
  'each selected candidate recomputes its own naming and saju-interaction evidence',
);
assert.deepEqual(
  integrated.facts.filter((fact) => fact.domain === 'fortune'),
  longCandidateDelivery.facts.filter((fact) => fact.domain === 'fortune'),
  'changing the name must never change natal-calendar ratings',
);
assert.deepEqual(
  integrated.interpretations.filter((row) => row.domain === 'fortune'),
  longCandidateDelivery.interpretations.filter((row) => row.domain === 'fortune'),
  'changing the name must never change natal-calendar narratives',
);
assert.deepEqual(
  findSurface(integrated, 'integrated')!.blocks.filter((block) => block.kind === 'timeline'),
  findSurface(longCandidateDelivery, 'integrated')!.blocks.filter(
    (block) => block.kind === 'timeline',
  ),
  'the integrated timeline stays birth-derived while interaction blocks remain name-conditioned',
);

const repeatedIntegrated = await engine.getReportDelivery(integratedRequest);
const { generatedAt: _firstGeneratedAt, ...firstSemanticDelivery } = integrated;
const { generatedAt: _secondGeneratedAt, ...secondSemanticDelivery } = repeatedIntegrated;
assert.deepEqual(
  secondSemanticDelivery,
  firstSemanticDelivery,
  'identical inputs produce identical semantic output; generatedAt is the sole clock field',
);

const forbiddenKeys = [
  'selectionSeed', 'selectedFragments', 'fragmentId', 'caseId', 'packKey',
  'packUrl', 'premiumBody', 'premiumContent', 'fullText', 'isUnlocked', 'paid',
  'entitlement', 'entitlementId', 'deliveryId',
];
const keys = serializedKeys(integrated);
for (const key of forbiddenKeys) assert.equal(keys.has(key), false, `forbidden key ${key}`);
for (const key of ['premiumContent', 'entitlementId', 'deliveryId']) {
  assert.throws(
    () => assertReportDeliveryV1({ ...integrated, [key]: 'must-not-leak' }),
    ReportDeliveryContractError,
    `runtime free-delivery guard must reject ${key}`,
  );
}

function assertInvalidDelivery(
  source: ReportDeliveryV1,
  reason: string,
  mutate: (value: any) => void,
): void {
  const drifted = structuredClone(source) as any;
  mutate(drifted);
  assert.throws(
    () => assertReportDeliveryV1(drifted),
    (error: unknown) => error instanceof ReportDeliveryContractError
      && error.reason === reason,
    reason,
  );
}

assertInvalidDelivery(integrated, 'TOP_LEVEL_SHAPE', (value) => {
  value.premiumStory = { text: 'must never cross the public DTO boundary' };
});
assertInvalidDelivery(integrated, 'GENERATED_AT', (value) => {
  value.generatedAt = Date.now();
});
assertInvalidDelivery(integrated, 'PROVENANCE_ARTIFACT_IDENTITY', (value) => {
  value.provenance.artifactIdentity.digest = `sha256:${'0'.repeat(64)}`;
});
assertInvalidDelivery(integrated, 'PROVENANCE_ARTIFACT_IDENTITY', (value) => {
  value.provenance.artifactIdentity.correctnessAuthority = true;
});
assertInvalidDelivery(integrated, 'PROVENANCE_VERSIONS', (value) => {
  value.provenance.versions.data = `sha256:${'0'.repeat(64)}`;
});
assertInvalidDelivery(integrated, 'SURFACE_COVERAGE_MISMATCH', (value) => {
  value.surfaces[0].depth = 'brief';
});
assertInvalidDelivery(integrated, 'SURFACE_SLICE_KEY_MISMATCH', (value) => {
  const oldSliceKey = value.surfaces[0].sliceKey;
  const forgedSliceKey = oldSliceKey + '.forged';
  const rewriteRefs = (current: any): void => {
    if (current === null || typeof current !== 'object') return;
    for (const key of Object.keys(current)) {
      const child = current[key];
      if (typeof child === 'string'
        && (child === oldSliceKey || child.startsWith(oldSliceKey + '.'))) {
        current[key] = forgedSliceKey + child.slice(oldSliceKey.length);
      } else {
        rewriteRefs(child);
      }
    }
  };
  rewriteRefs(value);
});
assertInvalidDelivery(integrated, 'HERO_DEPTH_REF', (value) => {
  const hero = value.surfaces[0].blocks.find((block: any) => block.kind === 'hero');
  delete value.interpretations.find(
    (interpretation: any) => interpretation.id === hero.interpretationRef,
  ).standard;
});
assertInvalidDelivery(integrated, 'TIMELINE_DEPTH_REF', (value) => {
  const timelineBlock = value.surfaces[0].blocks.find((block: any) => block.kind === 'timeline');
  const ref = timelineBlock.periods[0].cells[0].interpretationRef;
  delete value.interpretations.find((interpretation: any) => interpretation.id === ref).standard;
});
assertInvalidDelivery(integrated, 'TIMELINE_PERIOD_COVERAGE_MISMATCH', (value) => {
  value.surfaces[0].blocks.find((block: any) => block.kind === 'timeline').periods[0].id = 'thisWeek';
});
assertInvalidDelivery(integrated, 'TIMELINE_CATEGORY_COVERAGE_MISMATCH', (value) => {
  value.surfaces[0].blocks.find((block: any) => block.kind === 'timeline')
    .periods[0].cells[0].category = 'career';
});
assertInvalidDelivery(integrated, 'TIMELINE_CELLS', (value) => {
  value.surfaces[0].blocks.find((block: any) => block.kind === 'timeline').periods[0].cells = [];
});
assertInvalidDelivery(integrated, 'TOP_LEVEL_AVAILABILITY', (value) => {
  value.availability = value.availability.status === 'ready'
    ? { status: 'unavailable', reasonCodes: ['NOT_APPLICABLE'] }
    : { status: 'ready', reasonCodes: [] };
});
assertInvalidDelivery(integrated, 'INTERACTION_NATAL_BINDING', (value) => {
  const interaction = value.facts.find(
    (fact: any) => fact.kind === 'name_saju_interaction',
  );
  const yongshin = value.facts.find((fact: any) => fact.kind === 'yongshin');
  yongshin.element = interaction.yongshinElement === 'wood' ? 'fire' : 'wood';
});
assertInvalidDelivery(integrated, 'TIMELINE_RATING_BINDING', (value) => {
  const interactionFact = value.facts.find((fact: any) => fact.kind === 'name_saju_interaction');
  value.surfaces[0].blocks.find((block: any) => block.kind === 'timeline')
    .periods[0].cells[0].ratingFactRef = interactionFact.id;
});
assertInvalidDelivery(integrated, 'INTERPRETATION_FACT_DOMAIN', (value) => {
  const nameDistribution = structuredClone(value.facts.find(
    (fact: any) => fact.id === 'interaction.name-element-distribution',
  ));
  nameDistribution.id = 'naming.forged-element-distribution';
  nameDistribution.domain = 'naming';
  value.facts.push(nameDistribution);
  const hero = value.surfaces[0].blocks.find((block: any) => block.kind === 'hero');
  const interpretation = value.interpretations.find(
    (item: any) => item.id === hero.interpretationRef,
  );
  hero.supportingFactRefs.push(nameDistribution.id);
  interpretation.factRefs.push(nameDistribution.id);
});
assertInvalidDelivery(integrated, 'FACT_GROUP_INTERPRETATION_BINDING', (value) => {
  const factGroup = value.surfaces[0].blocks.find((block: any) => block.kind === 'fact_group');
  const timeline = value.surfaces[0].blocks.find((block: any) => block.kind === 'timeline');
  factGroup.interpretationRef = timeline.periods[0].cells[0].interpretationRef;
});
const integratedJson = JSON.stringify(integrated);
assert.equal(integratedJson.includes('1986|4|19|5|45|male'), false, 'raw selection seed is absent');
assert.ok(Buffer.byteLength(integratedJson, 'utf8') < 128 * 1024, 'single standard surface stays under 128 KiB');
assert.equal(generatedPackFetches, 0, 'new delivery timeline remains fully local after engine assets load');

const aggressiveSpringReport = {
  sajuCompatibility: {
    yongshinElement: 'WOOD',
    heeshinElement: null,
    gishinElement: 'FIRE',
    nameElements: ['WOOD', 'EARTH'],
    yongshinMatchCount: 1,
    gishinMatchCount: 0,
    dayMasterSupportScore: 0,
    affinityScore: 0,
    yongshinConsensusConflictLevel: 'none',
    safetyProfile: {
      posture: 'aggressive',
      strategy: 'aggressive_reinforcement',
      riskScore: 80,
      competingElements: [],
      yongshinRatio: 0.5,
      heesinRatio: 0,
      gishinRatio: 0,
      gusinRatio: 0.8,
      reasons: ['fixture'],
    },
  },
} as any;

const aggressiveSafetyDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'integrated', depth: 'brief' }],
  },
  birth: { year: 1986, month: 4, day: 19, gender: 'male' },
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_1234567890abcdef',
  candidateId: `candidate_v1_${'1'.repeat(32)}`,
  saju: {
    elementDistribution: { WOOD: 2, FIRE: 2, EARTH: 2, METAL: 1, WATER: 1 },
    gyeokguk: { confidence: 0.8 },
    yongshin: { element: 'WOOD', confidence: 80, warnings: [] },
  } as any,
  namingReport: null,
  springReport: aggressiveSpringReport,
});
const aggressiveInteraction = aggressiveSafetyDelivery.facts.find(
  (fact) => fact.kind === 'name_saju_interaction',
);
assert.ok(aggressiveInteraction?.kind === 'name_saju_interaction');
assert.equal(aggressiveInteraction.classification, 'supportive_signal',
  'direct match remains an auditable fact instead of being rewritten');
assert.equal(aggressiveInteraction.safety?.posture, 'aggressive');
assert.ok(aggressiveInteraction.limitations.includes('safety_profile_caution'));
assert.deepEqual(aggressiveSafetyDelivery.surfaces[0]?.availability, {
  status: 'limited', reasonCodes: ['NAME_SAJU_SAFETY_CAUTION'],
});
const aggressiveHero = aggressiveSafetyDelivery.surfaces[0]?.blocks.find(
  (block) => block.kind === 'hero',
);
assert.ok(aggressiveHero?.kind === 'hero');
assert.equal(
  aggressiveSafetyDelivery.interpretations.find(
    (row) => row.id === aggressiveHero.interpretationRef,
  )?.brief.headline,
  '보완보다 과도한 쏠림과 주의 근거를 먼저 보세요',
);
assert.equal(aggressiveSafetyDelivery.offers.length, 1, 'eligible evidence exposes one bound offer');
assert.equal(
  aggressiveSafetyDelivery.surfaces[0]?.blocks.filter(
    (block) => block.kind === 'premium_teaser',
  ).length,
  1,
  'one offer has exactly one entitlement-gated teaser',
);
assertInvalidDelivery(aggressiveSafetyDelivery, 'OFFER_SHAPE', (value) => {
  value.offers[0].premiumStory = 'paid body must remain server-owned';
});
assertInvalidDelivery(aggressiveSafetyDelivery, 'PREMIUM_TEASER_STATE', (value) => {
  value.surfaces[0].blocks.find((block: any) => block.kind === 'premium_teaser').availability = {
    status: 'ready',
    reasonCodes: [],
  };
});
assertInvalidDelivery(aggressiveSafetyDelivery, 'OFFER_CARDINALITY', (value) => {
  const teaser = value.surfaces[0].blocks.find((block: any) => block.kind === 'premium_teaser');
  value.surfaces[0].blocks = value.surfaces[0].blocks.filter(
    (block: any) => block.kind !== 'premium_teaser',
  );
  value.interpretations = value.interpretations.filter(
    (interpretation: any) => interpretation.id !== teaser.teaserInterpretationRef,
  );
  value.offers = [];
});
assertInvalidDelivery(aggressiveSafetyDelivery, 'INTERACTION_COUNT', (value) => {
  const interaction = value.facts.find((fact: any) => fact.kind === 'name_saju_interaction');
  interaction.yongshinMatchCount = 0;
  interaction.classification = 'no_direct_match';
});

const strengthLimitedDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'integrated', depth: 'brief' }],
  },
  birth: { year: 1986, month: 4, day: 19, gender: 'male' },
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_strength_limited_001',
  candidateId: `candidate_v1_${'2'.repeat(32)}`,
  saju: {
    elementDistribution: { WOOD: 2, FIRE: 2, EARTH: 2, METAL: 1, WATER: 1 },
    axisStrength: { strength: 'candidate', gyeokguk: 'definite', yongshin: 'definite' },
    gyeokguk: { confidence: 0.8 },
    yongshin: { element: 'WOOD', confidence: 80, warnings: [] },
  } as any,
  namingReport: null,
  springReport: aggressiveSpringReport,
});
assert.ok(strengthLimitedDelivery.surfaces[0]?.availability.reasonCodes
  .includes('SAJU_JUDGMENT_LOW_CONFIDENCE'));
assert.deepEqual(strengthLimitedDelivery.offers, [],
  'candidate/deferred strength judgment must suppress the paid offer');
assert.equal(strengthLimitedDelivery.surfaces[0]?.blocks.some(
  (block) => block.kind === 'premium_teaser',
), false, 'suppressed strength evidence must not leave a teaser');

const integratedSurface = findSurface(integrated, 'integrated')!;
const timeline = integratedSurface.blocks.find((block) => block.kind === 'timeline');
assert.ok(timeline && timeline.kind === 'timeline');
assert.equal(timeline.periods.length, 1);
assert.equal(timeline.periods[0].cells.length, 6);
const limitedCategoryInterpretations = [];
for (const cell of timeline.periods[0].cells) {
  const interpretation = integrated.interpretations.find((row) => row.id === cell.interpretationRef)!;
  limitedCategoryInterpretations.push(interpretation);
  assert.ok(interpretation.standard, `${cell.category}: standard present`);
  assert.equal(interpretation.expert, undefined, `${cell.category}: expert omitted`);
  assert.equal(interpretation.availability.status, 'limited',
    `${cell.category}: conditional evidence is carried separately from narrative copy`);
  assert.ok(interpretation.standard!.paragraphs.length > 0,
    `${cell.category}: category-specific content is preserved`);
  assert.equal(interpretation.origin, 'authored_bundle',
    `${cell.category}: an evidence qualifier does not relabel authored content provenance`);
  assert.equal(cell.ratingFactRef, `fortune.${timeline.periods[0].id}.${cell.category}.stars`,
    `${cell.category}: the selected-school calculated rating remains available under a limited qualifier`);
  assert.ok(integrated.facts.some((fact) => fact.id === cell.ratingFactRef),
    `${cell.category}: a rating ref never invents a missing fact`);
  assert.equal(cell.availability.reasonCodes.includes('METHOD_SCOPE_LIMITED'), false,
    `${cell.category}: a neutral grade is not mislabeled as a method limitation`);
}
assert.ok(
  new Set(limitedCategoryInterpretations.map(
    (interpretation) => interpretation.standard!.paragraphs.join('\n'),
  )).size > 1,
  'limited natal evidence preserves differentiated category narratives instead of one placeholder',
);

const interaction = integrated.facts.find((fact) => fact.kind === 'name_saju_interaction');
assert.ok(interaction && interaction.kind === 'name_saju_interaction');
assert.equal('score' in interaction, false, 'interaction is not promoted to a composite score');
assert.ok(interaction.limitations.includes('not_a_combined_balance_score'));
const distributions = integrated.facts.filter((fact) => fact.kind === 'element_distribution');
assert.equal(distributions.length, 2, 'separate saju and name element distributions');
for (const distribution of distributions) {
  const sum = distribution.values.reduce((total, item) => total + item.sharePercent, 0);
  assert.ok(Math.abs(sum - 100) <= 0.02, `${distribution.id}: independently normalized`);
}
assert.deepEqual(integrated.offers, [],
  'evidence-limited natal judgment must suppress the paid completion offer');
assert.equal(
  integratedSurface.blocks.some((block) => block.kind === 'premium_teaser'),
  false,
  'suppressed offers must not leave a misleading premium teaser',
);
assert.ok(
  integratedSurface.availability.reasonCodes.some((reason) => [
    'SAJU_JUDGMENT_LOW_CONFIDENCE',
    'YONGSHIN_JONGGYEOK_RISK',
    'YONGSHIN_CONSENSUS_CONFLICT',
  ].includes(reason)),
  'suppression remains auditable through a bounded natal-evidence reason',
);

const namelessIntegrated = await engine.getReportDelivery({
  birth: baseRequest.birth,
  targetDate: baseRequest.targetDate,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'integrated', depth: 'brief' }],
  },
});
assert.deepEqual(namelessIntegrated.offers, [],
  'a report without a bound name must not advertise an unregistrable paid result');
assert.equal(findSurface(namelessIntegrated, 'integrated')!.blocks
  .some((block) => block.kind === 'premium_teaser'), false);

const originalGetSajuReport = engine.getSajuReport.bind(engine);
(engine as any).getSajuReport = async () => {
  throw new Error('naming-only delivery must not calculate saju');
};
const naming = await engine.getReportDelivery({
  ...baseRequest,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'naming', depth: 'expert' }],
  },
});
(engine as any).getSajuReport = originalGetSajuReport;
assert.deepEqual(naming.surfaces.map((surface) => surface.id), ['naming']);
assert.equal(naming.analysisId, integrated.analysisId, 'lazy surfaces share one analysis ID');
assert.equal(naming.subject.candidateId, integrated.subject.candidateId);
assert.equal(naming.facts.some((fact) => fact.domain === 'saju'), false, 'naming-only payload excludes saju facts');
assert.deepEqual(
  [...new Set(naming.facts.map((fact) => fact.domain))],
  ['naming'],
  'naming-only payload cannot leak fortune or interaction facts',
);
assert.equal(
  naming.interpretations.every((row) => row.domain === 'naming'),
  true,
  'naming-only interpretations retain the naming authority boundary',
);
assert.notDeepEqual(
  longCandidateDelivery.facts.filter((fact) => fact.domain === 'naming'),
  naming.facts,
  'each selected candidate recomputes its own naming facts before delivery',
);
const namingSurface = findSurface(naming, 'naming')!;
assert.equal(namingSurface.blocks.some((block) => block.kind === 'timeline'), false);
const namingTrend = naming.facts.find((fact) => fact.kind === 'naming_trend');
assert.ok(namingTrend?.kind === 'naming_trend');
assert.deepEqual(
  {
    method: namingTrend.method,
    source: namingTrend.source,
    projection: namingTrend.projection,
    sourceFields: namingTrend.sourceFields,
    sourceTier: namingTrend.sourceTier,
    authorityTruthEligible: namingTrend.authorityTruthEligible,
    givenHangul: namingTrend.givenHangul,
  },
  {
    method: 'spring-ts.official-name-trend-projection.v1',
    source: 'spring-ts.NamingReport.nameTrend',
    projection: 'selective_without_recalculation',
    sourceFields: ['nameTrend'],
    sourceTier: 'T5_OFFICIAL',
    authorityTruthEligible: true,
    givenHangul: baseRequest.givenName.map((character) => character.hangul).join(''),
  },
  'official name-trend source values retain their authority and identity',
);
const namingPhonetic = naming.facts.find((fact) => fact.kind === 'naming_phonetic');
assert.ok(namingPhonetic?.kind === 'naming_phonetic');
assert.deepEqual(
  {
    method: namingPhonetic.method,
    source: namingPhonetic.source,
    projection: namingPhonetic.projection,
    sourceFields: namingPhonetic.sourceFields,
    sourceTier: namingPhonetic.sourceTier,
    authorityTruthEligible: namingPhonetic.authorityTruthEligible,
    fullHangul: namingPhonetic.fullHangul,
  },
  {
    method: 'spring-ts.phonetic-transition-projection.v1',
    source: 'spring-ts.NamingReport.phonetic',
    projection: 'selective_without_recalculation',
    sourceFields: ['phonetic'],
    sourceTier: 'T3_AUTHORED_INTERPRETATION',
    authorityTruthEligible: false,
    fullHangul: naming.subject.displayName,
  },
  'phonetic mechanics remain explicitly non-authoritative instead of laundering copy into facts',
);
assert.deepEqual(
  [...serializedKeys(namingPhonetic)]
    .filter((key) => ['message', 'evidence', 'warnings'].includes(key)),
  [],
  'authored phonetic prose does not cross the structured fact boundary',
);
assert.equal(
  naming.facts.some((fact) => fact.kind === 'name_statistics'),
  false,
  'naming-only delivery does not perform a replacement popularity lookup',
);
const namingDetailBlock = namingSurface.blocks.find(
  (block) => block.kind === 'fact_group'
    && block.presentation === 'evidence'
    && block.factRefs.includes(namingTrend.id),
);
assert.ok(namingDetailBlock?.kind === 'fact_group');
assert.deepEqual(
  namingDetailBlock.factRefs,
  [namingTrend.id, namingPhonetic.id],
  'name trend and phonetic mechanics are reachable as one bounded specialist group',
);
const calendarCapability = namingSurface.blocks.find((block) => block.kind === 'capability');
assert.ok(calendarCapability && calendarCapability.kind === 'capability');
assert.equal(calendarCapability.availability.status, 'unavailable');
assert.ok(calendarCapability.availability.reasonCodes.includes('NAMING_CALENDAR_METHOD_NOT_ESTABLISHED'));
const fourFrames = namingSurface.blocks.find((block) => block.kind === 'four_frames');
assert.ok(fourFrames && fourFrames.kind === 'four_frames');
assert.equal(fourFrames.items.length, 4);
for (const item of fourFrames.items) {
  assert.ok(item.interpretationRef, 'calculated four-frame facts receive public-safe deterministic copy');
  const interpretation = naming.interpretations.find((row) => row.id === item.interpretationRef);
  assert.equal(interpretation?.origin, 'deterministic_template');
  assert.doesNotMatch(
    JSON.stringify(interpretation),
    /질병|혼인|이혼|특정 나이|전문가 검토/u,
    'safe fallback copy must not reproduce unapproved authored predictions or review labels',
  );
}
assert.equal(namingSurface.availability.status, 'ready');
assert.equal(
  naming.interpretations.some((row) => row.origin === 'authored_bundle'),
  false,
  'authored 81-numerology copy remains blocked until a versioned external expert approval',
);
assertInvalidDelivery(naming, 'FOUR_FRAME_CONTENT_GATE', (value) => {
  const block = value.surfaces[0].blocks.find((item: any) => item.kind === 'four_frames');
  const interpretation = value.interpretations.find(
    (item: any) => item.id === block.items[0].interpretationRef,
  );
  interpretation.origin = 'authored_bundle';
});
assertJsonData(naming);
assertInvalidDelivery(naming, 'HERO_DEPTH_REF', (value) => {
  const hero = value.surfaces[0].blocks.find((block: any) => block.kind === 'hero');
  delete value.interpretations.find(
    (interpretation: any) => interpretation.id === hero.interpretationRef,
  ).expert;
});
assertInvalidDelivery(naming, 'NAMING_TREND_PROVENANCE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'naming_trend').sourceTier =
    'T3_AUTHORED_INTERPRETATION';
});
assertInvalidDelivery(naming, 'NAMING_TREND_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'naming_trend').eraFitScore = 99;
});
assertInvalidDelivery(naming, 'NAMING_PHONETIC_FACT_SHAPE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'naming_phonetic').evidence =
    ['authored copy must not enter this fact'];
});
assertInvalidDelivery(naming, 'NAMING_PHONETIC_TRANSITION_SCORE', (value) => {
  const transition = value.facts.find(
    (fact: any) => fact.kind === 'naming_phonetic',
  ).transitions[0];
  transition.score = Math.max(0, transition.score - 1);
});
assertInvalidDelivery(naming, 'NAMING_DETAIL_IDENTITY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'naming_trend').givenHangul = '하린';
});

const rawNamingReport = await engine.getNamingReport({
  birth: baseRequest.birth,
  surname: baseRequest.surname,
  givenName: baseRequest.givenName,
  mode: 'evaluate',
  options: baseRequest.options,
});
const statisticsDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'naming', depth: 'brief' }],
  },
  birth: baseRequest.birth,
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_name_statistics_001',
  namingReport: rawNamingReport,
  springReport: {
    namingReport: rawNamingReport,
    popularityRank: 42.5,
    maleRatio: 0.35,
    nameGender: 'female',
  } as any,
  saju: null,
});
const nameStatistics = statisticsDelivery.facts.find(
  (fact) => fact.kind === 'name_statistics',
);
assert.ok(nameStatistics?.kind === 'name_statistics');
assert.deepEqual(nameStatistics, {
  id: 'naming.statistics',
  domain: 'naming',
  method: 'spring-ts.name-stat-summary-projection.v1',
  kind: 'name_statistics',
  source: 'spring-ts.SpringReport',
  projection: 'selective_without_recalculation',
  sourceFields: ['popularityRank', 'maleRatio', 'nameGender'],
  popularityRank: 42.5,
  maleRatio: 0.35,
  nameGender: 'female',
}, 'validated name statistics are copied exactly without rounding or nearby-rank substitution');
assertInvalidDelivery(statisticsDelivery, 'NAME_STATISTICS_FACT_SHAPE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'name_statistics').similarRank = 42;
});
assertInvalidDelivery(statisticsDelivery, 'NAME_STATISTICS_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'name_statistics').nameGender = 'male';
});
await assert.rejects(
  buildReportDeliveryV1({
    selection: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'naming', depth: 'brief' }],
    },
    birth: baseRequest.birth,
    targetDate: new Date('2026-07-18T00:00:00Z'),
    analysisId: 'analysis_v1_invalid_statistics_01',
    namingReport: rawNamingReport,
    springReport: {
      namingReport: rawNamingReport,
      popularityRank: 42,
      maleRatio: 0.35,
      nameGender: 'male',
    } as any,
    saju: null,
  }),
  (error: unknown) => error instanceof ReportDeliveryContractError
    && error.reason === 'NAME_STATISTICS_INVALID',
  'a producer-side statistics mismatch fails closed instead of changing the label',
);

const pureHangulNaming = await engine.getReportDelivery({
  birth: baseRequest.birth,
  surname: [{ hangul: '김' }],
  givenName: [{ hangul: '하' }, { hangul: '린' }],
  targetDate: baseRequest.targetDate,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'naming', depth: 'expert' }],
  },
});
assert.doesNotThrow(() => assertReportDeliveryV1(pureHangulNaming));
assert.deepEqual(pureHangulNaming.availability, {
  status: 'limited',
  reasonCodes: ['METHOD_SCOPE_LIMITED'],
}, 'pure-Hangul analysis remains usable while declaring its narrower evidence scope');
assert.equal(
  pureHangulNaming.facts.some((fact) => fact.id === 'naming.hanja-score'),
  false,
  'disabled Hanja evaluation must not surface its neutral placeholder as evidence',
);
assert.equal(
  pureHangulNaming.facts.some((fact) => fact.id === 'naming.total-score'),
  false,
  'a Hangul-only score must not be relabeled as a cross-method total',
);
assert.equal(
  pureHangulNaming.facts.some((fact) => fact.id === 'naming.four-frame-score'),
  false,
  'disabled four-frame evaluation must not surface its neutral placeholder as evidence',
);
assert.equal(
  findSurface(pureHangulNaming, 'naming')!.blocks.some((block) => block.kind === 'four_frames'),
  false,
  'pure-Hangul mode must not manufacture four-frame polarity from disabled calculation',
);
assert.ok(
  pureHangulNaming.facts.some((fact) => fact.id === 'naming.hangul-score'),
  'the applicable Hangul evidence remains available',
);
const pureHangulCharacters = pureHangulNaming.facts.filter(
  (fact) => fact.kind === 'name_character',
);
assert.equal(pureHangulCharacters.length, 3);
for (const fact of pureHangulCharacters) {
  assert.equal(fact.method, 'spring-ts.pure-hangul-character.v1');
  assert.equal('hanja' in fact, false);
  assert.equal('strokes' in fact, false,
    'Hangul glyph-stroke proxies must not be confused with Hanja numerology strokes');
}
assertInvalidDelivery(pureHangulNaming, 'NAME_CHARACTER_BASIS', (value) => {
  value.facts.find((fact: any) => fact.kind === 'name_character').strokes = 7;
});

const originalGetNamingReport = engine.getNamingReport.bind(engine);
const originalGetSpringReportFromSnapshot = (engine as any).getSpringReportFromSnapshot.bind(engine);
(engine as any).getNamingReport = async () => {
  throw new Error('saju-only delivery must not calculate a naming report');
};
(engine as any).getSpringReportFromSnapshot = async () => {
  throw new Error('saju-only delivery must not calculate an integrated report');
};
const saju = await engine.getReportDelivery({
  ...baseRequest,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{
      id: 'saju',
      depth: 'brief',
      timeline: {
        periods: ['today', 'thisWeek', 'thisMonth', 'thisYear'],
        categories: ['overall', 'wealth', 'health', 'academic', 'romance', 'family'],
      },
      life: 'summary',
    }],
  },
});
(engine as any).getNamingReport = originalGetNamingReport;
(engine as any).getSpringReportFromSnapshot = originalGetSpringReportFromSnapshot;
assert.equal(saju.analysisId, integrated.analysisId, 'saju lazy chunk shares analysis ID');
const sajuSurface = findSurface(saju, 'saju')!;
const sajuHeroBlock = sajuSurface.blocks.find((block) => block.kind === 'hero');
assert.ok(sajuHeroBlock?.kind === 'hero');
const sajuHeroInterpretation = saju.interpretations.find(
  (row) => row.id === sajuHeroBlock.interpretationRef,
);
assert.ok(sajuHeroInterpretation?.brief.hook);
assert.equal(
  /\b(?:WOOD|FIRE|EARTH|METAL|WATER)\b/u.test(sajuHeroInterpretation.brief.hook),
  false,
  'Korean report copy must not leak internal element enum labels',
);
assert.equal(
  saju.facts.every((fact) => fact.domain === 'saju' || fact.domain === 'fortune'),
  true,
  'saju-only payload cannot leak naming or interaction facts',
);
assert.equal(
  saju.interpretations.every((row) => row.domain === 'saju' || row.domain === 'fortune'),
  true,
  'saju-only interpretations cannot leak naming or interaction narratives',
);
assert.ok(sajuSurface.blocks.some((block) => block.kind === 'life_flow'), 'life is a separate block');
const yongshinConfidence = saju.facts.find((fact) => fact.id === 'saju.yongshin-confidence');
const gyeokgukConfidence = saju.facts.find((fact) => fact.id === 'saju.gyeokguk-confidence');
assert.ok(yongshinConfidence?.kind === 'metric' && yongshinConfidence.unit === 'confidence_0_100');
assert.ok(gyeokgukConfidence?.kind === 'metric' && gyeokgukConfidence.unit === 'ratio_0_1');
const yongshinFact = saju.facts.find((fact) => fact.kind === 'yongshin');
assert.ok(yongshinFact?.kind === 'yongshin');
assert.ok(yongshinFact.confidence >= 0 && yongshinFact.confidence <= 100);
const gyeokgukFact = saju.facts.find((fact) => fact.kind === 'gyeokguk');
assert.ok(gyeokgukFact?.kind === 'gyeokguk');
assert.ok(gyeokgukFact.confidence >= 0 && gyeokgukFact.confidence <= 1);
const strengthFact = saju.facts.find((fact) => fact.kind === 'strength');
assert.ok(strengthFact?.kind === 'strength');
assert.ok(['STRONG', 'BALANCED', 'WEAK', 'UNKNOWN'].includes(strengthFact.levelCode));
const timeCorrectionFact = saju.facts.find((fact) => fact.kind === 'time_correction');
assert.ok(timeCorrectionFact?.kind === 'time_correction');
assert.equal(timeCorrectionFact.policy.longitudeCorrection, 'on');
assert.equal(timeCorrectionFact.policy.longitudeReference, 'civilOffsetMeridian');
assert.equal(timeCorrectionFact.policy.yaza, 'on');
assert.equal(timeCorrectionFact.policy.yazaMode, '23:00');
assert.deepEqual(timeCorrectionFact.input, {
  calendarType: 'solar',
  providedLocalDateTime: {
    year: 1986, month: 4, day: 19, hour: 5, minute: 45,
  },
  effectiveSolarDate: { year: 1986, month: 4, day: 19 },
  timePrecision: 'exact',
});
assert.equal(timeCorrectionFact.inputUncertainty, null);
assert.equal(timeCorrectionFact.lunarConversion, null);
const timeCorrectionBlock = sajuSurface.blocks.find(
  (block) => block.kind === 'fact_group'
    && block.factRefs.includes(timeCorrectionFact.id),
);
assert.equal(timeCorrectionBlock?.availability.status, 'ready',
  'deterministic clock-correction evidence stays ready when judgment prose is limited');
assert.ok(
  gyeokgukFact.typeCode === null || /^[A-Z][A-Z_]{0,39}$/u.test(gyeokgukFact.typeCode),
  'gyeokguk delivery exposes a bounded canonical type code, never localized copy',
);
assert.ok(['NORMAL', 'JONGGYEOK', 'UNKNOWN'].includes(gyeokgukFact.categoryCode));
assert.ok(
  gyeokgukFact.baseTenGodCode === null
    || /^[A-Z][A-Z_]{0,39}$/u.test(gyeokgukFact.baseTenGodCode),
  'gyeokguk delivery exposes a bounded canonical base ten-god code',
);
assertInvalidDelivery(saju, 'STRENGTH_FACT_SHAPE', (value) => {
  delete value.facts.find((fact: any) => fact.kind === 'strength').levelCode;
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_ADJUSTED', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .adjustedSolarLocalDateTime.minute = 60;
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_STANDARD', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .standardLocalDateTime.minute = -1;
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .yazaBoundaryEffect = 'inside_boundary';
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_FACT_SHAPE', (value) => {
  delete value.facts.find((fact: any) => fact.kind === 'time_correction').location;
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_LOCATION', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction').location.latitude = 91;
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_LOCATION_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .location.resolvedRegionCode = 'BUSAN';
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_UNCERTAINTY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .inputUncertainty = { unknownHour: {} };
});
assertInvalidDelivery(saju, 'TIME_CORRECTION_CARDINALITY', (value) => {
  const timeFact = value.facts.find((fact: any) => fact.kind === 'time_correction');
  value.facts = value.facts.filter((fact: any) => fact.id !== timeFact.id);
  value.surfaces[0].blocks = value.surfaces[0].blocks.filter(
    (block: any) => !(
      block.kind === 'fact_group'
      && block.factRefs.includes(timeFact.id)
    ),
  );
});
for (const requiredCode of ['typeCode', 'categoryCode', 'baseTenGodCode'] as const) {
  assertInvalidDelivery(saju, 'GYEOKGUK_FACT_SHAPE', (value) => {
    delete value.facts.find((fact: any) => fact.kind === 'gyeokguk')[requiredCode];
  });
}
const dayMaster = saju.facts.find((fact) => fact.id === 'saju.day-master');
assert.ok(dayMaster?.kind === 'day_master');
assert.equal('value' in dayMaster, false, 'day master is structured, not delimiter encoded');
for (const interpretation of saju.interpretations.filter((row) => row.domain === 'fortune')) {
  assert.equal(interpretation.standard, undefined, `${interpretation.id}: brief omits standard`);
  assert.equal(interpretation.expert, undefined, `${interpretation.id}: brief omits expert`);
}

const exactTimeDelivery = await engine.getReportDelivery({
  ...baseRequest,
  birth: {
    ...baseRequest.birth,
    region: '서울',
    latitude: 37.5665,
    longitude: 126.978,
    timezone: 'Asia/Seoul',
  },
  options: {
    ...baseRequest.options,
    sajuTimePolicy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
      longitudeReference: 'civilOffsetMeridian',
      yaza: 'on',
      yazaMode: '23:00',
    },
  },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
});
const exactTimeFact = exactTimeDelivery.facts.find(
  (fact) => fact.kind === 'time_correction',
);
assert.ok(exactTimeFact?.kind === 'time_correction');
assert.deepEqual(exactTimeFact.standardLocalDateTime, {
  year: 1986, month: 4, day: 19, hour: 5, minute: 45,
});
assert.deepEqual(exactTimeFact.input, {
  calendarType: 'solar',
  providedLocalDateTime: {
    year: 1986, month: 4, day: 19, hour: 5, minute: 45,
  },
  effectiveSolarDate: { year: 1986, month: 4, day: 19 },
  timePrecision: 'exact',
});
assert.deepEqual(exactTimeFact.adjustedSolarLocalDateTime, {
  year: 1986, month: 4, day: 19, hour: 5, minute: 13,
});
assert.ok(Math.abs(exactTimeFact.corrections.longitudeMinutes - (-32.088)) < 1e-9);
assert.ok(Math.abs(exactTimeFact.corrections.equationOfTimeMinutes - 0.686756) < 1e-6);
assert.deepEqual(exactTimeFact.location, {
  inputLabel: '서울',
  resolvedRegionCode: 'SEOUL',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
  source: 'explicit',
  coordinatesApplied: true,
});
assert.ok(exactTimeFact.referenceMeridianDegrees !== null);
assert.ok(Math.abs(exactTimeFact.referenceMeridianDegrees - 135) < 1e-9);
assert.deepEqual(exactTimeFact.referenceMeridianBasis, {
  kind: 'civil_offset_at_birth',
  utcOffsetMinutes: 540,
});
assert.equal(exactTimeFact.policy.explicitLocationRequired, true);
assert.equal(exactTimeFact.solarDateChanged, false);
assert.equal(exactTimeFact.yazaBoundaryEffect, 'outside_boundary');
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_MERIDIAN_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .referenceMeridianDegrees = 134;
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_MERIDIAN_CONSISTENCY', (value) => {
  const timeFact = value.facts.find((fact: any) => fact.kind === 'time_correction');
  timeFact.referenceMeridianDegrees = 120;
  timeFact.corrections.longitudeMinutes = 27.912;
  timeFact.adjustedSolarLocalDateTime.hour = 6;
  timeFact.adjustedSolarLocalDateTime.minute = 13;
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_MERIDIAN_CONSISTENCY', (value) => {
  const timeFact = value.facts.find((fact: any) => fact.kind === 'time_correction');
  timeFact.referenceMeridianBasis.utcOffsetMinutes = 480;
  timeFact.referenceMeridianDegrees = 120;
  timeFact.corrections.longitudeMinutes = 27.912;
  timeFact.adjustedSolarLocalDateTime.hour = 6;
  timeFact.adjustedSolarLocalDateTime.minute = 13;
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_CONSISTENCY', (value) => {
  const timeFact = value.facts.find((fact: any) => fact.kind === 'time_correction');
  timeFact.adjustedSolarLocalDateTime.hour = 18;
  timeFact.adjustedSolarLocalDateTime.minute = 12;
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_VALUES', (value) => {
  const timeFact = value.facts.find((fact: any) => fact.kind === 'time_correction');
  timeFact.corrections.equationOfTimeMinutes = 1000;
  timeFact.adjustedSolarLocalDateTime.hour = 21;
  timeFact.adjustedSolarLocalDateTime.minute = 52;
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_VALUES', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .corrections.daylightSavingMinutes = 999;
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_CONSISTENCY', (value) => {
  const timeFact = value.facts.find((fact: any) => fact.kind === 'time_correction');
  timeFact.policy.explicitLocationRequired = false;
  timeFact.location = {
    inputLabel: null,
    resolvedRegionCode: 'SEOUL',
    latitude: 37.5665,
    longitude: 126.978,
    timezone: 'Asia/Seoul',
    source: 'default',
    coordinatesApplied: true,
  };
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_LOCATION_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction').location.source = 'default';
});
assertInvalidDelivery(exactTimeDelivery, 'TIME_CORRECTION_LOCATION_CONSISTENCY', (value) => {
  const location = value.facts.find((fact: any) => fact.kind === 'time_correction').location;
  location.latitude = 36.3504;
  location.longitude = 127.3845;
});

const unknownHourDelivery = await engine.getReportDelivery({
  ...baseRequest,
  birth: {
    ...baseRequest.birth,
    hour: null,
    minute: null,
  },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
});
const unknownHourFact = unknownHourDelivery.facts.find(
  (fact) => fact.kind === 'time_correction',
);
assert.ok(unknownHourFact?.kind === 'time_correction');
assert.equal(unknownHourFact.input.timePrecision, 'unknown_hour');
assert.equal(unknownHourFact.input.providedLocalDateTime.hour, null);
assert.equal(unknownHourFact.input.providedLocalDateTime.minute, null);
assert.equal(unknownHourFact.standardLocalDateTime.hour, 12);
assert.equal(unknownHourFact.standardLocalDateTime.minute, 0);
assert.ok(unknownHourFact.inputUncertainty?.unknownHour);
assert.equal(unknownHourFact.inputUncertainty?.unknownMinute, undefined);
const unknownHourTimeBlock = findSurface(unknownHourDelivery, 'saju')!.blocks.find(
  (block) => block.kind === 'fact_group'
    && block.factRefs.includes(unknownHourFact.id),
);
assert.deepEqual(unknownHourTimeBlock?.availability, {
  status: 'limited',
  reasonCodes: ['BIRTH_TIME_IMPUTED'],
});
assert.ok(
  findSurface(unknownHourDelivery, 'saju')!.availability.reasonCodes
    .includes('BIRTH_TIME_IMPUTED'),
);
assertInvalidDelivery(
  unknownHourDelivery,
  'TIME_CORRECTION_AVAILABILITY',
  (value) => {
    const fact = value.facts.find((entry: any) => entry.kind === 'time_correction');
    const block = value.surfaces[0].blocks.find(
      (entry: any) => entry.kind === 'fact_group' && entry.factRefs.includes(fact.id),
    );
    block.availability = { status: 'ready', reasonCodes: [] };
  },
);

const unknownMinuteDelivery = await engine.getReportDelivery({
  ...baseRequest,
  birth: {
    ...baseRequest.birth,
    minute: null,
  },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
});
const unknownMinuteFact = unknownMinuteDelivery.facts.find(
  (fact) => fact.kind === 'time_correction',
);
assert.ok(unknownMinuteFact?.kind === 'time_correction');
assert.equal(unknownMinuteFact.input.timePrecision, 'unknown_minute');
assert.equal(unknownMinuteFact.input.providedLocalDateTime.hour, 5);
assert.equal(unknownMinuteFact.input.providedLocalDateTime.minute, null);
assert.equal(unknownMinuteFact.standardLocalDateTime.hour, 5);
assert.equal(unknownMinuteFact.standardLocalDateTime.minute, 0);
assert.ok(unknownMinuteFact.inputUncertainty?.unknownMinute);
assert.equal(unknownMinuteFact.inputUncertainty?.unknownHour, undefined);

const lunarDelivery = await engine.getReportDelivery({
  ...baseRequest,
  birth: {
    ...baseRequest.birth,
    year: 1986,
    month: 3,
    day: 11,
    calendarType: 'lunar',
    isLeapMonth: false,
  },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
});
const lunarTimeFact = lunarDelivery.facts.find(
  (fact) => fact.kind === 'time_correction',
);
assert.ok(lunarTimeFact?.kind === 'time_correction');
assert.deepEqual(lunarTimeFact.input, {
  calendarType: 'lunar',
  providedLocalDateTime: {
    year: 1986, month: 3, day: 11, hour: 5, minute: 45,
  },
  effectiveSolarDate: { year: 1986, month: 4, day: 19 },
  timePrecision: 'exact',
});
assert.deepEqual(lunarTimeFact.lunarConversion, {
  lunar: {
    year: 1986,
    month: 3,
    day: 11,
    isLeapMonth: false,
  },
  solar: { year: 1986, month: 4, day: 19 },
  source: 'builtin',
});
assert.deepEqual(lunarTimeFact.standardLocalDateTime, {
  year: 1986, month: 4, day: 19, hour: 5, minute: 45,
});
assertInvalidDelivery(lunarDelivery, 'TIME_CORRECTION_LUNAR_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .lunarConversion.solar.day = 20;
});
assertInvalidDelivery(lunarDelivery, 'TIME_CORRECTION_LUNAR', (value) => {
  value.facts.find((fact: any) => fact.kind === 'time_correction')
    .lunarConversion.kasiFallback = false;
});
assertInvalidDelivery(lunarDelivery, 'TIME_CORRECTION_LUNAR', (value) => {
  const conversion = value.facts.find(
    (fact: any) => fact.kind === 'time_correction',
  ).lunarConversion;
  conversion.source = 'kasi';
  conversion.kasiFallback = true;
});

const leapMonthDelivery = await engine.getReportDelivery({
  ...baseRequest,
  birth: {
    ...baseRequest.birth,
    year: 2025,
    month: 6,
    day: 1,
    calendarType: 'lunar',
    isLeapMonth: true,
  },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
});
const leapMonthTimeFact = leapMonthDelivery.facts.find(
  (fact) => fact.kind === 'time_correction',
);
assert.ok(leapMonthTimeFact?.kind === 'time_correction');
assert.deepEqual(leapMonthTimeFact.lunarConversion, {
  lunar: {
    year: 2025,
    month: 6,
    day: 1,
    isLeapMonth: true,
  },
  solar: { year: 2025, month: 7, day: 25 },
  source: 'builtin',
}, 'a real leap-month flag survives conversion and report-delivery provenance');

const mixedDepth = await engine.getReportDelivery({
  ...baseRequest,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [
      {
        id: 'integrated',
        depth: 'brief',
        timeline: { periods: ['thisYear'], categories: ['overall'] },
      },
      {
        id: 'saju',
        depth: 'expert',
        timeline: { periods: ['thisYear'], categories: ['overall'] },
      },
    ],
  },
});
const integratedMixedTimeline = findSurface(mixedDepth, 'integrated')!.blocks
  .find((block) => block.kind === 'timeline');
const sajuMixedTimeline = findSurface(mixedDepth, 'saju')!.blocks
  .find((block) => block.kind === 'timeline');
assert.ok(integratedMixedTimeline?.kind === 'timeline');
assert.ok(sajuMixedTimeline?.kind === 'timeline');
assert.equal(integratedMixedTimeline.defaultPeriod, 'thisYear');
assert.deepEqual(integratedMixedTimeline.availablePeriodOrder, ['thisYear']);
const briefRef = integratedMixedTimeline.periods[0]!.cells[0]!.interpretationRef!;
const expertRef = sajuMixedTimeline.periods[0]!.cells[0]!.interpretationRef!;
assert.match(briefRef, /\.brief\.interpretation$/u);
assert.match(expertRef, /\.expert\.interpretation$/u);
assert.equal(mixedDepth.interpretations.find((row) => row.id === briefRef)?.standard, undefined,
  'brief surface must not reference a deeper projection');
assert.ok(mixedDepth.interpretations.find((row) => row.id === expertRef)?.expert,
  'expert surface keeps its independent projection');
assertInvalidDelivery(mixedDepth, 'TIMELINE_DEPTH_REF', (value) => {
  const expertSurface = value.surfaces.find((surface: any) => surface.id === 'saju');
  const expertTimeline = expertSurface.blocks.find((block: any) => block.kind === 'timeline');
  const ref = expertTimeline.periods[0].cells[0].interpretationRef;
  delete value.interpretations.find((interpretation: any) => interpretation.id === ref).expert;
});

const validSajuReport = await originalGetSajuReport({
  birth: baseRequest.birth,
  surname: baseRequest.surname,
});
const structuralEvidenceFixture = {
  ...structuredClone(validSajuReport),
  shinsalHits: [
    {
      type: '\uCC9C\uB355\uADC0\uC778',
      position: '\uC6D4\uC8FC',
      grade: 'A',
      baseWeight: 80,
      positionMultiplier: 1.2,
      weightedScore: 96,
      basedOn: 'MONTH_BRANCH',
      seatPillars: ['month'],
      count: 1,
    },
    {
      type: '\uB3C4\uD654\uC0B4',
      position: '\uC77C\uC8FC',
      grade: 'B',
      baseWeight: 50,
      positionMultiplier: 1,
      weightedScore: 50,
      basedOn: 'DAY_BRANCH',
      seatPillars: ['day'],
      count: 2,
      qualityReasons: ['HYEONG'],
      conditionPenalty: 0.2,
    },
  ],
  cheonganRelations: [
    {
      type: '\uD569',
      stems: ['\uAC11', '\uAE30'],
      resultElement: 'EARTH',
      note: 'engine-private relation note',
      score: {
        model: 'legacy_heuristic_v1',
        unit: '0_100',
        status: 'provisional',
        evidenceOnly: true,
        authorityTruthEligible: false,
        provisional: true,
        pairCount: 1,
        positionGap: 3,
        positionGaps: [3],
        baseScore: 80,
        adjacencyBonus: 0,
        outcomeMultiplier: 1,
        finalScore: 80,
        rationale: 'engine-private provisional rationale',
      },
      hapState: 'HUA',
      hapStateKo: 'engine-private localized state',
      resultConfirmed: true,
    },
  ],
  jijiRelations: [
    {
      type: '\uCDA9',
      branches: ['\uC790', '\uC624'],
      note: 'engine-private branch note',
      outcome: '\uCDA9(\u6C96)',
      reasoning: 'engine-private interpretive reasoning',
    },
  ],
  tenGodAnalysis: {
    dayMaster: '\uAC11',
    byPosition: {
      YEAR: {
        cheonganTenGod: '\uBE44\uACAC',
        jijiPrincipalTenGod: '\uC815\uC7AC',
        hiddenStems: [{ stem: '\uAC11', element: 'WOOD', ratio: 1 }],
        hiddenStemTenGod: [{ stem: '\uAC11', tenGod: '\uBE44\uACAC' }],
      },
      MONTH: {
        cheonganTenGod: '\uC2DD\uC2E0',
        jijiPrincipalTenGod: '\uC0C1\uAD00',
        hiddenStems: [{ stem: '\uBCD1', element: 'FIRE', ratio: 1 }],
        hiddenStemTenGod: [{ stem: '\uBCD1', tenGod: '\uC2DD\uC2E0' }],
      },
      DAY: {
        cheonganTenGod: '\uBE44\uACAC',
        jijiPrincipalTenGod: '\uD3B8\uC7AC',
        hiddenStems: [{ stem: '\uBB34', element: 'EARTH', ratio: 1 }],
        hiddenStemTenGod: [{ stem: '\uBB34', tenGod: '\uD3B8\uC7AC' }],
      },
      HOUR: {
        cheonganTenGod: '\uC815\uC778',
        jijiPrincipalTenGod: '\uD3B8\uC778',
        hiddenStems: [{ stem: '\uC784', element: 'WATER', ratio: 1 }],
        hiddenStemTenGod: [{ stem: '\uC784', tenGod: '\uD3B8\uC778' }],
      },
    },
  },
  deficientElements: ['EARTH', 'METAL'],
  excessiveElements: ['WOOD'],
} as any;
const structuralEvidenceDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
  birth: baseRequest.birth,
  options: baseRequest.options,
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_structural_evidence_01',
  saju: structuralEvidenceFixture,
  namingReport: null,
  springReport: null,
});
const shinsalEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'shinsal_hits',
);
assert.ok(shinsalEvidence?.kind === 'shinsal_hits');
assert.deepEqual(
  {
    method: shinsalEvidence.method,
    source: shinsalEvidence.source,
    projection: shinsalEvidence.projection,
    sourceFields: shinsalEvidence.sourceFields,
  },
  {
    method: 'saju-ts.shinsal-summary-projection.v1',
    source: 'spring-ts.SajuSummary',
    projection: 'normalized_without_recalculation',
    sourceFields: ['shinsalHits'],
  },
);
assert.deepEqual(
  shinsalEvidence.hits,
  [
    {
      name: '\uCC9C\uB355\uADC0\uC778',
      calculationBasis: { label: '\uC6D4\uC8FC', code: 'MONTH_BRANCH' },
      grade: 'A',
      seatPillars: ['month'],
      occurrenceCount: 1,
    },
    {
      name: '\uB3C4\uD654\uC0B4',
      calculationBasis: { label: '\uC77C\uC8FC', code: 'DAY_BRANCH' },
      grade: 'B',
      seatPillars: ['day'],
      occurrenceCount: 2,
    },
  ],
  'named shinsal hits retain calculation basis and actual seat positions',
);
const shinsalKeys = serializedKeys(shinsalEvidence);
for (const internalKey of [
  'baseWeight',
  'positionMultiplier',
  'weightedScore',
  'qualityReasons',
  'conditionPenalty',
]) {
  assert.equal(
    shinsalKeys.has(internalKey),
    false,
    `shinsal projection omits engine-internal ${internalKey}`,
  );
}

const tenGodEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'ten_god_analysis',
);
assert.ok(tenGodEvidence?.kind === 'ten_god_analysis');
assert.equal(tenGodEvidence.dayMasterStem, '\uAC11');
assert.deepEqual(
  tenGodEvidence.positions.map((position) => position.position),
  ['year', 'month', 'day', 'hour'],
);
assert.deepEqual(
  tenGodEvidence.positions.map((position) => position.cheongan.code),
  ['BI_GYEON', 'SIK_SIN', 'BI_GYEON', 'JEONG_IN'],
);
assert.deepEqual(
  tenGodEvidence.positions.map((position) => position.jijiPrincipal.code),
  ['JEONG_JAE', 'SANG_GWAN', 'PYEON_JAE', 'PYEON_IN'],
);
assert.deepEqual(
  tenGodEvidence.positions.map((position) => position.hiddenStems[0]),
  [
    {
      stem: '\uAC11',
      element: 'wood',
      ratio: 1,
      tenGod: { label: '\uBE44\uACAC', code: 'BI_GYEON' },
    },
    {
      stem: '\uBCD1',
      element: 'fire',
      ratio: 1,
      tenGod: { label: '\uC2DD\uC2E0', code: 'SIK_SIN' },
    },
    {
      stem: '\uBB34',
      element: 'earth',
      ratio: 1,
      tenGod: { label: '\uD3B8\uC7AC', code: 'PYEON_JAE' },
    },
    {
      stem: '\uC784',
      element: 'water',
      ratio: 1,
      tenGod: { label: '\uD3B8\uC778', code: 'PYEON_IN' },
    },
  ],
  'ten-god positions retain source labels while adding bounded canonical codes',
);

const relationEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'natal_relations',
);
assert.ok(relationEvidence?.kind === 'natal_relations');
assert.deepEqual(relationEvidence.cheongan, [{
  type: '\uD569',
  stems: ['\uAC11', '\uAE30'],
  hapState: 'HUA',
  resultElement: 'earth',
  resultConfirmed: true,
}]);
assert.deepEqual(relationEvidence.jiji, [{
  type: '\uCDA9',
  branches: ['\uC790', '\uC624'],
  outcome: '\uCDA9(\u6C96)',
}]);
const relationKeys = serializedKeys(relationEvidence);
for (const internalKey of ['note', 'reasoning', 'score', 'hapStateKo']) {
  assert.equal(
    relationKeys.has(internalKey),
    false,
    `relation projection omits engine-internal ${internalKey}`,
  );
}

const elementBalanceEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'element_balance',
);
assert.ok(elementBalanceEvidence?.kind === 'element_balance');
assert.deepEqual(elementBalanceEvidence.deficient, ['earth', 'metal']);
assert.deepEqual(elementBalanceEvidence.excessive, ['wood']);

const gongmangEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'gongmang',
);
assert.ok(gongmangEvidence?.kind === 'gongmang');
assert.equal(gongmangEvidence.voidBranches.length, 2);

const seongpaeEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'gyeokguk_seongpae',
);
assert.ok(seongpaeEvidence?.kind === 'gyeokguk_seongpae');
assert.ok(['SUNYONG', 'YEOKYONG'].includes(seongpaeEvidence.usage));
const seongpaeKeys = serializedKeys(seongpaeEvidence);
for (const internalKey of ['reasons', 'verdictBeforeMonthBroken']) {
  assert.equal(
    seongpaeKeys.has(internalKey),
    false,
    `seongpae projection omits engine-internal ${internalKey}`,
  );
}

const sibiUnseongEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'sibi_unseong',
);
assert.ok(sibiUnseongEvidence?.kind === 'sibi_unseong');
assert.ok(sibiUnseongEvidence.stages.length >= 1);

const daeunEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'daeun_timeline',
);
assert.ok(daeunEvidence?.kind === 'daeun_timeline');
assert.ok(daeunEvidence.periods.length >= 1);
assert.ok(
  daeunEvidence.periods.every((period, index) =>
    index === 0 || period.order > daeunEvidence.periods[index - 1].order),
  'daeun periods stay in engine decade order',
);

const yinYangEvidence = structuralEvidenceDelivery.facts.find(
  (fact) => fact.kind === 'yin_yang_balance',
);
assert.ok(yinYangEvidence?.kind === 'yin_yang_balance');
assert.equal(
  yinYangEvidence.yang + yinYangEvidence.yin,
  8,
  'a full chart counts all eight characters',
);

const structuralEvidenceBlock = findSurface(structuralEvidenceDelivery, 'saju')!.blocks.find(
  (block) => block.kind === 'fact_group' && block.presentation === 'evidence',
);
assert.ok(structuralEvidenceBlock?.kind === 'fact_group');
assert.deepEqual(
  structuralEvidenceBlock.factRefs,
  [
    shinsalEvidence.id,
    tenGodEvidence.id,
    relationEvidence.id,
    elementBalanceEvidence.id,
    gongmangEvidence.id,
    seongpaeEvidence.id,
    sibiUnseongEvidence.id,
    daeunEvidence.id,
    yinYangEvidence.id,
  ],
  'specialist structural facts are reachable only through the saju evidence group',
);
assert.deepEqual(
  integrated.facts.filter((fact) => new Set([
    'shinsal_hits',
    'ten_god_analysis',
    'natal_relations',
    'element_balance',
    'gongmang',
    'gyeokguk_seongpae',
    'sibi_unseong',
    'daeun_timeline',
    'yin_yang_balance',
  ]).has(fact.kind)),
  [],
  'specialist structural facts do not broaden the integrated-only payload',
);
assertInvalidDelivery(structuralEvidenceDelivery, 'SAJU_PROJECTION_PROVENANCE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'shinsal_hits').sourceFields[0] = 'shinsalHit';
});
assertInvalidDelivery(structuralEvidenceDelivery, 'SHINSAL_HIT_SHAPE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'shinsal_hits').hits[0].weightedScore = 96;
});
assertInvalidDelivery(structuralEvidenceDelivery, 'SHINSAL_HIT_COUNT', (value) => {
  value.facts.find((fact: any) => fact.kind === 'shinsal_hits').hits[0].occurrenceCount = 0;
});
assertInvalidDelivery(structuralEvidenceDelivery, 'TEN_GOD_POSITION_ORDER', (value) => {
  value.facts.find((fact: any) => fact.kind === 'ten_god_analysis').positions.reverse();
});
assertInvalidDelivery(structuralEvidenceDelivery, 'TEN_GOD_HIDDEN_STEM_RATIO', (value) => {
  value.facts.find((fact: any) => fact.kind === 'ten_god_analysis')
    .positions[0].hiddenStems[0].ratio = 0.5;
});
assertInvalidDelivery(structuralEvidenceDelivery, 'CHEONGAN_RELATION_RESULT', (value) => {
  value.facts.find((fact: any) => fact.kind === 'natal_relations')
    .cheongan[0].resultElement = null;
});
assertInvalidDelivery(structuralEvidenceDelivery, 'ELEMENT_BALANCE_CONSISTENCY', (value) => {
  value.facts.find((fact: any) => fact.kind === 'element_balance').excessive.push('earth');
});

const earlyYearSajuReport = await originalGetSajuReport({
  birth: { ...baseRequest.birth, year: 50 },
  surname: baseRequest.surname,
});
const earlyYearDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
  birth: { ...baseRequest.birth, year: 50 },
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_early_year_time_01',
  saju: earlyYearSajuReport,
  namingReport: null,
  springReport: null,
});
assert.doesNotThrow(
  () => assertReportDeliveryV1(earlyYearDelivery),
  'years 1..99 retain their literal year instead of Date.UTC 1900-offset semantics',
);
const provenanceBoundDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
  birth: { ...baseRequest.birth, region: 'Busan' },
  options: {
    sajuTimePolicy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'off',
      yaza: 'off',
    },
  },
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_provenance_bound_01',
  saju: validSajuReport,
  namingReport: null,
  springReport: null,
});
const provenanceBoundTimeFact = provenanceBoundDelivery.facts.find(
  (fact) => fact.kind === 'time_correction',
);
assert.ok(provenanceBoundTimeFact?.kind === 'time_correction');
assert.deepEqual(
  provenanceBoundTimeFact.location,
  validSajuReport.timeCorrection.provenance?.location,
  'delivery location comes from the calculation atom, not a second birth lookup',
);
assert.deepEqual(
  provenanceBoundTimeFact.policy,
  validSajuReport.timeCorrection.provenance?.policy,
  'delivery policy comes from the calculation atom, not the later builder options',
);

const legacyTimeFixture = structuredClone(validSajuReport) as any;
delete legacyTimeFixture.timeCorrection.provenance;
await assert.rejects(
  buildReportDeliveryV1({
    selection: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
    birth: baseRequest.birth,
    targetDate: new Date('2026-07-18T00:00:00Z'),
    analysisId: 'analysis_v1_missing_time_provenance_01',
    saju: legacyTimeFixture,
    namingReport: null,
    springReport: null,
  }),
  (error: unknown) => error instanceof ReportDeliveryContractError
    && error.reason === 'TIME_CORRECTION_PROVENANCE_REQUIRED',
);

const invalidTimeFixture = structuredClone(validSajuReport) as any;
invalidTimeFixture.timeCorrection.standardYear = 0;
await assert.rejects(
  buildReportDeliveryV1({
    selection: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
    birth: baseRequest.birth,
    targetDate: new Date('2026-07-18T00:00:00Z'),
    analysisId: 'analysis_v1_invalid_time_fixture_01',
    saju: invalidTimeFixture,
    namingReport: null,
    springReport: null,
  }),
  (error: unknown) => error instanceof ReportDeliveryContractError
    && error.reason === 'TIME_CORRECTION_INVALID',
);

const failedSajuFixture = {
  ...structuredClone(validSajuReport),
  analysisStatus: 'failed',
} as any;
await assert.rejects(
  buildReportDeliveryV1({
    selection: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
    birth: baseRequest.birth,
    targetDate: new Date('2026-07-18T00:00:00Z'),
    analysisId: 'analysis_v1_failed_saju_fixture_01',
    saju: failedSajuFixture,
    namingReport: null,
    springReport: null,
  }),
  (error: unknown) => error instanceof ReportDeliveryContractError
    && error.reason === 'SAJU_UNAVAILABLE_FOR_REQUESTED_SURFACE',
);

const reversedPeriodDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{
      id: 'saju',
      depth: 'brief',
      timeline: { periods: ['thisYear', 'today'], categories: ['overall'] },
    }],
  },
  birth: baseRequest.birth,
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_reversed_period_order_01',
  saju: validSajuReport,
  namingReport: null,
  springReport: null,
});
const reversedPeriodSurface = findSurface(reversedPeriodDelivery, 'saju')!;
const reversedPeriodTimeline = reversedPeriodSurface.blocks.find(
  (block) => block.kind === 'timeline',
);
assert.ok(reversedPeriodTimeline?.kind === 'timeline');
assert.deepEqual(reversedPeriodTimeline.availablePeriodOrder, ['thisYear', 'today']);
assert.deepEqual(reversedPeriodTimeline.periods.map((period) => period.id), ['thisYear', 'today']);
assert.ok(reversedPeriodSurface.sliceKey.includes('periods-thisYear-today'));
const highRiskSajuReport = structuredClone(validSajuReport) as any;
highRiskSajuReport.axisStrength = {
  ...highRiskSajuReport.axisStrength,
  strength: 'candidate',
  gyeokguk: 'deferred',
  yongshin: 'deferred',
};
highRiskSajuReport.gyeokguk = {
  ...highRiskSajuReport.gyeokguk,
  confidence: 0.3,
};
highRiskSajuReport.yongshin = {
  ...highRiskSajuReport.yongshin,
  confidence: 35,
  warnings: ['종격 가능성을 배제하기 전에는 일반 억부 용신을 확정하지 않습니다.'],
  jonggyeokRisk: {
    level: 'HIGH',
    direction: 'PRESSURE',
    strengthIndex: -0.72,
    dominanceRatio: 2.8,
    subtypes: ['cong_weak'],
    maxCandidateScore: 0.81,
    confidenceAttenuated: true,
  },
};
const highRiskDelivery = await buildReportDeliveryV1({
  selection: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{
      id: 'saju',
      depth: 'standard',
      timeline: { periods: ['today'], categories: ['overall'] },
    }],
  },
  birth: baseRequest.birth,
  targetDate: new Date('2026-07-18T00:00:00Z'),
  analysisId: 'analysis_v1_fix_jong_high_risk_01',
  saju: highRiskSajuReport,
  namingReport: null,
  springReport: null,
});
const highRiskSurface = findSurface(highRiskDelivery, 'saju')!;
assert.ok(highRiskSurface.availability.reasonCodes.includes('SAJU_JUDGMENT_LOW_CONFIDENCE'));
assert.ok(highRiskSurface.availability.reasonCodes.includes('YONGSHIN_JONGGYEOK_RISK'));
const highRiskYongshin = highRiskDelivery.facts.find((fact) => fact.kind === 'yongshin');
assert.ok(highRiskYongshin?.kind === 'yongshin');
assert.deepEqual(highRiskYongshin.jonggyeokRisk, highRiskSajuReport.yongshin.jonggyeokRisk);
const highRiskHero = highRiskSurface.blocks.find((block) => block.kind === 'hero');
assert.ok(highRiskHero?.kind === 'hero');
assert.ok(highRiskHero.supportingFactRefs.includes(highRiskYongshin.id));
const highRiskMetrics = highRiskSurface.blocks.find((block) => block.id.endsWith('.metrics'));
assert.ok(highRiskMetrics?.kind === 'fact_group');
assert.equal(highRiskMetrics.availability.status, 'limited',
  'judgment metrics cannot advertise ready while gyeokguk/yongshin are deferred');
assert.ok(highRiskMetrics.availability.reasonCodes.includes('SAJU_JUDGMENT_LOW_CONFIDENCE'));
const highRiskPillars = highRiskSurface.blocks.find((block) => block.id.endsWith('.pillars'));
assert.equal(highRiskPillars?.availability.status, 'ready',
  'raw natal pillars remain usable independently of judgment confidence');
assert.ok(
  highRiskDelivery.interpretations.find(
    (interpretation) => interpretation.id === highRiskHero.interpretationRef,
  )?.brief.hook?.includes('보류'),
  'fix-jong/high-risk evidence defers an ordinary yongshin conclusion',
);
const highRiskTimeline = highRiskSurface.blocks.find((block) => block.kind === 'timeline');
assert.ok(highRiskTimeline?.kind === 'timeline');
assert.equal(highRiskTimeline.basis, 'natal_saju_calendar');
const highRiskCell = highRiskTimeline.periods[0]?.cells[0];
assert.equal(highRiskCell?.availability.status, 'limited');
assert.equal(highRiskCell?.ratingFactRef, 'fortune.today.overall.stars',
  'low-confidence natal evidence preserves the selected-school calculation while the cell remains limited');
assert.equal(highRiskDelivery.facts.some((fact) => fact.id === 'fortune.today.overall.stars'), true);
const highRiskCellInterpretation = highRiskDelivery.interpretations.find(
  (interpretation) => interpretation.id === highRiskCell?.interpretationRef,
);
assert.doesNotMatch(
  highRiskCellInterpretation?.brief.headline ?? '',
  /사주 판단 근거가 제한되어/u,
  'low-confidence fortune copy stays category-specific instead of becoming a placeholder',
);
assert.equal(
  highRiskCellInterpretation?.availability.status,
  'limited',
  'the delivery contract, rather than repeated narrative copy, marks the interpretation conditional',
);
assertInvalidDelivery(highRiskDelivery, 'YONGSHIN_JONGGYEOK_RANGE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'yongshin').jonggyeokRisk.dominanceRatio = -1;
});
assertInvalidDelivery(highRiskDelivery, 'YONGSHIN_FACT_SHAPE', (value) => {
  value.facts.find((fact: any) => fact.kind === 'yongshin').rawCandidates = [];
});
assertInvalidDelivery(highRiskDelivery, 'YONGSHIN_HERO_BINDING', (value) => {
  const yongshin = value.facts.find((fact: any) => fact.kind === 'yongshin');
  const hero = value.surfaces[0].blocks.find((block: any) => block.kind === 'hero');
  hero.supportingFactRefs = hero.supportingFactRefs.filter((ref: string) => ref !== yongshin.id);
});
assertInvalidDelivery(highRiskDelivery, 'SURFACE_AVAILABILITY', (value) => {
  const omitted = 'SAJU_JUDGMENT_LOW_CONFIDENCE';
  value.surfaces[0].availability.reasonCodes = value.surfaces[0].availability.reasonCodes
    .filter((reason: string) => reason !== omitted);
  value.availability.reasonCodes = value.availability.reasonCodes
    .filter((reason: string) => reason !== omitted);
});
assertInvalidDelivery(highRiskDelivery, 'SURFACE_AVAILABILITY', (value) => {
  value.surfaces[0].availability.status = 'unavailable';
  value.availability.status = 'unavailable';
});
assertInvalidDelivery(highRiskDelivery, 'UNUSED_FACT', (value) => {
  const orphan = structuredClone(value.facts.find((fact: any) => fact.kind === 'yongshin'));
  orphan.id += '.orphan';
  value.facts.push(orphan);
});
(engine as any).getSajuReport = async () => ({
  ...validSajuReport,
  yongshin: { ...validSajuReport.yongshin, confidence: 101 },
});
await assert.rejects(
  engine.getReportDelivery({
    ...baseRequest,
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'saju', depth: 'brief' }],
    },
  }),
  (error: unknown) => error instanceof ReportDeliveryContractError
    && error.reason === 'METRIC_OUT_OF_RANGE_saju.yongshin-confidence',
  'out-of-range engine facts must fail closed instead of being clamped',
);
(engine as any).getSajuReport = originalGetSajuReport;

const legacy = await engine.getFortuneReport({
  ...baseRequest,
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});
assert.equal('delivery' in legacy, false, 'legacy report shape has no delivery field');
assert.match(legacy.tieredMatrix?.meta.selectionSeed ?? '', /^selection_v1_[0-9a-f]{32}$/u);
assert.equal(JSON.stringify(legacy).includes('1986|4|19|5|45|male'), false, 'legacy tiered metadata no longer leaks birth seed');

engine.close();
console.log('Report delivery V1: PASS');
