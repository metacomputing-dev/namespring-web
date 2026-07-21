import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { DecodedIdToken } from "firebase-admin/auth";

import {
  assertAuthAccountStorageCutoverReadyV1,
  InMemoryAuthAccountRepository,
} from "../../api/_lib/auth-accounts-repository.js";
import {
  decodeAccountDeletionJobV1,
  decodeAuthAccountRecordV1,
  decodeBindingRecordV1,
  decodePrincipalRecordV1,
  decodeProviderUnlinkJobV1,
  encodeAccountDeletionJobV1,
  encodeProviderUnlinkJobV1,
} from "../../api/_lib/auth-accounts-firestore-codec.js";
import {
  assertTrustedMutationRequest,
  createSessionCookie,
  handleAuthApiError,
  issueCsrfToken,
} from "../../api/_lib/auth-http.js";
import {
  assertAuthIdentityBindingHmacKeyV2,
  authProviderFromFirebaseId,
  createAuthIdentityBindingDigesterV2,
  extractProviderIdentity,
  getAuthIdentityBindingHmacKeyV2,
  identityBindingDigest,
  type VerifiedProviderIdentity,
} from "../../api/_lib/auth-identity.js";
import currentSessionHandler from "../../api/auth/current.js";
import { cleanupFirebaseUsers, revokeAllFirebaseSessions } from "../../api/_lib/auth-lifecycle.js";
import {
  assertAnonymousBridgeIntent,
  assertAuthProviderEnabled,
  assertPublicSessionProvider,
  enabledAuthProviders,
  hasPrimarySignInProvider,
} from "../../api/_lib/auth-policy.js";
import authPolicyHandler from "../../api/auth/policy.js";
import {
  authRateLimitModeV1,
  consumeAuthRateLimit,
  consumeAuthSessionPreflightRateLimitV1,
  setAuthRateLimiterForTests,
  trustedAuthClientIpV1,
} from "../../api/_lib/auth-rate-limit.js";
import { effectiveAccountRoles, toBrowserVisibleAccountRoles } from "../../api/_lib/auth-principal.js";
import {
  assertAccountWriteFenceOpenV1,
  assertNoPaymentConfirmationLeaseV1,
} from "../../api/_lib/account-write-fence.js";
import {
  finalizeAccountDeletionJobV1,
  type AccountDeletionCleanupDependenciesV1,
} from "../../api/_lib/auth-account-deletion.js";
import { createAccountPortableExportManifestV1 } from "../../api/_lib/auth-portable-export.js";
import {
  assertAuthAuditHmacKeyV1,
  authAuditSubjectHashV1,
  retentionDeadlineV1,
} from "../../api/_lib/auth-audit-privacy.js";

const google = (subject: string): VerifiedProviderIdentity => ({
  provider: "google",
  issuer: "https://accounts.google.com",
  subject,
  firebaseProviderId: "google.com",
});

const apple = (subject: string): VerifiedProviderIdentity => ({
  provider: "apple",
  issuer: "https://appleid.apple.com",
  subject,
  firebaseProviderId: "apple.com",
});

const anonymous = (uid: string): VerifiedProviderIdentity => ({
  provider: "anonymous",
  issuer: "firebase:anonymous",
  subject: uid,
  firebaseProviderId: "anonymous",
});

const TEST_BINDING_KEY = "auth-identity-binding-test-key-0123456789abcdef";
const TEST_BINDING_DIGESTER = createAuthIdentityBindingDigesterV2(TEST_BINDING_KEY);
const storedBindingDigest = (hex = "a") => `hmac-sha256:v2:${hex.repeat(64)}`;

test("anonymous local use returns no server account and requires no Firebase configuration", async () => {
  const response = await currentSessionHandler(new Request("https://app.example/auth/current"));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), {
    authenticated: false,
    freeLocalAvailable: true,
    accountRequiredFor: ["sync", "payment"],
  });
});

test("CSRF requires both an exact allowed Origin and the double-submit token", () => {
  const previous = process.env.AUTH_ALLOWED_ORIGINS;
  process.env.AUTH_ALLOWED_ORIGINS = "https://app.example";
  try {
    const issued = issueCsrfToken();
    const cookiePair = issued.cookie.split(";", 1)[0];
    assert.doesNotThrow(() => assertTrustedMutationRequest({
      headers: new Headers({
        Origin: "https://app.example",
        Cookie: cookiePair,
        "X-CSRF-Token": issued.response.csrfToken,
      }),
    }));
    assert.throws(() => assertTrustedMutationRequest({
      headers: new Headers({
        Origin: "https://evil.example",
        Cookie: cookiePair,
        "X-CSRF-Token": issued.response.csrfToken,
      }),
    }), /origin/i);
    assert.throws(() => assertTrustedMutationRequest({
      headers: new Headers({ Origin: "https://app.example", Cookie: cookiePair }),
    }), /CSRF/i);
  } finally {
    if (previous === undefined) delete process.env.AUTH_ALLOWED_ORIGINS;
    else process.env.AUTH_ALLOWED_ORIGINS = previous;
  }
});

