# Premium V1 operations

## Runtime boundary

- Free saju, naming, integrated results, and local favorites stay on the mobile/browser device. They do not call these routes.
- Premium registration is the only route that loads the filesystem `SpringEngine` adapter and its database/WASM assets. Checkout, payment, delivery, webhook, export, and account deletion remain engine-free.
- A signed-in account is required only when a user starts a paid flow or server synchronization. Every provider identity maps to one canonical internal UUIDv4. Premium owner v2 is a domain-separated SHA-256 identifier derived from that UUID, so normal secret rotation cannot change ownership. It is not an authentication credential and must never be exposed as one.

## Paid flow

1. `POST /api/v1/premium/reports/register` accepts raw birth/name/candidate input. The server initializes `SpringEngine`, recomputes the report, verifies the candidate ID, seals the analysis, and stores no plaintext input record.
2. A `premium_admin` first creates a server-sealed review receipt for an exactly gate-attested report artifact or reusable case template. A different authenticated `premium_admin` consumes that receipt in the activation transaction. Browser-supplied `humanReview`, draft, or bulk JSON never grants authority.
3. `POST /api/v1/premium/checkout/create` resolves the exact active artifact/template, instantiates placeholders and evidence references, and blocks payment if the result is unavailable.
4. `POST /api/v1/premium/payments/confirm` acquires an encrypted account payment lease before calling Toss. The exact order, key, amount, currency, provider state, immutable content activation, and account fence are verified before the entitlement is committed; the lease is deleted in the same transaction.
5. `POST /api/v1/premium/reports/deliver` requires the exact owner, report binding, active entitlement, and pinned immutable resource. Soft retirement prevents new checkout but preserves already purchased delivery/replay. Emergency withdrawal is a separate revoke-and-refund procedure.

All owner mutations, checkout, confirmation, and delivery are idempotent. Client retries must reuse the original request ID and payment key. A reused key with different material is rejected.

## Content selector and review

- Selector V2 uses the canonical team order `category.period.age.band.strength.gyeok.interaction.gender`.
- Current story-completion V1 deliberately selects `overall.life`; `band` is derived only from the server-recomputed `fortune.life.overall.stars` fact (4-5 high, 3 mid, 1-2 low). Missing evidence is `unknown` and falls through to the reviewed default.
- Strength and gyeok routing use machine codes, never Korean display-copy parsing. Lunar age is not compared with a Gregorian target date; until canonical solar birth is exposed in delivery evidence it routes through `age=unknown`/default.
- Reusable templates carry stable source evidence IDs. Delivery rebinds them to the report-specific server evidence IDs.
- A passed gate must carry a trusted-CI HMAC attestation over the exact resource, report binding, provenance, selector/evidence binding, and prose/template material. The review receipt then binds the verified attestation, material digest, notes digest, authenticated reviewer, and server time.
- Review receipts are AES-256-GCM sealed with context-bound AAD and store only a rotation-aware premium-audit HMAC actor subject, never a raw reviewer UUID or session ID. Session correlation exists only as the already-pseudonymized audit subject. Pending authority expires after 7 days even if asynchronous Firestore TTL has not deleted the 365-day evidence record; report/analysis binding IDs remain encrypted solely to prevent cross-report replay.
- Activation accepts an opaque review receipt plus an exact activation request ID. The transaction verifies resource/report/product/contentVersion/selector/material, requires a distinct authenticated activator, and consumes the receipt atomically with the active pointer and audit. Only an exact same-principal, same-request retry returns the prior activation; cross-resource, altered-content, or second-request replay fails closed.

## Payment recovery

- Toss webhook bodies are untrusted hints. The service performs an authoritative Toss GET before changing local state; no fictional custom signature header is assumed.
- Confirmation and cancellation POSTs use deterministic Toss idempotency keys.
- Due encrypted payment leases are processed in batches of at most three by both `GET /api/internal/maintenance/premium` (Vercel cron every two minutes) and `POST /api/v1/premium/admin/reconcile-leases` (1-3, default 3). Both entry points share the durable `premium_payment_reconciliation` claim/fence, so manual and scheduled provider work cannot overlap. The cron accepts only the common `CRON_SECRET` bearer boundary and returns aggregate counts without account, order, payment-key, or provider-error details.
- Each queued document contributes only its indexed `dueAt` cursor. Immediately before Toss, a Firestore transaction reopens the sealed lease and verifies the unchanged due time, account/order ownership, payment key, and current order or retained-ledger state. Corrupt/conflicting work remains leased for manual remediation; a retry never silently deletes the lease. A terminal provider state and consistent entitlement/payment record are re-read transactionally before a surviving lease is released.
- Toss reads and cancellation calls each have a 12-second timeout. The worker is sequential, has a 45-second internal deadline and 90-second durable claim, and will not start another provider request without one full timeout budget. A surviving lease deliberately blocks account deletion.
- `PARTIAL_CANCELED` immediately revokes granted access, cancels the remaining provider balance, requires `CANCELED` with balance zero, and then records a terminal refund.
- Account deletion atomically moves payment/tax/refund fields to a minimized encrypted retained ledger. Later refund, chargeback, and webhook reconciliation continue by order ID without restoring birth/name/report ownership data.

## Privacy, export, and deletion

- Sensitive Firestore records are whole-record AES-256-GCM envelopes. Provider-key links, grants, owner-resource indexes, templates, review receipts, audits, deletion receipts, and legal payment records are also sealed.
- `GET /api/v1/premium/account/export` returns only owned reports, sanitized orders (no payment key), entitlements (no owner key), and already delivered content. It excludes analysis plaintext, encryption material, audit, provider links, and administrative content. It fails closed above 1,000 indexed resources or 3 MiB serialized JSON.
- Account deletion first creates the shared account write fence. Premium purge uses the sealed owner index, is idempotent by deletion request ID, and atomically snapshots each financial order before deletion.
- Operational audit TTL is 365 days. Audit actor/session fields contain only domain-separated v2 HMAC pseudonyms with the producing key ID; raw internal user and session IDs are never stored in audit records. The minimized payment ledger TTL is 5 years; confirm the actual statutory retention period before production. Deletion receipts expire after 365 days.

