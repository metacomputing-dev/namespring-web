# Content lifecycle operations (v1)

This API is an administrative staging/release boundary. Existing generated JSON files are **not** production content merely because they exist or were uploaded.

## Required release sequence

Every mutation is `POST`, requires an authenticated account with the persisted **and** Firebase-claim `admin` role, an allowed `Origin`, the server session cookie, and matching `__Host-namespring_csrf` / `X-CSRF-Token` values.

1. Validate up to 50 JSON artifacts without writing. The entire batch request is capped at 1 MiB, so large artifacts require smaller batches (a maximum-size artifact should be sent alone):

   `POST /api/v1/content/admin/stage-batch`

   ```json
   {
     "requestId": "batch_20260718_001",
     "mode": "validate_only",
     "artifacts": [
       {
         "artifactId": "overall.today.adult.v1",
         "channel": {
           "contentKey": "overall.today.adult.high.balanced.bigeop.adverse.female",
           "kind": "fortune_bundle",
           "audience": "free_local",
           "locale": "ko-KR"
         },
         "version": "2026.07.18.1",
         "payload": {
           "schemaVersion": "namespring.fortune-bundle.v1",
           "summary": "검수된 쉬운 요약",
           "hook": "바로 이해할 수 있는 핵심 흐름",
           "sections": [{ "id": "main", "body": "근거와 해석을 함께 담은 본문" }],
           "tips": ["오늘 실행할 구체적인 도움말"],
           "cautions": ["과잉 단정을 피하는 구체적인 주의점"]
         },
         "contentDigest": "sha256:<64 lowercase hex>",
         "provenance": {
           "source": {
             "sourceKind": "bulk_json_staging",
             "sourceId": "batch-source-001",
             "sourceVersion": "v1",
             "sourceDigest": "sha256:<64 lowercase hex>",
             "importedAt": "2026-07-18T12:00:00.000Z"
           },
           "generation": {
             "provider": "provider-id",
             "modelId": "model-id",
             "modelVersion": "model-version",
             "generatedAt": "2026-07-18T10:00:00.000Z"
           },
           "prompt": {
             "promptId": "prompt-id",
             "promptVersion": "v1",
             "promptDigest": "sha256:<64 lowercase hex>"
           },
           "gate": {
             "gateVersion": "v1",
             "decision": "passed",
             "checkedAt": "2026-07-18T11:00:00.000Z",
             "resultDigest": "sha256:<64 lowercase hex>",
             "attestation": {
               "attestationId": "ci-run-001",
               "runner": "trusted_ci",
               "keyId": "content-ci-2026-07",
               "subjectContentDigest": "sha256:<same canonical payload digest>",
               "policyDigest": "sha256:<frozen gate policy digest>",
               "signature": "hmac-sha256:<64 lowercase hex>"
             }
           }
         }
       }
     ]
   }
   ```

   Digests are SHA-256 over canonical JSON (sorted object keys). Use the exported `sha256Digest` helper; do not hash pretty-printed source bytes as `contentDigest`. A `passed` decision additionally requires a trusted-CI HMAC over `contentGateAttestationMaterial`; configure a rotatable key in `CONTENT_GATE_ATTESTATION_KEYRING_JSON`. Browser/admin clients never receive this secret.

   Each kind has an exact, bounded, plain-text schema (`fortune_bundle`, `name_energy`, `report_copy`, `article`, `glossary`). Markup, bidi/control characters, duplicate IDs, oversized fields, unknown keys and schema mismatches fail before persistence and are rechecked at activation/export. `other` is migration staging only and can never activate.

2. Repeat the same batch with `mode: "register_drafts"`. Each item is written only as `draft`. Single-artifact `/register` requests are capped at 768 KiB; staging batches are capped at 1 MiB. Both limits are enforced while streaming, before the entire body is buffered. If a batch stops partway, retry the identical `requestId`, ordering, and body: completed rows return idempotent replays. Changing an item under the same request ID fails closed. Import 2,200 rows through repeated bounded batches/cursors, never one request.
3. Inspect queues with `POST /api/v1/content/admin/list` (`lifecycle`, optional `afterArtifactId`, `limit` 1-10) and retrieve a full artifact with `POST /api/v1/content/admin/get`. `limit` is an upper bound: the server may return fewer rows plus `nextCursor` to keep the serialized page at or below 1,250,000 UTF-8 bytes.
4. A human accepts a gate-passed draft through `/review` at revision 1. The API records the authenticated reviewer and notes digest.
5. A different authenticated administrator approves through `/approve` at revision 2. Reviewer self-approval is rejected (four-eyes rule).
6. Activate through `/activate` at revision 3 with a reason. Activation atomically retires the prior artifact in the exact `{audience, kind, locale, contentKey}` channel. `/rollback` may explicitly reactivate a retired, previously approved artifact. Activation receipts are append-only.

Direct `draft → active`, failed-gate review, cross-channel replacement, stale revisions, and changed idempotent requests are rejected. There is no unauthenticated content-serving route.

An artifact keeps at most 64 append-only activation/rollback receipts inline. A
65th activation fails with `CONTENT_ACTIVATION_HISTORY_LIMIT`; operators must
register, review, and approve a new artifact version instead of growing one
Firestore document without bound. Moving historical receipts to an immutable
receipt subcollection is a post-launch schema migration option, not permission
to raise or bypass the current cap.

## Local/free build handoff

