# Account sync and privacy operations (v1)

Free calculation remains local and login-free. These routes are used only after account conversion and explicit synchronization consent.

## Privacy and encryption boundary

- Cookies contain only the secure session/CSRF material. Birth input, names, Hanja, candidate IDs, report reconstruction material, and display strings are not accepted in plaintext sync fields, URLs, or logs.
- A favorite has a random `fav_...` ID, a coarse resource type, and an `A256GCM` client-encrypted envelope (maximum 4 KiB decoded ciphertext). The server does not hold the data or recovery key and cannot decrypt it.
- AES-GCM AAD is the UTF-8 `|` join of the snapshot/export
  `aadContext.subjectId`, `favoriteId`, `resourceType`, `keyVersion`, and
  `namespring.favorite-envelope.v1`. The AAD subject is a stable,
  domain-separated SHA-256 projection of the high-entropy internal UUID; it is
  not the UUID, an authorization credential, or a value shared with premium.
- Snapshot, conflict, and export browser DTOs never contain the raw internal
  `ownerUserId`. Persistence retains ownership only for trusted repository and
  retention work, while the API returns the owner-free document projection.
- The client must generate a fresh 96-bit nonce for every encryption under a key version. The server rejects visible current-state nonce reuse, but the client must also prevent reuse after deletions.
- A new device needs the user's recovery secret or a passkey-PRF-derived key. Provider login alone cannot silently recover end-to-end encrypted favorite contents. The API advertises this capability explicitly.
- Preferences are a fixed low-sensitivity allowlist. Arbitrary profile/draft objects are rejected.

## User flow

All mutations require the server session, allowed `Origin`, and matching CSRF cookie/header.

1. `POST /api/v1/sync/consent` with the exact current policy version (`2026-07-18.v1`) and selected `favorites` / `preferences` scopes.
   Re-consenting with fewer scopes atomically wipes all data belonging to removed scopes; it is not merely hidden from the response.
2. `GET /api/v1/sync/snapshot` to obtain the server version, encrypted state,
   and the stable AAD context needed before encrypting a favorite.
3. `POST /api/v1/sync/delta` with a unique request ID, exact `baseVersion`, and up to 100 mutations. A stale version returns HTTP 409 plus the authoritative server document for deterministic client merge.
4. `POST /api/v1/sync/export` with exact `{}` JSON (maximum 2 KiB) produces the
   user's portable encrypted data and retention contract.
5. `POST /api/v1/sync/revoke` immediately wipes favorite/preference payloads and revokes consent. `POST /api/v1/sync/delete` removes the sync document. Deletion/audit identifiers are HMAC-only.

Mutation receipts return the originally committed version on exact retries even when newer changes exist. Reusing a request ID with a different body is rejected.

## Abuse and cost controls

- Every route authenticates first and then rate-limits by the server-resolved internal user ID; body-, query-, and cookie-claimed account IDs are never accepted as limiter subjects.
- Snapshot/export reads share `sync.read` (120 requests per 5 minutes). Consent/delta/revoke/delete writes share the independent `sync.write` budget (60 requests per 5 minutes), so an accidental polling loop cannot consume the user's save budget.
- Aggregate retention-health reads use their own `sync.admin-retention-status`
  budget (30 requests per 5 minutes per operator). They do not consume either
  end-user reads or manual-sweep capacity.
- Manual admin retention sweeps use a separate conservative `sync.admin-retention-sweep` budget (4 requests per hour per operator). The per-run service limit remains 80 documents.
- In production `SYNC_RATE_LIMIT_MODE` defaults to `required` and uses transactional Firestore counters with HMAC-derived document IDs. Configure a distinct high-entropy `RATE_LIMIT_HMAC_KEY` and deploy the `server_rate_limits_v1.expiresAt` TTL override. `disabled` is intended only for local development/tests.
- Per-account limiting is a cost and hot-document guard, not a complete volumetric DDoS layer. Keep platform/WAF request limits, monitoring, and billing alerts enabled before launch.

## Retention and deployment gates

- Set a high-entropy `SYNC_DELETION_HASH_PEPPER` (at least 32 characters) outside source control. Rotation needs a documented audit-correlation migration plan.
- Audit owner and actor-session subjects are separate domain-prefixed HMACs
  (`namespring.sync.owner.v1` and `namespring.sync.session.v1`). Raw auth-layer
  session identifiers are never persisted in sync audit records.
