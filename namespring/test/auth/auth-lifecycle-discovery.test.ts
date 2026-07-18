import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAuthAccountRepository,
} from "../../api/_lib/auth-accounts-repository.js";
import {
  AUTH_LIFECYCLE_ADMIN_RESPONSE_MAX_BYTES_V1,
  AuthLifecycleAdminServiceV1,
  parseGetAuthLifecycleJobRequestV1,
  parseListAuthLifecycleJobsRequestV1,
} from "../../api/_lib/auth-lifecycle-admin.js";
import { ApiHttpError } from "../../api/_lib/http.js";

const CURSOR_KEY = "test-auth-lifecycle-cursor-root-key-minimum-32-bytes";
const operatorId = "internal-admin-operator";

function identity(provider: "google" | "kakao_oidc", subject: string) {
  return provider === "google"
    ? {
        provider,
        issuer: "https://accounts.google.com",
        subject,
        firebaseProviderId: "google.com",
      } as const
    : {
        provider,
        issuer: "https://kauth.kakao.com",
        subject,
        firebaseProviderId: "oidc.kakao",
      } as const;
}

async function discoveryFixture() {
  let now = "2026-07-19T00:00:00.000Z";
  let sequence = 0;
  const repository = new InMemoryAuthAccountRepository(
    () => now,
    () => `lifecycle-discovery-${++sequence}`,
    () => false,
    () => CURSOR_KEY,
  );

  const firebaseA = "firebase-sensitive-deletion-a";
  const googleA = identity("google", "raw-google-subject-a");
  const accountA = await repository.ensureAccount({
    firebaseUid: firebaseA,
    identity: googleA,
    allowAnonymousUpgrade: false,
  });
  now = "2026-07-19T00:01:00.000Z";
  const deletionA = await repository.beginAccountDeletion(firebaseA);
  now = "2026-07-19T00:02:00.000Z";
  await repository.recordAccountDeletionCleanupFailure(
    accountA.account.internalUserId,
    deletionA.job.deletionRequestId,
    ["firebase/delete_failed", "unsafe code with spaces"],
  );
  const claimToken = `ajc_${"a".repeat(32)}`;
  const claimedA = await repository.claimAccountDeletionJob({
    deletionRequestId: deletionA.job.deletionRequestId,
    now,
    leaseMs: 90_000,
    claimToken,
    force: true,
  });
  assert.equal(claimedA.acquired, true);

  now = "2026-07-19T00:03:00.000Z";
  const firebaseB = "firebase-sensitive-deletion-b";
  const accountB = await repository.ensureAccount({
    firebaseUid: firebaseB,
    identity: identity("google", "raw-google-subject-b"),
    allowAnonymousUpgrade: false,
  });
  const deletionB = await repository.beginAccountDeletion(firebaseB);
  const claimedB = await repository.claimAccountDeletionJob({
    deletionRequestId: deletionB.job.deletionRequestId,
    now,
    leaseMs: 90_000,
    claimToken: `ajc_${"b".repeat(32)}`,
    force: true,
  });
  assert.equal(claimedB.acquired, true);
  if (!claimedB.acquired) throw new Error("test deletion claim failed");
  now = "2026-07-19T00:04:00.000Z";
  await repository.completeAccountDeletion(
    accountB.account.internalUserId,
    deletionB.job.deletionRequestId,
    operatorId,
    claimedB.claim,
  );

  now = "2026-07-19T00:05:00.000Z";
  const firebaseC = "firebase-sensitive-unlink-c";
  const googleC = identity("google", "raw-google-subject-c");
  const accountC = await repository.ensureAccount({
    firebaseUid: firebaseC,
    identity: googleC,
    allowAnonymousUpgrade: false,
  });
  await repository.linkIdentity(firebaseC, identity("kakao_oidc", "raw-kakao-subject-c"));
  const unlinkC = await repository.beginProviderUnlink({ firebaseUid: firebaseC, identity: googleC });
  await repository.recordProviderUnlinkFailure(
    accountC.account.internalUserId,
    unlinkC.job.unlinkRequestId,
    ["firebase/read_failed"],
  );

  const serviceClock = { now: () => new Date("2026-07-19T01:00:00.000Z") };
  return {
    repository,
    service: new AuthLifecycleAdminServiceV1(repository, serviceClock, () => CURSOR_KEY),
    requestIds: {
      deletionA: deletionA.job.deletionRequestId,
      deletionB: deletionB.job.deletionRequestId,
      unlinkC: unlinkC.job.unlinkRequestId,
    },
    sensitive: [
      accountA.account.internalUserId,
      accountB.account.internalUserId,
      accountC.account.internalUserId,
      firebaseA,
      firebaseB,
      firebaseC,
      googleA.subject,
      googleC.subject,
      claimToken,
    ],
  };
}

