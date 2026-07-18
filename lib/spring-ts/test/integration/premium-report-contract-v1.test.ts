import assert from 'node:assert/strict';
import {
  PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1,
  PREMIUM_REPORT_DELIVERY_SCHEMA_V1,
  PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  PREMIUM_REPORT_REFERENCE_SCHEMA_V1,
  REPORT_ENTITLEMENT_SCHEMA_V1,
  SERVICE_CATALOG_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
  PremiumContractValidationErrorV1,
  assertFreeReportPremiumBoundaryV1,
  assertPremiumReportAccessRequestV1,
  assertPremiumReportDeliveryV1,
  assertPremiumReportReferenceV1,
  assertPremiumReportReferenceForRegistrationDecisionV1,
  assertPremiumReportRegistrationRequestV1,
  assertReportEntitlementV1,
  assertServiceCatalogV1,
  createPremiumRegistrationMaterialDigestV1,
  evaluatePremiumReportRegistrationReplayV1,
  evaluatePremiumReportAccessV1,
  type PremiumReportAccessRequestV1,
  type PremiumReportBindingV1,
  type PremiumReportDeliveryV1,
  type PremiumReportReferenceV1,
  type PremiumReportRegistrationRequestV1,
  type ReportEntitlementV1,
  type ServiceCatalogV1,
} from '../../src/report/premium/index.js';
import { candidateIdFromNameIdentityV1 } from '../../src/experience/index.js';
import {
  REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  SpringEngine,
} from '../../src/index.js';

const now = '2026-07-18T10:00:00.000Z';
const binding: PremiumReportBindingV1 = {
  reportId: 'report_v1_0123456789abcdef',
  analysisId: 'server_analysis_v1_0123456789abcdef',
  candidateId: 'candidate_v1_b9210a79db1ac3be24948bc33caf46dc',
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  contentVersion: 'story-completion.2026-07.v1',
};
const principal = {
  kind: 'account' as const,
  subjectId: 'premium_owner_v1_0123456789abcdef',
};
const entitlement: ReportEntitlementV1 = {
  schemaVersion: REPORT_ENTITLEMENT_SCHEMA_V1,
  entitlementId: 'entitlement_v1_0123456789abcdef',
  authority: 'server',
  owner: principal,
  binding,
  status: 'active',
  grantSource: 'verified_payment',
  createdAt: now,
  updatedAt: now,
  activatedAt: now,
};
const report: PremiumReportReferenceV1 = {
  schemaVersion: PREMIUM_REPORT_REFERENCE_SCHEMA_V1,
  authority: 'server',
  registration: {
    requestId: 'premium_request_v1_report_0123456789abcdef',
    owner: principal,
    productId: binding.productId,
    candidateId: binding.candidateId,
    materialDigest: `sha256:${'0'.repeat(64)}`,
  },
  binding,
  status: 'registered',
  registeredAt: now,
  updatedAt: now,
};

const accessRequest: PremiumReportAccessRequestV1 = {
  schemaVersion: PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1,
  requestId: 'premium_request_v1_0123456789abcdef',
  entitlementId: entitlement.entitlementId,
  binding,
};

