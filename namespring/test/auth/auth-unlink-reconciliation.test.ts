import assert from "node:assert/strict";
import test from "node:test";
import {
  FirestoreAuthAccountRepository,
  InMemoryAuthAccountRepository,
  setAuthAccountRepositoryForTests,
  type ProviderUnlinkJobV1,
} from "../../api/_lib/auth-accounts-repository.js";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import {
  reconcileProviderUnlinkV1,
  type FirebaseProviderUnlinkApiV1,
} from "../../api/_lib/auth-lifecycle.js";
import {
  createAuthIdentityBindingDigesterV2,
  digestIdentityPart,
  identityBindingDigest,
  type VerifiedProviderIdentity,
} from "../../api/_lib/auth-identity.js";
import {
  issueCsrfToken,
  SESSION_COOKIE_NAME,
} from "../../api/_lib/auth-http.js";
import { setFirebaseAuthForTests } from "../../api/_lib/firebase-auth-admin.js";
import { setAuthRateLimiterForTests } from "../../api/_lib/auth-rate-limit.js";
import unlinkHandler from "../../api/auth/unlink.js";
import retryUnlinkHandler from "../../api/auth/admin/retry-unlink.js";

const TEST_BINDING_KEY = "auth-unlink-binding-test-key-0123456789abcdef";
const TEST_BINDING_DIGESTER = createAuthIdentityBindingDigesterV2(TEST_BINDING_KEY);
process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID ??= "oidc.kakao";

function google(subject: string): VerifiedProviderIdentity & { provider: "google" } {
  return {
    provider: "google",
    issuer: "https://accounts.google.com",
    subject,
    firebaseProviderId: "google.com",
  };
}

function kakao(subject: string): VerifiedProviderIdentity & { provider: "kakao_oidc" } {
  return {
    provider: "kakao_oidc",
    issuer: "https://kauth.kakao.com",
    subject,
    firebaseProviderId: "oidc.kakao",
  };
}

function emailLink(firebaseUid: string): VerifiedProviderIdentity & { provider: "email_link" } {
  return {
    provider: "email_link",
    issuer: "firebase:email-link",
    subject: firebaseUid,
    firebaseProviderId: "password",
  };
}

interface MutableFirebaseUser {
  providerData: Array<{ providerId: string; uid: string }>;
}

class FakeFirebaseUnlinkApi implements FirebaseProviderUnlinkApiV1 {
  readonly updates: Array<{ uid: string; providersToUnlink: string[] }> = [];
  readonly revocations: string[] = [];
  failUpdateBeforeApply = false;
  failUpdateAfterApply = false;
  failRevocation = false;
  dropRecoveryAfterUpdate = false;

  constructor(private readonly users: Map<string, MutableFirebaseUser>) {}

  async getUser(uid: string): Promise<MutableFirebaseUser> {
    const user = this.users.get(uid);
    if (!user) throw Object.assign(new Error("private missing user detail"), { code: "auth/user-not-found" });
    return { providerData: user.providerData.map((entry) => ({ ...entry })) };
  }

  async updateUser(uid: string, properties: { providersToUnlink: string[] }): Promise<MutableFirebaseUser> {
    this.updates.push({ uid, providersToUnlink: [...properties.providersToUnlink] });
    if (this.failUpdateBeforeApply) {
      throw Object.assign(new Error("private provider failure"), { code: "auth/internal-error" });
    }
    const user = this.users.get(uid);
    if (!user) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    user.providerData = user.providerData.filter((entry) => !properties.providersToUnlink.includes(entry.providerId));
    if (this.dropRecoveryAfterUpdate) {
      user.providerData = user.providerData.filter((entry) => entry.providerId !== "oidc.kakao");
    }
    if (this.failUpdateAfterApply) {
      throw Object.assign(new Error("private timeout after commit"), { code: "auth/internal-error" });
    }
    return { providerData: user.providerData.map((entry) => ({ ...entry })) };
  }

  async revokeRefreshTokens(uid: string): Promise<void> {
    this.revocations.push(uid);
    if (this.failRevocation) {
      throw Object.assign(new Error("private revocation failure"), { code: "auth/internal-error" });
    }
  }
}

