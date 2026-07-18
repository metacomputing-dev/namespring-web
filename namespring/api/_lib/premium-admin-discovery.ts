import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Transaction,
  type WriteBatch,
} from "firebase-admin/firestore";
import type { ReportEntitlementV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import {
  PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1,
  PREMIUM_ADMIN_DISCOVERY_PAGE_SCHEMA_V1,
  type PremiumAdminDiscoveryItemV1,
  type PremiumAdminDiscoveryPageV1,
  type PremiumAdminDiscoveryResourceV1,
  type PremiumAdminEntitlementDiscoveryItemV1,
  type PremiumAdminOrderDiscoveryItemV1,
  type PremiumAdminPaymentRecoveryDiscoveryItemV1,
} from "../../shared/types/premium-admin-discovery.js";
import type {
  PremiumPaymentOrderRecordV1,
  PremiumPaymentRecoveryStateV1,
} from "../../shared/types/premium-service.js";
import { getOptionalEnv } from "./env.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";
import { openPremiumJsonRecordV1 } from "./premium-crypto.js";
import { premiumDocumentKey } from "./premium-ids.js";
import type { PremiumRetainedPaymentRecordV1 } from "./premium-repository-contract.js";

export const PREMIUM_ADMIN_DISCOVERY_COLLECTIONS_V1 = {
  orders: "premium_v1_admin_orders",
  entitlements: "premium_v1_admin_entitlements",
  payment_recovery: "premium_v1_admin_payment_recovery",
} as const;

export const PREMIUM_ADMIN_DISCOVERY_LIMIT_MAX_V1 = 20 as const;
export const PREMIUM_ADMIN_DISCOVERY_RESPONSE_MAX_BYTES_V1 = 128 * 1024;
export const PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATES_V1 = [
  "prelaunch_empty_v1_verified",
  "projection_backfill_v1_verified",
] as const;

type PremiumAdminDiscoveryCutoverStateV1 =
  typeof PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATES_V1[number];
type PremiumAdminOrderSourceV1 = PremiumPaymentOrderRecordV1 | PremiumRetainedPaymentRecordV1;
type PremiumAdminProjectionWriterV1 = Transaction | WriteBatch;

function projectionSet(
  writer: PremiumAdminProjectionWriterV1,
  reference: DocumentReference,
  value: StoredPremiumAdminProjectionV1,
): void {
  const compatible = writer as unknown as {
    set(reference: DocumentReference, value: DocumentData, options: { readonly merge: boolean }): unknown;
  };
  compatible.set(reference, value as unknown as DocumentData, { merge: false });
}

export function assertPremiumAdminDiscoveryResponseBudgetV1(payload: unknown): void {
  if (Buffer.byteLength(JSON.stringify(payload), "utf8")
    > PREMIUM_ADMIN_DISCOVERY_RESPONSE_MAX_BYTES_V1) {
    throw new ApiHttpError(500, "PREMIUM_ADMIN_RESPONSE_TOO_LARGE", "Premium admin response exceeded its byte budget.");
  }
}

interface StoredPremiumAdminProjectionV1 {
  readonly schemaVersion: "namespring.premium-admin-projection.v1";
  readonly resource: PremiumAdminDiscoveryResourceV1;
  readonly resourceId: string;
  readonly source: "live_order" | "retained_payment" | "live_entitlement";
  readonly sortKey: string;
  readonly sourceDigest: `sha256:${string}`;
  readonly payload: PremiumAdminDiscoveryItemV1;
}

const LIVE_ORDER_COLLECTION = "premium_v1_orders";
const RETAINED_PAYMENT_COLLECTION = "premium_v1_retained_payments";
const ENTITLEMENT_COLLECTION = "premium_v1_entitlements";
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,256}$/u;
const PRODUCT_ID = /^[A-Za-z0-9._-]{1,256}$/u;
const CURSOR_PREFIX = "premium_admin_cursor_v1_";

function failCorrupt(message: string): never {
  throw new ApiHttpError(503, "PREMIUM_ADMIN_PROJECTION_CORRUPT", message);
}

function canonicalUtc(value: unknown, field: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string") return failCorrupt(`${field} is invalid.`);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    return failCorrupt(`${field} is invalid.`);
  }
  return value;
}

function requireResourceId(value: unknown, field: string): string {
  if (typeof value !== "string" || !RESOURCE_ID.test(value)) {
    return failCorrupt(`${field} is invalid.`);
  }
  return value;
}