test("session cookies use the __Host prefix and hardened attributes", () => {
  const value = createSessionCookie("opaque", 60);
  assert.match(value, /^__Host-namespring_session=opaque;/);
  assert.match(value, /Path=\//);
  assert.match(value, /HttpOnly/);
  assert.match(value, /Secure/);
  assert.match(value, /SameSite=Lax/);
  assert.doesNotMatch(value, /Domain=/);
});

test("a reserved unlink failure can expire both the session and CSRF cookies", () => {
  const response = handleAuthApiError(undefined, new Error("private unlink failure"), true);
  assert.ok(response instanceof Response);
  assert.equal(response.status, 500);
  const cookies = response.headers.get("set-cookie") ?? "";
  assert.match(cookies, /__Host-namespring_session=;/u);
  assert.match(cookies, /__Host-namespring_csrf=;/u);
  assert.equal((cookies.match(/Max-Age=0/gu) ?? []).length, 2);
});

test("anonymous account upgrades once; later providers require explicit linking", async () => {
  let id = 0;
  const repository = new InMemoryAuthAccountRepository(() => "2026-07-18T00:00:00.000Z", () => `user-${++id}`);
  const initial = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: anonymous("firebase-a"),
    allowAnonymousUpgrade: false,
  });
  const upgraded = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
    allowAnonymousUpgrade: true,
  });
  assert.equal(upgraded.account.internalUserId, initial.account.internalUserId);
  assert.deepEqual(upgraded.account.providers.map((entry) => entry.provider), ["anonymous", "google"]);

  await assert.rejects(
    () => repository.ensureAccount({
      firebaseUid: "firebase-a",
      identity: {
        provider: "apple",
        issuer: "https://appleid.apple.com",
        subject: "apple-a",
        firebaseProviderId: "apple.com",
      },
      allowAnonymousUpgrade: true,
    }),
    (error: unknown) => (error as { code?: string }).code === "EXPLICIT_LINK_REQUIRED",
  );
});

test("exact provider binding recovers an account but conflicting binding never merges", async () => {
  let id = 0;
  const repository = new InMemoryAuthAccountRepository(() => "2026-07-18T00:00:00.000Z", () => `user-${++id}`);
  const first = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: google("stable-google-subject"),
    allowAnonymousUpgrade: false,
  });
  const recovered = await repository.ensureAccount({
    firebaseUid: "firebase-b",
    identity: google("stable-google-subject"),
    allowAnonymousUpgrade: false,
  });
  assert.equal(recovered.recoveredExistingAccount, true);
  assert.equal(recovered.account.internalUserId, first.account.internalUserId);

  const second = await repository.ensureAccount({
    firebaseUid: "firebase-c",
    identity: google("other-google-subject"),
    allowAnonymousUpgrade: false,
  });
  await assert.rejects(
    () => repository.linkIdentity("firebase-c", google("stable-google-subject")),
    (error: unknown) => (error as { code?: string }).code === "IDENTITY_CONFLICT",
  );
  assert.notEqual(second.account.internalUserId, first.account.internalUserId);
});

test("matching email text never merges distinct Firebase principals", async () => {
  const decoded = (uid: string) => ({
    uid,
    iss: "https://securetoken.google.com/project",
    firebase: {
      sign_in_provider: "password",
      identities: { email: ["same@example.test"] },
    },
  }) as unknown as DecodedIdToken;
  const firstIdentity = extractProviderIdentity(decoded("firebase-a"));
  const secondIdentity = extractProviderIdentity(decoded("firebase-b"));
  assert.equal(firstIdentity.provider, "email_link");
  assert.equal(firstIdentity.subject, "firebase-a");
  assert.equal(secondIdentity.subject, "firebase-b");

  let id = 0;
  const repository = new InMemoryAuthAccountRepository(() => "2026-07-18T00:00:00.000Z", () => `user-${++id}`);
  const first = await repository.ensureAccount({ firebaseUid: "firebase-a", identity: firstIdentity, allowAnonymousUpgrade: false });
  const second = await repository.ensureAccount({ firebaseUid: "firebase-b", identity: secondIdentity, allowAnonymousUpgrade: false });
  assert.notEqual(first.account.internalUserId, second.account.internalUserId);
});

test("email-link sign-in methods canonicalize to Firebase Admin's password provider ID", () => {
  const identity = extractProviderIdentity({
    uid: "firebase-email-link",
    iss: "https://securetoken.google.com/project",
    firebase: {
      sign_in_provider: "emailLink",
      identities: { email: ["person@example.test"] },
    },
  } as unknown as DecodedIdToken);
  assert.equal(identity.provider, "email_link");
  assert.equal(identity.firebaseProviderId, "password");
  assert.equal(identity.subject, "firebase-email-link");
});

test("generic OIDC extraction fails closed when more than one exact provider could match", () => {
  const previous = process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS;
  try {
    process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS = "oidc.first,oidc.second";
    assert.throws(
      () => extractProviderIdentity({
        uid: "firebase-oidc",
        iss: "https://securetoken.google.com/project",
        firebase: {
          sign_in_provider: "oidc.first",
          identities: {
            "oidc.first": ["first-subject"],
            "oidc.second": ["second-subject"],
          },
        },
      } as unknown as DecodedIdToken, "oidc"),
      (error: unknown) => (error as { code?: string }).code === "PROVIDER_IDENTITY_AMBIGUOUS",
    );
  } finally {
    if (previous === undefined) delete process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS;
    else process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS = previous;
  }
});

test("Kakao and generic OIDC identities require exact configured Firebase provider IDs", () => {
  const previousKakao = process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID;
  const previousGeneric = process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS;
  try {
    process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID = "oidc.kakao-launch";
    process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS = "oidc.partner-one";
    assert.equal(authProviderFromFirebaseId("oidc.kakao-launch"), "kakao_oidc");
    assert.equal(authProviderFromFirebaseId("oidc.partner-one"), "oidc");
    for (const unconfigured of ["oidc.kakao", "oidc.fake-kakao", "oidc.partner-two"]) {
      assert.throws(
        () => authProviderFromFirebaseId(unconfigured),
        (error: unknown) => (error as { code?: string }).code === "AUTH_PROVIDER_NOT_ALLOWED",
      );
    }
    process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS = "oidc.kakao-launch";
    assert.throws(
      () => authProviderFromFirebaseId("oidc.kakao-launch"),
      (error: unknown) => (error as { code?: string }).code === "INVALID_AUTH_CONFIG",
    );
  } finally {
    if (previousKakao === undefined) delete process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID;
    else process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID = previousKakao;
    if (previousGeneric === undefined) delete process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS;
    else process.env.AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS = previousGeneric;
  }
});

