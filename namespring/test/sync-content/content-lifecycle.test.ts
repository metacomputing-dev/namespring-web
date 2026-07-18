import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type {
  ContentArtifactV1,
  ContentAudienceV1,
  RegisterContentArtifactRequestV1,
} from "../../shared/types/content-lifecycle.js";
import {
  CONTENT_ADMIN_LIST_RESPONSE_MAX_BYTES,
  ContentLifecycleServiceV1,
} from "../../api/_lib/content-service.js";
import {
  CONTENT_ACTIVATION_RECEIPT_INLINE_LIMIT_V1,
  InMemoryContentRepositoryV1,
  type ContentRepositoryV1,
} from "../../api/_lib/content-repository.js";
import { parseStageContentBatchRequest } from "../../api/_lib/content-staging.js";
import {
  parseApproveContentArtifactRequest,
  parseEmptyContentAdminRequest,
  parseFinalizeLocalContentExportRequest,
  parseListContentArtifactsRequest,
  parseLocalContentExportPageRequest,
  parseRegisterContentArtifactRequest,
  contentGateAttestationMaterial,
  sha256Digest,
} from "../../api/_lib/content-validation.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import {
  assertContentAuditHmacKeyringV1,
  contentAuditPrivacyFieldsV1,
  parseContentAuditHmacKeyringV1,
} from "../../api/_lib/content-audit-privacy.js";

const actor = { userId: "user_admin", sessionId: "sess_test" };
const reviewer = { userId: "user_reviewer", sessionId: "sess_reviewer" };
const approver = { userId: "user_approver", sessionId: "sess_approver" };
const clock = { now: () => new Date("2026-07-18T12:00:00.000Z") };
const digest = (value: unknown) => sha256Digest(value);
const TEST_GATE_KEY_ID = "test-ci-2026-07";
const TEST_GATE_SECRET = "test-only-content-attestation-secret-32-bytes-minimum";
const TEST_AUDIT_KEY_ID = "test-2026-07";
const TEST_AUDIT_SECRET = "test-only-content-audit-secret-2026-07-minimum-32-bytes";
const TEST_AUDIT_KEYRING = assertContentAuditHmacKeyringV1({
  currentKeyId: TEST_AUDIT_KEY_ID,
  keys: { [TEST_AUDIT_KEY_ID]: TEST_AUDIT_SECRET },
});
const TEST_AUDIT_SUBJECT_PATTERN = /^hmac-sha256:v1:test-2026-07:[a-f0-9]{64}$/u;
process.env.CONTENT_AUDIT_HMAC_KEYRING_JSON = JSON.stringify(TEST_AUDIT_KEYRING);
process.env.CONTENT_GATE_ATTESTATION_KEYRING_JSON = JSON.stringify({
  [TEST_GATE_KEY_ID]: TEST_GATE_SECRET,
});

test("admin content listing bounds aggregate response bytes without skipping cursor entries", async () => {
  const largeArtifact = (artifactId: string): ContentArtifactV1 => ({
    schemaVersion: "namespring.content-artifact.v1",
    artifactId,
    channel: { contentKey: artifactId, kind: "other", audience: "free_local", locale: "ko-KR" },
    version: "v1",
    lifecycle: "draft",
    revision: 1,
    contentDigest: digest({ artifactId }),
    payload: {
      schemaVersion: "namespring.other-draft.v1",
      data: { chunks: Array.from({ length: 4 }, () => "x".repeat(100_000)) },
    },
    provenance: {
      source: {
        sourceKind: "bulk_json_staging",
        sourceId: `source:${artifactId}`,
        sourceVersion: "v1",
        sourceDigest: digest({ source: artifactId }),
        importedAt: "2026-07-18T11:00:00.000Z",
      },
      gate: {
        gateVersion: "v1",
        decision: "passed",
        checkedAt: "2026-07-18T11:30:00.000Z",
        resultDigest: digest({ gate: artifactId }),
      },
    },
    registeredAt: "2026-07-18T12:00:00.000Z",
    registeredBy: `hmac-sha256:v1:test:${"a".repeat(64)}`,
    activations: [],
  } as unknown as ContentArtifactV1);
  const allArtifacts = ["artifact-a", "artifact-b", "artifact-c", "artifact-d"].map(largeArtifact);
  const repository = {
    listArtifacts: async (_lifecycle: string, afterArtifactId: string | undefined, limit: number) => {
      const matches = allArtifacts.filter((artifact) => !afterArtifactId || artifact.artifactId > afterArtifactId);
      const artifacts = matches.slice(0, limit);
      return {
        artifacts,
        nextCursor: matches.length > limit ? (artifacts.at(-1)?.artifactId ?? null) : null,
      };
    },
  } as unknown as ContentRepositoryV1;
  const service = new ContentLifecycleServiceV1(repository, clock, TEST_AUDIT_KEYRING);

  const first = await service.listArtifactsForAdmin({ lifecycle: "draft", limit: 10 });
  assert.deepEqual(first.artifacts.map((artifact) => artifact.artifactId), ["artifact-a", "artifact-b", "artifact-c"]);
  assert.equal(first.nextCursor, "artifact-c");
  assert.ok(Buffer.byteLength(JSON.stringify(first), "utf8") <= CONTENT_ADMIN_LIST_RESPONSE_MAX_BYTES);

  const second = await service.listArtifactsForAdmin({
    lifecycle: "draft",
    afterArtifactId: first.nextCursor ?? undefined,
    limit: 10,
  });
  assert.deepEqual(second.artifacts.map((artifact) => artifact.artifactId), ["artifact-d"]);
  assert.equal(second.nextCursor, null);
});

