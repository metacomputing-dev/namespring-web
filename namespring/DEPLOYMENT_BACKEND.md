# Backend deployment boundary

This file records deployment prerequisites that source-level tests cannot prove.
Passing unit tests is not production deployment evidence.

## Vercel project boundary

- Configure the Vercel project **Root Directory** as `namespring`. The
  `vercel.json`, `api` functions, frontend build, and relative `includeFiles`
  paths are defined from that root.
- Enable **Include source files outside of the Root Directory**. The register
  function requires the sibling `../lib/seed-ts` and `../lib/spring-ts` assets.
  Vercel documents this as a project setting for monorepos; it cannot be made
  self-verifying by `vercel.json` alone.
- Use Vercel CLI 20.1.0 or newer for monorepo source inclusion. Link the actual
  staging project before treating `vercel build` as representative.
- Only `api/v1/premium/reports/register.ts` may receive the four engine assets.
  Checkout, confirm, delivery, webhook, export, auth, sync, content, and legacy
  refund functions must remain free of the filesystem SpringEngine adapter.
- After a linked `vercel build`, inspect the generated function output and
  verify the register function contains all four files while another premium
  function contains none. Record compressed/uncompressed function size and a
  cold registration timing. The platform's uncompressed function limit still
  applies even when `includeFiles` is configured.
- Configure an independent `CRON_SECRET` of at least 32 bytes. Vercel invokes
  `/api/internal/maintenance/sync` with GET at minute 17 of every UTC hour and
  `/api/internal/maintenance/auth` every five minutes and
  `/api/internal/maintenance/premium` every two minutes, and
  `/api/internal/maintenance/premium-expiry` every fifteen minutes, supplying this value
  as a Bearer token. None of these routes accepts a query, body, cookie, User-Agent, or
  schedule header as authentication.
- Sub-daily cron requires Vercel Pro or Enterprise. A Hobby deployment with
  any of the checked-in sub-daily schedules is rejected rather than merely
  delayed; verify the linked project's plan before deployment and treat that
  rejection as a launch blocker. Do not silently remove or weaken the workers
  to make a production deployment pass. Vercel Cron is best-effort,
  can overlap or duplicate an invocation, and does not retry failed functions.
  Keep the Firestore claim/fencing state and configure an external dead-man
  alert against the latest successful sync-retention, auth-lifecycle,
  premium-payment-reconciliation, and premium-unpaid-expiry heartbeats before launch. Auth runs are
  bounded to two deletion and five provider-unlink candidates with a 45-second
  internal deadline. Premium runs
  are sequential and bounded to three due payment leases, a 45-second internal
  deadline, 12 seconds per Toss request, and aggregate-only output. Manual and
  cron premium reconciliation share the same durable claim/fence.
  Premium expiry runs are separately fenced and bounded to 20 candidates.
- Keep `TOSS_API_BASE_URL` unset or exactly
  `https://api.tosspayments.com`. Sandbox/test credentials use the same host;
  alternate schemes, hosts, credentials, paths, queries, and fragments are a
  launch-blocking configuration error before any Basic secret is constructed.
  Both legacy recovery and premium clients stream-decode at most 128 KiB of a
  provider response.