function requireProductId(value: unknown): string {
  if (typeof value !== "string" || !PRODUCT_ID.test(value)) {
    return failCorrupt("productId is invalid.");
  }
  return value;
}

function assertRecovery(value: PremiumPaymentRecoveryStateV1): PremiumPaymentRecoveryStateV1 {
  if (!value || !["not_required", "scheduled", "settled"].includes(value.status)) {
    return failCorrupt("Payment recovery state is invalid.");
  }
  const updatedAt = canonicalUtc(value.updatedAt, "paymentRecovery.updatedAt")!;
  const dueAt = canonicalUtc(value.dueAt, "paymentRecovery.dueAt", true);
  if ((value.status === "scheduled") !== (dueAt !== null)
    || (dueAt && Date.parse(dueAt) < Date.parse(updatedAt))) {
    return failCorrupt("Payment recovery due time is inconsistent.");
  }
  return { status: value.status, updatedAt, dueAt };
}

function assertProvider(value: unknown): "toss_web" | "apple_app_store" | "google_play" {
  if (value !== "toss_web" && value !== "apple_app_store" && value !== "google_play") {
    return failCorrupt("Payment rail is invalid or requires migration.");
  }
  return value;
}

function sourceDigest(payload: PremiumAdminDiscoveryItemV1): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex")}`;
}

function orderSourceKind(source: PremiumAdminOrderSourceV1): "live_order" | "retained_payment" {
  return source.schemaVersion === "namespring.premium-order-record.v1"
    ? "live_order"
    : "retained_payment";
}

function orderUpdatedAt(source: PremiumAdminOrderSourceV1): string {
  return source.schemaVersion === "namespring.premium-order-record.v1"
    ? canonicalUtc(source.updatedAt, "order.updatedAt")!
    : canonicalUtc(source.providerState?.observedAt ?? source.retainedAt, "retainedPayment.updatedAt")!;
}

function buildOrderItem(source: PremiumAdminOrderSourceV1): PremiumAdminOrderDiscoveryItemV1 {
  const live = source.schemaVersion === "namespring.premium-order-record.v1";
  const orderId = requireResourceId(source.orderId, "orderId");
  const createdAt = canonicalUtc(source.createdAt, "order.createdAt")!;
  const updatedAt = orderUpdatedAt(source);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) return failCorrupt("Order timestamps are inconsistent.");
  return {
    schemaVersion: PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1,
    resource: "orders",
    orderId,
    source: orderSourceKind(source),
    ...(live ? {
      reportId: requireResourceId(source.binding.reportId, "reportId"),
      productId: requireProductId(source.binding.productId),
      contentVersion: requireProductId(source.binding.contentVersion),
      ...(source.entitlementId ? {
        entitlementId: requireResourceId(source.entitlementId, "entitlementId"),
      } : {}),
    } : {}),
    status: source.status,
    amount: source.amount,
    currency: source.currency,
    provider: assertProvider(source.paymentProvider),
    recovery: assertRecovery(source.paymentRecovery),
    createdAt,
    updatedAt,
    paidAt: canonicalUtc(source.paidAt, "order.paidAt", true),
    refundedAt: canonicalUtc(source.refundedAt, "order.refundedAt", true),
  };
}

function buildRecoveryItem(source: PremiumAdminOrderSourceV1): PremiumAdminPaymentRecoveryDiscoveryItemV1 {
  const live = source.schemaVersion === "namespring.premium-order-record.v1";
  const recovery = assertRecovery(source.paymentRecovery);
  return {
    schemaVersion: PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1,
    resource: "payment_recovery",
    orderId: requireResourceId(source.orderId, "orderId"),
    source: orderSourceKind(source),
    ...(live ? {
      reportId: requireResourceId(source.binding.reportId, "reportId"),
      productId: requireProductId(source.binding.productId),
      contentVersion: requireProductId(source.binding.contentVersion),
    } : {}),
    paymentStatus: source.status,
    amount: source.amount,
    currency: source.currency,
    provider: assertProvider(source.paymentProvider),
    recoveryStatus: recovery.status,
    updatedAt: recovery.updatedAt,
    dueAt: recovery.dueAt,
  };
}