## Owner v2 cutover and legacy v1 migration

- Runtime authorization derives only `premium_owner_v2_*`. It never probes a v1 index, guesses a cross-version link, or grants access through both identities. Encountering a stored `premium_owner_v1_*` fails closed with `PREMIUM_OWNER_V1_MIGRATION_REQUIRED`.
- For a verified empty prelaunch store, freeze premium writes and account deletion, enumerate and decrypt every owner-bearing premium collection plus every owner-resource root, and prove that no v1 owner or v1 owner-derived document key exists. Record the inventory evidence before setting `PREMIUM_OWNER_V2_CUTOVER_STATE=prelaunch_empty_v1_verified`.
- If any v1 data exists, keep writes frozen and back up the store. For each identity-ledger UUID, use the offline-only legacy helper and the retired v1 secret to reproduce the exact v1 owner, then derive its v2 owner. Reject missing, duplicate, or ambiguous mappings.
- The offline migrator must rewrite and reseal every owner-bearing record, re-key owner-derived registration/checkout/delivery idempotency documents, rebuild the sealed owner-resource root, and delete the old keys in bounded transactions. Provider/order-ID financial recovery records must remain reconcilable throughout the migration.
- Compare pre/post resource counts and digests, prove that no v1 root or record remains, then exercise registration replay, owner index lookup, checkout, entitlement delivery, refund, export, and purge for migrated accounts. Only after independent review may production use `PREMIUM_OWNER_V2_CUTOVER_STATE=legacy_v1_migration_verified` and unfreeze writes.
- The cutover environment value is an operator attestation, not an automatic database check. A missing or different value fails closed; setting it without the recorded proof is a release violation.

## Premium audit-key rotation

- `PREMIUM_AUDIT_HMAC_KEYRING_JSON` contains an exact `{ currentKeyId, keys }` object with 1-8 distinct 32-256 byte secrets. Audit keys are dedicated: never reuse auth, rate-limit, sync, Toss, content, premium encryption, or retired owner secrets.
- Add the new key, retain prior keys, and only then change `currentKeyId`. New audit subjects use the current key ID; historical correlation verifies with the key ID embedded in each pseudonym.
- Retain every referenced key for at least the complete 365-day audit window and until Firestore has actually removed expired documents, because TTL deletion is asynchronous. Removing a referenced key makes verification fail closed with `PREMIUM_AUDIT_KEY_NOT_RETAINED`; restore the key or complete an approved offline pseudonym migration before continuing correlation work.
- Audit-key and premium-encryption-key rotation must not change owner v2, repository keys, entitlement access, refunds, export, or deletion behavior.

## Required environment

- `PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON`: `{ "currentKeyId": "...", "keys": { "...": "<base64 32-byte key>" } }`. Keep old keys during rotation until every envelope is migrated or expired.
- `PREMIUM_OWNER_V2_CUTOVER_STATE`: exactly `prelaunch_empty_v1_verified` or `legacy_v1_migration_verified`, backed by the evidence above. Premium owner v2 has no live derivation secret.
- `PREMIUM_AUDIT_HMAC_KEYRING_JSON`: exact bounded keyring described above.
- `CONTENT_GATE_ATTESTATION_KEYRING_JSON`: the same dedicated trusted content-gate keyring used by general content lifecycle. Premium gate signatures use a separate protocol/domain string and exact premium material subject digest.
- `TOSS_SECRET_KEY`; `TOSS_API_BASE_URL`, when present, must be exactly
  `https://api.tosspayments.com`. Toss test credentials use the same official
  origin. The backend rejects every other origin before constructing the Basic
  credential and caps decompressed provider responses at 128 KiB.
- `RATE_LIMIT_HMAC_KEY`: at least 32 UTF-8 bytes.
- Optional `PREMIUM_SERVICE_CATALOG_JSON` for the versioned price/catalog override.
- Engine asset overrides: `NAMESPRING_ENGINE_HANJA_DB_FILE`, `NAMESPRING_ENGINE_FOURFRAME_DB_FILE`, `NAMESPRING_ENGINE_SQL_WASM_FILE`, and `NAMESPRING_ENGINE_NAME_STAT_FILE`.
- Firebase Admin/session variables documented in the auth operations guide.

## Production gates

- Deploy Firestore rules as server-only for premium collections and deploy `firestore.indexes.json`, including `ciphertext` exemptions and review/audit/retained/deletion TTL policies.
- Configure the Vercel register function's asset `includeFiles`; other premium functions must not include engine assets.
- Exercise Firebase session + CSRF, Toss sandbox confirmation/cancel/webhook, Firestore emulator transaction races, lease scheduler recovery, retained-ledger refund after deletion, and encryption/audit key rotation in staging.
- Rehearse the selected owner-v2 cutover path from a snapshot. Preserve the inventory, mapping, count/digest, v1-absence, owner-index, replay, refund, export, and purge evidence. Do not enable premium routes when the proof and configured attestation disagree.
- Seed only human-approved, immutable templates for every paid selector fallback. Confirm that no unreviewed staging JSON is active.
- Perform Korean saju/naming expert review and final human copy review before enabling payment. Green unit tests do not establish expert-content authority.
- No production Toss/Firebase end-to-end or browser checkout was executed by this implementation alone; do not treat this document as launch approval.
