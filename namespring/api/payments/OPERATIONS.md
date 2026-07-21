# Legacy payment retirement and refund operations

The unauthenticated `/api/payments/create`, `/api/payments/confirm`, and
`/api/payments/fail` endpoints are permanent `410 Gone` tombstones. Do not
re-enable them: they predate account ownership, CSRF protection, transactional
state transitions, and the premium V1 payment saga. New purchases must use the
authenticated `/api/v1/premium/*` contract.

Historic records in the `payments` Firestore collection remain refundable via
`POST /api/admin/refund`. This route requires all of the following:

- a valid Firebase server session bound to an active primary sign-in provider;
- the persisted `admin` role and a matching current Firebase custom claim;
- an exact configured Origin and the double-submit CSRF cookie/header;
- the shared transactional server rate limiter;
- JSON `{ "orderId": "...", "reason": "..." }` with no extra fields.

`ADMIN_REFUND_TOKEN` is obsolete and provides no access. Remove it from the
production secret store after all older deployments are drained.

Keep `VITE_PAYMENT_ENABLED=false` for every frontend deployment that still
calls `/api/payments/*`. Roll out the disabled frontend first, wait for existing
checkout redirects to drain, then deploy the tombstones. The new frontend must
use premium V1 and must not switch this legacy flag back on.

## Reconciliation behavior

1. The route transactionally claims a deterministic refund attempt without
   changing `PAID` or another financial status.
2. If an old record lacks `paymentKey`, Toss is queried by `orderId`; the key is
   attached only when order ID, KRW amount, and existing identity agree.
3. Toss is read before cancellation. Cancellation uses a deterministic
   `Idempotency-Key` scoped to order, payment, and remaining balance.
4. A cancel error is followed by a provider read. Local `REFUNDED` is committed
   only from an exact provider identity with zero remaining balance.
5. Timeouts, unknown statuses, partial outcomes, and malformed responses retain
   the prior financial status and return `202 RECONCILIATION_REQUIRED`.
6. A provider `404` for an order without a stored payment key returns
   `MANUAL_REQUIRED`; verify the Toss merchant console before issuing a manual
   refund. Never issue a second refund while the route reports an indeterminate
   result.

Firestore transaction retries are the CAS boundary for concurrent operators.
The provider idempotency key makes duplicate cancellation calls safe, while the
stored attempt/status makes retries auditable. Raw provider exception messages
are not persisted or returned.

## Release checks

- Configure `TOSS_SECRET_KEY`, `AUTH_ALLOWED_ORIGINS`, Firebase Admin, and a
  distinct 32-byte-or-longer `RATE_LIMIT_HMAC_KEY`.
- Deploy the `server_rate_limits_v1.expiresAt` TTL policy.
- Run `npm run typecheck:backend` and `npm run test:backend-contracts`.
- Before production traffic, run an emulator concurrency test and Toss sandbox
  drills for: missing payment key recovery, duplicate admin retry, cancel
  timeout followed by successful GET reconciliation, partial cancellation, and
  provider/order/amount mismatch.
- After the drain window, enumerate historic `READY`, `FAILED`, `CANCELED`, and
  `refundState=RECONCILIATION_REQUIRED` records. Check each potentially captured
  order in Toss by `orderId`; the authenticated endpoint can recover a missing
  payment key and refund it without reopening public confirmation.
- Keep legacy `payments` backups and financial-retention policy until the final
  chargeback/refund window has elapsed; retiring purchase endpoints does not
  authorize deleting historic financial records.

## Premium v1 provider rails and launch fences

The canonical rail IDs are `toss_web`, `apple_app_store`, and `google_play`.
Only `toss_web` has an adapter today. Apple and Google are explicit disabled
capabilities: they must return unavailable until native purchase evidence,
server verification, notification/reconciliation, refund/revocation, and
environment separation have real implementations and sandbox evidence. Never
translate a native-store token into a Toss payment key or grant an entitlement
from a client success callback.

The checked-in catalog is unavailable. Selling requires all of the following:

- a reviewed active `PREMIUM_SERVICE_CATALOG_JSON`;
- `PREMIUM_CATALOG_ACTIVATION_STATE=provider_staging_and_content_verified_v1`;
- `PREMIUM_TOSS_WEB_RAIL_STATE=provider_staging_verified_v1`;
- a current `PREMIUM_POLICY_CONTRACT_JSON` whose notice/terms/refund digests
  match the text actually shown by the client;
- approved immutable content and successful Toss staging mismatch, duplicate,
  timeout, cancel, and reconciliation drills.

Premium V1 permits exactly one non-terminal checkout per registered report.
Reusing the same owner-scoped request ID returns the original order; a distinct
request receives `PREMIUM_CHECKOUT_ALREADY_OPEN`. A provider-terminal state
that never granted access releases that report lock immediately, while the
failed order remains on its bounded 30-minute expiry path. A paid report is a
one-purchase binding; after refund/revocation, repurchase starts from a new
premium report registration instead of mutating the prior financial history.

If Toss confirms `DONE` but the local entitlement transaction is lost, the
account-scoped durable lease remains. Reconciliation retries transient storage
failures. For an explicit permanent grant invariant failure it performs an
idempotent full Toss cancellation, requires `CANCELED` with zero remaining
balance, and then records either the refunded order or the minimized retained
ledger if account deletion won the race. Never delete or TTL a live payment
lease, and alert on leases that remain due after repeated worker runs.

Before adding an iOS/Android rail, migrate prelaunch only: add a discriminated
adapter and provider-scoped payment identity, validate signed evidence only on
the server, handle pending purchases without entitlement, test notification
replay and refund/revoke, then enable the rail capability behind a new verified
deployment fence. Existing `toss_web` records must remain explicitly tagged;
do not infer a provider from token shape.

Official policy and integration references:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple App Store Server API](https://developer.apple.com/documentation/appstoreserverapi)
- [Apple receipt validation](https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Google Play Billing security and server verification](https://developer.android.com/google/play/billing/security?hl=en)
- [Google Play Billing integration](https://developer.android.com/google/play/billing/integrate?hl=en)
- [Toss Payments widget integration](https://docs.tosspayments.com/guides/v2/payment-widget/integration-window)
- [Toss Payments API reference](https://docs.tosspayments.com/reference)

## Consent, expiry, and privacy operations

Registration requires explicit current data-processing acceptance bound to the
registration material. Checkout separately requires current purchase terms and
refund-policy acceptance bound to the order idempotency material. The server
stores only versions, SHA-256 digests, purpose, client time reference, server
recorded time, and binding digests; it does not store notice body, IP, or user
agent in these receipts. Account deletion removes the personal registration
receipt with the sealed analysis. A paid-order legal ledger retains only the
minimal purchase policy receipt needed for payment/refund evidence.

Unpurchased report registration/analysis/reference data expires after 24 hours;
an unpaid ready order expires after 30 minutes. The durable
`premium_v1_unpaid_expiry_candidates` sweep is the authority. Its completed
receipts use Firestore TTL only as auxiliary cleanup; TTL never independently
deletes paid source records. Deploy the candidate `expiresAt` index and the
`premium_v1_unpaid_expiry_receipts.deleteAfter` TTL policy, and keep the
`/api/internal/maintenance/premium-expiry` cron enabled. The sweep transaction
conflicts with checkout/payment writes, removes owner indexes and admin
projections atomically, defers uncertain provider recovery, and never deletes a
paid/refunded/revoked/entitled record.