test("social identity extraction never substitutes a Firebase UID for a missing or ambiguous provider subject", () => {
  const token = (identities: Record<string, unknown>) => ({
    uid: "firebase-social-principal",
    iss: "https://securetoken.google.com/project",
    firebase: {
      sign_in_provider: "google.com",
      identities,
    },
  }) as unknown as DecodedIdToken;

  assert.throws(
    () => extractProviderIdentity(token({})),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_SUBJECT_NOT_VERIFIED",
  );
  assert.throws(
    () => extractProviderIdentity(token({ "google.com": ["google-a", "google-b"] })),
    (error: unknown) => (error as { code?: string }).code === "PROVIDER_IDENTITY_AMBIGUOUS",
  );

  const exact = extractProviderIdentity(token({ "google.com": ["google-a", "google-a"] }));
  assert.equal(exact.subject, "google-a");
  assert.notEqual(exact.subject, "firebase-social-principal");
});

test("security-critical Firestore account, principal, and binding records fail closed on corruption", async () => {
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => "user-integrity",
  );
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-integrity",
    identity: google("google-integrity"),
    allowAnonymousUpgrade: false,
  });
  const account = structuredClone(created.account);
  assert.deepEqual(decodeAuthAccountRecordV1(account, "user-integrity"), account);

  const duplicateRole = structuredClone(account) as { roles: string[] };
  duplicateRole.roles = ["user", "admin", "admin"];
  assert.throws(
    () => decodeAuthAccountRecordV1(duplicateRole, "user-integrity"),
    (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_INTEGRITY_ERROR",
  );

  const malformedPending = structuredClone(account) as { pendingProviderUnlink: unknown };
  malformedPending.pendingProviderUnlink = {
    unlinkRequestId: `provider_unlink_v1_${"a".repeat(32)}`,
    provider: "google",
    bindingDigest: "b".repeat(64),
  };
  assert.throws(
    () => decodeAuthAccountRecordV1(malformedPending, "user-integrity"),
    (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_INTEGRITY_ERROR",
  );

  assert.throws(
    () => decodePrincipalRecordV1({
      internalUserId: "user-integrity",
      firebaseUid: "firebase-other",
      createdAt: "2026-07-18T00:00:00.000Z",
    }, "firebase-integrity"),
    (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_INTEGRITY_ERROR",
  );
  assert.throws(
    () => decodeBindingRecordV1({
      internalUserId: "user-integrity",
      provider: "google",
      issuer: "https://accounts.google.com",
      subjectDigest: "c".repeat(64),
      createdAt: "2026-07-18T00:00:00.000Z",
    }, "d".repeat(64)),
    (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_INTEGRITY_ERROR",
  );
  assert.throws(
    () => decodeBindingRecordV1({
      internalUserId: "user-integrity",
      provider: "google",
      issuer: "https://accounts.google.com",
      subjectDigest: "c".repeat(64),
      createdAt: "2026-07-18T00:00:00.000Z",
    }, "c".repeat(64), { provider: "kakao_oidc", issuer: "https://kauth.kakao.com" }),
    (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_INTEGRITY_ERROR",
  );
});

test("Firestore auth codecs reject number, boolean, and object type impostors before coercion", async () => {
  const failsWith = (code: string) => (error: unknown) => (error as { code?: string }).code === code;
  const at = "2026-07-18T00:00:00.000Z";
  const accountRepository = new InMemoryAuthAccountRepository(() => at, () => "123");
  const created = await accountRepository.ensureAccount({
    firebaseUid: "firebase-codec-impostor",
    identity: google("google-codec-impostor"),
    allowAnonymousUpgrade: false,
  });
  const account = structuredClone(created.account);

  assert.throws(
    () => decodeAuthAccountRecordV1({ ...account, internalUserId: 123 }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );
  assert.throws(
    () => decodeAuthAccountRecordV1({ ...account, version: true }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );
  assert.throws(
    () => decodeAuthAccountRecordV1({
      ...account,
      providers: [{ ...account.providers[0], issuer: { toString: () => "https://accounts.google.com" } }],
    }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );
  assert.throws(
    () => decodeAuthAccountRecordV1({
      ...account,
      providers: [Object.assign(Object.create({ inherited: true }), account.providers[0])],
    }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );

  const principal = {
    internalUserId: "123",
    firebaseUid: "firebase-codec-impostor",
    createdAt: at,
  };
  assert.throws(
    () => decodePrincipalRecordV1({ ...principal, internalUserId: 123 }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );
  assert.throws(
    () => decodePrincipalRecordV1(Object.assign(Object.create({ inherited: true }), principal)),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );

  const binding = {
    internalUserId: "123",
    provider: "google",
    issuer: "https://accounts.google.com",
    subjectDigest: storedBindingDigest(),
    createdAt: at,
  };
  assert.throws(
    () => decodeBindingRecordV1({ ...binding, provider: false }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );
  assert.throws(
    () => decodeBindingRecordV1({ ...binding, issuer: { toString: () => binding.issuer } }),
    failsWith("AUTH_ACCOUNT_INTEGRITY_ERROR"),
  );

  const deletionRepository = new InMemoryAuthAccountRepository(() => at, () => "deletion-codec-user");
  await deletionRepository.ensureAccount({
    firebaseUid: "firebase-deletion-codec",
    identity: google("google-deletion-codec"),
    allowAnonymousUpgrade: false,
  });
  const deletion = await deletionRepository.beginAccountDeletion("firebase-deletion-codec");
  const storedDeletion = encodeAccountDeletionJobV1(deletion.job);
  assert.deepEqual(decodeAccountDeletionJobV1(storedDeletion), deletion.job);
  for (const candidate of [
    { ...storedDeletion, internalUserId: 123 },
    { ...storedDeletion, status: true },
    { ...storedDeletion, deletionRequestId: { toString: () => deletion.job.deletionRequestId } },
    Object.assign(Object.create({ inherited: true }), storedDeletion),
  ]) {
    assert.throws(() => decodeAccountDeletionJobV1(candidate), failsWith("DELETION_JOB_INTEGRITY_ERROR"));
  }

  const kakao: VerifiedProviderIdentity = {
    provider: "kakao_oidc",
    issuer: "https://kauth.kakao.com",
    subject: "kakao-unlink-codec",
    firebaseProviderId: "oidc.kakao",
  };
  const unlinkRepository = new InMemoryAuthAccountRepository(() => at, () => "unlink-codec-user");
  await unlinkRepository.ensureAccount({
    firebaseUid: "firebase-unlink-codec",
    identity: google("google-unlink-codec"),
    allowAnonymousUpgrade: false,
  });
  await unlinkRepository.linkIdentity("firebase-unlink-codec", kakao);
  const unlink = await unlinkRepository.beginProviderUnlink({
    firebaseUid: "firebase-unlink-codec",
    identity: google("google-unlink-codec"),
  });
  const storedUnlink = encodeProviderUnlinkJobV1(unlink.job);
  assert.deepEqual(decodeProviderUnlinkJobV1(storedUnlink), unlink.job);
  for (const candidate of [
    { ...storedUnlink, internalUserId: 123 },
    { ...storedUnlink, stage: false },
    { ...storedUnlink, issuer: { toString: () => unlink.job.issuer } },
    { ...storedUnlink, status: "completed", stage: "reserved" },
    Object.assign(Object.create({ inherited: true }), storedUnlink),
  ]) {
    assert.throws(() => decodeProviderUnlinkJobV1(candidate), failsWith("PROVIDER_UNLINK_JOB_INTEGRITY_ERROR"));
  }
});

test("Firestore auth account storage cannot open without an explicit verified cutover state", () => {
  const previous = {
    account: process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE,
    binding: process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE,
    key: process.env.AUTH_IDENTITY_BINDING_HMAC_KEY,
  };
  try {
    delete process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE;
    delete process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE;
    delete process.env.AUTH_IDENTITY_BINDING_HMAC_KEY;
    assert.throws(
      () => assertAuthAccountStorageCutoverReadyV1(),
      (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_STORAGE_CUTOVER_REQUIRED",
    );
    process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE = "assume_empty";
    assert.throws(
      () => assertAuthAccountStorageCutoverReadyV1(),
      (error: unknown) => (error as { code?: string }).code === "AUTH_ACCOUNT_STORAGE_CUTOVER_REQUIRED",
    );
    process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE = "prelaunch_empty_v1_verified";
    assert.throws(
      () => assertAuthAccountStorageCutoverReadyV1(),
      (error: unknown) => (error as { code?: string }).code === "AUTH_IDENTITY_BINDING_CUTOVER_REQUIRED",
    );
    process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE = "legacy_sha256_to_hmac_v2_migration_verified";
    process.env.AUTH_IDENTITY_BINDING_HMAC_KEY = TEST_BINDING_KEY;
    assert.throws(
      () => assertAuthAccountStorageCutoverReadyV1(),
      (error: unknown) => (error as { code?: string }).code === "AUTH_IDENTITY_BINDING_CUTOVER_REQUIRED",
      "an existing-store migration attestation cannot be paired with an empty-store account attestation",
    );
    process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE = "prelaunch_empty_hmac_v2_verified";
    assert.doesNotThrow(() => assertAuthAccountStorageCutoverReadyV1());

    process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE = "legacy_v1_migration_verified";
    assert.throws(
      () => assertAuthAccountStorageCutoverReadyV1(),
      (error: unknown) => (error as { code?: string }).code === "AUTH_IDENTITY_BINDING_CUTOVER_REQUIRED",
      "existing stores cannot claim the empty HMAC binding path",
    );
    process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE = "legacy_sha256_to_hmac_v2_migration_verified";
    assert.doesNotThrow(() => assertAuthAccountStorageCutoverReadyV1());
  } finally {
    if (previous.account === undefined) delete process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE;
    else process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE = previous.account;
    if (previous.binding === undefined) delete process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE;
    else process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE = previous.binding;
    if (previous.key === undefined) delete process.env.AUTH_IDENTITY_BINDING_HMAC_KEY;
    else process.env.AUTH_IDENTITY_BINDING_HMAC_KEY = previous.key;
  }
});

test("provider bindings use a dedicated keyed domain and never retain or expose a low-entropy subject", async () => {
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => "user-1",
    undefined,
    undefined,
    TEST_BINDING_DIGESTER,
  );
  const rawSubject = "1234567";
  const identity = {
    provider: "kakao_oidc",
    issuer: "https://kauth.kakao.com",
    subject: rawSubject,
    firebaseProviderId: "oidc.kakao",
  } as const;
  const { account } = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity,
    allowAnonymousUpgrade: false,
  });
  assert.equal(JSON.stringify(account).includes(rawSubject), false);
  assert.match(account.providers[0].subjectDigest, /^hmac-sha256:v2:[a-f0-9]{64}$/u);
  const legacyRawSha = createHash("sha256")
    .update(`${identity.provider}\u0000${identity.issuer}\u0000${identity.subject}`, "utf8")
    .digest("hex");
  assert.notEqual(account.providers[0].subjectDigest, legacyRawSha);
  assert.notEqual(account.providers[0].subjectDigest, `hmac-sha256:v2:${legacyRawSha}`);
  assert.equal(account.providers[0].subjectDigest, identityBindingDigest(identity, TEST_BINDING_KEY));
  assert.notEqual(
    account.providers[0].subjectDigest,
    identityBindingDigest({ ...identity, firebaseProviderId: "oidc.kakao-other" }, TEST_BINDING_KEY),
    "the exact Firebase provider ID is part of the binding domain",
  );
});

test("identity-binding key configuration rejects missing, short, and cross-domain reused material", () => {
  const previous = {
    audit: process.env.AUTH_AUDIT_HMAC_KEY,
    binding: process.env.AUTH_IDENTITY_BINDING_HMAC_KEY,
  };
  try {
    delete process.env.AUTH_AUDIT_HMAC_KEY;
    delete process.env.AUTH_IDENTITY_BINDING_HMAC_KEY;
    assert.throws(
      () => getAuthIdentityBindingHmacKeyV2(),
      (error: unknown) => (error as { code?: string }).code === "AUTH_IDENTITY_BINDING_KEY_INVALID",
    );
    assert.throws(
      () => assertAuthIdentityBindingHmacKeyV2("too-short"),
      (error: unknown) => (error as { code?: string }).code === "AUTH_IDENTITY_BINDING_KEY_INVALID",
    );
    process.env.AUTH_AUDIT_HMAC_KEY = TEST_BINDING_KEY;
    assert.throws(
      () => assertAuthIdentityBindingHmacKeyV2(TEST_BINDING_KEY),
      (error: unknown) => (error as { code?: string }).code === "AUTH_IDENTITY_BINDING_KEY_REUSE",
    );
  } finally {
    if (previous.audit === undefined) delete process.env.AUTH_AUDIT_HMAC_KEY;
    else process.env.AUTH_AUDIT_HMAC_KEY = previous.audit;
    if (previous.binding === undefined) delete process.env.AUTH_IDENTITY_BINDING_HMAC_KEY;
    else process.env.AUTH_IDENTITY_BINDING_HMAC_KEY = previous.binding;
  }
});

test("auth audit subjects are dedicated-key HMAC pseudonyms with bounded retention", () => {
  const key = "auth-audit-key-0123456789abcdef0123456789";
  assert.equal(assertAuthAuditHmacKeyV1(key), key);
  assert.throws(
    () => assertAuthAuditHmacKeyV1(key, [key]),
    (error: unknown) => (error as { code?: string }).code === "AUTH_AUDIT_KEY_REUSE",
  );
  const subject = authAuditSubjectHashV1("internal-user-private", key);
  assert.match(subject, /^hmac-sha256:[a-f0-9]{64}$/u);
  assert.equal(subject.includes("internal-user-private"), false);
  assert.notEqual(
    subject,
    authAuditSubjectHashV1("internal-user-private", "different-auth-audit-key-0123456789abcdef"),
  );
  assert.equal(
    retentionDeadlineV1("2026-07-18T00:00:00.000Z", 30),
    "2026-08-17T00:00:00.000Z",
  );
});

test("legacy auth export advertises a small bounded three-domain portable manifest", async () => {
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => "portable-export-user",
  );
  await repository.ensureAccount({
    firebaseUid: "firebase-export",
    identity: google("google-export"),
    allowAnonymousUpgrade: false,
  });
  const auth = await repository.exportAccount("firebase-export");
  assert.equal(auth.portableManifestHref, "/api/auth/export-portable");
  const manifest = createAccountPortableExportManifestV1(auth, "2026-07-18T01:00:00.000Z");
  assert.deepEqual(manifest.includedScopes, ["auth", "sync", "premium"]);
  assert.equal(manifest.consistency, "independent_section_snapshots");
  assert.equal(manifest.sections.auth.data.account.providers[0].provider, "google");
  assert.equal(manifest.sections.sync.href, "/api/v1/sync/export");
  assert.equal(manifest.sections.premium.href, "/api/v1/premium/account/export");
  assert.equal(manifest.sections.premium.bounds.maxResponseBytes, 3 * 1024 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify(manifest), "utf8") < 64 * 1024);
  assert.equal(JSON.stringify(manifest).includes("google-export"), false);
});

test("only launch providers can establish a primary public session", () => {
  for (const provider of ["google", "kakao_oidc", "email_link", "anonymous"] as const) {
    assert.doesNotThrow(() => assertPublicSessionProvider(provider));
  }
  for (const provider of ["apple", "phone", "facebook", "oidc"] as const) {
    assert.throws(() => assertPublicSessionProvider(provider), /primary|step-up/i);
  }
});

test("anonymous bridge is opt-in and restricted to explicit sync or payment intents", () => {
  for (const intent of ["sync", "payment"] as const) {
    assert.doesNotThrow(() => assertAnonymousBridgeIntent(intent));
  }
  for (const intent of ["sign_in", "account_upgrade"] as const) {
    assert.throws(
      () => assertAnonymousBridgeIntent(intent),
      (error: unknown) => (error as { code?: string }).code === "ACCOUNT_UPGRADE_REQUIRED",
    );
  }

  const previous = process.env.AUTH_ENABLED_PROVIDERS;
  const previousKakao = process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID;
  try {
    process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID = "oidc.kakao";
    process.env.AUTH_ENABLED_PROVIDERS = "google,kakao_oidc,email_link";
    assert.throws(
      () => assertAuthProviderEnabled("anonymous"),
      (error: unknown) => (error as { code?: string }).code === "AUTH_PROVIDER_DISABLED",
    );
    process.env.AUTH_ENABLED_PROVIDERS = "anonymous,google,kakao_oidc,email_link";
    assert.doesNotThrow(() => assertAuthProviderEnabled("anonymous"));
  } finally {
    if (previous === undefined) delete process.env.AUTH_ENABLED_PROVIDERS;
    else process.env.AUTH_ENABLED_PROVIDERS = previous;
    if (previousKakao === undefined) delete process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID;
    else process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID = previousKakao;
  }
});

test("Apple cannot be enabled by configuration before its revocation adapter exists", async () => {
  const previous = process.env.AUTH_ENABLED_PROVIDERS;
  const previousKakao = process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID;
  try {
    process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID = "oidc.kakao";
    process.env.AUTH_ENABLED_PROVIDERS = "google,kakao_oidc,email_link";
    assert.deepEqual(enabledAuthProviders(), ["google", "kakao_oidc", "email_link"]);
    assert.doesNotThrow(() => assertAuthProviderEnabled("google"));
    assert.doesNotThrow(() => assertAuthProviderEnabled("kakao_oidc"));
    assert.doesNotThrow(() => assertAuthProviderEnabled("email_link"));
    assert.throws(
      () => assertAuthProviderEnabled("apple"),
      (error: unknown) => (error as { code?: string }).code === "APPLE_AUTH_REVOCATION_ADAPTER_REQUIRED",
    );

    const policy = await authPolicyHandler(new Request("https://app.example/api/auth/policy"));
    assert.ok(policy instanceof Response);
    const payload = await policy.json() as Record<string, unknown>;
    assert.deepEqual(payload.enabledProviders, ["google", "kakao_oidc", "email_link"]);
    assert.deepEqual(payload.disabledUntilLifecycleAdapter, ["apple"]);
    assert.equal((payload.providerReadyContract as unknown[]).includes("apple"), false);

    process.env.AUTH_ENABLED_PROVIDERS = "google,apple";
    assert.throws(
      enabledAuthProviders,
      (error: unknown) => (error as { code?: string }).code === "APPLE_AUTH_REVOCATION_ADAPTER_REQUIRED",
    );
  } finally {
    if (previous === undefined) delete process.env.AUTH_ENABLED_PROVIDERS;
    else process.env.AUTH_ENABLED_PROVIDERS = previous;
    if (previousKakao === undefined) delete process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID;
    else process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID = previousKakao;
  }
});

test("server-backed sync and paid use require a recoverable primary provider", () => {
  assert.equal(hasPrimarySignInProvider([{ provider: "anonymous" }]), false);
  assert.equal(hasPrimarySignInProvider([{ provider: "phone" }]), false);
  assert.equal(hasPrimarySignInProvider([
    { provider: "anonymous" },
    { provider: "phone" },
  ]), false);
  for (const provider of ["google", "kakao_oidc", "email_link"] as const) {
    assert.equal(hasPrimarySignInProvider([{ provider }]), true);
  }
  assert.equal(hasPrimarySignInProvider([{ provider: "apple" }]), false);
  assert.equal(hasPrimarySignInProvider([{ provider: "google" }, { provider: "apple" }]), true);
});

test("account deletion fence fails closed for in-flight personal-data writes", () => {
  assert.doesNotThrow(() => assertAccountWriteFenceOpenV1({ exists: false }));
  assert.throws(
    () => assertAccountWriteFenceOpenV1({ exists: true }),
    (error: unknown) => (error as { code?: string }).code === "ACCOUNT_DELETION_IN_PROGRESS",
  );
});

test("account deletion blocks on a payment lease and otherwise creates a durable write fence", async () => {
  assert.doesNotThrow(() => assertNoPaymentConfirmationLeaseV1({ exists: false }));
  assert.throws(
    () => assertNoPaymentConfirmationLeaseV1({ exists: true }),
    (error: unknown) => (error as { code?: string }).code === "PAYMENT_RECONCILIATION_REQUIRED",
  );

  const leased = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => "0123456789abcdef0123456789abcdef",
    () => true,
  );
  const leasedAccount = await leased.ensureAccount({
    firebaseUid: "firebase-leased",
    identity: google("google-leased"),
    allowAnonymousUpgrade: false,
  });
  await assert.rejects(
    () => leased.beginAccountDeletion("firebase-leased"),
    (error: unknown) => (error as { code?: string }).code === "PAYMENT_RECONCILIATION_REQUIRED",
  );
  assert.equal(leased.hasAccountDeletionFence(leasedAccount.account.internalUserId), false);
  assert.equal((await leased.getActiveByFirebaseUid("firebase-leased"))?.status, "active");

  let id = 0;
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => `deterministic-entropy-${++id}`,
  );
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-open",
    identity: google("google-open"),
    allowAnonymousUpgrade: false,
  });
  const pending = await repository.beginAccountDeletion("firebase-open");
  assert.match(pending.job.deletionRequestId, /^deletion_request_v1_[a-f0-9]{32}$/u);
  assert.equal(repository.hasAccountDeletionFence(created.account.internalUserId), true);
});

test("phone step-up never counts as the remaining primary sign-in method", async () => {
  const repository = new InMemoryAuthAccountRepository(() => "2026-07-18T00:00:00.000Z", () => "user-1");
  await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
    allowAnonymousUpgrade: false,
  });
  await repository.linkIdentity("firebase-a", {
    provider: "phone",
    issuer: "firebase:phone",
    subject: "firebase-a",
    firebaseProviderId: "phone",
  });
  await assert.rejects(
    () => repository.beginProviderUnlink({ firebaseUid: "firebase-a", identity: google("google-a") }),
    (error: unknown) => (error as { code?: string }).code === "LAST_SIGN_IN_METHOD",
  );
});

