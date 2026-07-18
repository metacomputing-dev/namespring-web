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
  integrated.facts.some((fact) => fact.domain === 'naming'),
  false,
  'integrated payload exposes name effects as interaction facts, not a duplicate naming report',
);
assert.equal(
  integrated.interpretations.some((row) => row.domain === 'naming'),
  false,
  'integrated narratives do not duplicate the specialist naming surface',
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
for (const cell of timeline.periods[0].cells) {
  const interpretation = integrated.interpretations.find((row) => row.id === cell.interpretationRef)!;
  assert.ok(interpretation.standard, `${cell.category}: standard present`);
  assert.equal(interpretation.expert, undefined, `${cell.category}: expert omitted`);
}

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
const calendarCapability = namingSurface.blocks.find((block) => block.kind === 'capability');
assert.ok(calendarCapability && calendarCapability.kind === 'capability');
assert.equal(calendarCapability.availability.status, 'unavailable');
assert.ok(calendarCapability.availability.reasonCodes.includes('NAMING_CALENDAR_METHOD_NOT_ESTABLISHED'));
const fourFrames = namingSurface.blocks.find((block) => block.kind === 'four_frames');
assert.ok(fourFrames && fourFrames.kind === 'four_frames');
assert.equal(fourFrames.items.length, 4);
assertJsonData(naming);
assertInvalidDelivery(naming, 'HERO_DEPTH_REF', (value) => {
  const hero = value.surfaces[0].blocks.find((block: any) => block.kind === 'hero');
  delete value.interpretations.find(
    (interpretation: any) => interpretation.id === hero.interpretationRef,
  ).expert;
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
      timeline: { periods: ['today'], categories: ['overall'] },
      life: 'summary',
    }],
  },
});
(engine as any).getNamingReport = originalGetNamingReport;
(engine as any).getSpringReportFromSnapshot = originalGetSpringReportFromSnapshot;
assert.equal(saju.analysisId, integrated.analysisId, 'saju lazy chunk shares analysis ID');
const sajuSurface = findSurface(saju, 'saju')!;
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
assert.equal(highRiskCell?.ratingFactRef, undefined,
  'low-confidence natal evidence must not emit a fortune star rating');
assert.equal(highRiskDelivery.facts.some((fact) => fact.id === 'fortune.today.overall.stars'), false);
const highRiskCellInterpretation = highRiskDelivery.interpretations.find(
  (interpretation) => interpretation.id === highRiskCell?.interpretationRef,
);
assert.match(highRiskCellInterpretation?.brief.headline ?? '', /단정하지 않아요/u);
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