- `/admin/export-local-manifest` creates a 24-hour immutable export session at one active-catalog revision. It requires an exact `{}` JSON body capped at 2 KiB. The deprecated `/admin/export-local-bundle` route has the same body contract and is only an alias for session creation; it never returns all payloads.
- Session creation first uses bounded aggregate counts, then reads metadata and checks the catalog revision before/after the query. Catalogs above 2,500 active local/shared artifacts fail before the full query unless the server-only reviewed operational state and an explicit ceiling no higher than 25,000 are enabled. It stages 100-entry metadata chunks in Firestore write batches capped at 50 documents beneath an unpublished export ID, then atomically publishes only the owner-HMAC-bound header after one final catalog-revision check. Chunk entries are not indexed. The 21,060-entry development corpus therefore uses 211 chunks over five conservative writes instead of 843 documents and never enters one oversized Firestore transaction. A concurrent activation/retirement prevents publication or invalidates the session; a partial staging failure leaves no discoverable header, and each unreachable chunk retains its 24-hour TTL cleanup.
- Fetch payloads through `/admin/export-local-page` beginning with `{ "exportId": "..." }`, then repeat with the returned cursor. A metadata chunk contains at most 100 artifacts, while every response still stops at 1,500,000 canonical UTF-8 bytes and returns an offset cursor when fewer than 100 fit. Artifacts are fetched in bounded 25-document batch RPCs rather than pointer/artifact round trips, then lifecycle, channel, activation ID, content digest and payload validity are revalidated. The server transactionally advances an owner-bound rolling delivery cursor only after assembling a valid page; exact same-cursor retries are idempotent, while skips and out-of-order requests fail closed. A different administrator receives the same not-found response as an unknown opaque export ID.
- Collect each page's ordered `entry` values, verify their canonical SHA-256 equals the session `assetSetDigest`, and call `/admin/finalize-local-export` with `exportId`, `observedArtifactCount`, and `observedAssetSetDigest`. Finalization requires the server-side cursor to have served every artifact in order and fails if a page was skipped or an emergency retirement/replacement occurred. The distinct `local_export.finalized` audit event records this transition.
- Obtain the finalization receipt immediately before sealing/publishing the packaged SQLite/lazy asset. Its `publishGate` intentionally requires another immediate finalization if publication was delayed; an emergency content change after a receipt requires cancel/rebuild.
- The build job assembles `LocalContentExportManifestV1` and packaged SQLite/lazy assets from the bounded pages. The free runtime reads those assets and must never call this API.
- No existing bulk JSON has been imported by this change; manual review remains required. During FE development the current high-quality corpus may be used as production-like provisional fixtures behind a mock/content adapter, but the production build must not silently promote it into this approval ledger. Final reviewed data can then replace the adapter source without rewriting UI consumers.

## Deployment gates

Before enabling the routes:

- Firestore Security Rules must deny all direct client reads/writes to `content_artifacts_v1`, `active_content_channels_v1`, `content_request_receipts_v1`, and `content_audit_events_v1`; access is through Admin SDK APIs only.
- Deny direct client access to `content_catalog_state_v1`, `content_export_snapshots_v1`, `content_export_chunks_v1`, and `content_export_progress_v1` as well. Their `expiresAt` values are stored as native Firestore `Timestamp`s and have TTL field overrides; deleting a Firestore parent does not delete subcollections, so chunk and delivery-progress TTL must remain enabled.
- Exempt `content_artifacts_v1.payload` from single-field indexing to avoid index-entry expansion and content duplication in indexes.
- Add composite indexes for `content_artifacts_v1(lifecycle, channel.audience)` and `content_artifacts_v1(lifecycle, artifactId)`.
- Configure and test Firebase admin credentials, allowed origins, persisted admin roles, matching Firebase custom claims, session/CSRF issuance, audit retention, backups, and point-in-time recovery.
- Configure `CONTENT_GATE_ATTESTATION_KEYRING_JSON` in trusted server/CI environments, rotate key IDs without rewriting immutable attestations, and verify that missing/unknown/tampered signatures fail closed.
- Configure `CONTENT_AUDIT_HMAC_KEYRING_JSON` with `currentKeyId` and 1-8 dedicated keys of 32-256 random bytes. Stored actor/session pseudonyms include algorithm version and key ID; actor and session domains remain separated and raw identifiers are never persisted in these fields. During rotation, add the new key and make it current while retaining every prior key referenced by an artifact. Four-eyes comparison evaluates the authenticated actor under every retained key, so a reviewer cannot self-approve merely because the current key changed. Removing a referenced key fails content mutations closed with `CONTENT_AUDIT_KEY_NOT_RETAINED`; freeze writes and complete an offline identity-ledger migration while both keys remain available before removal. Audit `deleteAfter` remains a root Firestore `Timestamp` with a 365-day TTL. TTL deletion is asynchronous, so operational access controls and deletion checks remain necessary until Firestore removes an expired document.
- For a catalog above 2,500 entries, retain the checked-in 300-second limit for both start routes, verify the selected Fluid Compute operating model, set `CONTENT_EXPORT_OPERATIONAL_STATE=large_catalog_v1_reviewed`, and set `CONTENT_EXPORT_MAX_ACTIVE_ARTIFACTS` narrowly above the reviewed corpus. The overall deployment already requires Pro/Enterprise for its sub-daily cron schedules; that plan requirement is independent from the export duration. Start is limited to 4/hour/admin. Pages consume an actor-global 1,200/hour budget before a 600/hour owner+export-session budget; finalization similarly consumes global 40/hour before session 20/hour. Thus a 211-page corpus can retry, while random export IDs cannot create unbounded independent Firestore rate buckets. Record real staging duration, read/write counts, orphan TTL cleanup, and completion within 24 hours before launch.
- Run `validate_only` against representative and worst-size artifacts before any batch registration. A successful upload is not permission to activate.