test("session revocation covers every linked Firebase UID", async () => {
  const revoked: string[] = [];
  await revokeAllFirebaseSessions({
    async revokeRefreshTokens(uid: string) { revoked.push(uid); },
    async deleteUser() {},
  }, ["uid-a", "uid-b", "uid-a"]);
  assert.deepEqual(revoked.sort(), ["uid-a", "uid-b"]);
});

test("Firebase cleanup reports partial failure instead of claiming deletion", async () => {
  const cleanup = await cleanupFirebaseUsers({
    async revokeRefreshTokens(uid: string) {
      if (uid === "uid-b") throw Object.assign(new Error("private"), { code: "auth/internal-error" });
    },
    async deleteUser() {},
  }, ["uid-a", "uid-b"]);
  assert.equal(cleanup.completed, false);
  assert.deepEqual(cleanup.errorCodes, ["auth/internal-error"]);
});

test("deletion cleanup retry treats an already removed Firebase user as complete", async () => {
  const cleanup = await cleanupFirebaseUsers({
    async revokeRefreshTokens() {
      throw Object.assign(new Error("gone"), { code: "auth/user-not-found" });
    },
    async deleteUser() {
      throw new Error("must not be reached after missing user");
    },
  }, ["already-deleted"]);
  assert.deepEqual(cleanup, { completed: true, errorCodes: [] });
});

