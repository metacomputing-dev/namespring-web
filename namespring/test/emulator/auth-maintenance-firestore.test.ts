import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test, { after, beforeEach } from "node:test";

import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

import { FirestoreAuthAccountRepository } from "../../api/_lib/auth-accounts-repository.js";
import {
  createAuthIdentityBindingDigesterV2,
  digestIdentityPart,
  identityBindingDigest,
} from "../../api/_lib/auth-identity.js";
import { authRoleProvisioningSubjectHashV1 } from "../../api/_lib/auth-role-provisioning-contract.js";
import { FirestoreAuthRoleProvisioningRepositoryV1 } from "../../api/_lib/auth-role-provisioning-repository.js";
import { provisionAuthRoleV1, type AuthRoleProvisioningClaimsGatewayV1 } from "../../api/_lib/auth-role-provisioning.js";

const TEST_BINDING_KEY = "auth-emulator-binding-test-key-0123456789abcdef";
const TEST_BINDING_DIGESTER = createAuthIdentityBindingDigesterV2(TEST_BINDING_KEY);

const ROOT_COLLECTIONS = [
  "authAccountsV1",
  "authFirebasePrincipalsV1",
  "authIdentityBindingsV1",
  "authAuditEventsV1",
  "authDeletionJobsV1",
  "authProviderUnlinkJobsV1",
  "authRoleProvisioningReceiptsV1",
  "authRoleProvisioningLeasesV1",
  "accountDeletionFencesV1",
] as const;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.NAMESPRING_EMULATOR_PROJECT_ID;