async function accountWithGoogleAndKakao() {
  let sequence = 0;
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => `unlink-entropy-${++sequence}`,
  );
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
    allowAnonymousUpgrade: false,
  });
  await repository.linkIdentity("firebase-a", kakao("kakao-a"));
  return { repository, userId: created.account.internalUserId };
}

function firebaseWithGoogleAndKakao(): FakeFirebaseUnlinkApi {
  return new FakeFirebaseUnlinkApi(new Map([
    ["firebase-a", { providerData: [
      { providerId: "google.com", uid: "google-a" },
      { providerId: "oidc.kakao", uid: "kakao-a" },
    ] }],
  ]));
}

function firestoreRepositoryWithGoogleAndKakao(): FirestoreAuthAccountRepository {
  const internalUserId = "internal-user-firestore";
  const firebaseUid = "firebase-firestore";
  const googleIdentity = google("google-firestore");
  const kakaoIdentity = kakao("kakao-firestore");
  const googleDigest = identityBindingDigest(googleIdentity, TEST_BINDING_KEY);
  const kakaoDigest = identityBindingDigest(kakaoIdentity, TEST_BINDING_KEY);
  const records = new Map<string, unknown>([
    [`authFirebasePrincipalsV1/${digestIdentityPart(firebaseUid)}`, {
      internalUserId,
      firebaseUid,
      createdAt: "2026-07-18T00:00:00.000Z",
    }],
    [`authAccountsV1/${internalUserId}`, {
      internalUserId,
      status: "active",
      roles: ["user"],
      providers: [
        { provider: "google", issuer: googleIdentity.issuer, subjectDigest: googleDigest, linkedAt: "2026-07-18T00:00:00.000Z" },
        { provider: "kakao_oidc", issuer: kakaoIdentity.issuer, subjectDigest: kakaoDigest, linkedAt: "2026-07-18T00:00:00.000Z" },
      ],
      firebaseUids: [firebaseUid],
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
      lastAuthenticatedAt: "2026-07-18T00:00:00.000Z",
      deletionRequestedAt: null,
      deletedAt: null,
      deleteAfter: null,
      pendingProviderUnlink: null,
      version: 1,
    }],
    [`authIdentityBindingsV1/${googleDigest}`, {
      internalUserId,
      provider: "google",
      issuer: googleIdentity.issuer,
      subjectDigest: googleDigest,
      createdAt: "2026-07-18T00:00:00.000Z",
    }],
    [`authIdentityBindingsV1/${kakaoDigest}`, {
      internalUserId,
      provider: "kakao_oidc",
      issuer: kakaoIdentity.issuer,
      subjectDigest: kakaoDigest,
      createdAt: "2026-07-18T00:00:00.000Z",
    }],
  ]);
  const reference = (collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`,
    async get() {
      const stored = records.get(`${collectionName}/${id}`);
      return { exists: stored !== undefined, data: () => stored };
    },
  });
  const transaction = {
    async get(ref: { path: string }) {
      const stored = records.get(ref.path);
      return { exists: stored !== undefined, data: () => stored };
    },
    set(ref: { path: string }, value: unknown) { records.set(ref.path, value); },
    create(ref: { path: string }, value: unknown) { records.set(ref.path, value); },
    delete(ref: { path: string }) { records.delete(ref.path); },
  };
  const db = {
    collection(collectionName: string) {
      return { doc: (id: string) => reference(collectionName, id) };
    },
    async runTransaction<T>(callback: (value: typeof transaction) => Promise<T>): Promise<T> {
      return callback(transaction);
    },
  } as unknown as Firestore;
  let sequence = 0;
  return new FirestoreAuthAccountRepository(
    db,
    () => "2026-07-18T00:00:00.000Z",
    () => `firestore-unlink-entropy-${++sequence}`,
    () => "auth-audit-test-key-0123456789abcdef",
    TEST_BINDING_DIGESTER,
  );
}

async function reserveGoogle(
  repository: InMemoryAuthAccountRepository,
): Promise<ProviderUnlinkJobV1> {
  return (await repository.beginProviderUnlink({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
  })).job;
}

test("provider unlink reserves first, revokes sessions, then removes only the exact internal binding", async () => {
  const { repository, userId } = await accountWithGoogleAndKakao();
  const reservation = await repository.beginProviderUnlink({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
  });
  assert.equal(reservation.account.pendingProviderUnlink?.unlinkRequestId, reservation.job.unlinkRequestId);
  assert.deepEqual(reservation.account.providers.map((entry) => entry.provider), ["google", "kakao_oidc"]);
  assert.equal(await repository.getActiveByFirebaseUid("firebase-a"), null, "pending accounts fail closed");
  assert.equal(JSON.stringify(reservation.job).includes("google-a"), false, "raw provider subjects must not persist");

  const firebase = firebaseWithGoogleAndKakao();
  const result = await reconcileProviderUnlinkV1({
    repository,
    job: reservation.job,
    recordedByUserId: userId,
    auth: firebase,
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(result.account?.providers.map((entry) => entry.provider), ["kakao_oidc"]);
  assert.deepEqual(firebase.updates, [{ uid: "firebase-a", providersToUnlink: ["google.com"] }]);
  assert.deepEqual(firebase.revocations, ["firebase-a"]);
  assert.deepEqual((await repository.getActiveByFirebaseUid("firebase-a"))?.providers.map((entry) => entry.provider), ["kakao_oidc"]);
  const completed = await repository.getProviderUnlinkJob(reservation.job.unlinkRequestId);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.stage, "completed");
  assert.equal(completed?.bindingDigest, "");
  assert.deepEqual(completed?.firebaseUids, []);
  assert.equal(completed?.deleteAfter, "2026-08-17T00:00:00.000Z");
});

test("an update timeout after Firebase committed is reconciled instead of double-failing", async () => {
  const { repository, userId } = await accountWithGoogleAndKakao();
  const job = await reserveGoogle(repository);
  const firebase = firebaseWithGoogleAndKakao();
  firebase.failUpdateAfterApply = true;
  const result = await reconcileProviderUnlinkV1({ repository, job, recordedByUserId: userId, auth: firebase });
  assert.equal(result.status, "completed");
  assert.equal(firebase.updates.length, 1);
  assert.deepEqual(result.account?.providers.map((entry) => entry.provider), ["kakao_oidc"]);
});

test("email-link unlink uses the canonical password provider without persisting the email address", async () => {
  let sequence = 0;
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => `email-unlink-entropy-${++sequence}`,
  );
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: emailLink("firebase-a"),
    allowAnonymousUpgrade: false,
  });
  await repository.linkIdentity("firebase-a", google("google-a"));
  const reservation = await repository.beginProviderUnlink({
    firebaseUid: "firebase-a",
    identity: emailLink("firebase-a"),
  });
  const firebase = new FakeFirebaseUnlinkApi(new Map([[
    "firebase-a",
    { providerData: [
      { providerId: "password", uid: "private@example.test" },
      { providerId: "google.com", uid: "google-a" },
    ] },
  ]]));

  const result = await reconcileProviderUnlinkV1({
    repository,
    job: reservation.job,
    recordedByUserId: created.account.internalUserId,
    auth: firebase,
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(firebase.updates, [{ uid: "firebase-a", providersToUnlink: ["password"] }]);
  assert.deepEqual(result.account?.providers.map((entry) => entry.provider), ["google"]);
  assert.equal(JSON.stringify(reservation.job).includes("private@example.test"), false);
});

test("a confirmed external failure stays pending, blocks deletion, and an operator retry completes idempotently", async () => {
  const { repository, userId } = await accountWithGoogleAndKakao();
  const firstReservation = await repository.beginProviderUnlink({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
  });
  const duplicateReservation = await repository.beginProviderUnlink({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
  });
  assert.equal(duplicateReservation.job.unlinkRequestId, firstReservation.job.unlinkRequestId);

  const firebase = firebaseWithGoogleAndKakao();
  firebase.failUpdateBeforeApply = true;
  const pending = await reconcileProviderUnlinkV1({
    repository,
    job: firstReservation.job,
    recordedByUserId: userId,
    auth: firebase,
  });
  assert.equal(pending.status, "pending");
  const pendingJob = await repository.getProviderUnlinkJob(firstReservation.job.unlinkRequestId);
  assert.equal(pendingJob?.attemptCount, 1);
  assert.deepEqual(pendingJob?.lastFailureCodes, ["firebase/update_failed"]);
  assert.equal(JSON.stringify(pendingJob).includes("private provider failure"), false);
  await assert.rejects(
    () => repository.beginAccountDeletion("firebase-a"),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_UNLINK_IN_PROGRESS",
  );

  firebase.failUpdateBeforeApply = false;
  assert.ok(pendingJob);
  const retried = await reconcileProviderUnlinkV1({
    repository,
    job: pendingJob,
    recordedByUserId: "operator-user",
    auth: firebase,
  });
  assert.equal(retried.status, "completed");
  assert.deepEqual(retried.account?.providers.map((entry) => entry.provider), ["kakao_oidc"]);

  const completedJob = await repository.getProviderUnlinkJob(firstReservation.job.unlinkRequestId);
  assert.ok(completedJob);
  const updateCount = firebase.updates.length;
  const revocationCount = firebase.revocations.length;
  const replayed = await reconcileProviderUnlinkV1({
    repository,
    job: completedJob,
    recordedByUserId: "operator-user",
    auth: firebase,
  });
  assert.equal(replayed.status, "completed");
  assert.equal(firebase.updates.length, updateCount);
  assert.equal(firebase.revocations.length, revocationCount);
});

test("refresh-token revocation failure preserves the internal binding until a later drain", async () => {
  const { repository, userId } = await accountWithGoogleAndKakao();
  const job = await reserveGoogle(repository);
  const firebase = firebaseWithGoogleAndKakao();
  firebase.failRevocation = true;
  const pending = await reconcileProviderUnlinkV1({ repository, job, recordedByUserId: userId, auth: firebase });
  assert.equal(pending.status, "pending");
  const pendingJob = await repository.getProviderUnlinkJob(job.unlinkRequestId);
  assert.equal(pendingJob?.stage, "firebase_unlinked");
  assert.deepEqual(pendingJob?.lastFailureCodes, ["firebase/refresh_revoke_failed"]);

  firebase.failRevocation = false;
  assert.ok(pendingJob);
  const completed = await reconcileProviderUnlinkV1({
    repository,
    job: pendingJob,
    recordedByUserId: "operator-user",
    auth: firebase,
  });
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.account?.providers.map((entry) => entry.provider), ["kakao_oidc"]);
});

test("a mismatched Firebase provider subject cannot consume the reserved internal binding", async () => {
  const { repository, userId } = await accountWithGoogleAndKakao();
  const job = await reserveGoogle(repository);
  const firebase = new FakeFirebaseUnlinkApi(new Map([
    ["firebase-a", { providerData: [
      { providerId: "google.com", uid: "different-google-subject" },
      { providerId: "oidc.kakao", uid: "kakao-a" },
    ] }],
  ]));
  const result = await reconcileProviderUnlinkV1({ repository, job, recordedByUserId: userId, auth: firebase });
  assert.equal(result.status, "pending");
  assert.equal(firebase.updates.length, 0);
  assert.equal(firebase.revocations.length, 0);
  assert.deepEqual(
    (await repository.getProviderUnlinkJob(job.unlinkRequestId))?.lastFailureCodes,
    ["firebase/target_identity_mismatch"],
  );
});

test("a live last-primary race stays pending and preserves the internal recovery binding", async () => {
  const { repository, userId } = await accountWithGoogleAndKakao();
  const job = await reserveGoogle(repository);
  const firebase = firebaseWithGoogleAndKakao();
  firebase.dropRecoveryAfterUpdate = true;

  const result = await reconcileProviderUnlinkV1({ repository, job, recordedByUserId: userId, auth: firebase });
  assert.equal(result.status, "pending");
  assert.equal(firebase.updates.length, 1);
  assert.equal(firebase.revocations.length, 0);
  const pending = await repository.getProviderUnlinkJob(job.unlinkRequestId);
  assert.equal(pending?.stage, "reserved");
  assert.deepEqual(pending?.lastFailureCodes, ["firebase/recovery_provider_missing"]);
  const duplicate = await repository.beginProviderUnlink({ firebaseUid: "firebase-a", identity: google("google-a") });
  assert.deepEqual(duplicate.account.providers.map((entry) => entry.provider), ["google", "kakao_oidc"]);
});

test("concurrent unlink and account deletion serialize on the account reservation", async () => {
  const { repository } = await accountWithGoogleAndKakao();
  const [unlink, deletion] = await Promise.allSettled([
    repository.beginProviderUnlink({ firebaseUid: "firebase-a", identity: google("google-a") }),
    repository.beginAccountDeletion("firebase-a"),
  ]);
  assert.equal(unlink.status, "fulfilled");
  assert.equal(deletion.status, "rejected");
  assert.equal((deletion as PromiseRejectedResult).reason.code, "PROVIDER_UNLINK_IN_PROGRESS");

  const second = await repository.beginProviderUnlink({ firebaseUid: "firebase-a", identity: google("google-a") });
  await assert.rejects(
    () => repository.beginProviderUnlink({ firebaseUid: "firebase-a", identity: kakao("kakao-a") }),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_UNLINK_IN_PROGRESS",
  );
  assert.equal(second.job.unlinkRequestId, (unlink as PromiseFulfilledResult<{ job: ProviderUnlinkJobV1 }>).value.job.unlinkRequestId);
});

test("the production Firestore reservation mutex blocks link and deletion transactions", async () => {
  const repository = firestoreRepositoryWithGoogleAndKakao();
  const reservation = await repository.beginProviderUnlink({
    firebaseUid: "firebase-firestore",
    identity: google("google-firestore"),
  });
  assert.equal(reservation.job.stage, "reserved");
  await assert.rejects(
    () => repository.linkIdentity("firebase-firestore", google("different-google")),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_UNLINK_IN_PROGRESS",
  );
  await assert.rejects(
    () => repository.beginAccountDeletion("firebase-firestore"),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_UNLINK_IN_PROGRESS",
  );
});

test("malformed persisted unlink jobs fail closed before reconciliation", async () => {
  const unlinkRequestId = `provider_unlink_v1_${"a".repeat(32)}`;
  const malformed = {
    unlinkRequestId,
    internalUserId: "internal-user",
    provider: "google",
    issuer: "https://accounts.google.com",
    firebaseProviderId: "google.com",
    bindingDigest: "b".repeat(64),
    firebaseUids: ["firebase-a"],
    status: "pending",
    stage: "completed",
    requestedAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    attemptCount: 0,
    lastFailureCodes: [],
    deleteAfter: null,
  };
  const db = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return { exists: true, data: () => malformed };
            },
          };
        },
      };
    },
  } as unknown as Firestore;
  const repository = new FirestoreAuthAccountRepository(
    db,
    undefined,
    undefined,
    undefined,
    TEST_BINDING_DIGESTER,
  );
  await assert.rejects(
    () => repository.getProviderUnlinkJob(unlinkRequestId),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR",
  );
  malformed.stage = "reserved";
  malformed.unlinkRequestId = `provider_unlink_v1_${"c".repeat(32)}`;
  await assert.rejects(
    () => repository.getProviderUnlinkJob(unlinkRequestId),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR",
  );
});

test("the public route returns a minimal pending receipt and clears both browser credentials", async () => {
  const previousOrigins = process.env.AUTH_ALLOWED_ORIGINS;
  const { repository } = await accountWithGoogleAndKakao();
  const firebase = firebaseWithGoogleAndKakao();
  firebase.failUpdateBeforeApply = true;
  const decoded = {
    uid: "firebase-a",
    iss: "https://securetoken.google.com/project",
    auth_time: Math.floor(Date.now() / 1000),
    firebase: {
      sign_in_provider: "google.com",
      identities: { "google.com": ["google-a"] },
    },
  } as unknown as DecodedIdToken;
  const auth = {
    async verifySessionCookie() { return decoded; },
    async verifyIdToken() { return decoded; },
    getUser: firebase.getUser.bind(firebase),
    updateUser: firebase.updateUser.bind(firebase),
    revokeRefreshTokens: firebase.revokeRefreshTokens.bind(firebase),
  } as unknown as Auth;
  const csrf = issueCsrfToken();
  const csrfCookie = csrf.cookie.split(";", 1)[0];

  process.env.AUTH_ALLOWED_ORIGINS = "https://app.example";
  setAuthAccountRepositoryForTests(repository);
  setFirebaseAuthForTests(auth);
  setAuthRateLimiterForTests({ async consume() {} });
  try {
    const response = await unlinkHandler(new Request("https://app.example/api/auth/unlink", {
      method: "POST",
      headers: {
        Origin: "https://app.example",
        Cookie: `${SESSION_COOKIE_NAME}=opaque-session; ${csrfCookie}`,
        "X-CSRF-Token": csrf.response.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider: "google", reauthIdToken: "r".repeat(32) }),
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 202);
    const payload = await response.json() as Record<string, unknown>;
    assert.equal(payload.unlinkStatus, "pending");
    assert.equal(payload.cleanupPending, true);
    assert.match(String(payload.unlinkRequestId), /^provider_unlink_v1_[a-f0-9]{32}$/u);
    assert.equal(JSON.stringify(payload).includes("private provider failure"), false);
    const cookies = response.headers.get("set-cookie") ?? "";
    assert.match(cookies, /__Host-namespring_session=;/u);
    assert.match(cookies, /__Host-namespring_csrf=;/u);
    assert.equal((cookies.match(/Max-Age=0/gu) ?? []).length, 2);
  } finally {
    setAuthRateLimiterForTests(null);
    setFirebaseAuthForTests(null);
    setAuthAccountRepositoryForTests(null);
    if (previousOrigins === undefined) delete process.env.AUTH_ALLOWED_ORIGINS;
    else process.env.AUTH_ALLOWED_ORIGINS = previousOrigins;
  }
});

test("the dual-authorized admin route drains and replays a job idempotently", async () => {
  const previousOrigins = process.env.AUTH_ALLOWED_ORIGINS;
  const { repository } = await accountWithGoogleAndKakao();
  const targetJob = await reserveGoogle(repository);
  const operator = await repository.ensureAccount({
    firebaseUid: "firebase-operator",
    identity: google("google-operator"),
    allowAnonymousUpgrade: false,
  });
  (operator.account.roles as string[]).push("admin");
  const firebase = firebaseWithGoogleAndKakao();
  const decodedOperator = {
    uid: "firebase-operator",
    iss: "https://securetoken.google.com/project",
    auth_time: Math.floor(Date.now() / 1000),
    admin: true,
    firebase: {
      sign_in_provider: "google.com",
      identities: { "google.com": ["google-operator"] },
    },
  } as unknown as DecodedIdToken;
  const auth = {
    async verifySessionCookie() { return decodedOperator; },
    getUser: firebase.getUser.bind(firebase),
    updateUser: firebase.updateUser.bind(firebase),
    revokeRefreshTokens: firebase.revokeRefreshTokens.bind(firebase),
  } as unknown as Auth;
  const csrf = issueCsrfToken();
  const csrfCookie = csrf.cookie.split(";", 1)[0];
  const request = () => new Request("https://app.example/api/auth/admin/retry-unlink", {
    method: "POST",
    headers: {
      Origin: "https://app.example",
      Cookie: `${SESSION_COOKIE_NAME}=operator-session; ${csrfCookie}`,
      "X-CSRF-Token": csrf.response.csrfToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ unlinkRequestId: targetJob.unlinkRequestId }),
  });

  process.env.AUTH_ALLOWED_ORIGINS = "https://app.example";
  setAuthAccountRepositoryForTests(repository);
  setFirebaseAuthForTests(auth);
  setAuthRateLimiterForTests({ async consume() {} });
  try {
    const first = await retryUnlinkHandler(request());
    const second = await retryUnlinkHandler(request());
    assert.ok(first instanceof Response);
    assert.ok(second instanceof Response);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const firstPayload = await first.json() as Record<string, unknown>;
    const secondPayload = await second.json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(firstPayload).sort(), ["cleanupPending", "unlinkRequestId", "unlinkStatus"]);
    assert.deepEqual(secondPayload, firstPayload);
    assert.equal(firebase.updates.length, 1);
    assert.equal(firebase.revocations.length, 1);
    assert.equal(JSON.stringify(firstPayload).includes("firebase-a"), false);
    assert.equal(JSON.stringify(firstPayload).includes("google-a"), false);
  } finally {
    setAuthRateLimiterForTests(null);
    setFirebaseAuthForTests(null);
    setAuthAccountRepositoryForTests(null);
    if (previousOrigins === undefined) delete process.env.AUTH_ALLOWED_ORIGINS;
    else process.env.AUTH_ALLOWED_ORIGINS = previousOrigins;
  }
});