test("deletion is fail-closed and remains pending until cleanup completion", async () => {
  let id = 0;
  const repository = new InMemoryAuthAccountRepository(() => "2026-07-18T00:00:00.000Z", () => `id-${++id}`);
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-a",
    identity: google("google-a"),
    allowAnonymousUpgrade: false,
  });
  const pending = await repository.beginAccountDeletion("firebase-a");
  assert.equal(pending.account.status, "deletion_pending");
  assert.equal(pending.job.bindingDigests.length, 1);
  assert.equal(pending.job.deleteAfter, null);
  assert.equal(await repository.getActiveByFirebaseUid("firebase-a"), null);
  await assert.rejects(
    () => repository.ensureAccount({
      firebaseUid: "firebase-a",
      identity: google("google-a"),
      allowAnonymousUpgrade: false,
    }),
    (error: unknown) => (error as { code?: string }).code === "ACCOUNT_INACTIVE",
  );
  await repository.recordAccountDeletionCleanupFailure(
    created.account.internalUserId,
    pending.job.deletionRequestId,
    ["auth/internal-error"],
  );
  const storedJob = await repository.getAccountDeletionJob(pending.job.deletionRequestId);
  assert.equal(storedJob?.status, "pending");
  assert.equal(storedJob?.attemptCount, 1);
  const deleted = await repository.completeAccountDeletion(created.account.internalUserId, pending.job.deletionRequestId);
  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.deleteAfter, "2026-08-17T00:00:00.000Z");
  const completedJob = await repository.getAccountDeletionJob(pending.job.deletionRequestId);
  assert.equal(completedJob?.status, "completed");
  assert.deepEqual(completedJob?.firebaseUids, []);
  assert.deepEqual(completedJob?.bindingDigests, []);
  assert.deepEqual(completedJob?.providerKinds, []);
  assert.equal(completedJob?.deleteAfter, "2026-08-17T00:00:00.000Z");
  const recreated = await repository.ensureAccount({
    firebaseUid: "firebase-after-deletion",
    identity: google("google-a"),
    allowAnonymousUpgrade: false,
  });
  assert.notEqual(recreated.account.internalUserId, created.account.internalUserId);
});