const registrationCandidateId = candidateIdFromNameIdentityV1({
  surnameHangul: '최',
  surnameHanja: '崔',
  givenHangul: '성수',
  givenHanja: '成秀',
});
const registrationRequest: PremiumReportRegistrationRequestV1 = {
  schemaVersion: PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  requestId: 'premium_request_v1_registration_0123456789abcdef',
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  localAnalysisId: 'analysis_v1_local_0123456789abcdef',
  candidateId: registrationCandidateId,
  analysisInput: {
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    targetDate: '2026-07-18',
  },
};
assert.doesNotThrow(() => assertPremiumReportRegistrationRequestV1(registrationRequest));
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
  const surname = [{ hangul: '\uAE40', hanja: '\u91D1' }];
  const candidateId = candidateIdFromNameIdentityV1({
    surnameHangul: surname.map((character) => character.hangul).join(''),
    surnameHanja: surname.map((character) => character.hanja).join(''),
    givenHangul: givenName.map((character) => character.hangul).join(''),
    givenHanja: givenName.map((character) => character.hanja).join(''),
  });
  assert.doesNotThrow(() => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    candidateId,
    analysisInput: { ...registrationRequest.analysisInput, surname, givenName },
  }), `explicit ${givenName.length}-syllable names remain eligible for paid recomputation`);
}
const pureHangulCandidateId = candidateIdFromNameIdentityV1({
  surnameHangul: '김', surnameHanja: '', givenHangul: '하늘', givenHanja: '',
});
assert.doesNotThrow(() => assertPremiumReportRegistrationRequestV1({
  ...registrationRequest,
  candidateId: pureHangulCandidateId,
  analysisInput: {
    ...registrationRequest.analysisInput,
    surname: [{ hangul: '김' }],
    givenName: [{ hangul: '하' }, { hangul: '늘' }],
  },
}), 'paid server recomputation accepts a complete pure-Hangul identity');
for (const [request, reason, label] of [
  [{
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수' }],
    },
  }, 'PARTIAL_HANJA_IDENTITY', 'partial-Hanja identity'],
  [{
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      options: { pureHangulNameMode: 'on' },
    },
  }, 'PURE_HANGUL_MODE_CONFLICT', 'pure-Hangul mode with explicit Hanja'],
  [{
    ...registrationRequest,
    candidateId: pureHangulCandidateId,
    analysisInput: {
      ...registrationRequest.analysisInput,
      surname: [{ hangul: '김' }],
      givenName: [{ hangul: '하' }, { hangul: '늘' }],
      options: { pureHangulNameMode: 'off' },
    },
  }, 'PURE_HANGUL_MODE_DISABLED', 'pure-Hangul identity with that mode disabled'],
] as const) {
  assert.throws(
    () => assertPremiumReportRegistrationRequestV1(request),
    (error: unknown) => error instanceof PremiumContractValidationErrorV1
      && error.reason === reason,
    `${label} must preserve a precise recoverable reason across the paid boundary`,
  );
}
const registrationDigest = await createPremiumRegistrationMaterialDigestV1(registrationRequest);
assert.match(registrationDigest, /^sha256:[a-f0-9]{64}$/u);
let untrustedGetterCalls = 0;
const accessorRegistrationRequest = structuredClone(registrationRequest) as Record<string, unknown>;
Object.defineProperty(accessorRegistrationRequest, 'candidateId', {
  enumerable: true,
  get() {
    untrustedGetterCalls += 1;
    return registrationCandidateId;
  },
});
await assert.rejects(
  createPremiumRegistrationMaterialDigestV1(accessorRegistrationRequest),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'registration digest rejects accessor-backed request data',
);
assert.equal(untrustedGetterCalls, 0,
  'registration digest snapshots descriptors before semantic validation and never executes getters');
const registrationReport: PremiumReportReferenceV1 = {
  ...report,
  registration: {
    requestId: registrationRequest.requestId,
    owner: principal,
    productId: registrationRequest.productId,
    candidateId: registrationRequest.candidateId,
    materialDigest: registrationDigest,
  },
  binding: { ...report.binding, candidateId: registrationCandidateId },
};
const registrationDecision = await evaluatePremiumReportRegistrationReplayV1({
  principal,
  request: registrationRequest,
  replay: { state: 'first_seen' },
});
assert.deepEqual(registrationDecision, {
  registration: 'allow',
  reasonCode: 'REGISTRATION_ACCEPTED',
  registrationMode: 'initial',
  authorization: {
    requestId: registrationRequest.requestId,
    owner: principal,
    productId: registrationRequest.productId,
    candidateId: registrationRequest.candidateId,
    materialDigest: registrationDigest,
  },
});
const mutableRegistrationInput = {
  principal: { ...principal },
  request: structuredClone(registrationRequest),
  replay: { state: 'first_seen' as const },
};
const pendingRegistrationDecision = evaluatePremiumReportRegistrationReplayV1(
  mutableRegistrationInput,
);
(mutableRegistrationInput.request as { candidateId: string }).candidateId =
  'candidate_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
