import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test, { after, beforeEach } from "node:test";

import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

import { ACCOUNT_PAYMENT_LEASE_COLLECTION_V1 } from "../../api/_lib/account-write-fence.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import { FirestoreMaintenanceCoordinatorV1 } from "../../api/_lib/maintenance-coordinator.js";
import {
  FirestorePremiumAdminDiscoveryV1,
  PREMIUM_ADMIN_DISCOVERY_COLLECTIONS_V1,
  writePremiumOrderAdminProjectionsV1,
} from "../../api/_lib/premium-admin-discovery.js";
import { sealPremiumJsonRecordV1 } from "../../api/_lib/premium-crypto.js";
import { premiumAuditActorV2 } from "../../api/_lib/premium-audit-privacy.js";
import { premiumDocumentKey } from "../../api/_lib/premium-ids.js";
import { premiumArtifactReviewedMaterialDigestV1 } from "../../api/_lib/premium-review-contract.js";
import {
  FirestorePremiumRepositoryV1,
  type PremiumProviderObservationV1,
  type PremiumRetainedPaymentRecordV1,
} from "../../api/_lib/premium-repository.js";
import { PremiumServiceV1 } from "../../api/_lib/premium-service.js";
import type { TossPremiumClientV1 } from "../../api/_lib/premium-toss.js";
import type { PremiumPaymentOrderRecordV1 } from "../../shared/types/premium-service.js";

const ROOT_COLLECTIONS = [
  ACCOUNT_PAYMENT_LEASE_COLLECTION_V1,
  "premium_v1_orders",
  "premium_v1_registrations",
  "premium_v1_reports",
  "premium_v1_analyses",
  "premium_v1_checkout_requests",
  "premium_v1_content_artifacts",
  "premium_v1_active_content",
  "premium_v1_content_reviews",
  "premium_v1_provider_payment_keys",
  "premium_v1_entitlement_grants",
  "premium_v1_delivery_requests",
  "premium_v1_audit",
  "premium_v1_retained_payments",
  "premium_v1_entitlements",
  "premium_v1_unpaid_expiry_candidates",
  "premium_v1_unpaid_expiry_receipts",
  ...Object.values(PREMIUM_ADMIN_DISCOVERY_COLLECTIONS_V1),
  "server_maintenance_run_states_v1",
] as const;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.NAMESPRING_EMULATOR_PROJECT_ID;

