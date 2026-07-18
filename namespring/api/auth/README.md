# Authentication backend contract

This API is outside the free calculation path. Free saju, naming analysis,
Hanja lookup, favorites, drafts, and input memory remain local until the user
explicitly asks to synchronize or pay.

## Routes

- `GET /api/auth/policy`: safe capability discovery; an empty enabled-provider
  list means deployment is not configured yet.
- `GET /api/auth/csrf`: issues an HttpOnly `__Host-namespring_csrf` cookie and
  returns its matching value. Keep the returned value in memory.
- `POST /api/auth/session`: exchanges a recent Firebase ID token for an
  HttpOnly `__Host-namespring_session` cookie. Anonymous tokens are accepted
  only for an explicit account-upgrade, sync, or payment intent.
- `GET /api/auth/current`: returns only effective roles, account state, and
  linked-provider summaries. Internal user/session IDs remain server-only. With
  no cookie it returns the free/local
  anonymous state without initializing Firebase.
- `POST /api/auth/link`: requires the current session, CSRF, recent
  reauthentication, a post-link token, and the same Firebase UID. A provider
  identity already bound to another internal user fails closed.
- `POST /api/auth/unlink`: starts a durable two-phase unlink after recent
  reauthentication. One Firestore transaction reserves the exact hashed
  binding and proves another primary sign-in method remains; it does not remove
  the binding yet. The server then confirms the exact Firebase provider ID and
  subject, calls Admin `providersToUnlink`, re-reads ambiguous outcomes, revokes
  refresh tokens for every related Firebase UID, and only then removes the
  internal binding. A partial or ambiguous outcome returns `202 pending`, keeps
  the account fail-closed, and clears the session and CSRF cookies. The client
  must never call Firebase `unlink()` separately. Firebase's `emailLink`
  sign-in method is canonicalized to the Admin/UserRecord provider ID
  `password` before reservation.
- `POST /api/auth/logout`: clears this browser session.
- `POST /api/auth/revoke`: recent reauthentication, revokes all Firebase
  refresh/session tokens for the current Firebase principal, then clears the
  browser cookies.
- `GET /api/auth/export`: keeps the legacy, bounded auth-only export contract.
- `GET /api/auth/export-portable`: returns a small portable-export manifest.
  The auth section is inline; authenticated sync and paid export endpoints are
  listed separately so encrypted favorites and paid deliveries cannot overflow
  one serverless response. Each section records its own snapshot time. Sync is
  bounded by 100 encrypted favorites; paid export is bounded by 1,000 items and
  3 MiB and fails closed if the account exceeds either limit.
- `POST /api/auth/delete`: recent reauthentication plus literal `DELETE`, then
  atomically checks that no payment-confirmation lease exists, creates the
  cross-domain account-deletion fence, changes identity/principal mappings into
  fail-closed tombstones, and creates a durable deletion outbox job. Keeping
  the hashed mappings until cleanup completes prevents a still-valid Firebase
  token from recreating a second account during deletion. Firebase users, sync
  payloads, and paid personal data must all be purged before those tombstones
  are removed and the auth account becomes `deleted`. Any partial failure
  returns `202 deletion_pending`.
- `POST /api/auth/admin/list-lifecycle-jobs`: dual-authorized, Origin/CSRF
  protected metadata-only discovery for deletion and provider-unlink jobs.
  Optional kind/status filters and a signed opaque cursor page at most 20 rows
  from an immutable `requestedAt + requestId` ordering; the JSON response is
  capped at 64 KiB. Internal user IDs, Firebase UIDs, provider identity fields,
  binding digests, raw errors, and claim tokens are never projected.
- `POST /api/auth/admin/get-lifecycle-job`: retrieves the same bounded public
  projection for one kind-bound request ID. Successful list and successful or
  missing detail reads write a fail-closed HMAC-pseudonymized discovery audit
  before returning; neither the operator ID nor request ID is stored in clear.
- `POST /api/auth/admin/retry-deletion`: dual-authorized admin retry for a
  pending deletion job. It uses the same fenced claim/reconcile core as the
  automatic worker and may bypass retry backoff, but it cannot steal a live
  claim. Each retry uses the same deletion request ID. Legally retained payment
  records are minimized and pseudonymized by the paid repository rather than
  exposed to auth.
- `POST /api/auth/admin/retry-unlink`: dual-authorized, Origin/CSRF protected
  retry for a pending provider-unlink job. It re-observes Firebase before every
  mutation and is idempotent across update timeouts, token-revocation failures,
  and internal-finalization retries. It shares the worker's claim/fence core;
  the route never returns internal user IDs, Firebase UIDs, provider subjects,
  tokens, or raw upstream errors.
- `GET /api/internal/maintenance/auth`: `CRON_SECRET`-authenticated, aggregate-
  only lifecycle drain. Vercel invokes it every five minutes. Each run claims
  at most two deletion jobs and five provider-unlink jobs and stops before its
  fixed deadline. Duplicate invocations, expired-lease takeover, and stale
  completions are serialized by transactionally incremented fences.