test("cross-domain deletion remains pending after a partial failure and retries idempotently", async () => {
  let id = 0;
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => `deletion-test-entropy-${++id}`,
  );
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-delete-all",
    identity: google("google-delete-all"),
    allowAnonymousUpgrade: false,
  });
  const pending = await repository.beginAccountDeletion("firebase-delete-all");
  const calls: string[] = [];
  let syncAttempt = 0;
  const dependencies: AccountDeletionCleanupDependenciesV1 = {
    async cleanupFirebase() {
      calls.push(`firebase:${pending.job.deletionRequestId}`);
      return { completed: true, errorCodes: [] };
    },
    async deleteSyncData(_userId, deletionRequestId) {
      calls.push(`sync:${deletionRequestId}`);
      syncAttempt += 1;
      if (syncAttempt === 1) {
        throw Object.assign(new Error("must not leak"), { code: "SYNC_TEMPORARY_FAILURE" });
      }
    },
    async purgePremiumData(_userId, deletionRequestId) {
      calls.push(`premium:${deletionRequestId}`);
    },
  };

  const first = await finalizeAccountDeletionJobV1({
    repository,
    job: pending.job,
    recordedByUserId: created.account.internalUserId,
    dependencies,
  });
  assert.equal(first.status, "deletion_pending");
  assert.deepEqual(first.cleanup.domains, { firebase: "completed", sync: "failed", premium: "completed" });
  assert.deepEqual(first.cleanup.errorCodes, ["sync/SYNC_TEMPORARY_FAILURE"]);
  assert.equal(JSON.stringify(first).includes("must not leak"), false);
  assert.equal((await repository.getAccountDeletionJob(pending.job.deletionRequestId))?.attemptCount, 1);

  const retriedJob = await repository.getAccountDeletionJob(pending.job.deletionRequestId);
  assert.ok(retriedJob);
  const second = await finalizeAccountDeletionJobV1({
    repository,
    job: retriedJob,
    recordedByUserId: created.account.internalUserId,
    dependencies,
  });
  assert.equal(second.status, "deleted");
  assert.equal(second.account?.status, "deleted");
  assert.equal((await repository.getAccountDeletionJob(pending.job.deletionRequestId))?.status, "completed");
  assert.equal(calls.filter((entry) => entry.startsWith("firebase:")).length, 2);
  assert.equal(calls.filter((entry) => entry.startsWith("sync:")).length, 2);
  assert.equal(calls.filter((entry) => entry.startsWith("premium:")).length, 2);
  assert.equal(new Set(calls.map((entry) => entry.split(":", 2)[1])).size, 1);
});

