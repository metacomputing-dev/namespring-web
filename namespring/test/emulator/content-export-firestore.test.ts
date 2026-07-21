import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync } from "node:crypto";
import test, { after, beforeEach } from "node:test";

import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
} from "firebase-admin/firestore";

import { FirestoreContentRepositoryV1 } from "../../api/_lib/content-repository.js";
import { ContentLifecycleServiceV1 } from "../../api/_lib/content-service.js";
import { contentGateAttestationMaterial, sha256Digest } from "../../api/_lib/content-validation.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import type {
  ContentArtifactV1,
  ContentActorSubjectV1,
  LocalContentExportEntryV1,
  LocalContentExportSessionV1,
} from "../../shared/types/content-lifecycle.js";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.NAMESPRING_EMULATOR_PROJECT_ID;
const EXPORT_SNAPSHOTS = "content_export_snapshots_v1";
const EXPORT_CHUNKS = "content_export_chunks_v1";
const EXPORT_PROGRESS = "content_export_progress_v1";
const CATALOG_STATE = "content_catalog_state_v1";
const ARTIFACTS = "content_artifacts_v1";
const AUDIT_EVENTS = "content_audit_events_v1";
const CATALOG_DOCUMENT = "active-local-catalog";
const ownerSubjects = [
  `hmac-sha256:v1:emulator-owner:${"a".repeat(64)}`,
] as const satisfies readonly ContentActorSubjectV1[];
const otherOwnerSubjects = [
  `hmac-sha256:v1:emulator-other:${"b".repeat(64)}`,
] as const satisfies readonly ContentActorSubjectV1[];
const TEST_GATE_KEY_ID = "emulator-ci";
const TEST_GATE_SECRET = "emulator-content-gate-secret-at-least-32-bytes";
process.env.CONTENT_GATE_ATTESTATION_KEYRING_JSON = JSON.stringify({
  [TEST_GATE_KEY_ID]: TEST_GATE_SECRET,
});