function buildEntitlementItem(source: ReportEntitlementV1): PremiumAdminEntitlementDiscoveryItemV1 {
  const createdAt = canonicalUtc(source.createdAt, "entitlement.createdAt")!;
  const updatedAt = canonicalUtc(source.updatedAt, "entitlement.updatedAt")!;
  if (Date.parse(updatedAt) < Date.parse(createdAt)) return failCorrupt("Entitlement timestamps are inconsistent.");
  return {
    schemaVersion: PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1,
    resource: "entitlements",
    entitlementId: requireResourceId(source.entitlementId, "entitlementId"),
    status: source.status,
    reportId: requireResourceId(source.binding.reportId, "reportId"),
    productId: requireProductId(source.binding.productId),
    contentVersion: requireProductId(source.binding.contentVersion),
    createdAt,
    updatedAt,
    activatedAt: canonicalUtc(source.activatedAt ?? null, "entitlement.activatedAt", true),
    expiresAt: canonicalUtc(source.expiresAt ?? null, "entitlement.expiresAt", true),
  };
}

function wrapProjection(
  resource: PremiumAdminDiscoveryResourceV1,
  resourceId: string,
  source: StoredPremiumAdminProjectionV1["source"],
  createdAt: string,
  payload: PremiumAdminDiscoveryItemV1,
): StoredPremiumAdminProjectionV1 {
  return {
    schemaVersion: "namespring.premium-admin-projection.v1",
    resource,
    resourceId,
    source,
    sortKey: `${createdAt}|${resourceId}`,
    sourceDigest: sourceDigest(payload),
    payload,
  };
}

function orderProjection(source: PremiumAdminOrderSourceV1): StoredPremiumAdminProjectionV1 {
  const payload = buildOrderItem(source);
  return wrapProjection("orders", payload.orderId, payload.source, payload.createdAt, payload);
}

function recoveryProjection(source: PremiumAdminOrderSourceV1): StoredPremiumAdminProjectionV1 {
  const payload = buildRecoveryItem(source);
  return wrapProjection(
    "payment_recovery",
    payload.orderId,
    payload.source,
    canonicalUtc(source.createdAt, "order.createdAt")!,
    payload,
  );
}

function entitlementProjection(source: ReportEntitlementV1): StoredPremiumAdminProjectionV1 {
  const payload = buildEntitlementItem(source);
  return wrapProjection("entitlements", payload.entitlementId, "live_entitlement", payload.createdAt, payload);
}

function projectionDocumentId(resource: PremiumAdminDiscoveryResourceV1, resourceId: string): string {
  return premiumDocumentKey("premium-admin-discovery-v1", resource, resourceId);
}

function projectionRef(db: Firestore, resource: PremiumAdminDiscoveryResourceV1, resourceId: string) {
  return db.collection(PREMIUM_ADMIN_DISCOVERY_COLLECTIONS_V1[resource])
    .doc(projectionDocumentId(resource, resourceId));
}

export function writePremiumOrderAdminProjectionsV1(
  transaction: PremiumAdminProjectionWriterV1,
  db: Firestore,
  source: PremiumAdminOrderSourceV1,
): void {
  const order = orderProjection(source);
  const recovery = recoveryProjection(source);
  projectionSet(transaction, projectionRef(db, "orders", order.resourceId), order);
  projectionSet(transaction, projectionRef(db, "payment_recovery", recovery.resourceId), recovery);
}

export function deletePremiumOrderAdminProjectionsV1(
  transaction: PremiumAdminProjectionWriterV1,
  db: Firestore,
  orderId: string,
): void {
  transaction.delete(projectionRef(db, "orders", orderId));
  transaction.delete(projectionRef(db, "payment_recovery", orderId));
}

export function writePremiumEntitlementAdminProjectionV1(
  transaction: PremiumAdminProjectionWriterV1,
  db: Firestore,
  source: ReportEntitlementV1,
): void {
  const projection = entitlementProjection(source);
  projectionSet(transaction, projectionRef(db, "entitlements", projection.resourceId), projection);
}

export function deletePremiumEntitlementAdminProjectionV1(
  transaction: PremiumAdminProjectionWriterV1,
  db: Firestore,
  entitlementId: string,
): void {
  transaction.delete(projectionRef(db, "entitlements", entitlementId));
}

export function assertPremiumAdminDiscoveryCutoverV1(
  value = getOptionalEnv("PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATE"),
): PremiumAdminDiscoveryCutoverStateV1 {
  if (!PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATES_V1.includes(value as PremiumAdminDiscoveryCutoverStateV1)) {
    throw new ApiHttpError(
      503,
      "PREMIUM_ADMIN_PROJECTION_CUTOVER_UNVERIFIED",
      "Premium admin discovery is unavailable until its projection migration is verified.",
    );
  }
  return value as PremiumAdminDiscoveryCutoverStateV1;
}