test("admin content listing accepts only an integer JSON number limit", () => {
  assert.deepEqual(parseListContentArtifactsRequest({ lifecycle: "draft", limit: 3 }), {
    lifecycle: "draft",
    limit: 3,
  });
  for (const limit of ["3", true, 3.5]) {
    assert.throws(
      () => parseListContentArtifactsRequest({ lifecycle: "draft", limit }),
      (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_CONTENT_REQUEST",
    );
  }
});

test("content admin cursors, revisions, and counts reject numeric coercion", () => {
  const digestValue = digest({ manifest: true });
  const calls = [
    () => parseApproveContentArtifactRequest({
      requestId: "request-1",
      artifactId: "artifact-1",
      expectedRevision: "1",
    }),
    () => parseLocalContentExportPageRequest({
      exportId: "export-1",
      cursor: { chunkIndex: "0", offset: 0 },
    }),
    () => parseFinalizeLocalContentExportRequest({
      exportId: "export-1",
      observedArtifactCount: true,
      observedAssetSetDigest: digestValue,
    }),
  ];
  for (const call of calls) {
    assert.throws(
      call,
      (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_CONTENT_REQUEST",
    );
  }
});

test("content export HTTP cursor parser accepts the reviewed chunk bounds and fails closed beyond them", () => {
  for (const cursor of [
    { chunkIndex: 0, offset: 25 },
    { chunkIndex: 249, offset: 99 },
  ]) {
    assert.deepEqual(
      parseLocalContentExportPageRequest({ exportId: "export-1", cursor }),
      { exportId: "export-1", cursor },
    );
  }
  for (const cursor of [
    { chunkIndex: 0, offset: 100 },
    { chunkIndex: 250, offset: 0 },
    { chunkIndex: Number.MAX_SAFE_INTEGER + 1, offset: 0 },
    { chunkIndex: 0, offset: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.throws(
      () => parseLocalContentExportPageRequest({ exportId: "export-1", cursor }),
      (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_CONTENT_REQUEST",
    );
  }
});

test("content export session creation requires an exact empty JSON object", () => {
  assert.equal(parseEmptyContentAdminRequest({}), undefined);
  for (const body of [undefined, null, [], { ignored: true }]) {
    assert.throws(
      () => parseEmptyContentAdminRequest(body),
      (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_CONTENT_REQUEST",
    );
  }
});

test("content audit pseudonyms preserve correlation without retaining raw actor/session IDs", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock, TEST_AUDIT_KEYRING);
  await service.register(actor, registration("artifact-audit-privacy"));

  const audit = repository.audits[0];
  assert.ok(audit);
  assert.match(audit.actorSubject, TEST_AUDIT_SUBJECT_PATTERN);
  assert.match(audit.sessionSubject, TEST_AUDIT_SUBJECT_PATTERN);
  assert.notEqual(audit.actorSubject, audit.sessionSubject);
  assert.equal(audit.deleteAfter, "2027-07-18T12:00:00.000Z");
  assert.equal(JSON.stringify(audit).includes(actor.userId), false);
  assert.equal(JSON.stringify(audit).includes(actor.sessionId), false);

  await service.review(reviewer, {
    requestId: "review:artifact-audit-privacy",
    artifactId: "artifact-audit-privacy",
    expectedRevision: 1,
    notesDigest: digest({ privacy: "review" }),
  });
  await service.approve(approver, {
    requestId: "approve:artifact-audit-privacy",
    artifactId: "artifact-audit-privacy",
    expectedRevision: 2,
  });
  await service.activate(approver, {
    requestId: "activate:artifact-audit-privacy",
    artifactId: "artifact-audit-privacy",
    expectedRevision: 3,
    reason: "privacy contract verification",
  });
  await service.retire(actor, {
    requestId: "retire:artifact-audit-privacy",
    artifactId: "artifact-audit-privacy",
    expectedRevision: 4,
    reason: "privacy contract verification complete",
  });
  const governedArtifact = repository.peekArtifact("artifact-audit-privacy");
  assert.ok(governedArtifact);
  assert.match(governedArtifact.registeredBy, TEST_AUDIT_SUBJECT_PATTERN);
  assert.match(governedArtifact.review?.reviewerId ?? "", TEST_AUDIT_SUBJECT_PATTERN);
  assert.match(governedArtifact.approval?.approverId ?? "", TEST_AUDIT_SUBJECT_PATTERN);
  assert.match(governedArtifact.activations[0]?.activatedBy ?? "", TEST_AUDIT_SUBJECT_PATTERN);
  assert.match(governedArtifact.retirement?.retiredBy ?? "", TEST_AUDIT_SUBJECT_PATTERN);
  const persistedContent = JSON.stringify({ artifact: governedArtifact, audits: repository.audits });
  for (const rawIdentifier of [
    actor.userId,
    actor.sessionId,
    reviewer.userId,
    reviewer.sessionId,
    approver.userId,
    approver.sessionId,
  ]) {
    assert.equal(persistedContent.includes(rawIdentifier), false);
  }

  const repeated = contentAuditPrivacyFieldsV1(actor, "2026-07-19T12:00:00.000Z", TEST_AUDIT_KEYRING);
  assert.equal(repeated.actorSubject, audit.actorSubject);
  assert.equal(repeated.sessionSubject, audit.sessionSubject);
  assert.throws(
    () => assertContentAuditHmacKeyringV1(TEST_AUDIT_KEYRING, [TEST_AUDIT_SECRET]),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_AUDIT_KEY_REUSE",
  );
});

test("content audit keyring is bounded, exact, and rejects unsafe rotation material", () => {
  assert.throws(
    () => parseContentAuditHmacKeyringV1("not-json"),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_AUDIT_KEYRING_INVALID",
  );
  assert.throws(
    () => assertContentAuditHmacKeyringV1({ currentKeyId: "missing", keys: { retained: TEST_AUDIT_SECRET } }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_AUDIT_CURRENT_KEY_MISSING",
  );
  assert.throws(
    () => assertContentAuditHmacKeyringV1({
      currentKeyId: "one",
      keys: { one: TEST_AUDIT_SECRET, two: TEST_AUDIT_SECRET },
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_AUDIT_KEYRING_DUPLICATE_SECRET",
  );
  const oversizedKeys = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [
    `key-${index}`,
    `test-only-audit-secret-${index}-with-at-least-thirty-two-bytes`,
  ]));
  assert.throws(
    () => assertContentAuditHmacKeyringV1({ currentKeyId: "key-0", keys: oversizedKeys }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_AUDIT_KEYRING_SIZE_INVALID",
  );
});

test("four-eyes remains fail-closed when the current content audit key rotates", async () => {
  const oldKeyId = "test-2026-06";
  const oldSecret = "test-only-content-audit-secret-2026-06-minimum-32-bytes";
  const oldKeyring = assertContentAuditHmacKeyringV1({
    currentKeyId: oldKeyId,
    keys: { [oldKeyId]: oldSecret },
  });
  const rotatedKeyring = assertContentAuditHmacKeyringV1({
    currentKeyId: TEST_AUDIT_KEY_ID,
    keys: { [oldKeyId]: oldSecret, [TEST_AUDIT_KEY_ID]: TEST_AUDIT_SECRET },
  });
  const repository = new InMemoryContentRepositoryV1();
  const oldService = new ContentLifecycleServiceV1(repository, clock, oldKeyring);
  const request = registration("artifact-audit-rotation");
  await oldService.register(actor, request);
  const reviewRequest = {
    requestId: "review:artifact-audit-rotation",
    artifactId: request.artifactId,
    expectedRevision: 1,
    notesDigest: digest({ rotation: "old-key-review" }),
  } as const;
  await oldService.review(reviewer, reviewRequest);

  const rotatedService = new ContentLifecycleServiceV1(repository, clock, rotatedKeyring);
  const replay = await rotatedService.review(reviewer, reviewRequest);
  assert.equal(replay.operation, "idempotent_replay");
  await assert.rejects(
    rotatedService.approve(reviewer, {
      requestId: "approve:self-after-rotation",
      artifactId: request.artifactId,
      expectedRevision: 2,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_SEPARATION_OF_DUTIES_REQUIRED",
  );
  await rotatedService.approve(approver, {
    requestId: "approve:other-after-rotation",
    artifactId: request.artifactId,
    expectedRevision: 2,
  });
  const artifact = repository.peekArtifact(request.artifactId);
  assert.match(artifact?.review?.reviewerId ?? "", /^hmac-sha256:v1:test-2026-06:[a-f0-9]{64}$/u);
  assert.match(artifact?.approval?.approverId ?? "", TEST_AUDIT_SUBJECT_PATTERN);
});

test("removing a referenced content audit key freezes mutations until explicit migration", async () => {
  const oldKeyId = "test-2026-05";
  const oldSecret = "test-only-content-audit-secret-2026-05-minimum-32-bytes";
  const repository = new InMemoryContentRepositoryV1();
  const oldService = new ContentLifecycleServiceV1(repository, clock, assertContentAuditHmacKeyringV1({
    currentKeyId: oldKeyId,
    keys: { [oldKeyId]: oldSecret },
  }));
  const request = registration("artifact-audit-key-removal");
  await oldService.register(actor, request);
  await oldService.review(reviewer, {
    requestId: "review:artifact-audit-key-removal",
    artifactId: request.artifactId,
    expectedRevision: 1,
    notesDigest: digest({ rotation: "must-retain" }),
  });

  const removedOldKeyService = new ContentLifecycleServiceV1(repository, clock, TEST_AUDIT_KEYRING);
  await assert.rejects(
    removedOldKeyService.approve(approver, {
      requestId: "approve:after-key-removal",
      artifactId: request.artifactId,
      expectedRevision: 2,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_AUDIT_KEY_NOT_RETAINED",
  );
  const unchanged = repository.peekArtifact(request.artifactId);
  assert.equal(unchanged?.lifecycle, "reviewed");
  assert.equal(unchanged?.revision, 2);
  assert.equal(unchanged?.approval, undefined);
});

function registration(
  artifactId: string,
  audience: ContentAudienceV1 = "free_local",
  gateDecision: "passed" | "failed" = "passed",
  largeBody = false,
): RegisterContentArtifactRequestV1 {
  const payload = {
    schemaVersion: "namespring.fortune-bundle.v1" as const,
    summary: `검수 가능한 콘텐츠 요약 ${artifactId}`,
    hook: "오늘 바로 이해할 수 있는 핵심 흐름입니다.",
    sections: largeBody
      ? Array.from({ length: 3 }, (_, index) => ({
          id: `large-${index}`,
          body: `근거 ${index} ${"가".repeat(4_000)}`,
        }))
      : [{ id: "one", body: "근거와 해석을 함께 담은 검수 대상 본문입니다." }],
    tips: ["오늘 실천할 한 가지를 정해 기록해 보세요."],
    cautions: ["근거가 확인되지 않은 큰 결정은 잠시 미루세요."],
  };
  const contentDigest = digest(payload);
  const gateVersion = "v4";
  const checkedAt = "2026-07-18T11:30:00.000Z";
  const resultDigest = digest({ gateDecision });
  const unsignedAttestation = {
    attestationId: `gate:${artifactId}`,
    runner: "trusted_ci" as const,
    keyId: TEST_GATE_KEY_ID,
    subjectContentDigest: contentDigest,
    policyDigest: digest({ policy: "commercial-readable-v1" }),
  };
  const signature = `hmac-sha256:${createHmac("sha256", TEST_GATE_SECRET)
    .update(contentGateAttestationMaterial({
      ...unsignedAttestation,
      gateVersion,
      decision: gateDecision,
      checkedAt,
      resultDigest,
    }), "utf8")
    .digest("hex")}` as const;
  return {
    requestId: `register:${artifactId}`,
    artifactId,
    channel: { contentKey: "overall.today.adult", kind: "fortune_bundle", audience, locale: "ko-KR" },
    version: `v-${artifactId}`,
    payload,
    contentDigest,
    provenance: {
      source: {
        sourceKind: "bulk_json_staging",
        sourceId: `source:${artifactId}`,
        sourceVersion: "v1",
        sourceDigest: digest({ artifactId }),
        importedAt: "2026-07-18T11:00:00.000Z",
      },
      generation: {
        provider: "openai",
        modelId: "model-test",
        modelVersion: "2026-07-18",
        generatedAt: "2026-07-18T10:00:00.000Z",
      },
      prompt: {
        promptId: "bundle-base",
        promptVersion: "v3",
        promptDigest: digest({ prompt: 3 }),
      },
      gate: {
        gateVersion,
        decision: gateDecision,
        checkedAt,
        resultDigest,
        ...(gateDecision === "passed"
          ? { attestation: { ...unsignedAttestation, signature } }
          : {}),
      },
    },
  };
}

async function advanceToActive(
  service: ContentLifecycleServiceV1,
  request: RegisterContentArtifactRequestV1,
) {
  await service.register(actor, request);
  await service.review(reviewer, {
    requestId: `review:${request.artifactId}`,
    artifactId: request.artifactId,
    expectedRevision: 1,
    notesDigest: digest({ reviewed: request.artifactId }),
  });
  await service.approve(approver, {
    requestId: `approve:${request.artifactId}`,
    artifactId: request.artifactId,
    expectedRevision: 2,
  });
  return service.activate(approver, {
    requestId: `activate:${request.artifactId}`,
    artifactId: request.artifactId,
    expectedRevision: 3,
    reason: "human-approved release",
  });
}

test("bulk JSON remains draft and cannot serve/export before gate + human review + approval", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const staged = registration("artifact-draft");
  const response = await service.register(actor, staged);
  assert.equal(response.artifact.lifecycle, "draft");
  assert.equal(await repository.getActive(staged.channel), null);
  await assert.rejects(
    service.activate(actor, {
      requestId: "activate-too-soon",
      artifactId: staged.artifactId,
      expectedRevision: 1,
      reason: "must fail",
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_CONTENT_TRANSITION",
  );
  await assert.rejects(
    service.createLocalExportSession(actor),
    (error: unknown) => error instanceof ApiHttpError && error.code === "NO_ACTIVE_LOCAL_CONTENT",
  );
});

test("failed quality gate cannot be converted into a human-reviewed artifact", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  await service.register(actor, registration("artifact-gate-failed", "free_local", "failed"));
  await assert.rejects(
    service.review(actor, {
      requestId: "review-gate-failed",
      artifactId: "artifact-gate-failed",
      expectedRevision: 1,
      notesDigest: digest({ notes: "no" }),
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_GATE_NOT_PASSED",
  );
});

test("content registration rejects malformed schemas and markup before persistence", () => {
  const valid = registration("artifact-schema");
  assert.throws(
    () => parseRegisterContentArtifactRequest({
      ...valid,
      payload: { ...valid.payload, hook: "<script>alert(1)</script>" },
      contentDigest: digest({ ...valid.payload, hook: "<script>alert(1)</script>" }),
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "UNSAFE_CONTENT_TEXT",
  );
  assert.throws(
    () => parseRegisterContentArtifactRequest({
      ...valid,
      payload: { summary: "스키마 버전과 필수 구조가 없는 콘텐츠입니다." },
      contentDigest: digest({ summary: "스키마 버전과 필수 구조가 없는 콘텐츠입니다." }),
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_CONTENT_REQUEST",
  );
  const { attestation: _attestation, ...unsignedGate } = valid.provenance.gate;
  assert.throws(
    () => parseRegisterContentArtifactRequest({
      ...valid,
      provenance: { ...valid.provenance, gate: unsignedGate },
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_GATE_ATTESTATION_REQUIRED",
  );
  assert.ok(valid.provenance.gate.attestation);
  const signature = valid.provenance.gate.attestation.signature;
  const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
  assert.throws(
    () => parseRegisterContentArtifactRequest({
      ...valid,
      provenance: {
        ...valid.provenance,
        gate: {
          ...valid.provenance.gate,
          attestation: { ...valid.provenance.gate.attestation, signature: tamperedSignature },
        },
      },
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_ATTESTATION_SIGNATURE_INVALID",
  );
});

test("reviewer cannot self-approve and staging-only other content cannot activate", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const request = registration("artifact-four-eyes");
  await service.register(actor, request);
  await service.review(reviewer, {
    requestId: "review:four-eyes",
    artifactId: request.artifactId,
    expectedRevision: 1,
    notesDigest: digest({ reviewed: true }),
  });
  await assert.rejects(
    service.approve(reviewer, {
      requestId: "approve:self",
      artifactId: request.artifactId,
      expectedRevision: 2,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_SEPARATION_OF_DUTIES_REQUIRED",
  );

  const otherPayload = {
    schemaVersion: "namespring.other-draft.v1" as const,
    data: { migrationNote: "수동 매핑 전 임시 보관 자료입니다." },
  };
  const otherContentDigest = digest(otherPayload);
  const otherBase = registration("artifact-other");
  assert.ok(otherBase.provenance.gate.attestation);
  const { signature: _previousSignature, ...otherBaseAttestation } = otherBase.provenance.gate.attestation;
  const otherUnsignedAttestation = {
    ...otherBaseAttestation,
    subjectContentDigest: otherContentDigest,
  };
  const otherGate = {
    ...otherBase.provenance.gate,
    attestation: {
      ...otherUnsignedAttestation,
      signature: `hmac-sha256:${createHmac("sha256", TEST_GATE_SECRET)
        .update(contentGateAttestationMaterial({
          ...otherUnsignedAttestation,
          gateVersion: otherBase.provenance.gate.gateVersion,
          decision: otherBase.provenance.gate.decision,
          checkedAt: otherBase.provenance.gate.checkedAt,
          resultDigest: otherBase.provenance.gate.resultDigest,
        }), "utf8")
        .digest("hex")}` as const,
    },
  };
  const other = {
    ...otherBase,
    channel: {
      contentKey: "migration.unmapped.one",
      kind: "other" as const,
      audience: "free_local" as const,
      locale: "ko-KR" as const,
    },
    payload: otherPayload,
    contentDigest: otherContentDigest,
    provenance: { ...otherBase.provenance, gate: otherGate },
  };
  await service.register(actor, other);
  await service.review(reviewer, {
    requestId: "review:other",
    artifactId: other.artifactId,
    expectedRevision: 1,
    notesDigest: digest({ reviewed: true }),
  });
  await service.approve(approver, {
    requestId: "approve:other",
    artifactId: other.artifactId,
    expectedRevision: 2,
  });
  await assert.rejects(
    service.activate(approver, {
      requestId: "activate:other",
      artifactId: other.artifactId,
      expectedRevision: 3,
      reason: "must remain staging-only",
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_KIND_NOT_DELIVERABLE",
  );
});

test("approved active content exports through a bounded digest-bound session while drafts stay excluded", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const active = registration("artifact-active");
  await advanceToActive(service, active);
  await service.register(actor, registration("artifact-still-draft"));

  const session = await service.createLocalExportSession(actor);
  assert.equal(session.runtimeBoundary, "authenticated_build_pipeline_only");
  assert.equal(session.artifactCount, 1);
  assert.equal(session.maxPageItems, 100);
  assert.equal(session.maxPageBytes, 1_500_000);
  await assert.rejects(
    service.finalizeLocalExport(actor, {
      exportId: session.exportId,
      observedArtifactCount: session.artifactCount,
      observedAssetSetDigest: session.assetSetDigest,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_DELIVERY_INCOMPLETE",
  );
  await assert.rejects(
    service.getLocalExportPage({ userId: "user_other_admin", sessionId: "sess_other" }, {
      exportId: session.exportId,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND",
  );
  const page = await service.getLocalExportPage(actor, { exportId: session.exportId });
  assert.equal(page.nextCursor, null);
  assert.deepEqual(page.artifacts.map((item) => item.entry.artifactId), ["artifact-active"]);
  assert.deepEqual(page.artifacts[0]?.payload, active.payload);
  assert.equal(page.artifacts[0]?.entry.contentDigest, digest(page.artifacts[0]?.payload));
  const replay = await service.getLocalExportPage(actor, { exportId: session.exportId });
  assert.equal(replay.pageDigest, page.pageDigest, "same-cursor retry must be idempotent after progress commit");
  const observedEntries = page.artifacts.map((item) => item.entry);
  assert.equal(digest(observedEntries), session.assetSetDigest);
  const completion = await service.finalizeLocalExport(actor, {
    exportId: session.exportId,
    observedArtifactCount: observedEntries.length,
    observedAssetSetDigest: digest(observedEntries),
  });
  assert.equal(completion.catalogRevision, session.catalogRevision);
  assert.equal(completion.publishGate, "recheck_immediately_before_asset_publication");
  assert.equal(repository.audits.at(-1)?.action, "local_export.finalized");
});

test("in-memory export progress rejects malformed timestamps and cursor skips like Firestore", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock, TEST_AUDIT_KEYRING);
  await advanceToActive(service, registration("artifact-progress-parity"));
  const session = await service.createLocalExportSession(actor);
  const requesterSubjects = contentAuditPrivacyFieldsV1(
    actor,
    clock.now().toISOString(),
    TEST_AUDIT_KEYRING,
  ).actorSubjects;
  const common = {
    exportId: session.exportId,
    catalogRevision: session.catalogRevision,
    requestCursor: { chunkIndex: 0, offset: 0 },
    pageDigest: digest({ page: "progress-parity" }),
    pageArtifactCount: 1,
    requesterSubjects,
  } as const;

  await assert.rejects(
    repository.recordLocalExportPageDelivery({
      ...common,
      nextCursor: null,
      occurredAt: "2026-07-18T12:00:00Z",
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_DELIVERY_INPUT_INVALID",
  );
  await assert.rejects(
    repository.recordLocalExportPageDelivery({
      ...common,
      nextCursor: { chunkIndex: 2, offset: 0 },
      occurredAt: clock.now().toISOString(),
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_DELIVERY_INPUT_INVALID",
  );

  const page = await service.getLocalExportPage(actor, { exportId: session.exportId });
  assert.equal(page.nextCursor, null, "invalid progress writes must not mutate the delivery fence");
});

test("export response stops below 1.5 MiB and resumes inside a 100-item metadata chunk", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  for (let index = 0; index < 100; index += 1) {
    const request = registration(`artifact-large-${String(index).padStart(3, "0")}`, "free_local", "passed", true);
    await advanceToActive(service, {
      ...request,
      channel: { ...request.channel, contentKey: `overall.today.large-${String(index).padStart(3, "0")}` },
    });
  }

  const session = await service.createLocalExportSession(actor);
  assert.equal(session.chunkCount, 1);
  const firstPage = await service.getLocalExportPage(actor, { exportId: session.exportId });
  assert.ok(firstPage.artifacts.length >= 26 && firstPage.artifacts.length < 100);
  assert.ok(firstPage.pageBytes <= session.maxPageBytes);
  assert.deepEqual(firstPage.nextCursor, { chunkIndex: 0, offset: firstPage.artifacts.length });

  // Exercise the exact JSON wire shape accepted by the HTTP route parser. A
  // byte-split cursor with offset >=25 previously failed here even though the
  // service emitted it.
  const parsedSecondPageRequest = parseLocalContentExportPageRequest(JSON.parse(JSON.stringify({
    exportId: session.exportId,
    cursor: firstPage.nextCursor,
  })));
  assert.deepEqual(parsedSecondPageRequest.cursor, firstPage.nextCursor);
  const secondPage = await service.getLocalExportPage(actor, parsedSecondPageRequest);
  assert.ok(secondPage.artifacts.length > 0);
  assert.ok(secondPage.pageBytes <= session.maxPageBytes);
  assert.equal(
    secondPage.artifacts[0]?.entry.artifactId,
    `artifact-large-${String(firstPage.artifacts.length).padStart(3, "0")}`,
  );
});

test("export metadata chunks never exceed 100 artifacts and an emergency retirement invalidates the snapshot", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  for (let index = 0; index < 127; index += 1) {
    const request = registration(`artifact-page-${String(index).padStart(2, "0")}`);
    const uniqueRequest = {
      ...request,
      channel: { ...request.channel, contentKey: `overall.today.page-${String(index).padStart(2, "0")}` },
    };
    await advanceToActive(service, uniqueRequest);
  }
  const session = await service.createLocalExportSession(actor);
  assert.equal(session.artifactCount, 127);
  assert.equal(session.chunkCount, 2);
  await assert.rejects(
    service.getLocalExportPage(actor, {
      exportId: session.exportId,
      cursor: { chunkIndex: 1, offset: 0 },
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_CURSOR_OUT_OF_SEQUENCE",
  );
  const firstPage = await service.getLocalExportPage(actor, { exportId: session.exportId });
  assert.equal(firstPage.artifacts.length, 100);
  assert.deepEqual(firstPage.nextCursor, { chunkIndex: 1, offset: 0 });
  await assert.rejects(
    service.finalizeLocalExport(actor, {
      exportId: session.exportId,
      observedArtifactCount: session.artifactCount,
      observedAssetSetDigest: session.assetSetDigest,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_DELIVERY_INCOMPLETE",
  );

  const firstArtifact = repository.peekArtifact("artifact-page-00");
  assert.ok(firstArtifact);
  await service.retire(actor, {
    requestId: "retire:during-export",
    artifactId: firstArtifact.artifactId,
    expectedRevision: firstArtifact.revision,
    reason: "emergency content withdrawal",
  });
  await assert.rejects(
    service.getLocalExportPage(actor, { exportId: session.exportId, cursor: firstPage.nextCursor ?? undefined }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_SNAPSHOT_INVALIDATED",
  );
});

test("channel identity prevents same contentKey from crossing free and paid audiences", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const local = registration("artifact-local", "free_local");
  const paid = registration("artifact-paid", "paid_server");
  await advanceToActive(service, local);
  await advanceToActive(service, paid);

  assert.equal((await repository.getActive(local.channel))?.artifactId, local.artifactId);
  assert.equal((await repository.getActive(paid.channel))?.artifactId, paid.artifactId);
  await assert.rejects(
    service.getActiveServerContent(local.channel),
    (error: unknown) => error instanceof ApiHttpError && error.code === "LOCAL_CONTENT_SERVER_DELIVERY_FORBIDDEN",
  );
  assert.equal((await service.getActiveServerContent(paid.channel)).artifactId, paid.artifactId);
});

test("replacement is atomic, rollback is explicit, and activation receipts remain append-only", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const first = registration("artifact-first");
  const second = registration("artifact-second");
  await advanceToActive(service, first);
  await advanceToActive(service, second);
  assert.equal(repository.peekArtifact(first.artifactId)?.lifecycle, "retired");
  assert.equal((await repository.getActive(second.channel))?.artifactId, second.artifactId);

  await service.rollback(actor, {
    requestId: "rollback:first",
    artifactId: first.artifactId,
    expectedRevision: 5,
    reason: "verified production rollback",
  });
  const rolledBack = repository.peekArtifact(first.artifactId);
  assert.equal(rolledBack?.lifecycle, "active");
  assert.deepEqual(rolledBack?.activations.map((entry) => entry.mode), ["initial", "rollback"]);
  assert.equal(repository.peekArtifact(second.artifactId)?.lifecycle, "retired");
});

test("a 64-receipt artifact must roll forward to a new version instead of appending receipt 65", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const left = registration("artifact-activation-cap-left");
  const right = registration("artifact-activation-cap-right");
  await advanceToActive(service, left);
  await advanceToActive(service, right);

  for (let activationNumber = 2; activationNumber <= CONTENT_ACTIVATION_RECEIPT_INLINE_LIMIT_V1; activationNumber += 1) {
    const leftState = repository.peekArtifact(left.artifactId);
    assert.ok(leftState);
    assert.equal(leftState.lifecycle, "retired");
    await service.rollback(approver, {
      requestId: `cap-left-${activationNumber}`,
      artifactId: left.artifactId,
      expectedRevision: leftState.revision,
      reason: "bounded rollback history test",
    });
    const rightState = repository.peekArtifact(right.artifactId);
    assert.ok(rightState);
    assert.equal(rightState.lifecycle, "retired");
    await service.rollback(approver, {
      requestId: `cap-right-${activationNumber}`,
      artifactId: right.artifactId,
      expectedRevision: rightState.revision,
      reason: "bounded rollback history test",
    });
  }

  const capped = repository.peekArtifact(left.artifactId);
  assert.ok(capped);
  assert.equal(capped.lifecycle, "retired");
  assert.equal(capped.activations.length, CONTENT_ACTIVATION_RECEIPT_INLINE_LIMIT_V1);
  await assert.rejects(
    service.rollback(approver, {
      requestId: "cap-left-receipt-65",
      artifactId: left.artifactId,
      expectedRevision: capped.revision,
      reason: "must register a new artifact version",
    }),
    (error: unknown) => error instanceof ApiHttpError
      && error.code === "CONTENT_ACTIVATION_HISTORY_LIMIT"
      && error.statusCode === 409,
  );
  assert.equal(repository.peekArtifact(left.artifactId)?.activations.length, 64);
  assert.equal(repository.peekArtifact(right.artifactId)?.lifecycle, "active");
});

test("content idempotency response remains revision-stable after later transitions", async () => {
  const repository = new InMemoryContentRepositoryV1();
  const service = new ContentLifecycleServiceV1(repository, clock);
  const request = registration("artifact-replay");
  const initial = await service.register(actor, request);
  await service.review(actor, {
    requestId: "review:replay",
    artifactId: request.artifactId,
    expectedRevision: 1,
    notesDigest: digest({ ok: true }),
  });
  const replay = await service.register(actor, request);
  assert.equal(replay.operation, "idempotent_replay");
  assert.deepEqual(replay.artifact, initial.artifact);
  assert.equal(replay.artifact.revision, 1);
  assert.equal(replay.artifact.lifecycle, "draft");
});

test("staging batch validates canonical digests and never changes lifecycle", () => {
  const item = registration("artifact-batch");
  const { requestId: _requestId, ...artifact } = item;
  const parsed = parseStageContentBatchRequest({
    requestId: "batch:one",
    mode: "validate_only",
    artifacts: [artifact],
  });
  assert.equal(parsed.mode, "validate_only");
  assert.equal(parsed.artifacts[0]?.provenance.source.sourceKind, "bulk_json_staging");
  assert.equal("lifecycle" in (parsed.artifacts[0] ?? {}), false);
});