if (!emulatorHost || !projectId) {
  test("premium payment maintenance Firestore emulator integration", {
    skip: "run inside the project Firestore emulator harness",
  }, () => undefined);
} else {
  assert.match(emulatorHost, /^(?:127\.0\.0\.1|localhost):\d{2,5}$/u);
  assert.match(projectId, /^demo-[a-z0-9-]{5,40}$/u);
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);

  process.env.PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON = JSON.stringify({
    currentKeyId: "premium-emulator-v1",
    keys: { "premium-emulator-v1": Buffer.alloc(32, 73).toString("base64") },
  });
  const premiumAuditKeyring = {
    currentKeyId: "premium-emulator-audit-v1",
    keys: { "premium-emulator-audit-v1": "premium-emulator-audit-secret-32-bytes-minimum" },
  } as const;
  process.env.PREMIUM_AUDIT_HMAC_KEYRING_JSON = JSON.stringify(premiumAuditKeyring);
  process.env.PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATE = "prelaunch_empty_v1_verified";

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  // Premium repository code intentionally obtains the default Admin
  // Firestore singleton. This default app remains emulator-only because the
  // harness supplies FIRESTORE_EMULATOR_HOST and a demo-* project.
  const app = initializeApp({
    projectId,
    credential: cert({
      projectId,
      clientEmail: `emulator@${projectId}.iam.gserviceaccount.com`,
      privateKey,
    }),
  });
  const db = getFirestore(app);

  async function clearCollection(firestore: Firestore, collectionName: string): Promise<void> {
    for (;;) {
      const snapshot = await firestore.collection(collectionName).limit(100).get();
      if (snapshot.empty) return;
      const batch = firestore.batch();
      for (const document of snapshot.docs) batch.delete(document.ref);
      await batch.commit();
    }
  }

  async function clearTestData(): Promise<void> {
    for (;;) {
      const index = await db.collectionGroup("items").limit(100).get();
      if (index.empty) break;
      const batch = db.batch();
      for (const document of index.docs) batch.delete(document.ref);
      await batch.commit();
    }
    for (const collectionName of ROOT_COLLECTIONS) await clearCollection(db, collectionName);
  }

  beforeEach(clearTestData);
  after(async () => {
    await clearTestData();
    await deleteApp(app);
    delete process.env.PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON;
    delete process.env.PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATE;
  });

  function leaseContext(internalUserId: string): string {
    return `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${internalUserId}`;
  }

  async function writeLease(
    internalUserId: string,
    index: number,
    reconcileAfter: string,
  ): Promise<void> {
    const lease = {
      schemaVersion: "namespring.account-payment-lease.v1",
      orderId: `order-${index}`,
      ownerSubjectId: `owner-${index}`,
      paymentKey: `payment-${index}`,
      acquiredAt: "2026-07-18T23:40:00.000Z",
      reconcileAfter,
    } as const;
    await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc(internalUserId).set({
      ...sealPremiumJsonRecordV1(leaseContext(internalUserId), lease),
      dueAt: Timestamp.fromDate(new Date(reconcileAfter)),
    });
  }

  function retained(
    index: number,
    paymentKey = `payment-${index}`,
    reconcileAfter = "2026-07-19T00:00:00.000Z",
  ): PremiumRetainedPaymentRecordV1 {
    return {
      schemaVersion: "namespring.retained-payment.v1",
      orderId: `order-${index}`,
      amount: 1_000,
      currency: "KRW",
      paymentProvider: "toss_web",
      paymentKey,
      status: "paid",
      createdAt: "2026-07-18T20:00:00.000Z",
      paidAt: "2026-07-18T20:01:00.000Z",
      refundedAt: null,
      paymentRecovery: {
        status: "scheduled",
        updatedAt: "2026-07-18T23:40:00.000Z",
        dueAt: reconcileAfter,
      },
      purchasePolicyReceipt: {
        termsVersion: "premium-terms.test.v1",
        termsDigest: `sha256:${"2".repeat(64)}`,
        refundPolicyVersion: "premium-refund.test.v1",
        refundPolicyDigest: `sha256:${"3".repeat(64)}`,
        recordedAt: "2026-07-18T20:00:00.000Z",
        bindingDigest: `sha256:${"4".repeat(64)}`,
      },
      retainedAt: "2026-07-18T22:00:00.000Z",
      retentionReason: "payment_tax_refund_record",
      deletionReference: `deletion-${index}`,
      deleteAfter: "2031-07-18T22:00:00.000Z",
    };
  }

  async function writeRetained(value: PremiumRetainedPaymentRecordV1): Promise<void> {
    const id = premiumDocumentKey("retained-payment", value.orderId);
    await db.collection("premium_v1_retained_payments").doc(id).set({
      ...sealPremiumJsonRecordV1(`premium_v1_retained_payments/${id}`, value),
      deleteAfter: Timestamp.fromDate(new Date(value.deleteAfter)),
    });
  }

  function providerObservation(
    index: number,
    status: string,
    balanceAmount: number,
  ): PremiumProviderObservationV1 {
    return {
      eventId: `event-${index}-${status}`,
      orderId: `order-${index}`,
      paymentKey: `payment-${index}`,
      status,
      totalAmount: 1_000,
      balanceAmount,
      currency: "KRW",
      occurredAt: "2026-07-19T00:00:05.000Z",
      observedAt: "2026-07-19T00:00:06.000Z",
    };
  }

  class EmulatorToss implements TossPremiumClientV1 {
    readonly rail = "toss_web" as const;
    getCalls: string[] = [];
    cancelCalls: string[] = [];

    async get(paymentKey: string) {
      this.getCalls.push(paymentKey);
      const index = Number(paymentKey.split("-").at(-1));
      return index === 3
        ? providerObservation(index, "PARTIAL_CANCELED", 600)
        : providerObservation(index, "DONE", 1_000);
    }

    async cancel(params: { paymentKey: string }) {
      this.cancelCalls.push(params.paymentKey);
      const index = Number(params.paymentKey.split("-").at(-1));
      return providerObservation(index, "CANCELED", 0);
    }

    async confirm() { throw new Error("not used by maintenance"); }
  }

  test("real due query isolates corrupt ciphertext, caps work at three, compensates partial cancel, and releases only terminal leases", {
    timeout: 30_000,
  }, async () => {
    const dueTimes = [
      "2026-07-19T00:00:00.000Z",
      "2026-07-19T00:00:01.000Z",
      "2026-07-19T00:00:02.000Z",
      "2026-07-19T00:00:03.000Z",
    ] as const;
    await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc("internal-user-1").set({
      schemaVersion: "corrupt-envelope",
      dueAt: Timestamp.fromDate(new Date(dueTimes[0])),
    });
    for (const index of [2, 3, 4]) {
      await writeLease(`internal-user-${index}`, index, dueTimes[index - 1]!);
      await writeRetained(retained(index, `payment-${index}`, dueTimes[index - 1]!));
    }

    const repository = new FirestorePremiumRepositoryV1();
    const toss = new EmulatorToss();
    const service = new PremiumServiceV1({
      repository,
      toss,
      now: () => "2026-07-19T00:00:10.000Z",
      createEngine: () => { throw new Error("premium maintenance must remain engine-free"); },
      ownerForActor: () => { throw new Error("premium maintenance must not derive a client owner"); },
    });
    const result = await service.reconcileDuePaymentLeases({
      userId: "system_premium_emulator",
      sessionId: "mrun_premium_emulator_maintenance_01",
      roles: ["premium_system"],
    }, 3, { deadlineAtEpochMs: Date.parse("2026-07-19T00:00:55.000Z") });

    assert.deepEqual(result, {
      scanned: 3,
      settled: 2,
      retryRequired: 1,
      deadlineReached: false,
      hasMore: true,
    });
    assert.deepEqual(toss.getCalls, ["payment-2", "payment-3"]);
    assert.deepEqual(toss.cancelCalls, ["payment-3"]);
    assert.equal((await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc("internal-user-1").get()).exists, true);
    assert.equal((await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc("internal-user-2").get()).exists, false);
    assert.equal((await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc("internal-user-3").get()).exists, false);
    assert.equal((await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc("internal-user-4").get()).exists, true);

    const retainedThree = await repository.getRetainedPayment("order-3");
    assert.equal(retainedThree?.status, "refunded");
    assert.equal(retainedThree?.providerState?.status, "CANCELED");
    assert.equal(retainedThree?.providerState?.balanceAmount, 0);
  });

  test("transactional preflight rejects a lease replacement and a retained-payment identity conflict", {
    timeout: 20_000,
  }, async () => {
    const dueAt = "2026-07-19T00:00:00.000Z";
    await writeLease("internal-user-1", 1, dueAt);
    await writeRetained(retained(1, "payment-1", dueAt));
    const repository = new FirestorePremiumRepositoryV1();
    const [queued] = await repository.listDuePaymentConfirmationLeaseCandidates({
      now: "2026-07-19T00:00:10.000Z",
      limit: 1,
    });
    assert.ok(queued);

    await writeLease("internal-user-1", 1, "2026-07-19T00:30:00.000Z");
    await assert.rejects(
      repository.readDuePaymentConfirmationLease({
        candidate: queued,
        now: "2026-07-19T00:00:10.000Z",
      }),
      (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_PAYMENT_LEASE_CHANGED",
    );

    await writeLease("internal-user-1", 1, dueAt);
    await writeRetained(retained(1, "different-payment-key", dueAt));
    const [current] = await repository.listDuePaymentConfirmationLeaseCandidates({
      now: "2026-07-19T00:00:10.000Z",
      limit: 1,
    });
    assert.ok(current);
    await assert.rejects(
      repository.readDuePaymentConfirmationLease({
        candidate: current,
        now: "2026-07-19T00:00:10.000Z",
      }),
      (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_PAYMENT_LEASE_CONFLICT",
    );
    assert.equal((await db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc("internal-user-1").get()).exists, true);
  });

  test("admin discovery stays transactionally aligned across concurrent lease acquisition and fails closed on tampering", {
    timeout: 20_000,
  }, async () => {
    const internalUserId = "123e4567-e89b-42d3-a456-426614174000";
    const owner = { kind: "account" as const, subjectId: `premium_owner_v2_${"a".repeat(43)}` };
    const order: PremiumPaymentOrderRecordV1 = {
      schemaVersion: "namespring.premium-order-record.v1",
      orderId: `premium_order_v1_${"b".repeat(24)}`,
      requestId: `premium_request_v1_${"c".repeat(24)}`,
      accountWriteSubjectId: internalUserId,
      owner,
      binding: {
        reportId: `report_v1_${"d".repeat(24)}`,
        analysisId: `server_analysis_v1_${"e".repeat(24)}`,
        candidateId: `candidate_v1_${"f".repeat(24)}`,
        productId: "report.story-completion.v1",
        contentVersion: "story-completion.2026-07.v1",
      },
      contentActivation: {
        sourceKind: "report_artifact",
        resourceId: `premium_artifact_v1_${"g".repeat(24)}`,
        activationId: `premium_activation_v1_${"h".repeat(24)}`,
        immutableContentDigest: `sha256:${"1".repeat(64)}`,
      },
      catalogVersion: "premium-catalog.2026-07.v1",
      amount: 1_000,
      currency: "KRW",
      status: "ready",
      paymentProvider: "toss_web",
      paymentKey: null,
      entitlementId: null,
      createdAt: "2026-07-19T01:00:00.000Z",
      updatedAt: "2026-07-19T01:00:00.000Z",
      paidAt: null,
      refundedAt: null,
      paymentRecovery: {
        status: "not_required",
        updatedAt: "2026-07-19T01:00:00.000Z",
        dueAt: null,
      },
      purchaseTermsReceipt: {
        accepted: true,
        termsVersion: "premium-terms.test.v1",
        termsDigest: `sha256:${"2".repeat(64)}`,
        refundPolicyVersion: "premium-refund.test.v1",
        refundPolicyDigest: `sha256:${"3".repeat(64)}`,
        clientAcceptedAt: "2026-07-19T01:00:00.000Z",
        recordedAt: "2026-07-19T01:00:00.000Z",
        acceptanceDigest: `sha256:${"4".repeat(64)}`,
        bindingDigest: `sha256:${"5".repeat(64)}`,
      },
    };
    await db.runTransaction(async (transaction) => {
      transaction.create(db.collection("premium_v1_orders").doc(order.orderId),
        sealPremiumJsonRecordV1(`premium_v1_orders/${order.orderId}`, order));
      writePremiumOrderAdminProjectionsV1(transaction, db, order);
    });

    const repository = new FirestorePremiumRepositoryV1();
    const acquisition = {
      internalUserId,
      owner,
      orderId: order.orderId,
      paymentKey: `payment_${"i".repeat(24)}`,
      now: "2026-07-19T01:01:00.000Z",
    };
    const results = await Promise.all([
      repository.acquirePaymentConfirmationLease(acquisition),
      repository.acquirePaymentConfirmationLease(acquisition),
    ]);
    assert.deepEqual(results.map((result) => result.mode).sort(), ["idempotent_replay", "initial"]);

    const discovery = new FirestorePremiumAdminDiscoveryV1(db);
    const recovery = await discovery.get({ resource: "payment_recovery", id: order.orderId });
    assert.equal(recovery.resource, "payment_recovery");
    assert.equal(recovery.recoveryStatus, "scheduled");
    assert.equal(recovery.dueAt, "2026-07-19T01:16:00.000Z");
    const serialized = JSON.stringify(recovery);
    assert.equal(serialized.includes(internalUserId), false);
    assert.equal(serialized.includes(acquisition.paymentKey), false);
    assert.equal(serialized.includes(owner.subjectId), false);
    assert.equal(serialized.includes(order.binding.candidateId), false);
    assert.equal(serialized.includes(order.binding.analysisId), false);

    const page = await discovery.list({ resource: "orders", limit: 1 });
    assert.equal(page.items.length, 1);
    assert.equal(page.nextCursor, null);
    assert.match(JSON.stringify(page), /"provider":"toss_web"/u);

    const projection = await db.collection(PREMIUM_ADMIN_DISCOVERY_COLLECTIONS_V1.payment_recovery)
      .limit(1).get();
    assert.equal(projection.size, 1);
    await projection.docs[0]!.ref.update({ sourceDigest: `sha256:${"0".repeat(64)}` });
    await assert.rejects(
      discovery.get({ resource: "payment_recovery", id: order.orderId }),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "PREMIUM_ADMIN_PROJECTION_STALE",
    );
  });

  test("unpurchased registration, analysis, and report expire atomically while only a TTL receipt remains", {
    timeout: 20_000,
  }, async () => {
    const owner = { kind: "account" as const, subjectId: `premium_owner_v2_${"u".repeat(43)}` };
    const internalUserId = "123e4567-e89b-42d3-a456-426614174001";
    const reportId = `report_v1_${"r".repeat(24)}`;
    const analysisId = `server_analysis_v1_${"a".repeat(24)}`;
    const requestId = `premium_request_v1_${"q".repeat(24)}`;
    const materialDigest = `sha256:${"6".repeat(64)}` as const;
    const report = {
      schemaVersion: "namespring.premium-report-reference.v1",
      authority: "server",
      registration: {
        requestId,
        owner,
        productId: "report.story-completion.v1",
        candidateId: `candidate_v1_${"c".repeat(24)}`,
        materialDigest,
      },
      binding: {
        reportId,
        analysisId,
        candidateId: `candidate_v1_${"c".repeat(24)}`,
        productId: "report.story-completion.v1",
        contentVersion: "story-completion.2026-07.v1",
      },
      status: "registered",
      registeredAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    } as const;
    const analysis = {
      schemaVersion: "namespring.premium-server-analysis.v1",
      analysisId,
      reportId,
      owner,
      registrationRequestId: requestId,
      materialDigest,
      dataProcessingConsent: {
        accepted: true,
        noticeVersion: "premium-data-notice.test.v1",
        noticeDigest: `sha256:${"1".repeat(64)}`,
        purpose: "premium_report_server_recomputation",
        clientAcceptedAt: "2026-07-17T00:00:00.000Z",
        recordedAt: "2026-07-17T00:00:00.000Z",
        registrationMaterialDigest: materialDigest,
        acceptanceDigest: `sha256:${"2".repeat(64)}`,
        bindingDigest: `sha256:${"3".repeat(64)}`,
      },
      recomputedAt: "2026-07-17T00:00:00.000Z",
      sealedDelivery: {
        schemaVersion: "namespring.premium-sealed-analysis.v1",
        algorithm: "A256GCM",
        keyId: "test-key",
        iv: "iv",
        ciphertext: "ciphertext",
        authenticationTag: "tag",
      },
      evidence: [],
      contentSelector: {
        schemaVersion: "namespring.premium-content-selector.v1",
        algorithmVersion: "story-selector-v2",
        keys: ["overall.life.default"],
        axes: {
          category: "overall", period: "life", age: "adult", band: "mid", gender: "male",
          strength: "balanced", gyeok: "special", interaction: "neutral",
        },
      },
    } as const;
    const audit = {
      schemaVersion: "namespring.premium-audit-event.v1",
      auditId: `premium_audit_v1_${"d".repeat(24)}`,
      occurredAt: "2026-07-17T00:00:00.000Z",
      deleteAfter: "2027-07-17T00:00:00.000Z",
      action: "report.registered",
      actor: { userId: "premium_audit_actor", sessionId: "premium_audit_session", roles: ["user"] },
      owner,
      reportId,
      requestId,
    } as const;
    const repository = new FirestorePremiumRepositoryV1();
    await repository.commitRegistration({
      internalUserId,
      report: report as never,
      analysis: analysis as never,
      audit: audit as never,
    });
    assert.equal((await db.collection("premium_v1_unpaid_expiry_candidates").get()).size, 1);

    const contentActivation = {
      sourceKind: "report_artifact" as const,
      resourceId: `premium_artifact_v1_${"e".repeat(24)}`,
      activationId: `premium_activation_v1_${"f".repeat(24)}`,
      immutableContentDigest: `sha256:${"7".repeat(64)}` as const,
    };
    const reviewReceiptId = `premium_review_v1_${"r".repeat(43)}`;
    const reviewMaterialDigest = premiumArtifactReviewedMaterialDigestV1({
      schemaVersion: "namespring.premium-content-record.v1",
      artifactId: contentActivation.resourceId,
      reportId,
      productId: report.binding.productId,
      contentVersion: report.binding.contentVersion,
      lifecycle: "active",
      provenance: {},
      content: {},
    } as never, report.binding);
    const reviewer = {
      userId: "123e4567-e89b-42d3-a456-426614174001",
      sessionId: "premium-reviewer-session",
      roles: ["premium_admin"],
    } as const;
    await repository.createContentReview({
      reviewer,
      receipt: {
        schemaVersion: "namespring.premium-content-review-receipt.v1",
        receiptId: reviewReceiptId,
        requestId: `premium_review_request_v1_${"q".repeat(24)}`,
        resourceKind: "report_artifact",
        resourceId: contentActivation.resourceId,
        reportId,
        analysisId,
        productId: report.binding.productId,
        contentVersion: report.binding.contentVersion,
        selectorKey: null,
        reviewedMaterialDigest: reviewMaterialDigest,
        notesDigest: `sha256:${"5".repeat(64)}`,
        decision: "approved",
        reviewer: { actorSubject: premiumAuditActorV2(reviewer, premiumAuditKeyring).userId },
        reviewedAt: "2026-07-17T00:00:00.000Z",
        authorityExpiresAt: "2026-07-24T00:00:00.000Z",
        status: "pending",
        consumption: null,
        deleteAfter: "2027-07-17T00:00:00.000Z",
      },
      audit: {
        ...audit,
        auditId: `premium_audit_v1_${"r".repeat(24)}`,
        action: "content.reviewed",
        actor: { ...audit.actor, roles: ["premium_admin"] },
      } as never,
    });
    const activator = {
      userId: "123e4567-e89b-42d3-a456-426614174002",
      sessionId: "premium-activator-session",
      roles: ["premium_admin"],
    } as const;
    await repository.activateContent({
      artifact: {
        schemaVersion: "namespring.premium-content-record.v1",
        artifactId: contentActivation.resourceId,
        reportId,
        productId: report.binding.productId,
        contentVersion: report.binding.contentVersion,
        lifecycle: "active",
        activation: {
          activationId: contentActivation.activationId,
          reviewReceiptId,
          activatedAt: "2026-07-17T00:00:01.000Z",
          activatedBy: premiumAuditActorV2(activator, premiumAuditKeyring).userId,
          immutableContentDigest: contentActivation.immutableContentDigest,
        },
        provenance: {},
        content: {},
      } as never,
      reviewReceiptId,
      activationRequestId: `premium_activation_request_v1_${"s".repeat(24)}`,
      reviewedMaterialDigest: reviewMaterialDigest,
      activator,
      audit: {
        ...audit,
        auditId: `premium_audit_v1_${"e".repeat(24)}`,
        action: "content.activated",
        occurredAt: "2026-07-17T00:00:01.000Z",
      } as never,
    });

    const purchaseReceipt = {
      accepted: true as const,
      termsVersion: "premium-terms.test.v1",
      termsDigest: `sha256:${"8".repeat(64)}` as const,
      refundPolicyVersion: "premium-refund.test.v1",
      refundPolicyDigest: `sha256:${"9".repeat(64)}` as const,
      clientAcceptedAt: "2026-07-17T00:00:02.000Z",
      recordedAt: "2026-07-17T00:00:02.000Z",
      acceptanceDigest: `sha256:${"a".repeat(64)}` as const,
      bindingDigest: `sha256:${"b".repeat(64)}` as const,
    };
    const checkoutAudit = (orderId: string, auditId: string, occurredAt: string) => ({
      ...audit,
      auditId,
      action: "payment.created" as const,
      orderId,
      occurredAt,
    });
    const order = (
      orderId: string,
      checkoutRequestId: string,
      createdAt: string,
    ): PremiumPaymentOrderRecordV1 => ({
      schemaVersion: "namespring.premium-order-record.v1",
      orderId,
      requestId: checkoutRequestId,
      accountWriteSubjectId: internalUserId,
      owner,
      binding: report.binding,
      contentActivation,
      catalogVersion: "premium-catalog.test.v1",
      purchaseTermsReceipt: purchaseReceipt,
      amount: 1_000,
      currency: "KRW",
      status: "ready",
      paymentProvider: "toss_web",
      paymentKey: null,
      entitlementId: null,
      createdAt,
      updatedAt: createdAt,
      paidAt: null,
      refundedAt: null,
      paymentRecovery: { status: "not_required", updatedAt: createdAt, dueAt: null },
    });

    const firstOrder = order(
      `premium_order_v1_${"g".repeat(24)}`,
      `premium_request_v1_${"h".repeat(24)}`,
      "2026-07-17T00:00:02.000Z",
    );
    const firstCheckout = await repository.createCheckout({
      internalUserId,
      order: firstOrder,
      audit: checkoutAudit(firstOrder.orderId, `premium_audit_v1_${"f".repeat(24)}`, firstOrder.createdAt) as never,
    });
    assert.equal(firstCheckout.mode, "initial");
    assert.equal((await repository.createCheckout({
      internalUserId,
      order: firstOrder,
      audit: checkoutAudit(firstOrder.orderId, `premium_audit_v1_${"g".repeat(24)}`, firstOrder.createdAt) as never,
    })).mode, "idempotent_replay");

    const overlappingOrder = order(
      `premium_order_v1_${"i".repeat(24)}`,
      `premium_request_v1_${"j".repeat(24)}`,
      "2026-07-17T00:00:03.000Z",
    );
    await assert.rejects(
      repository.createCheckout({
        internalUserId,
        order: overlappingOrder,
        audit: checkoutAudit(overlappingOrder.orderId, `premium_audit_v1_${"h".repeat(24)}`, overlappingOrder.createdAt) as never,
      }),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "PREMIUM_CHECKOUT_ALREADY_OPEN",
    );

    // A provider-terminal no-grant state releases only the report lock. The
    // failed order keeps its own expiry candidate for bounded data cleanup.
    await repository.failUnpaidOrder({
      orderId: firstOrder.orderId,
      actor: {
        userId: "premium_system_checkout_test",
        sessionId: "premium_system_checkout_session",
        roles: ["premium_system"],
      },
      observation: {
        eventId: "toss_event_v1_checkout_canceled",
        paymentKey: `payment_${"k".repeat(24)}`,
        orderId: firstOrder.orderId,
        status: "CANCELED",
        totalAmount: 1_000,
        balanceAmount: 0,
        currency: "KRW",
        occurredAt: "2026-07-17T00:00:04.000Z",
        observedAt: "2026-07-17T00:00:05.000Z",
      },
      audit: {
        ...audit,
        auditId: `premium_audit_v1_${"i".repeat(24)}`,
        action: "payment.reconciled",
        orderId: firstOrder.orderId,
        occurredAt: "2026-07-17T00:00:05.000Z",
      } as never,
    });
    const retryCheckout = await repository.createCheckout({
      internalUserId,
      order: overlappingOrder,
      audit: checkoutAudit(overlappingOrder.orderId, `premium_audit_v1_${"j".repeat(24)}`, overlappingOrder.createdAt) as never,
    });
    assert.equal(retryCheckout.mode, "initial");

    const expiredOrders = await repository.sweepExpiredUnpaidData({
      now: "2026-07-17T01:00:00.000Z",
      limit: 20,
    });
    assert.equal(expiredOrders.deleted, 2);
    assert.equal(await repository.getOrder(firstOrder.orderId), null);
    assert.equal(await repository.getOrder(overlappingOrder.orderId), null);

    const result = await repository.sweepExpiredUnpaidData({
      now: "2026-07-19T00:00:00.000Z",
      limit: 20,
    });
    assert.deepEqual(result, { scanned: 1, deleted: 1, skipped: 0, failed: 0, hasMore: false });
    assert.equal(await repository.getReport(reportId), null);
    assert.equal(await repository.getAnalysis(analysisId), null);
    assert.equal((await db.collection("premium_v1_registrations").get()).empty, true);
    assert.equal((await db.collection("premium_v1_unpaid_expiry_candidates").get()).empty, true);
    const receipts = await db.collection("premium_v1_unpaid_expiry_receipts").get();
    assert.equal(receipts.size, 3, "two terminal-order receipts and one report receipt remain TTL-only");
    assert.equal(receipts.docs.every((document) => document.data().deleteAfter instanceof Timestamp), true);
    assert.equal(JSON.stringify(receipts.docs.map((document) => document.data())).includes(owner.subjectId), false);
  });

  test("sealed premium review receipt is single-consumer under concurrent activation and leaks no raw principal", {
    timeout: 20_000,
  }, async () => {
    const repository = new FirestorePremiumRepositoryV1();
    const reportId = `report_v1_${"r".repeat(24)}`;
    const analysisId = `server_analysis_v1_${"a".repeat(24)}`;
    const owner = { kind: "account" as const, subjectId: `premium_owner_v2_${"o".repeat(43)}` };
    const report = {
      schemaVersion: "namespring.premium-report-reference.v1",
      authority: "server",
      registration: {
        decision: "allowed",
        owner,
        requestId: `premium_request_v1_${"q".repeat(24)}`,
        materialDigest: `sha256:${"1".repeat(64)}`,
      },
      binding: {
        reportId,
        analysisId,
        candidateId: `candidate_v1_${"c".repeat(24)}`,
        productId: "report.story-completion.v1",
        contentVersion: "story-completion.2026-07.v1",
      },
      status: "registered",
      registeredAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    } as const;
    await db.collection("premium_v1_reports").doc(reportId).set(sealPremiumJsonRecordV1(
      `premium_v1_reports/${reportId}`,
      report,
    ));
    const reviewer = {
      userId: "123e4567-e89b-42d3-a456-426614174011",
      sessionId: "raw-review-session-must-not-leak",
      roles: ["premium_admin"],
    } as const;
    const activator = {
      userId: "123e4567-e89b-42d3-a456-426614174012",
      sessionId: "raw-activation-session-must-not-leak",
      roles: ["premium_admin"],
    } as const;
    const receiptId = `premium_review_v1_${"v".repeat(43)}`;
    const materialDigest = premiumArtifactReviewedMaterialDigestV1({
      schemaVersion: "namespring.premium-content-record.v1",
      artifactId: `premium_artifact_v1_${"x".repeat(24)}`,
      reportId,
      productId: report.binding.productId,
      contentVersion: report.binding.contentVersion,
      lifecycle: "active",
      provenance: {},
      content: {},
    } as never, report.binding as never);
    const baseAudit = {
      schemaVersion: "namespring.premium-audit-event.v1",
      occurredAt: "2026-07-19T00:00:01.000Z",
      deleteAfter: "2027-07-19T00:00:01.000Z",
      actor: {
        userId: "premium_audit_actor_v2:premium-emulator-audit-v1:" + "1".repeat(64),
        sessionId: "premium_audit_session_v2:premium-emulator-audit-v1:" + "2".repeat(64),
        roles: ["premium_admin"],
      },
      owner,
      reportId,
    } as const;
    await repository.createContentReview({
      reviewer,
      receipt: {
        schemaVersion: "namespring.premium-content-review-receipt.v1",
        receiptId,
        requestId: `premium_review_request_v1_${"w".repeat(24)}`,
        resourceKind: "report_artifact",
        resourceId: `premium_artifact_v1_${"x".repeat(24)}`,
        reportId,
        analysisId,
        productId: report.binding.productId,
        contentVersion: report.binding.contentVersion,
        selectorKey: null,
        reviewedMaterialDigest: materialDigest,
        notesDigest: `sha256:${"3".repeat(64)}`,
        decision: "approved",
        reviewer: { actorSubject: premiumAuditActorV2(reviewer, premiumAuditKeyring).userId },
        reviewedAt: "2026-07-19T00:00:01.000Z",
        authorityExpiresAt: "2026-07-26T00:00:01.000Z",
        status: "pending",
        consumption: null,
        deleteAfter: "2027-07-19T00:00:01.000Z",
      },
      audit: {
        ...baseAudit,
        auditId: `premium_audit_v1_${"v".repeat(24)}`,
        action: "content.reviewed",
        requestId: `premium_review_request_v1_${"w".repeat(24)}`,
      } as never,
    });
    const storedEnvelope = (await db.collection("premium_v1_content_reviews").doc(receiptId).get()).data()!;
    assert.equal(storedEnvelope.deleteAfter instanceof Timestamp, true);
    const serializedEnvelope = JSON.stringify(storedEnvelope);
    for (const forbidden of [reviewer.userId, reviewer.sessionId, activator.userId, activator.sessionId, reportId, analysisId]) {
      assert.equal(serializedEnvelope.includes(forbidden), false, `sealed review envelope leaked ${forbidden}`);
    }

    const activationInput = (suffix: string) => ({
      artifact: {
        schemaVersion: "namespring.premium-content-record.v1",
        artifactId: `premium_artifact_v1_${"x".repeat(24)}`,
        reportId,
        productId: report.binding.productId,
        contentVersion: report.binding.contentVersion,
        lifecycle: "active",
        activation: {
          activationId: `premium_activation_v1_${suffix.repeat(24)}`,
          reviewReceiptId: receiptId,
          activatedAt: "2026-07-19T00:00:02.000Z",
          activatedBy: premiumAuditActorV2(activator, premiumAuditKeyring).userId,
          immutableContentDigest: `sha256:${suffix.repeat(64)}`,
        },
        provenance: {},
        content: {},
      } as never,
      reviewReceiptId: receiptId,
      activationRequestId: `premium_activation_request_v1_${suffix.repeat(24)}`,
      reviewedMaterialDigest: materialDigest,
      activator,
      audit: {
        ...baseAudit,
        auditId: `premium_audit_v1_${suffix.repeat(24)}`,
        action: "content.activated",
        occurredAt: "2026-07-19T00:00:02.000Z",
      } as never,
    });
    const contenders = [activationInput("4"), activationInput("5")] as const;
    const results = await Promise.allSettled(contenders.map((input) => repository.activateContent(input)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected")!;
    assert.equal(rejected.reason instanceof ApiHttpError && rejected.reason.code === "PREMIUM_REVIEW_RECEIPT_CONSUMED", true);
    const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
    const replay = await repository.activateContent(contenders[winnerIndex]!);
    assert.equal(replay.activation?.activationId, contenders[winnerIndex]!.artifact.activation.activationId);
    const storedConsumed = await repository.getContentReviewReceipt(receiptId);
    assert.equal(storedConsumed?.status, "consumed");
    assert.equal(storedConsumed?.consumption?.activationRequestId, contenders[winnerIndex]!.activationRequestId);
  });

  test("premium global claims have one owner and stale fencing cannot finalize a takeover", {
    timeout: 20_000,
  }, async () => {
    const left = new FirestoreMaintenanceCoordinatorV1(db, () => "p".repeat(43));
    const right = new FirestoreMaintenanceCoordinatorV1(db, () => "q".repeat(43));
    const now = new Date("2026-07-19T00:00:00.000Z");
    const [leftClaim, rightClaim] = await Promise.all([
      left.claim({
        job: "premium_payment_reconciliation",
        runId: "mrun_premium_emulator_claim_owner_a1",
        now,
        leaseMs: 90_000,
      }),
      right.claim({
        job: "premium_payment_reconciliation",
        runId: "mrun_premium_emulator_claim_owner_b1",
        now,
        leaseMs: 90_000,
      }),
    ]);
    const winner = [leftClaim, rightClaim].find((claim) => claim.acquired);
    assert.ok(winner?.acquired);
    assert.equal([leftClaim, rightClaim].filter((claim) => claim.acquired).length, 1);

    const takeoverCoordinator = new FirestoreMaintenanceCoordinatorV1(db, () => "r".repeat(43));
    const takeover = await takeoverCoordinator.claim({
      job: "premium_payment_reconciliation",
      runId: "mrun_premium_emulator_claim_takeover1",
      now: new Date("2026-07-19T00:01:30.001Z"),
      leaseMs: 90_000,
    });
    assert.ok(takeover.acquired);
    assert.equal(takeover.fence, winner.fence + 1);
    const winnerCoordinator = leftClaim.acquired ? left : right;
    assert.equal(await winnerCoordinator.finish({
      claim: winner,
      now: new Date("2026-07-19T00:01:31.000Z"),
      outcome: "completed",
      aggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
    }), false);
    assert.equal(await takeoverCoordinator.finish({
      claim: takeover,
      now: new Date("2026-07-19T00:01:32.000Z"),
      outcome: "completed",
      aggregate: { scanned: 2, deleted: 2, skipped: 0, failed: 0, deadlineReached: false },
    }), true);
  });
}