function decodeStoredProjection(value: DocumentData | undefined): StoredPremiumAdminProjectionV1 {
  if (!value || value.schemaVersion !== "namespring.premium-admin-projection.v1"
    || !["orders", "entitlements", "payment_recovery"].includes(value.resource)
    || typeof value.resourceId !== "string" || !RESOURCE_ID.test(value.resourceId)
    || !["live_order", "retained_payment", "live_entitlement"].includes(value.source)
    || typeof value.sortKey !== "string" || value.sortKey.length > 600
    || typeof value.sourceDigest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value.sourceDigest)
    || !value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) {
    return failCorrupt("Stored premium admin projection is invalid.");
  }
  return value as StoredPremiumAdminProjectionV1;
}

async function readOrderSources(
  transaction: Transaction,
  db: Firestore,
  orderId: string,
): Promise<{ live: PremiumPaymentOrderRecordV1 | null; retained: PremiumRetainedPaymentRecordV1 | null }> {
  const retainedId = premiumDocumentKey("retained-payment", orderId);
  const [liveSnapshot, retainedSnapshot] = await Promise.all([
    transaction.get(db.collection(LIVE_ORDER_COLLECTION).doc(orderId)),
    transaction.get(db.collection(RETAINED_PAYMENT_COLLECTION).doc(retainedId)),
  ]);
  const live = liveSnapshot.exists
    ? openPremiumJsonRecordV1<PremiumPaymentOrderRecordV1>(
        `${LIVE_ORDER_COLLECTION}/${orderId}`,
        liveSnapshot.data(),
      )
    : null;
  const retained = retainedSnapshot.exists
    ? openPremiumJsonRecordV1<PremiumRetainedPaymentRecordV1>(
        `${RETAINED_PAYMENT_COLLECTION}/${retainedId}`,
        retainedSnapshot.data(),
      )
    : null;
  if (live && retained) return failCorrupt("Live and retained payment sources overlap.");
  return { live, retained };
}

async function expectedProjection(
  transaction: Transaction,
  db: Firestore,
  stored: StoredPremiumAdminProjectionV1,
): Promise<StoredPremiumAdminProjectionV1 | null> {
  if (stored.resource === "entitlements") {
    const snapshot = await transaction.get(db.collection(ENTITLEMENT_COLLECTION).doc(stored.resourceId));
    if (!snapshot.exists) return null;
    const entitlement = openPremiumJsonRecordV1<ReportEntitlementV1>(
      `${ENTITLEMENT_COLLECTION}/${stored.resourceId}`,
      snapshot.data(),
    );
    return entitlementProjection(entitlement);
  }
  const sources = await readOrderSources(transaction, db, stored.resourceId);
  const source = sources.live ?? sources.retained;
  if (!source) return null;
  return stored.resource === "orders" ? orderProjection(source) : recoveryProjection(source);
}

async function validateProjection(
  transaction: Transaction,
  db: Firestore,
  raw: DocumentData | undefined,
): Promise<StoredPremiumAdminProjectionV1> {
  const stored = decodeStoredProjection(raw);
  const expected = await expectedProjection(transaction, db, stored);
  if (!expected || !isDeepStrictEqual(stored, expected)) {
    throw new ApiHttpError(
      503,
      "PREMIUM_ADMIN_PROJECTION_STALE",
      "Premium admin projection does not match its canonical source.",
    );
  }
  return stored;
}

function encodeCursor(resource: PremiumAdminDiscoveryResourceV1, sortKey: string): string {
  const body = JSON.stringify({ v: 1, resource, sortKey });
  return `${CURSOR_PREFIX}${Buffer.from(body, "utf8").toString("base64url")}`;
}