(mutableRegistrationInput.principal as { subjectId: string }).subjectId =
  'premium_owner_v1_fedcba9876543210';
(mutableRegistrationInput.replay as { state: string }).state = 'conflicting_material_replay';
const isolatedRegistrationDecision = await pendingRegistrationDecision;
assert.equal(isolatedRegistrationDecision.registration, 'allow');
if (isolatedRegistrationDecision.registration === 'allow') {
  assert.equal(isolatedRegistrationDecision.authorization.candidateId, registrationRequest.candidateId);
  assert.equal(isolatedRegistrationDecision.authorization.owner.subjectId, principal.subjectId);
  assert.equal(isolatedRegistrationDecision.registrationMode, 'initial');
}
assert.doesNotThrow(() => assertPremiumReportReferenceForRegistrationDecisionV1(
  registrationReport,
  registrationDecision,
));
assert.throws(
  () => assertPremiumReportReferenceForRegistrationDecisionV1(
    {
      ...report,
      registration: {
        ...report.registration,
        candidateId: registrationRequest.candidateId,
      },
      binding: { ...report.binding, candidateId: registrationRequest.candidateId },
    },
    registrationDecision,
  ),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'same-name reports from another registration owner or birth input cannot be substituted',
);

const registrationReplayDecision = await evaluatePremiumReportRegistrationReplayV1({
  principal,
  request: registrationRequest,
  replay: {
    state: 'same_material_replay',
    materialDigest: registrationDigest,
    priorReport: registrationReport,
  },
});
assert.equal(registrationReplayDecision.registration, 'allow');
if (registrationReplayDecision.registration === 'allow') {
  assert.equal(registrationReplayDecision.registrationMode, 'idempotent_replay');
  assert.equal(
    registrationReplayDecision.priorReport.binding.reportId,
    registrationReport.binding.reportId,
  );
  assert.doesNotThrow(() => assertPremiumReportReferenceForRegistrationDecisionV1(
    registrationReport,
    registrationReplayDecision,
  ));
}

const changedBirthRegistration = {
  ...registrationRequest,
  analysisInput: {
    ...registrationRequest.analysisInput,
    birth: { ...registrationRequest.analysisInput.birth, minute: 46 },
  },
};
assert.deepEqual(await evaluatePremiumReportRegistrationReplayV1({
  principal,
  request: changedBirthRegistration,
  replay: {
    state: 'same_material_replay',
    materialDigest: registrationDigest,
    priorReport: registrationReport,
  },
}), {
  registration: 'deny',
  reasonCode: 'REGISTRATION_REPLAY_MISMATCH',
}, 'same requestId cannot be reused after any source analysis input changes');

const otherPrincipal = {
  ...principal,
  subjectId: 'premium_owner_v1_fedcba9876543210',
};
const otherOwnerDecision = await evaluatePremiumReportRegistrationReplayV1({
  principal: otherPrincipal,
  request: registrationRequest,
  replay: { state: 'first_seen' },
});
assert.equal(
  otherOwnerDecision.registration === 'allow'
    ? otherOwnerDecision.authorization.owner.subjectId
    : null,
  otherPrincipal.subjectId,
  'the idempotency namespace is scoped by authenticated owner as well as requestId',
);