if (!emulatorHost || !projectId) {
  test("auth lifecycle Firestore emulator integration", {
    skip: "run inside the project Firestore emulator harness",
  }, () => undefined);
} else {
  assert.match(emulatorHost, /^(?:127\.0\.0\.1|localhost):\d{2,5}$/u);
  assert.match(projectId, /^demo-[a-z0-9-]{5,40}$/u);
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
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
  }, `auth-maintenance-emulator-${process.pid}`);
  const db = getFirestore(app);

  async function clearCollection(firestore: Firestore, collectionName: string): Promise<void> {
    for (;;) {
      const snapshot = await firestore.collection(collectionName).limit(100).get();
      if (snapshot.empty) return;
      const batch = firestore.batch();
      for (const document of snapshot.docs) batch.delete(document.ref);
      await batch.commit();
    }
  }

  async function clearTestData(): Promise<void> {
    for (const collectionName of ROOT_COLLECTIONS) await clearCollection(db, collectionName);
  }

  beforeEach(clearTestData);
  after(async () => {
    await clearTestData();
    await deleteApp(app);
  });

  test("auth deletion claims use transactional CAS, expiry takeover, fencing, and TTL-only completion", async () => {
    const firebaseUid = "firebase-auth-emulator";
    const internalUserId = "internal-auth-emulator";
    const bindingDigest = `hmac-sha256:v2:${"a".repeat(64)}`;
    const initialAt = "2026-07-19T00:00:00.000Z";
    let now = initialAt;
    let sequence = 0;
    await db.collection("authFirebasePrincipalsV1").doc(digestIdentityPart(firebaseUid)).set({
      internalUserId,
      firebaseUid,
      createdAt: initialAt,
    });
    await db.collection("authAccountsV1").doc(internalUserId).set({
      internalUserId,
      status: "active",
      roles: ["user"],
      providers: [{
        provider: "google",
        issuer: "https://accounts.google.com",
        subjectDigest: bindingDigest,
        linkedAt: initialAt,
      }],
      firebaseUids: [firebaseUid],
      createdAt: initialAt,
      updatedAt: initialAt,
      lastAuthenticatedAt: initialAt,
      deletionRequestedAt: null,
      deletedAt: null,
      deleteAfter: null,
      pendingProviderUnlink: null,
      version: 1,
    });
    await db.collection("authIdentityBindingsV1").doc(bindingDigest).set({
      internalUserId,
      provider: "google",
      issuer: "https://accounts.google.com",
      subjectDigest: bindingDigest,
      createdAt: initialAt,
    });

    const repository = new FirestoreAuthAccountRepository(
      db,
      () => now,
      () => `auth-emulator-${++sequence}`,
      () => "auth-audit-emulator-key-0123456789abcdef",
      TEST_BINDING_DIGESTER,
    );
    const deletion = await repository.beginAccountDeletion(firebaseUid);
    const first = await repository.claimAccountDeletionJob({
      deletionRequestId: deletion.job.deletionRequestId,
      now,
      leaseMs: 90_000,
      claimToken: `ajc_${"a".repeat(32)}`,
      force: false,
    });
    assert.equal(first.acquired, true);
    if (!first.acquired) return;
    assert.deepEqual(await repository.claimAccountDeletionJob({
      deletionRequestId: deletion.job.deletionRequestId,
      now,
      leaseMs: 90_000,
      claimToken: `ajc_${"b".repeat(32)}`,
      force: true,
    }), { acquired: false });

    now = "2026-07-19T00:01:30.001Z";
    const takeover = await repository.claimAccountDeletionJob({
      deletionRequestId: deletion.job.deletionRequestId,
      now,
      leaseMs: 90_000,
      claimToken: `ajc_${"b".repeat(32)}`,
      force: false,
    });
    assert.equal(takeover.acquired, true);
    if (!takeover.acquired) return;
    assert.equal(takeover.claim.fence, first.claim.fence + 1);
    await assert.rejects(
      () => repository.recordAccountDeletionCleanupFailure(
        internalUserId,
        deletion.job.deletionRequestId,
        ["sync/temporary"],
        "system",
        first.claim,
      ),
      (error: unknown) => (error as { code?: string }).code === "AUTH_JOB_CLAIM_LOST",
    );
    assert.equal(await repository.releaseAuthLifecycleJobClaim(first.claim, true), false);
    assert.equal(await repository.releaseAuthLifecycleJobClaim(takeover.claim, true), true);

    now = "2026-07-19T00:02:00.001Z";
    assert.deepEqual(
      await repository.listDueAccountDeletionJobIds(now, 2),
      [deletion.job.deletionRequestId],
    );
    const completionClaim = await repository.claimAccountDeletionJob({
      deletionRequestId: deletion.job.deletionRequestId,
      now,
      leaseMs: 90_000,
      claimToken: `ajc_${"c".repeat(32)}`,
      force: false,
    });
    assert.equal(completionClaim.acquired, true);
    if (!completionClaim.acquired) return;
    await repository.completeAccountDeletion(
      internalUserId,
      deletion.job.deletionRequestId,
      "system",
      completionClaim.claim,
    );
    const completed = await repository.getAccountDeletionJob(deletion.job.deletionRequestId);
    assert.equal(completed?.status, "completed");
    assert.equal(completed?.nextAttemptAt, null);
    assert.equal(completed?.claimToken, null);
    assert.ok(completed?.deleteAfter);
    const stored = await db.collection("authDeletionJobsV1").doc(deletion.job.deletionRequestId).get();
    const storedAccount = await db.collection("authAccountsV1").doc(internalUserId).get();
    assert.ok(stored.get("deleteAfter") instanceof Timestamp);
    assert.ok(storedAccount.get("deleteAfter") instanceof Timestamp);
    assert.equal(stored.get("nextAttemptAt"), null);
  });

  test("provider unlink due query, claim CAS, fenced stages, and completion are real Firestore transactions", async () => {
    const firebaseUid = "firebase-unlink-emulator";
    const internalUserId = "internal-unlink-emulator";
    const initialAt = "2026-07-19T01:00:00.000Z";
    const google = {
      provider: "google" as const,
      issuer: "https://accounts.google.com",
      subject: "google-unlink-emulator",
      firebaseProviderId: "google.com",
    };
    const kakao = {
      provider: "kakao_oidc" as const,
      issuer: "https://kauth.kakao.com",
      subject: "kakao-unlink-emulator",
      firebaseProviderId: "oidc.kakao",
    };
    const googleDigest = identityBindingDigest(google, TEST_BINDING_KEY);
    const kakaoDigest = identityBindingDigest(kakao, TEST_BINDING_KEY);
    await db.collection("authFirebasePrincipalsV1").doc(digestIdentityPart(firebaseUid)).set({
      internalUserId,
      firebaseUid,
      createdAt: initialAt,
    });
    await db.collection("authAccountsV1").doc(internalUserId).set({
      internalUserId,
      status: "active",
      roles: ["user"],
      providers: [
        { provider: "google", issuer: google.issuer, subjectDigest: googleDigest, linkedAt: initialAt },
        { provider: "kakao_oidc", issuer: kakao.issuer, subjectDigest: kakaoDigest, linkedAt: initialAt },
      ],
      firebaseUids: [firebaseUid],
      createdAt: initialAt,
      updatedAt: initialAt,
      lastAuthenticatedAt: initialAt,
      deletionRequestedAt: null,
      deletedAt: null,
      deleteAfter: null,
      pendingProviderUnlink: null,
      version: 1,
    });
    for (const [identity, subjectDigest] of [[google, googleDigest], [kakao, kakaoDigest]] as const) {
      await db.collection("authIdentityBindingsV1").doc(subjectDigest).set({
        internalUserId,
        provider: identity.provider,
        issuer: identity.issuer,
        subjectDigest,
        createdAt: initialAt,
      });
    }

    let sequence = 0;
    const repository = new FirestoreAuthAccountRepository(
      db,
      () => initialAt,
      () => `auth-unlink-emulator-${++sequence}`,
      () => "auth-audit-emulator-key-0123456789abcdef",
      TEST_BINDING_DIGESTER,
    );
    const reservation = await repository.beginProviderUnlink({ firebaseUid, identity: google });
    assert.deepEqual(
      await repository.listDueProviderUnlinkJobIds(initialAt, 5),
      [reservation.job.unlinkRequestId],
    );
    const [left, right] = await Promise.all([
      repository.claimProviderUnlinkJob({
        unlinkRequestId: reservation.job.unlinkRequestId,
        now: initialAt,
        leaseMs: 90_000,
        claimToken: `ajc_${"d".repeat(32)}`,
        force: false,
      }),
      repository.claimProviderUnlinkJob({
        unlinkRequestId: reservation.job.unlinkRequestId,
        now: initialAt,
        leaseMs: 90_000,
        claimToken: `ajc_${"e".repeat(32)}`,
        force: false,
      }),
    ]);
    const owner = [left, right].find((candidate) => candidate.acquired);
    assert.ok(owner?.acquired);
    assert.equal([left, right].filter((candidate) => candidate.acquired).length, 1);
    if (!owner?.acquired) return;

    await repository.markProviderUnlinkFirebaseApplied(
      internalUserId,
      reservation.job.unlinkRequestId,
      "system",
      owner.claim,
    );
    await repository.markProviderUnlinkSessionsRevoked(
      internalUserId,
      reservation.job.unlinkRequestId,
      "system",
      owner.claim,
    );
    const account = await repository.completeProviderUnlink(
      internalUserId,
      reservation.job.unlinkRequestId,
      "system",
      owner.claim,
    );
    assert.deepEqual(account.providers.map((provider) => provider.provider), ["kakao_oidc"]);
    const completed = await repository.getProviderUnlinkJob(reservation.job.unlinkRequestId);
    assert.equal(completed?.status, "completed");
    assert.equal(completed?.bindingDigest, "");
    assert.equal(completed?.claimToken, null);
    assert.ok(completed?.deleteAfter);
    const [storedJob, removedGoogleBinding, retainedKakaoBinding] = await Promise.all([
      db.collection("authProviderUnlinkJobsV1").doc(reservation.job.unlinkRequestId).get(),
      db.collection("authIdentityBindingsV1").doc(googleDigest).get(),
      db.collection("authIdentityBindingsV1").doc(kakaoDigest).get(),
    ]);
    assert.ok(storedJob.get("deleteAfter") instanceof Timestamp);
    assert.equal(removedGoogleBinding.exists, false);
    assert.equal(retainedKakaoBinding.exists, true);
  });

  test("lifecycle discovery queries bounded metadata pages and audits reads without raw identifiers", async () => {
    const deletionRequestId = `deletion_request_v1_${"1".repeat(32)}`;
    const unlinkRequestId = `provider_unlink_v1_${"2".repeat(32)}`;
    const deletionInternalUserId = "sensitive-deletion-user";
    const unlinkInternalUserId = "sensitive-unlink-user";
    const firebaseUid = "sensitive-firebase-uid";
    const bindingDigest = `hmac-sha256:v2:${"a".repeat(64)}`;
    await db.collection("authDeletionJobsV1").doc(deletionRequestId).set({
      deletionRequestId,
      internalUserId: deletionInternalUserId,
      firebaseUids: [firebaseUid],
      bindingDigests: [bindingDigest],
      providerKinds: ["google"],
      status: "pending",
      requestedAt: "2026-07-19T02:00:00.000Z",
      updatedAt: "2026-07-19T02:01:00.000Z",
      attemptCount: 1,
      lastErrorCodes: ["firebase/delete_failed"],
      deleteAfter: null,
      nextAttemptAt: Timestamp.fromDate(new Date("2026-07-19T02:01:30.000Z")),
      claimUntil: null,
      claimToken: null,
      fence: 0,
      backoffMs: 30_000,
    });
    await db.collection("authProviderUnlinkJobsV1").doc(unlinkRequestId).set({
      unlinkRequestId,
      internalUserId: unlinkInternalUserId,
      provider: "google",
      issuer: "https://accounts.google.com",
      firebaseProviderId: "google.com",
      bindingDigest: "",
      firebaseUids: [],
      status: "completed",
      stage: "completed",
      requestedAt: "2026-07-19T02:00:00.000Z",
      updatedAt: "2026-07-19T02:02:00.000Z",
      attemptCount: 0,
      lastFailureCodes: [],
      deleteAfter: Timestamp.fromDate(new Date("2026-08-18T02:02:00.000Z")),
      nextAttemptAt: null,
      claimUntil: null,
      claimToken: null,
      fence: 1,
      backoffMs: 0,
    });

    let sequence = 0;
    const repository = new FirestoreAuthAccountRepository(
      db,
      () => "2026-07-19T03:00:00.000Z",
      () => `auth-discovery-emulator-${++sequence}`,
      () => "auth-discovery-audit-key-0123456789abcdef",
      TEST_BINDING_DIGESTER,
    );
    const first = await repository.listAuthLifecycleJobMetadata({
      snapshotAt: "2026-07-19T03:00:00.000Z",
      limit: 1,
    });
    assert.deepEqual(first.jobs.map((job) => job.requestId), [unlinkRequestId]);
    assert.deepEqual(first.nextPosition, {
      requestedAt: "2026-07-19T02:00:00.000Z",
      requestId: unlinkRequestId,
    });
    const second = await repository.listAuthLifecycleJobMetadata({
      snapshotAt: "2026-07-19T03:00:00.000Z",
      after: first.nextPosition ?? undefined,
      limit: 1,
    });
    assert.deepEqual(second.jobs.map((job) => job.requestId), [deletionRequestId]);
    assert.equal(second.nextPosition, null);
    const pending = await repository.listAuthLifecycleJobMetadata({
      kind: "account_deletion",
      status: "pending",
      snapshotAt: "2026-07-19T03:00:00.000Z",
      limit: 20,
    });
    assert.deepEqual(pending.jobs.map((job) => job.requestId), [deletionRequestId]);
    const detail = await repository.getAuthLifecycleJobMetadata("account_deletion", deletionRequestId);
    assert.equal(detail?.stage, "cleanup_pending");
    assert.deepEqual(detail?.failureCodes, ["firebase/delete_failed"]);
    const output = JSON.stringify({ first, second, pending, detail });
    for (const secret of [deletionInternalUserId, unlinkInternalUserId, firebaseUid, bindingDigest]) {
      assert.equal(output.includes(secret), false);
    }

    await repository.recordAuthLifecycleDiscoveryAudit({
      actorUserId: "sensitive-admin-user",
      operation: "get",
      kind: "account_deletion",
      requestId: deletionRequestId,
      resultCount: 1,
    });
    const audits = await db.collection("authAuditEventsV1")
      .where("schemaVersion", "==", "namespring.auth-lifecycle-discovery-audit.v1")
      .get();
    assert.equal(audits.size, 1);
    const audit = audits.docs[0]?.data();
    assert.match(String(audit?.actorSubjectHash), /^hmac-sha256:[a-f0-9]{64}$/u);
    assert.match(String(audit?.jobRequestHash), /^hmac-sha256:[a-f0-9]{64}$/u);
    assert.ok(audit?.deleteAfter instanceof Timestamp);
    const auditJson = JSON.stringify(audit);
    assert.equal(auditJson.includes("sensitive-admin-user"), false);
    assert.equal(auditJson.includes(deletionRequestId), false);
  });

  test("role provisioning leases serialize races and fence an expired worker", async () => {
    const firebaseUid = "firebase-role-race";
    const internalUserId = "internal-role-race";
    const key = "emulator-role-provisioning-key-0123456789abcdef";
    await db.collection("authFirebasePrincipalsV1").doc(digestIdentityPart(firebaseUid)).set({
      internalUserId,
      firebaseUid,
      createdAt: "2026-07-19T04:00:00.000Z",
    });
    await db.collection("authAccountsV1").doc(internalUserId).set({
      internalUserId,
      status: "active",
      roles: ["user"],
      providers: [{
        provider: "google",
        issuer: "https://accounts.google.com",
        subjectDigest: `hmac-sha256:v2:${"d".repeat(64)}`,
        linkedAt: "2026-07-19T04:00:00.000Z",
      }],
      firebaseUids: [firebaseUid],
      createdAt: "2026-07-19T04:00:00.000Z",
      updatedAt: "2026-07-19T04:00:00.000Z",
      lastAuthenticatedAt: "2026-07-19T04:00:00.000Z",
      deletionRequestedAt: null,
      deletedAt: null,
      deleteAfter: null,
      pendingProviderUnlink: null,
      version: 1,
    });
    const repository = new FirestoreAuthRoleProvisioningRepositoryV1(
      db,
      () => "2026-07-19T04:00:00.000Z",
      () => key,
    );
    const targetSubjectHash = authRoleProvisioningSubjectHashV1("target", internalUserId, key);
    const operatorSubjectHash = authRoleProvisioningSubjectHashV1("operator", "ops.emulator", key);
    const base = {
      requestId: "role_request_v1_emulatorrace0001",
      targetFirebaseUid: firebaseUid,
      targetSubjectHash,
      operatorSubjectHash,
      operation: "grant",
      role: "admin",
      now: "2026-07-19T04:00:00.000Z",
      claimToken: `rpc_${"a".repeat(32)}`,
    } as const;
    const first = await repository.acquire(base);
    assert.equal(first.completed, false);
    if (first.completed) return;
    const contenders = await Promise.allSettled([
      repository.acquire({ ...base, claimToken: `rpc_${"b".repeat(32)}` }),
      repository.acquire({
        ...base,
        requestId: "role_request_v1_emulatorrace0002",
        claimToken: `rpc_${"c".repeat(32)}`,
      }),
    ]);
    assert.equal(contenders.every((result) => result.status === "rejected"), true);

    const takeover = await repository.acquire({
      ...base,
      now: "2026-07-19T04:02:00.001Z",
      claimToken: `rpc_${"b".repeat(32)}`,
    });
    assert.equal(takeover.completed, false);
    if (takeover.completed) return;
    assert.equal(takeover.claim.fence, first.claim.fence + 1);
    await assert.rejects(
      () => repository.persistDesiredRoles(first.claim, first.receipt),
      (error: unknown) => (error as { code?: string }).code === "ROLE_PROVISIONING_CLAIM_LOST",
    );
    assert.equal(await repository.release(takeover.claim), true);
    const lease = await db.collection("authRoleProvisioningLeasesV1").doc(targetSubjectHash).get();
    assert.deepEqual(Object.keys(lease.data() ?? {}).sort(), [
      "claimToken",
      "claimUntil",
      "fence",
      "requestId",
      "schemaVersion",
      "targetSubjectHash",
    ]);
    const leaseJson = JSON.stringify(lease.data());
    assert.equal(leaseJson.includes(firebaseUid), false);
    assert.equal(leaseJson.includes(internalUserId), false);
    assert.equal(leaseJson.includes("ops.emulator"), false);

    const receiptRef = db.collection("authRoleProvisioningReceiptsV1").doc(base.requestId);
    await receiptRef.update({ requestId: 123 });
    await assert.rejects(
      () => repository.acquire({ ...base, claimToken: `rpc_${"d".repeat(32)}` }),
      (error: unknown) => (error as { code?: string }).code === "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR",
    );
    await receiptRef.update({ requestId: base.requestId, status: true });
    await assert.rejects(
      () => repository.acquire({ ...base, claimToken: `rpc_${"e".repeat(32)}` }),
      (error: unknown) => (error as { code?: string }).code === "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR",
    );
    await receiptRef.update({ status: "pending" });
    await lease.ref.update({ claimToken: { toString: "rpc_impostor" } });
    await assert.rejects(
      () => repository.acquire({ ...base, claimToken: `rpc_${"f".repeat(32)}` }),
      (error: unknown) => (error as { code?: string }).code === "ROLE_PROVISIONING_LEASE_INTEGRITY_ERROR",
    );
  });

  test("role provisioning service commits a minimal TTL receipt and no raw identity log", async () => {
    const firebaseUids = ["firebase-role-service-a", "firebase-role-service-b"];
    const internalUserId = "internal-role-service";
    const operatorRef = "ops.service-emulator";
    const key = "emulator-role-service-key-0123456789abcdef";
    for (const firebaseUid of firebaseUids) {
      await db.collection("authFirebasePrincipalsV1").doc(digestIdentityPart(firebaseUid)).set({
        internalUserId,
        firebaseUid,
        createdAt: "2026-07-19T05:00:00.000Z",
      });
    }
    await db.collection("authAccountsV1").doc(internalUserId).set({
      internalUserId,
      status: "active",
      roles: ["user"],
      providers: [{
        provider: "google",
        issuer: "https://accounts.google.com",
        subjectDigest: `hmac-sha256:v2:${"e".repeat(64)}`,
        linkedAt: "2026-07-19T05:00:00.000Z",
      }],
      firebaseUids,
      createdAt: "2026-07-19T05:00:00.000Z",
      updatedAt: "2026-07-19T05:00:00.000Z",
      lastAuthenticatedAt: "2026-07-19T05:00:00.000Z",
      deletionRequestedAt: null,
      deletedAt: null,
      deleteAfter: null,
      pendingProviderUnlink: null,
      version: 1,
    });
    const values = new Map(firebaseUids.map((uid) => [uid, { keep: uid.endsWith("a") ? "a" : "b" }]));
    const revocations: string[] = [];
    const claims: AuthRoleProvisioningClaimsGatewayV1 = {
      async getCustomClaims(uid) { return structuredClone(values.get(uid) ?? {}); },
      async setCustomClaims(uid, next) { values.set(uid, structuredClone(next)); },
      async revokeRefreshTokens(uid) { revocations.push(uid); },
    };
    const repository = new FirestoreAuthRoleProvisioningRepositoryV1(
      db,
      () => "2026-07-19T05:00:00.000Z",
      () => key,
    );
    const input = {
      requestId: "role_request_v1_emulatorservice01",
      targetFirebaseUid: firebaseUids[0],
      operatorRef,
      operation: "grant",
      role: "premium_admin",
      confirmed: true,
    } as const;
    const result = await provisionAuthRoleV1(input, {
      repository,
      claims,
      now: () => "2026-07-19T05:00:00.000Z",
      hmacKey: () => key,
      newClaimToken: () => `rpc_${"d".repeat(32)}`,
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(revocations, firebaseUids);
    assert.deepEqual(values.get(firebaseUids[0]), {
      keep: "a",
      premium_admin: true,
      roles: ["premium_admin"],
    });
    const [storedAccount, storedReceipt, leases] = await Promise.all([
      db.collection("authAccountsV1").doc(internalUserId).get(),
      db.collection("authRoleProvisioningReceiptsV1").doc(input.requestId).get(),
      db.collection("authRoleProvisioningLeasesV1").get(),
    ]);
    assert.deepEqual(storedAccount.get("roles"), ["user", "premium_admin"]);
    assert.ok(storedReceipt.get("deleteAfter") instanceof Timestamp);
    assert.equal(leases.empty, true);
    const stored = storedReceipt.data() ?? {};
    assert.deepEqual(Object.keys(stored).sort(), [
      "afterRoles",
      "beforeRoles",
      "deleteAfter",
      "operation",
      "operatorSubjectHash",
      "requestId",
      "role",
      "schemaVersion",
      "stage",
      "status",
      "targetSubjectHash",
      "updatedAt",
    ]);
    const storedJson = JSON.stringify(stored);
    for (const raw of [...firebaseUids, internalUserId, operatorRef]) assert.equal(storedJson.includes(raw), false);

    const replay = await provisionAuthRoleV1(input, {
      repository,
      claims,
      now: () => "2026-07-19T05:01:00.000Z",
      hmacKey: () => key,
      newClaimToken: () => `rpc_${"e".repeat(32)}`,
    });
    assert.equal(replay.status, "completed");
    assert.deepEqual(revocations, firebaseUids);
  });
}