test("Apple-linked deletion purges local domains but stays pending without token revocation capability", async () => {
  let id = 0;
  const repository = new InMemoryAuthAccountRepository(
    () => "2026-07-18T00:00:00.000Z",
    () => `apple-deletion-entropy-${++id}`,
  );
  const created = await repository.ensureAccount({
    firebaseUid: "firebase-apple-delete",
    identity: apple("apple-delete-subject"),
    allowAnonymousUpgrade: false,
  });
  const pending = await repository.beginAccountDeletion("firebase-apple-delete");
  assert.deepEqual(pending.job.providerKinds, ["apple"]);
  let firebaseCleanupCalls = 0;
  let syncCleanupCalls = 0;
  let premiumCleanupCalls = 0;
  const result = await finalizeAccountDeletionJobV1({
    repository,
    job: pending.job,
    recordedByUserId: created.account.internalUserId,
    dependencies: {
      async cleanupFirebase() {
        firebaseCleanupCalls += 1;
        return { completed: true, errorCodes: [] };
      },
      async deleteSyncData() { syncCleanupCalls += 1; },
      async purgePremiumData() { premiumCleanupCalls += 1; },
    },
  });
  assert.equal(result.status, "deletion_pending");
  assert.deepEqual(result.cleanup.errorCodes, ["apple/revocation-adapter-required"]);
  assert.deepEqual(result.cleanup.domains, { firebase: "failed", sync: "completed", premium: "completed" });
  assert.equal(firebaseCleanupCalls, 1, "Firebase cleanup should progress without impersonating Apple revocation");
  assert.equal(syncCleanupCalls, 1);
  assert.equal(premiumCleanupCalls, 1);
  assert.equal((await repository.getAccountDeletionJob(pending.job.deletionRequestId))?.status, "pending");
});