- The two content export start routes have an explicit 300-second maximum.
  This project's Pro/Enterprise requirement comes independently from the
  checked-in sub-daily cron schedules; current Vercel documentation also allows
  a 300-second Fluid Compute duration on Hobby. Fluid Compute is the selected
  large-export operating model here, not a claim that only Pro can run for 300
  seconds. Verify that it is enabled and measure the real function before using
  the 21,060-item development corpus; do not rely on an unverified dashboard
  default. Before enabling large export, set
  `CONTENT_EXPORT_OPERATIONAL_STATE=large_catalog_v1_reviewed` and set
  `CONTENT_EXPORT_MAX_ACTIVE_ARTIFACTS` to a narrow reviewed ceiling between
  2,501 and 25,000 (for the current corpus, at least 21,060). Missing, malformed,
  or undersized values fail before the full metadata query. A 21,060-item
  snapshot uses 211 TTL-owned metadata chunks across five conservative writes,
  and only the final
  catalog-revision transaction publishes its owner-bound header. A timeout can
  therefore leave invisible TTL staging documents but never a readable partial
  snapshot. The build runner retries by starting a new session; start is capped
  at four attempts per administrator per hour. Page reads first consume a
  1,200/hour administrator-global budget and then a 600/hour owner+opaque-export
  session budget; finalization similarly uses global 40/hour plus session 20/hour.
  Random export IDs therefore cannot multiply the global cost budget. Pages retain the 1.5 MiB byte
  ceiling and offset cursor. `content_export_progress_v1` transactionally
  records the only next cursor and served artifact count; exact retries are
  idempotent, skipped/out-of-order pages fail, and finalization is unavailable
  until every artifact has been served. Progress uses the same 24-hour native
  Timestamp TTL because deleting the parent header does not delete its
  subcollection.
  Alert on start failures and abnormal orphan-chunk growth, and budget for one
  full metadata read plus chunk writes per start attempt. Fluid Compute or a
  300-second setting alone is not evidence that the real Firebase region,
  indexes, and corpus complete within the bound: record a staging timing before
  launch.
  Keep `content_export_snapshots_v1.ownerSubjects` exempt from automatic
  indexing; it exists only for server-side owner authorization across content
  audit-key rotation and must not create queryable HMAC index entries.
  Keep `content_export_chunks_v1.entries` exempt as well. Each write batch is
  capped at 50 maximum-100-entry documents so worst-case identifiers retain
  material headroom below Firestore's 10 MiB commit boundary.

Required register assets:

- `public/data/hanja.db`
- `public/data/fourframe.db`
- `../lib/seed-ts/assets/sql-wasm-1.14.1.wasm`
- `../lib/spring-ts/data/name-stat/name-stat-summary.v1.bin`

References:

- <https://vercel.com/docs/project-configuration/vercel-json#functions>
- <https://vercel.com/docs/fluid-compute>
- <https://vercel.com/docs/cron-jobs/usage-and-pricing>
- <https://vercel.com/docs/monorepos/monorepo-faq#can-i-share-source-files-between-projects-are-shared-packages-supported>
- <https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions>

## Firestore boundary

- Deploy `firestore.rules` and `firestore.indexes.json` from the `namespring`
  directory (`firebase.json` resolves both relative paths there).
- Client rules are a universal deny. All backend access uses Firebase Admin;
  never add a browser read exception for premium, auth, sync, or content data.
- Session creation consumes a bounded pre-authentication IP bucket before ID
  token verification and a separate Firebase-UID bucket afterward. Production
  trusts only Vercel's dedicated single-value `x-vercel-forwarded-for`; it does
  not fall back to generic `x-forwarded-for`, which an upstream proxy may
  replace. A missing, chained, or invalid value fails closed. Raw addresses are never stored or
  logged by this path: the generic rate limiter immediately derives its
  domain-separated HMAC document key. Local/test runs ignore forwarding
  headers and require `AUTH_TRUSTED_DEV_CLIENT_IP` explicitly.
- Free/local use never creates a Firebase principal or server account. If the
  anonymous bridge is enabled after staging validation, `anonymous` must be in
  the backend `AUTH_ENABLED_PROVIDERS` allowlist and is accepted only for an
  explicit `sync` or `payment` intent. It remains rejected for `sign_in` and
  generic `account_upgrade` requests.
- Enabling `kakao_oidc` also requires `AUTH_KAKAO_FIREBASE_PROVIDER_ID` to equal
  the exact Firebase console provider ID. Generic OIDC is future-disabled and,
  if later enabled, accepts only the exact bounded IDs in
  `AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS`; substring/provider-family matching
  is forbidden for account-recovery bindings.