if (!emulatorHost || !projectId) {
  test("content export Firestore emulator integration", {
    skip: "run with npm run test:emulator:maintenance",
  }, () => undefined);
} else {
  assert.match(emulatorHost, /^(?:127\.0\.0\.1|localhost):\d{2,5}$/u);
  assert.match(projectId, /^demo-[a-z0-9-]{5,40}$/u);
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const app = initializeApp({
    projectId,
    credential: cert({
      projectId,
      clientEmail: `emulator@${projectId}.iam.gserviceaccount.com`,
      privateKey,
    }),
  }, `content-export-emulator-${process.pid}`);
  const db = getFirestore(app);
  const repository = new FirestoreContentRepositoryV1(db);

  async function deleteQuery(snapshot: QuerySnapshot<DocumentData>): Promise<void> {
    for (let offset = 0; offset < snapshot.docs.length; offset += 200) {
      const batch = db.batch();
      for (const document of snapshot.docs.slice(offset, offset + 200)) batch.delete(document.ref);
      await batch.commit();
    }
  }

  async function clearTestData(): Promise<void> {
    await deleteQuery(await db.collectionGroup(EXPORT_CHUNKS).get());
    await deleteQuery(await db.collectionGroup(EXPORT_PROGRESS).get());
    await deleteQuery(await db.collection(EXPORT_SNAPSHOTS).get());
    await deleteQuery(await db.collection(CATALOG_STATE).get());
    await deleteQuery(await db.collection(ARTIFACTS).get());
    await deleteQuery(await db.collection(AUDIT_EVENTS).get());
  }

  beforeEach(async () => {
    await clearTestData();
    await db.collection(CATALOG_STATE).doc(CATALOG_DOCUMENT).set({
      revision: 7,
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
  });
  after(async () => {
    await clearTestData();
    await deleteApp(app);
  });

  function entry(index: number): LocalContentExportEntryV1 {
    const id = String(index).padStart(6, "0");
    return {
      artifactId: `artifact-${id}`,
      contentKey: `overall.today.fixture-${id}`,
      kind: "fortune_bundle",
      audience: "free_local",
      locale: "ko-KR",
      version: "v1",
      contentDigest: `sha256:${index.toString(16).padStart(64, "0")}`,
      activationId: `activation-${id}`,
    };
  }

  function session(exportId: string, artifactCount: number): LocalContentExportSessionV1 {
    return {
      schemaVersion: "namespring.local-content-export-session.v1",
      exportId,
      createdAt: "2026-07-19T00:00:00.000Z",
      expiresAt: "2026-07-20T00:00:00.000Z",
      catalogRevision: 7,
      artifactCount,
      chunkCount: Math.ceil(artifactCount / 100),
      maxPageItems: 100,
      maxPageBytes: 1_500_000,
      assetSetDigest: `sha256:${"c".repeat(64)}`,
      runtimeBoundary: "authenticated_build_pipeline_only",
    };
  }

  function activeArtifact(artifactId: string): ContentArtifactV1 {
    const payload = {
      schemaVersion: "namespring.fortune-bundle.v1" as const,
      summary: "오늘의 흐름을 바로 이해할 수 있는 검증된 요약입니다.",
      hook: "지금 확인하면 좋은 핵심을 먼저 짚어드립니다.",
      sections: [{ id: "evidence", body: "근거와 해석을 구분해 읽을 수 있는 본문입니다." }],
      tips: ["작은 실천 하나를 정하고 기록해 보세요."],
      cautions: ["근거가 확인되지 않은 큰 결정은 잠시 보류하세요."],
    };
    const contentDigest = sha256Digest(payload);
    const gateVersion = "v1";
    const checkedAt = "2026-07-18T23:10:00.000Z";
    const resultDigest = sha256Digest({ gate: artifactId });
    const unsignedAttestation = {
      attestationId: `attestation:${artifactId}`,
      runner: "trusted_ci" as const,
      keyId: TEST_GATE_KEY_ID,
      subjectContentDigest: contentDigest,
      policyDigest: sha256Digest({ policy: "emulator" }),
    };
    const signature = `hmac-sha256:${createHmac("sha256", TEST_GATE_SECRET)
      .update(contentGateAttestationMaterial({
        ...unsignedAttestation,
        gateVersion,
        decision: "passed",
        checkedAt,
        resultDigest,
      }), "utf8")
      .digest("hex")}` as const;
    return {
      schemaVersion: "namespring.content-artifact.v1",
      artifactId,
      channel: {
        contentKey: `overall.today.${artifactId}`,
        kind: "fortune_bundle",
        audience: "free_local",
        locale: "ko-KR",
      },
      version: "v1",
      lifecycle: "active",
      revision: 4,
      contentDigest,
      payload,
      provenance: {
        source: {
          sourceKind: "manual",
          sourceId: `source:${artifactId}`,
          sourceVersion: "v1",
          sourceDigest: sha256Digest({ source: artifactId }),
          importedAt: "2026-07-18T23:00:00.000Z",
        },
        gate: {
          gateVersion,
          decision: "passed",
          checkedAt,
          resultDigest,
          attestation: {
            ...unsignedAttestation,
            signature,
          },
        },
      },
      registeredAt: "2026-07-18T23:20:00.000Z",
      registeredBy: ownerSubjects[0],
      review: {
        reviewerId: ownerSubjects[0],
        reviewedAt: "2026-07-18T23:30:00.000Z",
        decision: "accepted",
        notesDigest: sha256Digest({ review: artifactId }),
      },
      approval: {
        approverId: otherOwnerSubjects[0],
        approvedAt: "2026-07-18T23:40:00.000Z",
        decision: "approved",
        reviewArtifactRevision: 2,
      },
      activations: [{
        activationId: `activation:${artifactId}`,
        activatedAt: "2026-07-18T23:50:00.000Z",
        activatedBy: otherOwnerSubjects[0],
        reason: "emulator export projection regression",
        immutableContentDigest: contentDigest,
        mode: "initial",
      }],
    };
  }

  test("real active-artifact projection creates an export session and malformed metadata fails closed", {
    timeout: 30_000,
  }, async () => {
    const valid = activeArtifact("artifact-emulator-projection");
    await db.collection(ARTIFACTS).doc(valid.artifactId).set(valid);

    const service = new ContentLifecycleServiceV1(
      repository,
      { now: () => new Date("2026-07-19T00:00:00.000Z") },
      {
        currentKeyId: "emulator-audit",
        keys: { "emulator-audit": "emulator-content-audit-secret-at-least-32-bytes" },
      },
      () => ({ largeCatalogEnabled: false, maxActiveArtifacts: 2_500 }),
    );
    const exportSession = await service.createLocalExportSession({
      userId: "emulator-export-admin",
      sessionId: "emulator-export-session",
    });
    assert.equal(exportSession.artifactCount, 1);
    const exportActor = { userId: "emulator-export-admin", sessionId: "emulator-export-session" };
    await assert.rejects(
      service.finalizeLocalExport(exportActor, {
        exportId: exportSession.exportId,
        observedArtifactCount: exportSession.artifactCount,
        observedAssetSetDigest: exportSession.assetSetDigest,
      }),
      (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_DELIVERY_INCOMPLETE",
    );
    const page = await service.getLocalExportPage(exportActor, { exportId: exportSession.exportId });
    assert.equal(page.artifacts.length, 1);
    assert.equal(page.nextCursor, null);
    const completion = await service.finalizeLocalExport(exportActor, {
      exportId: exportSession.exportId,
      observedArtifactCount: exportSession.artifactCount,
      observedAssetSetDigest: exportSession.assetSetDigest,
    });
    assert.equal(completion.exportId, exportSession.exportId);
    const progress = await db.collection(EXPORT_SNAPSHOTS).doc(exportSession.exportId)
      .collection(EXPORT_PROGRESS).doc("delivery").get();
    assert.equal(progress.data()?.servedArtifactCount, 1);
    assert.equal(progress.data()?.nextCursor, null);
    assert.ok(progress.data()?.expiresAt instanceof Timestamp);
    const entries = await repository.listActiveExportEntries("free_local");
    assert.deepEqual(entries, [{
      artifactId: valid.artifactId,
      contentKey: valid.channel.contentKey,
      kind: valid.channel.kind,
      audience: valid.channel.audience,
      locale: valid.channel.locale,
      version: valid.version,
      contentDigest: valid.contentDigest,
      activationId: valid.activations[0]?.activationId,
    }]);

    const tampered = activeArtifact("artifact-emulator-tampered-gate");
    assert.ok(tampered.provenance.gate.attestation);
    await db.collection(ARTIFACTS).doc(tampered.artifactId).set({
      ...tampered,
      provenance: {
        ...tampered.provenance,
        gate: {
          ...tampered.provenance.gate,
          attestation: {
            ...tampered.provenance.gate.attestation,
            signature: `hmac-sha256:${"0".repeat(64)}`,
          },
        },
      },
    });
    await assert.rejects(
      repository.listActiveExportEntries("free_local"),
      (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_STORED_ATTESTATION_INVALID",
    );
    await db.collection(ARTIFACTS).doc(tampered.artifactId).delete();

    const corrupt = {
      ...activeArtifact("artifact-emulator-corrupt"),
      review: { ...valid.review, reviewerId: 123 },
    };
    await db.collection(ARTIFACTS).doc(corrupt.artifactId).set(corrupt);
    await assert.rejects(
      repository.listActiveExportEntries("free_local"),
      (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_METADATA_INVALID",
    );
  });

  test("21,060-entry second-batch failure leaves TTL staging but no readable header", {
    timeout: 60_000,
  }, async () => {
    const exportId = "cexp_emulator_partial_21060";
    const header = db.collection(EXPORT_SNAPSHOTS).doc(exportId);
    const entries = Array.from({ length: 21_060 }, (_, index) => entry(index));
    const planned = session(exportId, entries.length);
    assert.equal(planned.chunkCount, 211);

    // Chunk 50 is in the second bounded write batch. Its collision forces that
    // whole batch to fail after chunks 0-49 have already committed.
    await header.collection(EXPORT_CHUNKS).doc("000050").create({
      collisionGuard: true,
      expiresAt: Timestamp.fromDate(new Date(planned.expiresAt)),
    });
    await assert.rejects(repository.createLocalExportSnapshot(planned, entries, ownerSubjects));

    assert.equal((await header.get()).exists, false, "partial metadata must remain undiscoverable");
    const chunks = await header.collection(EXPORT_CHUNKS).get();
    assert.equal(chunks.size, 51, "only first batch plus the deliberate collision may remain");
    for (const document of chunks.docs) {
      assert.ok(document.data().expiresAt instanceof Timestamp, `${document.id} needs independent TTL cleanup`);
    }
    await assert.rejects(
      repository.getLocalExportChunk(exportId, 0, ownerSubjects),
      (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND",
    );
  });

  test("published snapshots are owner-bound and never return owner HMAC metadata", {
    timeout: 20_000,
  }, async () => {
    const exportId = "cexp_emulator_owner_bound";
    const entries = Array.from({ length: 101 }, (_, index) => entry(index));
    const planned = session(exportId, entries.length);
    await repository.createLocalExportSnapshot(planned, entries, ownerSubjects);

    await assert.rejects(
      repository.getLocalExportChunk(exportId, 0, otherOwnerSubjects),
      (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND",
    );
    const result = await repository.getLocalExportChunk(exportId, 0, ownerSubjects);
    assert.equal(result.chunk.entries.length, 100);
    assert.equal(Object.hasOwn(result.session, "ownerSubjects"), false);
    assert.equal(JSON.stringify(result.session).includes(ownerSubjects[0]), false);
    assert.ok((await db.collection(EXPORT_SNAPSHOTS).doc(exportId).get()).data()?.expiresAt instanceof Timestamp);
  });

  test("stored export sessions and chunks reject unknown, coerced, and malformed fields", {
    timeout: 20_000,
  }, async () => {
    const exportId = "cexp_emulator_strict_storage";
    const entries = Array.from({ length: 101 }, (_, index) => entry(index));
    await repository.createLocalExportSnapshot(session(exportId, entries.length), entries, ownerSubjects);
    const header = db.collection(EXPORT_SNAPSHOTS).doc(exportId);
    const chunk = header.collection(EXPORT_CHUNKS).doc("000000");
    const originalHeader = (await header.get()).data()!;
    const originalChunk = (await chunk.get()).data()!;
    const rejectsCorrupt = (error: unknown) => error instanceof ApiHttpError
      && error.code === "CONTENT_EXPORT_SNAPSHOT_CORRUPT";

    for (const corruptHeader of [
      { ...originalHeader, maxPageBytes: "1500000" },
      { ...originalHeader, chunkCount: "2" },
      { ...originalHeader, unexpectedField: true },
    ]) {
      await header.set(corruptHeader);
      await assert.rejects(repository.getLocalExportChunk(exportId, 0, ownerSubjects), rejectsCorrupt);
    }
    await header.set(originalHeader);

    const malformedEntries = [...originalChunk.entries];
    malformedEntries[0] = { ...malformedEntries[0], contentDigest: 123 };
    for (const corruptChunk of [
      { ...originalChunk, entries: malformedEntries },
      { ...originalChunk, chunkIndex: "0" },
      { ...originalChunk, unexpectedField: true },
    ]) {
      await chunk.set(corruptChunk);
      await assert.rejects(repository.getLocalExportChunk(exportId, 0, ownerSubjects), rejectsCorrupt);
    }
  });
}