test("auth rate-limit seam receives only a server-trusted scope and subject", async () => {
  const calls: Array<[string, string]> = [];
  setAuthRateLimiterForTests({
    async consume(scope, trustedSubject) { calls.push([scope, trustedSubject]); },
  });
  try {
    await consumeAuthRateLimit("delete", "sess_server_derived");
    assert.deepEqual(calls, [["delete", "sess_server_derived"]]);
  } finally {
    setAuthRateLimiterForTests(null);
  }
});

test("session pre-auth limiting trusts only the platform IP in production and an explicit fixed IP locally", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDevIp = process.env.AUTH_TRUSTED_DEV_CLIENT_IP;
  const previousRateLimitMode = process.env.AUTH_RATE_LIMIT_MODE;
  const calls: Array<[string, string]> = [];
  setAuthRateLimiterForTests({
    async consume(scope, trustedSubject) { calls.push([scope, trustedSubject]); },
  });
  try {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_RATE_LIMIT_MODE;
    assert.equal(authRateLimitModeV1(), "required");
    process.env.AUTH_RATE_LIMIT_MODE = "disabled";
    assert.throws(
      () => authRateLimitModeV1(),
      (error: unknown) => (error as { code?: string }).code === "INVALID_AUTH_CONFIG",
    );
    process.env.AUTH_RATE_LIMIT_MODE = "required";
    assert.equal(
      trustedAuthClientIpV1({ headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.8" }) }),
      "203.0.113.8",
    );
    assert.throws(
      () => trustedAuthClientIpV1({ headers: new Headers({ "x-forwarded-for": "203.0.113.8" }) }),
      (error: unknown) => (error as { code?: string }).code === "TRUSTED_CLIENT_IP_UNAVAILABLE",
    );
    for (const value of [null, "203.0.113.8, 10.0.0.1", "not-an-ip"]) {
      assert.throws(
        () => trustedAuthClientIpV1({
          headers: value === null ? new Headers() : new Headers({ "x-vercel-forwarded-for": value }),
        }),
        (error: unknown) => (error as { code?: string }).code === "TRUSTED_CLIENT_IP_UNAVAILABLE",
      );
    }

    process.env.NODE_ENV = "test";
    process.env.AUTH_TRUSTED_DEV_CLIENT_IP = "127.0.0.1";
    const spoofed = { headers: new Headers({ "x-forwarded-for": "198.51.100.99" }) };
    assert.equal(trustedAuthClientIpV1(spoofed), "127.0.0.1");
    await consumeAuthSessionPreflightRateLimitV1(spoofed);
    assert.deepEqual(calls, [["sessionPreAuth", "ip:127.0.0.1"]]);

    delete process.env.AUTH_TRUSTED_DEV_CLIENT_IP;
    assert.throws(
      () => trustedAuthClientIpV1(spoofed),
      (error: unknown) => (error as { code?: string }).code === "TRUSTED_CLIENT_IP_UNAVAILABLE",
    );
  } finally {
    setAuthRateLimiterForTests(null);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDevIp === undefined) delete process.env.AUTH_TRUSTED_DEV_CLIENT_IP;
    else process.env.AUTH_TRUSTED_DEV_CLIENT_IP = previousDevIp;
    if (previousRateLimitMode === undefined) delete process.env.AUTH_RATE_LIMIT_MODE;
    else process.env.AUTH_RATE_LIMIT_MODE = previousRateLimitMode;
  }
});

test("admin role requires both the persisted role and current custom claim", () => {
  const account = {
    internalUserId: "user-1",
    status: "active",
    roles: ["user", "admin"],
    providers: [],
    firebaseUids: ["firebase-a"],
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    lastAuthenticatedAt: "2026-07-18T00:00:00.000Z",
    deletionRequestedAt: null,
    deletedAt: null,
    deleteAfter: null,
    version: 1,
  } as const;
  assert.deepEqual(effectiveAccountRoles(account, { uid: "firebase-a" } as DecodedIdToken), ["user"]);
  assert.deepEqual(effectiveAccountRoles(account, { uid: "firebase-a", admin: true } as unknown as DecodedIdToken), ["user", "admin"]);
});

test("browser role projection never exposes premium_system or unknown internal roles", () => {
  assert.deepEqual(
    toBrowserVisibleAccountRoles(["premium_system", "user", "internal_future", "premium_admin", "admin"]),
    ["user", "admin", "premium_admin"],
  );
});