- The auth account repository does not infer that a target project is empty.
  `AUTH_ACCOUNT_STORAGE_CUTOVER_STATE=prelaunch_empty_v1_verified` is permitted
  only after recording a target-project query/export proving that
  `authAccountsV1`, `authFirebasePrincipalsV1`, `authIdentityBindingsV1`,
  `authDeletionJobsV1`, `authProviderUnlinkJobsV1`, `authAuditEventsV1`,
  `accountDeletionFencesV1`, `authRoleProvisioningReceiptsV1`, and
  `authRoleProvisioningLeasesV1` are empty. If any document exists, freeze auth
  writes, preserve a rollback export, migrate every account/principal/binding
  to the exact version-1 codec (including explicit `pendingProviderUnlink` and
  lifecycle-consistent `deleteAfter`),
  verify one-to-one principal and binding ownership plus lifecycle-job
  references, and only then use `legacy_v1_migration_verified`. Missing or
  unknown state returns 503 before Firestore account access.
- Provider-binding privacy has a separate, paired v2 cutover gate. A verified
  empty account store must set
  `AUTH_IDENTITY_BINDING_CUTOVER_STATE=prelaunch_empty_hmac_v2_verified`; an
  existing store must set
  `legacy_sha256_to_hmac_v2_migration_verified`. Configure one independently
  generated 32-256-byte `AUTH_IDENTITY_BINDING_HMAC_KEY`. The backend derives
  only domain-separated `hmac-sha256:v2:` binding IDs and rejects missing,
  short, reused, or whitespace/control-bearing key material. It never probes
  legacy raw-SHA IDs at runtime.
- For an existing store, freeze session/link/unlink/deletion writes and both
  lifecycle workers; preserve a rollback export; enumerate every account,
  binding, pending unlink, and pending deletion reference. Reconstruct each
  exact provider subject from verified Firebase/provider records (never from
  email text), prove each legacy SHA binding maps one-to-one, rewrite binding
  document IDs and every account/job reference in bounded transactions, then
  prove counts, ownership, lifecycle references, login recovery, unlink, and
  deletion against the snapshot. Any unmappable or ambiguous binding blocks
  cutover and requires explicit reauthentication/support recovery. Independently
  review the evidence and prove that no 64-hex legacy binding remains before
  setting the migration attestation. Rotating the HMAC key requires the same
  frozen-write migration; removing the old key first would orphan accounts.
- Completed auth accounts retain only a disconnected tombstone long enough for
  deletion retry/audit consistency. `authAccountsV1.deleteAfter` is a native
  Firestore `Timestamp` and TTL-removes that tombstone after the same bounded
  retention window as the completed deletion job; it is never used as an
  immediate authorization transition.
- Whole-record AES-GCM `ciphertext`, random `iv`, and
  `authenticationTag` fields are exempt from automatic indexing for every
  sealed collection group. The owner-resource subcollection uses the generic
  collection-group name `items` and must retain the same exemptions.
- `accountPaymentLeasesV1.dueAt` intentionally keeps its ascending single-field
  index because the bounded reconciliation worker performs a due-time range
  query. Do not convert `dueAt` into TTL: silently deleting an unreconciled
  payment lease would allow account deletion to race an unknown charge.
- TTL fields are top-level Firestore `Timestamp` values. The live
  `account_sync_v1.expiresAt` field is query-indexed but deliberately is not a
  TTL field: the transactional sweeper alone owns live-data deletion so the
  source delete, HMAC-only receipt, and payload-free audit are atomic. Request
  receipts, deletion receipts, and audit events remain Firestore-TTL-owned.
- `premium_v1_unpaid_expiry_candidates.expiresAt` is query-indexed, not TTL.
  Its transactional sweeper is the only authority allowed to delete unpaid
  source/index/projection state. Only completed, metadata-only
  `premium_v1_unpaid_expiry_receipts.deleteAfter` uses TTL.
- TTL deletion is asynchronous. Monitor expired-document backlog and do not use
  TTL as an immediate authorization or financial-state transition.