- Active sync data becomes unreadable after 365 days without a write. The
  hourly transactional sweeper is the sole physical-deletion owner for live
  documents: it re-reads the candidate and its Firestore update time before
  atomically deleting it and creating an HMAC-only receipt plus payload-free
  audit. A concurrent user write that extends retention is always preserved.
  Payload-free audits/request receipts expire after 365 days; HMAC-only
  deletion receipts expire after 30 days through Firestore TTL.
- The HTTP/domain contract exposes canonical ISO timestamps, but the Firestore adapter persists TTL/query fields (`expiresAt`, `deleteAfter`) as native Firestore `Timestamp` values and decodes them on reads. Legacy string-valued TTL documents must be migrated before serving; the adapter fails closed instead of pretending Firestore TTL can process strings.
- Vercel invokes `GET /api/internal/maintenance/sync` at minute 17 of every UTC
  hour. It requires the exact `CRON_SECRET` Bearer token, accepts no body or
  caller-selected batch size, claims a durable 90-second Firestore lease, and
  processes at most 40 candidates within a 45-second deadline. Vercel does not
  retry failed cron invocations, so the worker is reconciliation-based and the
  next run catches up. `/api/v1/sync/admin/retention-sweep` remains the
  authenticated manual admin/CSRF route.
- `POST /api/v1/sync/admin/retention-status` is the only browser-facing
  retention discovery route. It requires the same persisted-plus-token `admin`
  role, trusted Origin, and CSRF proof as a mutation even though its service is
  read-only. Its request is exact `{}` with a 2 KiB limit and every success or
  failure response is `no-store`.
- Retention status performs two bounded plain reads and never claims a lease,
  opens a transaction, or writes a document. The due query selects only
  `expiresAt`, reads at most 101 rows, reports `candidateCount` capped at 100,
  and uses the extra row only for `hasMore`. `oldestDueAt` is the oldest due
  timestamp or `null`; it is not an account locator. A concurrent sweep can
  make this observational snapshot stale immediately, which is expected and
  never affects sweep fencing or update-time revalidation.
- The maintenance portion exposes only `state`, the latest durable
  start/finish transition as `heartbeatAt`, an optional lease expiry, and the
  most recent completion outcome/aggregate. `heartbeatAt` is not a process
  liveness probe. `lease_expired`, a stale oldest-due timestamp, or repeated
  `failed`/`partial` outcomes are operator signals; FE must not infer a user or
  enumerate records from them.
- The status contract cannot contain internal user/document IDs, ciphertext,
  favorites, preferences, active run IDs, fencing values, claim tokens, or raw
  exception details. There is intentionally no user-level retention list/get
  API. Unknown server failures use the shared sanitized error envelope.
- A `skipped_locked` maintenance response reports `hasMore: true`: that run did
  not inspect the candidate queue and therefore cannot prove it is empty. This
  is a catch-up hint for the next scheduled/manual run, not proof that expired
  data exists.
- Run `npm run test:emulator:maintenance` from `namespring` for the real
  Admin-SDK/Firestore transaction suite. It requires project-pinned Java 21 and uses the
  pinned official Firebase CLI, a unique `demo-*` project, an ephemeral local
  credential, collection cleanup between tests, and a three-minute process
  ceiling. No production project ID or application credential is accepted.
- Firestore Security Rules must deny direct client access to `account_sync_v1`, `account_sync_request_receipts_v1`, `account_sync_deletion_receipts_v1`, and `account_sync_audit_events_v1`.
- Exempt `account_sync_v1.favorites` from single-field indexing. Keep an
  ascending query index, but no TTL policy, on `account_sync_v1.expiresAt`.
  Deploy TTL only for request receipts, deletion receipts, and audit events.
- Configure allowed origins, Firebase admin credentials, account/role bindings, session/CSRF issuance, backups, alerting, and an authenticated scheduled execution identity.
- The 100-favorite / 4-KiB-envelope limits keep the single Firestore account document below its 1 MiB limit with margin. Load-test the actual serialized worst case in the emulator before launch.

Firebase Emulator references:

- <https://firebase.google.com/docs/emulator-suite/install_and_configure>
- <https://firebase.google.com/docs/emulator-suite/connect_firestore>