Every mutation requires an exact allowlisted `Origin`, the CSRF cookie, and the
same value in `X-CSRF-Token`. Cookies are Secure, HttpOnly, host-only, and do not
contain names, birth data, provider tokens, or preferences.

Public auth mutations accept only an exact plain JSON object and reject arrays,
unknown keys, exotic prototypes, and value coercion before token verification.
`session`, `unlink`, `delete`, and `revoke` bodies are capped at 20 KiB; `link`
is capped at 36 KiB because it carries two independently bounded ID tokens.
Tokens are never copied into responses, audit payloads, or diagnostic details.

Routine browser responses for session creation/current state, provider
link/unlink, account deletion, session revocation, and administrator retries do
not expose the internal account or session ID. Those identifiers remain
available to server-side authorization, rate limiting, repositories, and audit
actors. The explicit account portability exports are the only auth responses
that retain the account's own `userId` by contract.

The account repository keeps `auth-accounts-repository.ts` as a stable import
barrel. Contracts, pure lifecycle/projection logic, the in-memory test double,
Firestore codecs, and the Firestore implementation live in separate acyclic
modules. Storage implementations depend inward on the contract and pure logic;
the contract never imports either implementation. This preserves existing API
imports while keeping transaction and persistence code independently testable.

An exact verified Google/Kakao/provider-subject binding may restore an
existing internal account and is reported as `recoveredExistingAccount`.
Matching email text never restores or merges accounts: email-link and phone
bindings remain scoped to their Firebase UID. Anonymous-to-provider promotion
therefore requires the Firebase client to link the credential to the same UID;
credential-in-use/split-account conflicts fail closed for explicit support
resolution rather than silently joining data.

## Required deployment configuration

- Firebase Admin: `FIREBASE_SERVICE_ACCOUNT_JSON`, or
  `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.
- `AUTH_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins. Configure each
  approved production/preview origin; do not use wildcards.
- `AUTH_ENABLED_PROVIDERS`: comma-separated allowlist from
  `anonymous,google,kakao_oidc,email_link,apple,phone,facebook,oidc`. It defaults
  to empty (fail closed). `apple` is recognized only so the contract can reject
  it with an explicit lifecycle-adapter error; configuration alone cannot
  enable Apple login. The Firebase anonymous bridge also remains disabled unless
  `anonymous` is explicitly present in this validated backend allowlist. Even
  then, the session endpoint accepts it only for a caller-selected `sync` or
  `payment` intent; free/local use, `sign_in`, and generic `account_upgrade`
  never create an anonymous server account.
- `AUTH_KAKAO_FIREBASE_PROVIDER_ID`: exact Firebase Authentication OIDC
  provider ID configured for Kakao (for example `oidc.kakao`). It is mandatory
  whenever `kakao_oidc` is enabled; provider-family or substring matching is
  never used for durable account bindings.
- `AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS`: future-only bounded comma-separated
  exact provider IDs. It must remain empty unless the generic `oidc` adapter and
  every listed provider have passed their lifecycle gates. Changing either ID
  setting with existing bindings requires an explicit frozen-write migration.
- Optional bounded settings: `AUTH_SESSION_DAYS` (1-14, default 5),
  `AUTH_RECENT_AUTH_MAX_AGE_SECONDS` (60-900, default 300), and
  `AUTH_CSRF_TTL_SECONDS` (300-86400, default 3600).
- `AUTH_IDENTITY_BINDING_HMAC_KEY` is an independently generated, immutable
  32-256-byte server-only key. Provider binding document IDs and account/job
  references use `hmac-sha256:v2:<digest>` over an explicit provider-binding
  domain plus the exact provider, issuer, Firebase provider ID, and verified
  subject. The key must
  not equal any audit, role, rate-limit, sync, cron, Toss, content, premium, or
  encryption key. There is no runtime unkeyed-SHA lookup fallback.
- `AUTH_IDENTITY_BINDING_CUTOVER_STATE` must be exactly
  `prelaunch_empty_hmac_v2_verified` when the account-store attestation is the
  verified-empty path, or
  `legacy_sha256_to_hmac_v2_migration_verified` when the account-store
  attestation is the existing-store migration path. A missing, unknown, or
  mismatched pair fails before account Firestore access.
- `AUTH_AUDIT_HMAC_KEY` (at least 32 bytes) is required for Firestore auth
  mutations. It must be independently generated and must not equal the rate
  limit, sync-deletion, CRON, Toss, premium audit/content/encryption, or any
  other domain key material.
- `AUTH_ROLE_PROVISIONING_HMAC_KEY` (32-256 bytes) independently pseudonymizes
  trusted role receipts, operators, and target accounts. It is rejected if it
  equals any configured auth, rate-limit, sync, cron, Toss, content, premium,
  or encryption secret.
- `RATE_LIMIT_HMAC_KEY` (at least 32 bytes) is required when
  `AUTH_RATE_LIMIT_MODE=required`; production defaults to required. Development
  defaults to disabled. An edge/WAF limit is still required for invalid-token
  and public CSRF traffic that has no trusted account subject yet.