test("lifecycle discovery paginates a frozen metadata-only snapshot without identity leakage", async () => {
  const fixture = await discoveryFixture();
  const first = await fixture.service.list(operatorId, parseListAuthLifecycleJobsRequestV1({ limit: 2 }));
  assert.equal(first.schemaVersion, "namespring.auth-lifecycle-job-list.v1");
  assert.equal(first.snapshotAt, "2026-07-19T01:00:00.000Z");
  assert.equal(first.jobs.length, 2);
  assert.match(first.nextCursor ?? "", /^alc1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u);

  const second = await fixture.service.list(operatorId, parseListAuthLifecycleJobsRequestV1({
    limit: 2,
    cursor: first.nextCursor,
  }));
  assert.equal(second.snapshotAt, first.snapshotAt);
  assert.equal(second.nextCursor, null);
  const ids = [...first.jobs, ...second.jobs].map((job) => job.requestId);
  assert.deepEqual(new Set(ids), new Set(Object.values(fixture.requestIds)));
  assert.equal(ids.length, 3);

  const allowedKeys = [
    "attemptCount", "claimUntil", "deleteAfter", "failureCodes", "kind", "nextAttemptAt",
    "requestId", "requestedAt", "stage", "status", "updatedAt",
  ];
  for (const job of [...first.jobs, ...second.jobs]) {
    assert.deepEqual(Object.keys(job).sort(), allowedKeys);
  }
  const serialized = JSON.stringify({ first, second });
  for (const secret of fixture.sensitive) assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("bindingDigest"), false);
  assert.equal(serialized.includes("firebaseUids"), false);
  assert.ok(Buffer.byteLength(JSON.stringify(first), "utf8") <= AUTH_LIFECYCLE_ADMIN_RESPONSE_MAX_BYTES_V1);
  assert.ok(Buffer.byteLength(JSON.stringify(second), "utf8") <= AUTH_LIFECYCLE_ADMIN_RESPONSE_MAX_BYTES_V1);

  assert.equal(fixture.repository.lifecycleDiscoveryAudits.length, 2);
  const auditJson = JSON.stringify(fixture.repository.lifecycleDiscoveryAudits);
  assert.equal(auditJson.includes(operatorId), false);
  for (const requestId of Object.values(fixture.requestIds)) assert.equal(auditJson.includes(requestId), false);
  assert.match(fixture.repository.lifecycleDiscoveryAudits[0]?.actorSubjectHash ?? "", /^hmac-sha256:[a-f0-9]{64}$/u);
});

test("lifecycle discovery filters, details, cursor integrity, and not-found audits fail closed", async () => {
  const fixture = await discoveryFixture();
  const filtered = await fixture.service.list(operatorId, parseListAuthLifecycleJobsRequestV1({
    kind: "account_deletion",
    status: "completed",
    limit: 20,
  }));
  assert.deepEqual(filtered.jobs.map((job) => job.requestId), [fixture.requestIds.deletionB]);

  const detail = await fixture.service.get(operatorId, parseGetAuthLifecycleJobRequestV1({
    kind: "provider_unlink",
    requestId: fixture.requestIds.unlinkC,
  }));
  assert.equal(detail.job.requestId, fixture.requestIds.unlinkC);
  assert.deepEqual(detail.job.failureCodes, ["firebase/read_failed"]);

  const first = await fixture.service.list(operatorId, parseListAuthLifecycleJobsRequestV1({ limit: 1 }));
  assert.ok(first.nextCursor);
  const lastCharacter = first.nextCursor.at(-1);
  const tampered = `${first.nextCursor.slice(0, -1)}${lastCharacter === "A" ? "B" : "A"}`;
  await assert.rejects(
    () => fixture.service.list(operatorId, parseListAuthLifecycleJobsRequestV1({ limit: 1, cursor: tampered })),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_AUTH_LIFECYCLE_CURSOR",
  );
  await assert.rejects(
    () => fixture.service.list(operatorId, parseListAuthLifecycleJobsRequestV1({
      kind: "account_deletion",
      limit: 1,
      cursor: first.nextCursor,
    })),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_AUTH_LIFECYCLE_CURSOR",
  );

  const missingId = `deletion_request_v1_${"f".repeat(32)}`;
  await assert.rejects(
    () => fixture.service.get(operatorId, { kind: "account_deletion", requestId: missingId }),
    (error: unknown) => error instanceof ApiHttpError && error.statusCode === 404
      && error.code === "AUTH_LIFECYCLE_JOB_NOT_FOUND",
  );
  const missingAudit = fixture.repository.lifecycleDiscoveryAudits.at(-1);
  assert.equal(missingAudit?.operation, "get");
  assert.equal(missingAudit?.resultCount, 0);
  assert.equal(JSON.stringify(missingAudit).includes(missingId), false);
});

test("lifecycle discovery request parsers reject unknown fields, coercion, oversized pages, and kind mismatches", () => {
  assert.deepEqual(parseListAuthLifecycleJobsRequestV1({}), { limit: 20 });
  assert.deepEqual(parseListAuthLifecycleJobsRequestV1({
    kind: "provider_unlink",
    status: "pending",
    limit: 5,
  }), { kind: "provider_unlink", status: "pending", limit: 5 });
  for (const body of [
    null,
    [],
    { limit: "20" },
    { limit: true },
    { limit: 21 },
    { kind: "all" },
    { status: "failed" },
    { unexpected: true },
  ]) {
    assert.throws(
      () => parseListAuthLifecycleJobsRequestV1(body),
      (error: unknown) => error instanceof ApiHttpError,
    );
  }
  assert.throws(
    () => parseGetAuthLifecycleJobRequestV1({
      kind: "provider_unlink",
      requestId: `deletion_request_v1_${"a".repeat(32)}`,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_AUTH_LIFECYCLE_REQUEST",
  );
});