- Firestore TTL deletes require a Firebase project with billing enabled and are
  billed document deletes; they are not covered by free usage. Treat missing
  billing or any undeployed TTL policy from `firestore.indexes.json` as a
  production launch blocker. Verify every policy in the target project, set
  budget alerts, and retain the application-level authorization/deletion checks
  while asynchronous TTL cleanup is pending.

Before production, deploy to a disposable Firebase project and run:

1. rules denial checks with an untrusted client;
2. content composite queries, the live sync-retention and premium unpaid-expiry `expiresAt` queries, and
   both auth `status + nextAttemptAt` due-job queries;
3. due payment-lease ordering and pagination;
4. TTL policy inspection for every configured collection group;
5. emulator transaction races for payment confirmation, reconciliation, unpaid expiry,
   account deletion, retained-ledger handoff, and a sync write that extends
   `expiresAt` after the retention query but before its transaction commits;
6. Firebase Auth Emulator token exchange from an anonymous sync intent through
   same-UID email account promotion, hardened session-cookie issuance, Admin SDK
   cookie verification, and single-account Firestore persistence;
7. an authenticated cron invocation, duplicate/overlap fencing, expired-claim
   takeover, bounded aggregate-only response, and missing-run alert.

References:

- <https://firebase.google.com/docs/firestore/query-data/index-overview>
- <https://firebase.google.com/docs/firestore/ttl>
- <https://firebase.google.com/docs/firestore/pricing>

Vercel Cron references:

- <https://vercel.com/docs/cron-jobs>
- <https://vercel.com/docs/cron-jobs/manage-cron-jobs>
- <https://vercel.com/docs/cron-jobs/usage-and-pricing>

## Premium owner and audit-key boundary

- `PREMIUM_OWNER_V2_CUTOVER_STATE` is mandatory and exact. Use
  `prelaunch_empty_v1_verified` only with a recorded full-store proof that no
  v1 owner/index key exists. Use `legacy_v1_migration_verified` only after the
  frozen-write migration, one-to-one identity mapping, owner-key rewrite,
  count/digest reconciliation, v1-absence scan, and independent review in the
  premium operations runbook. Never use runtime v1 fallback or dual-owner
  authorization as a migration shortcut.
- `PREMIUM_AUDIT_HMAC_KEYRING_JSON` must contain a dedicated current key and all
  still-referenced historical keys. Keys must be distinct from auth,
  rate-limit, sync, Toss, content, and premium-encryption secrets. Audit actor
  and session pseudonyms embed the producing key ID; raw identifiers must not
  appear in stored audit envelopes or operational exports.
- Retain historical audit keys for the complete 365-day retention interval and
  until asynchronous Firestore TTL deletion is observed. Missing historical
  keys fail verification closed; owner v2 and paid access must remain unchanged
  when audit or encryption keys rotate.

Before enabling premium routes in staging, rehearse owner cutover from a
snapshot and rotate the audit current key while retaining the prior key. Prove
registration/index replay, checkout, confirmation, entitlement delivery,
refund/revoke, export, and purge continuity; correlate both pre- and
post-rotation audit pseudonyms; then prove that removing a referenced audit key
fails verification without broadening access. Preserve the evidence with the
release record.

## Local verification

```text
npm run typecheck:backend
npm run test:deployment-boundaries
npm run test:backend-contracts
npm run test:emulator:maintenance
```

The emulator command requires the project-pinned Java 21 and Firebase CLI. It starts
both Authentication and Firestore under a unique local-only `demo-*` project,
supplies no external credential, caps the whole run at three minutes, and cleans
its collections and debug log. The Auth boundary deliberately exercises real
emulator-issued ID tokens plus Admin SDK `verifyIdToken`, `createSessionCookie`,
and `verifySessionCookie`; it is not a decoded-token mock. Never set
`FIREBASE_AUTH_EMULATOR_HOST` in production. Cache the official Firestore
emulator binary directory in CI to avoid repeated downloads.

Reference:

- <https://firebase.google.com/docs/emulator-suite/connect_auth>