function decodeCursor(resource: PremiumAdminDiscoveryResourceV1, cursor: string): string {
  if (typeof cursor !== "string" || !cursor.startsWith(CURSOR_PREFIX) || cursor.length > 1_024) {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_CURSOR_INVALID", "Premium admin cursor is invalid.");
  }
  try {
    const encoded = cursor.slice(CURSOR_PREFIX.length);
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { v?: unknown; resource?: unknown; sortKey?: unknown };
    if (!parsed || Object.keys(parsed).sort().join("|") !== "resource|sortKey|v"
      || parsed.v !== 1 || parsed.resource !== resource || typeof parsed.sortKey !== "string"
      || parsed.sortKey.length < 3 || parsed.sortKey.length > 600
      || encodeCursor(resource, parsed.sortKey) !== cursor) {
      throw new Error("non-canonical cursor");
    }
    return parsed.sortKey;
  } catch {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_CURSOR_INVALID", "Premium admin cursor is invalid.");
  }
}

export class FirestorePremiumAdminDiscoveryV1 {
  constructor(private readonly db: Firestore = getFirestoreDb()) {}

  async list(input: {
    readonly resource: PremiumAdminDiscoveryResourceV1;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<PremiumAdminDiscoveryPageV1> {
    assertPremiumAdminDiscoveryCutoverV1();
    if (!Number.isInteger(input.limit) || input.limit < 1
      || input.limit > PREMIUM_ADMIN_DISCOVERY_LIMIT_MAX_V1) {
      throw new ApiHttpError(400, "PREMIUM_ADMIN_LIMIT_INVALID", "limit must be an integer from 1 to 20.");
    }
    const cursorSortKey = input.cursor ? decodeCursor(input.resource, input.cursor) : null;
    return this.db.runTransaction(async (transaction) => {
      let query = this.db.collection(PREMIUM_ADMIN_DISCOVERY_COLLECTIONS_V1[input.resource])
        .orderBy("sortKey", "desc")
        .limit(input.limit + 1);
      if (cursorSortKey) query = query.startAfter(cursorSortKey);
      const snapshot = await transaction.get(query);
      const validated: StoredPremiumAdminProjectionV1[] = [];
      for (const document of snapshot.docs) {
        const projection = await validateProjection(transaction, this.db, document.data());
        if (projection.resource !== input.resource
          || document.id !== projectionDocumentId(input.resource, projection.resourceId)) {
          return failCorrupt("Premium admin projection identity is inconsistent.");
        }
        validated.push(projection);
      }
      const hasMore = validated.length > input.limit;
      const selected = validated.slice(0, input.limit);
      const page: PremiumAdminDiscoveryPageV1 = {
        schemaVersion: PREMIUM_ADMIN_DISCOVERY_PAGE_SCHEMA_V1,
        resource: input.resource,
        items: selected.map((entry) => entry.payload),
        nextCursor: hasMore && selected.length > 0
          ? encodeCursor(input.resource, selected.at(-1)!.sortKey)
          : null,
      };
      assertPremiumAdminDiscoveryResponseBudgetV1(page);
      return page;
    });
  }

  async get(input: {
    readonly resource: PremiumAdminDiscoveryResourceV1;
    readonly id: string;
  }): Promise<PremiumAdminDiscoveryItemV1> {
    assertPremiumAdminDiscoveryCutoverV1();
    if (!RESOURCE_ID.test(input.id)) {
      throw new ApiHttpError(400, "PREMIUM_ADMIN_ID_INVALID", "Premium admin resource ID is invalid.");
    }
    return this.db.runTransaction(async (transaction) => {
      const reference = projectionRef(this.db, input.resource, input.id);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        // Distinguish a genuinely missing resource from a projection migration
        // hole; the latter must never masquerade as a harmless 404.
        if (input.resource === "entitlements") {
          const source = await transaction.get(this.db.collection(ENTITLEMENT_COLLECTION).doc(input.id));
          if (source.exists) {
            throw new ApiHttpError(503, "PREMIUM_ADMIN_PROJECTION_MISSING", "Premium admin projection is missing.");
          }
        } else {
          const sources = await readOrderSources(transaction, this.db, input.id);
          if (sources.live || sources.retained) {
            throw new ApiHttpError(503, "PREMIUM_ADMIN_PROJECTION_MISSING", "Premium admin projection is missing.");
          }
        }
        throw new ApiHttpError(404, "PREMIUM_ADMIN_RESOURCE_NOT_FOUND", "Premium admin resource was not found.");
      }
      const stored = await validateProjection(transaction, this.db, snapshot.data());
      if (stored.resource !== input.resource || stored.resourceId !== input.id) {
        return failCorrupt("Premium admin projection identity is inconsistent.");
      }
      assertPremiumAdminDiscoveryResponseBudgetV1(stored.payload);
      return stored.payload;
    });
  }
}