const mismatchedPriorReport: PremiumReportReferenceV1 = {
  ...registrationReport,
  registration: {
    ...registrationReport.registration,
    candidateId: 'candidate_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  binding: {
    ...registrationReport.binding,
    candidateId: 'candidate_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
};
assert.deepEqual(await evaluatePremiumReportRegistrationReplayV1({
  principal,
  request: registrationRequest,
  replay: {
    state: 'same_material_replay',
    materialDigest: registrationDigest,
    priorReport: mismatchedPriorReport,
  },
}), {
  registration: 'deny',
  reasonCode: 'REGISTRATION_REFERENCE_MISMATCH',
}, 'a replay observation cannot mix the request digest with another report binding');
if (registrationReplayDecision.registration === 'allow') {
  assert.throws(
    () => assertPremiumReportReferenceForRegistrationDecisionV1(
      mismatchedPriorReport,
      registrationReplayDecision,
    ),
    (error: unknown) => error instanceof PremiumContractValidationErrorV1
      && error.reason === 'INVALID_REGISTRATION_REQUEST',
    'the downstream handler cannot substitute another report for the replay decision',
  );
}
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    candidateId: `candidate_v1_${'0'.repeat(32)}`,
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'paid transition must recompute candidate identity instead of trusting the local ID',
);
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: { ...registrationRequest.analysisInput, options: { limit: 20 } },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'pagination/display state must not enter the paid analysis identity',
);
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      options: { precisionConfig: { attackerControlledUnknownField: 'x'.repeat(1024) } },
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'nested analysis options must use an exact allowlist',
);
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      birth: { ...registrationRequest.analysisInput.birth, name: '불필요한 개인정보' },
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'display name must not cross the paid registration boundary',
);
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      birth: { gender: 'male' },
      targetDate: '2026-02-31',
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'paid registration requires a complete birth date and a real target date',
);
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      targetDate: '1986-04-18',
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'paid registration rejects a fortune horizon before birth before server recomputation',
);
const asciiCandidateId = candidateIdFromNameIdentityV1({
  surnameHangul: 'A', surnameHanja: '', givenHangul: 'B', givenHanja: '',
});
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    candidateId: asciiCandidateId,
    analysisInput: {
      ...registrationRequest.analysisInput,
      surname: [{ hangul: 'A' }],
      givenName: [{ hangul: 'B' }],
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'paid identity must use the same Hangul/Hanja syntax gate as the engine',
);
assert.doesNotThrow(() => assertPremiumReportRegistrationRequestV1({
  ...registrationRequest,
  analysisInput: {
    ...registrationRequest.analysisInput,
    options: {
      schoolPreset: 'naming_safe',
      sajuTimePolicy: { trueSolarTime: 'on', yaza: 'off' },
      precisionConfig: {
        nameElementStrategy: 'safeFallback',
        yongshinMode: 'consensus_aware',
        unknownTimeSajuDamp: 0.5,
      },
    },
  },
}), 'known bounded analysis options remain reproducible on the paid server');
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      options: { precisionConfig: { lunarConversionSource: 'builtin' } },
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'paid registration clients cannot select even the built-in conversion infrastructure',
);
assert.throws(
  () => assertPremiumReportRegistrationRequestV1({
    ...registrationRequest,
    analysisInput: {
      ...registrationRequest.analysisInput,
      options: { precisionConfig: { lunarConversionSource: 'kasi' } },
    },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_REGISTRATION_REQUEST',
  'untrusted clients cannot select paid-server KASI infrastructure',
);

const catalog: ServiceCatalogV1 = {
  schemaVersion: SERVICE_CATALOG_SCHEMA_V1,
  catalogVersion: 'catalog.2026-07.v1',
  generatedAt: now,
  products: [{
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    contentVersion: binding.contentVersion,
    displayName: '이야기 완성하기',
    availability: 'active',
    price: {
      amount: 1000,
      currency: 'KRW',
      authority: 'server_catalog',
      taxIncluded: true,
    },
  }],
};
assert.doesNotThrow(() => assertServiceCatalogV1(catalog));
assert.throws(
  () => assertServiceCatalogV1({
    ...catalog,
    products: [{ ...catalog.products[0], availability: ['active'] }],
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_CATALOG',
  'catalog enums must not accept array-to-string coercion',
);
assert.doesNotThrow(() => assertServiceCatalogV1({
  ...catalog,
  products: [{
    ...catalog.products[0],
    price: { ...catalog.products[0]!.price, amount: 1200 },
  }],
}), 'contract must not hardcode a product price in SpringEngine');
assert.doesNotThrow(() => assertReportEntitlementV1(entitlement));
assert.throws(
  () => assertReportEntitlementV1({ ...entitlement, grantSource: ['verified_payment'] }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_ENTITLEMENT',
  'entitlement enums must not accept array-to-string coercion',
);
assert.throws(
  () => assertPremiumReportReferenceV1({
    ...report,
    binding: { ...binding, analysisId: 'analysis_v1_local_0123456789abcdef' },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_ID',
  'a server report must not reuse the local engine-session analysis namespace',
);
assert.throws(
  () => assertReportEntitlementV1({
    ...entitlement,
    updatedAt: '2026-02-31T10:00:00.000Z',
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_TIMESTAMP',
  'timestamps must reject calendar rollover dates',
);
assert.doesNotThrow(() => assertPremiumReportAccessRequestV1(accessRequest));
const expectedAccessAuthorization = {
  requestId: accessRequest.requestId,
  entitlementId: accessRequest.entitlementId,
  owner: principal,
  binding,
};

const initialAccessDecision = evaluatePremiumReportAccessV1({
  principal,
  request: accessRequest,
  report,
  entitlement,
  replay: { state: 'first_seen' },
  now,
});
assert.deepEqual(initialAccessDecision, {
  access: 'allow',
  reasonCode: 'ACCESS_GRANTED',
  deliveryMode: 'initial',
  authorization: expectedAccessAuthorization,
});

const replayAccessDecision = evaluatePremiumReportAccessV1({
  principal,
  request: accessRequest,
  report,
  entitlement,
  replay: {
    state: 'same_binding_replay',
    priorDeliveryId: 'premium_delivery_v1_0123456789abcdef',
  },
  now,
});
assert.deepEqual(replayAccessDecision, {
  access: 'allow',
  reasonCode: 'IDEMPOTENT_REPLAY',
  deliveryMode: 'idempotent_replay',
  priorDeliveryId: 'premium_delivery_v1_0123456789abcdef',
  authorization: expectedAccessAuthorization,
});

assert.deepEqual(evaluatePremiumReportAccessV1({
  principal,
  request: accessRequest,
  report,
  entitlement,
  replay: { state: 'conflicting_binding_replay' },
  now,
}), {
  access: 'deny',
  reasonCode: 'REPLAY_BINDING_MISMATCH',
});

assert.deepEqual(evaluatePremiumReportAccessV1({
  principal,
  request: {
    ...accessRequest,
    binding: { ...binding, analysisId: 'server_analysis_v1_fedcba9876543210' },
  },
  report,
  entitlement,
  replay: { state: 'first_seen' },
  now,
}), {
  access: 'deny',
  reasonCode: 'ANALYSIS_ID_MISMATCH',
});

assert.deepEqual(evaluatePremiumReportAccessV1({
  principal,
  request: accessRequest,
  report,
  entitlement: { ...entitlement, status: 'refunded' },
  replay: { state: 'first_seen' },
  now,
}), {
  access: 'deny',
  reasonCode: 'ENTITLEMENT_REFUNDED',
});

assert.deepEqual(evaluatePremiumReportAccessV1({
  principal: { ...principal, subjectId: 'premium_owner_v1_fedcba9876543210' },
  request: accessRequest,
  report,
  entitlement,
  replay: { state: 'first_seen' },
  now,
}), {
  access: 'deny',
  reasonCode: 'REPORT_OWNER_MISMATCH',
});

assert.deepEqual(evaluatePremiumReportAccessV1({
  principal,
  request: accessRequest,
  report,
  entitlement: { ...entitlement, owner: otherPrincipal },
  replay: { state: 'first_seen' },
  now,
}), {
  access: 'deny',
  reasonCode: 'ENTITLEMENT_OWNER_MISMATCH',
}, 'a report owner cannot consume an entitlement issued to another owner');

const futureActivation = '2026-07-19T10:00:00.000Z';
const notYetActive = {
  ...entitlement,
  activatedAt: futureActivation,
  updatedAt: futureActivation,
};
assert.deepEqual(evaluatePremiumReportAccessV1({
  principal,
  request: accessRequest,
  report,
  entitlement: notYetActive,
  replay: { state: 'first_seen' },
  now,
}), {
  access: 'deny',
  reasonCode: 'ENTITLEMENT_NOT_ACTIVE',
});

assert.throws(
  () => evaluatePremiumReportAccessV1({
    principal,
    request: accessRequest,
    report,
    entitlement,
    replay: { state: 'not_a_server_state' } as never,
    now,
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_ACCESS_REQUEST',
  'unrecognized replay claims must fail closed',
);

assert.throws(
  () => assertPremiumReportAccessRequestV1({
    ...accessRequest,
    isUnlocked: true,
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_ACCESS_REQUEST',
  'client unlock flags must be rejected as unknown authority claims',
);

const delivery: PremiumReportDeliveryV1 = {
  schemaVersion: PREMIUM_REPORT_DELIVERY_SCHEMA_V1,
  deliveryId: 'premium_delivery_v1_0123456789abcdef',
  binding,
  entitlement: {
    entitlementId: entitlement.entitlementId,
    status: 'active',
  },
  deliveryMode: 'initial',
  deliveredAt: now,
  premiumContent: {
    kind: 'story_completion',
    format: 'structured_plain_text_v1',
    title: '이야기 완성하기',
    summary: '사주와 이름의 관계를 하나의 이야기로 정리합니다.',
    sections: [{
      id: 'opening',
      title: '타고난 기운과 불리는 기운',
      body: '서로 다른 두 기운이 어떤 방식으로 보완되는지 설명합니다.',
      evidenceRefs: ['fact.name-elements', 'fact.saju-elements'],
    }],
  },
};
const deliveryValidationContext = {
  entitlement,
  allowedEvidenceRefs: ['fact.name-elements', 'fact.saju-elements'],
  accessDecision: initialAccessDecision,
};
assert.doesNotThrow(() => assertPremiumReportDeliveryV1(delivery, deliveryValidationContext));
assert.throws(
  () => assertPremiumReportDeliveryV1({
    ...delivery,
    premiumContent: {
      ...delivery.premiumContent,
      sections: [{
        id: 'ungrounded',
        title: '근거 없는 섹션',
        body: '서버 재계산 근거를 하나도 참조하지 않습니다.',
      }],
    },
  }, deliveryValidationContext),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'every paid narrative section must be grounded in server-recomputed evidence',
);
assert.throws(
  () => assertPremiumReportDeliveryV1(delivery, {
    ...deliveryValidationContext,
    allowedEvidenceRefs: [],
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'a paid report cannot pass with zero server-recomputed evidence',
);
const otherBinding: PremiumReportBindingV1 = {
  ...binding,
  reportId: 'report_v1_fedcba9876543210',
  analysisId: 'server_analysis_v1_fedcba9876543210',
  candidateId: 'candidate_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};
const otherEntitlement: ReportEntitlementV1 = {
  ...entitlement,
  entitlementId: 'entitlement_v1_fedcba9876543210',
  owner: { ...principal, subjectId: 'premium_owner_v1_fedcba9876543210' },
  binding: otherBinding,
};
assert.throws(
  () => assertPremiumReportDeliveryV1({
    ...delivery,
    binding: otherBinding,
    entitlement: {
      entitlementId: otherEntitlement.entitlementId,
      status: 'active',
    },
  }, {
    ...deliveryValidationContext,
    entitlement: otherEntitlement,
    accessDecision: initialAccessDecision,
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'an allow decision cannot be mixed into a different owner/report entitlement context',
);
assert.throws(
  () => (assertPremiumReportDeliveryV1 as (value: unknown) => void)(delivery),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'paid delivery validation must never run without trusted entitlement/evidence context',
);
assert.throws(
  () => assertPremiumReportDeliveryV1({
    ...delivery,
    binding: { ...binding, candidateId: 'candidate_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  }, deliveryValidationContext),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'paid delivery must remain bound to the entitled candidate',
);
assert.throws(
  () => assertPremiumReportDeliveryV1(delivery, {
    ...deliveryValidationContext,
    entitlement: notYetActive,
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'paid content cannot be delivered before entitlement activation',
);
assert.throws(
  () => assertPremiumReportDeliveryV1({
    ...delivery,
    premiumContent: {
      ...delivery.premiumContent,
      sections: [{
        ...delivery.premiumContent.sections[0]!,
        evidenceRefs: ['fact.name-elements', 'fact.name-elements'],
      }],
    },
  }, deliveryValidationContext),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'DUPLICATE_VALUE',
  'duplicate evidence references must fail closed',
);
assert.throws(
  () => assertPremiumReportDeliveryV1({
    ...delivery,
    premiumContent: {
      ...delivery.premiumContent,
      sections: [{
        ...delivery.premiumContent.sections[0]!,
        evidenceRefs: ['fact.not-in-registered-analysis'],
      }],
    },
  }, deliveryValidationContext),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'dangling evidence references must fail closed',
);
const replayDelivery: PremiumReportDeliveryV1 = {
  ...delivery,
  deliveryId: replayAccessDecision.access === 'allow'
    ? replayAccessDecision.priorDeliveryId!
    : delivery.deliveryId,
  deliveryMode: 'idempotent_replay',
};
const replayDeliveryContext = {
  ...deliveryValidationContext,
  accessDecision: replayAccessDecision,
};
assert.doesNotThrow(
  () => assertPremiumReportDeliveryV1(replayDelivery, replayDeliveryContext),
  'an idempotent replay returns the exact prior delivery identity',
);
assert.throws(
  () => assertPremiumReportDeliveryV1({
    ...replayDelivery,
    deliveryId: 'premium_delivery_v1_fedcba9876543210',
  }, replayDeliveryContext),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'a replay cannot mint a second delivery identity',
);
assert.throws(
  () => assertPremiumReportDeliveryV1(delivery, replayDeliveryContext),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'INVALID_DELIVERY',
  'delivery mode must match the trusted access decision',
);

const freeEngine = new SpringEngine();
const freeDelivery = await freeEngine.getReportDelivery({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'saju', depth: 'brief' }],
  },
});
assert.doesNotThrow(() => assertFreeReportPremiumBoundaryV1(freeDelivery));
freeEngine.close();
assert.throws(
  () => assertFreeReportPremiumBoundaryV1({
    schemaVersion: 'spring-ts.report-delivery.v1',
    premiumContent: delivery.premiumContent,
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'FREE_DELIVERY_PREMIUM_LEAK',
  'free delivery must never embed paid content',
);
assert.throws(
  () => assertFreeReportPremiumBoundaryV1({
    ...freeDelivery,
    premiumStory: { body: 'paid body hidden behind an unknown key' },
  }),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'FREE_DELIVERY_PREMIUM_LEAK',
  'unknown premium-shaped fields must be rejected by the full free DTO schema',
);
const cyclicFreePayload: Record<string, unknown> = {};
cyclicFreePayload.self = cyclicFreePayload;
assert.throws(
  () => assertFreeReportPremiumBoundaryV1(cyclicFreePayload),
  (error: unknown) => error instanceof PremiumContractValidationErrorV1
    && error.reason === 'FREE_DELIVERY_PREMIUM_LEAK',
  'cyclic untrusted payloads fail as a contract error instead of overflowing the stack',
);

console.log('premium-report-contract-v1: PASS');