Firebase console/client setup must enable only the chosen launch providers.
The intended launch set is Kakao OIDC, Google, and passwordless email link;
Apple is hard-disabled until a reviewed server adapter captures and revokes its
credentials and processes credential-revoked notifications. Phone, Facebook,
and generic OIDC remain disabled until their console configuration, abuse
controls, and product flows have been reviewed. Do not enable Firebase
email/password when using the `email_link` mapping.

Firestore collections `authAccountsV1`, `authFirebasePrincipalsV1`,
`authIdentityBindingsV1`, `authAuditEventsV1`, `authDeletionJobsV1`,
`authProviderUnlinkJobsV1`,
`authRoleProvisioningReceiptsV1`, `authRoleProvisioningLeasesV1`,
`accountDeletionFencesV1`, and `accountPaymentLeasesV1` are Admin-SDK-only.
Client security rules must deny direct reads/writes. Provider subjects are
domain-separated, dedicated-key HMAC pseudonyms before persistence. Email and phone values are deliberately not
account merge keys.

`authAuditEventsV1` never stores a raw internal user ID. Account and operator
subjects are dedicated-key HMAC pseudonyms, audit payloads exclude provider
subjects and cleanup error text, and root `deleteAfter` timestamps enforce a
365-day Firestore TTL. A completed deletion job is minimized immediately
(`firebaseUids`, provider-binding digests, and errors are emptied) and receives
a 30-day root Timestamp TTL. Pending jobs have no TTL so cleanup cannot be
silently abandoned. Deploy the matching TTL field overrides from
`firestore.indexes.json`; code alone does not activate Firestore TTL policy.

Provider-unlink jobs follow the same retention rule: while pending they retain
only the server-required Firebase UID list, exact Firebase provider ID, issuer,
and a dedicated-key, domain-separated binding HMAC. They never persist the reauthentication token or
raw provider subject. Completion immediately empties the UID list and binding
digest and assigns a 30-day TTL. A reservation is an account-level mutex, so a
second unlink, provider link, session recreation, export, or account deletion
cannot race past an externally ambiguous operation. Successful reconciliation
revokes all related Firebase refresh tokens; users sign in again through the
remaining primary provider.

Apple does not count as a server-backed primary recovery provider. Session
creation, link, and unlink fail closed for Apple even if an operator adds it to
`AUTH_ENABLED_PROVIDERS`. A legacy Apple-linked account deletion still advances
ordinary Firebase, sync, and premium cleanup, but its durable deletion job stays
pending with a sanitized adapter-required code until Apple token revocation is
implemented and verified. Firebase user deletion is not evidence that the
Apple authorization was revoked.

Both auth outboxes keep root `nextAttemptAt`, `claimUntil`, `claimToken`,
`fence`, and `backoffMs` metadata. Failures use deterministic exponential
backoff from 30 seconds to a six-hour cap (no jitter); manual retries share the
same claim path and only bypass `nextAttemptAt`. A pending job always has
`deleteAfter: null`. Only a successfully minimized completed job becomes TTL
eligible. Deploy both `status + nextAttemptAt` and `status + requestedAt`
composite indexes before enabling the cron and administrator discovery, then
alert on repeated partial outcomes or a stale lifecycle
heartbeat; a passing source test is not deployment evidence.

The deletion fence is intentionally durable after completion. Every normal
sync/paid personal-data transaction reads it before its first write. Only the
idempotent `account_deletion` cleanup path may cross it. Payment confirmation
acquires `accountPaymentLeasesV1/{internalUserId}` before calling the provider;
deletion fails with `PAYMENT_RECONCILIATION_REQUIRED` while that lease exists.
Do not delete a stuck lease manually: reconcile the provider payment, release
the lease through the paid workflow, then retry account deletion.

## Administrative roles

All accounts start with the immutable persisted `user` role. A privileged role
is effective only when it exists both in `authAccountsV1.roles` and in the
current Firebase custom claims (`admin: true` or `roles`). There is
intentionally no public role-assignment endpoint. The trusted `npm run
auth:role` CLI is dry-run by default and requires the exact `--confirm APPLY`
flag to mutate. It uses idempotent request IDs, a target-scoped fenced lease,
claims readback, refresh-token revocation, and a 365-day pseudonymized receipt;
see `docs/AUTH_ROLE_PROVISIONING_RUNBOOK_V1.md`.

Only `admin` and `premium_admin` may be granted to human accounts.
`premium_system` is reserved for a separate service-actor mechanism. If it is
found in persisted human roles or Firebase claims, normal provisioning fails
closed and only the explicit `revoke premium_system` migration is accepted.
Routine browser role projection includes only `user`, `admin`, and
`premium_admin`; it never reveals `premium_system` or unknown claim keys.

## Launch gates

The code contract does not prove that provider consoles, redirect URIs, email
templates, Apple private-email relay/revocation, Firestore rules/indexes,
secrets, or custom claims are deployed. Exercise each enabled provider and
deletion/revoke flow in a Firebase/Toss staging project before production
activation.
