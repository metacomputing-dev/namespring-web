import assert from "node:assert/strict";
import test from "node:test";

import { ApiHttpError } from "../../api/_lib/http.js";
import type {
  MaintenanceClaimResultV1,
  MaintenanceCoordinatorV1,
} from "../../api/_lib/maintenance-coordinator.js";
import {
  runPremiumPaymentMaintenanceV1,
  type PremiumMaintenanceDependenciesV1,
} from "../../api/_lib/premium-maintenance.js";
import type {
  PremiumPaymentLeaseCandidateV1,
  PremiumPaymentLeaseWorkItemV1,
  PremiumProviderObservationV1,
  PremiumRepositoryV1,
  PremiumRetainedPaymentRecordV1,
} from "../../api/_lib/premium-repository.js";
import { PremiumServiceV1 } from "../../api/_lib/premium-service.js";
import type { TossPremiumClientV1 } from "../../api/_lib/premium-toss.js";
import type { PremiumPaymentOrderRecordV1 } from "../../shared/types/premium-service.js";

process.env.PREMIUM_AUDIT_HMAC_KEYRING_JSON = JSON.stringify({
  currentKeyId: "maintenance-test-v1",
  keys: { "maintenance-test-v1": "premium-maintenance-audit-secret-0123456789" },
});

const SYSTEM_ACTOR = {
  userId: "system_premium_test",
  sessionId: "session_premium_test",
  roles: ["premium_system"],
} as const;

function candidate(index: number): PremiumPaymentLeaseCandidateV1 {
  return {
    internalUserId: `internal-user-${index}`,
    dueAt: "2026-07-18T00:00:00.000Z",
  };
}

function work(index: number): PremiumPaymentLeaseWorkItemV1 {
  return {
    ...candidate(index),
    settlementState: "scheduled",
    orderId: `order-${index}`,
    ownerSubjectId: `owner-${index}`,
    paymentKey: `payment-${index}`,
    acquiredAt: "2026-07-17T23:45:00.000Z",
    reconcileAfter: "2026-07-18T00:00:00.000Z",
  };
}

function paidOrder(index: number): PremiumPaymentOrderRecordV1 {
  return {
    schemaVersion: "namespring.premium-order-record.v1",
    orderId: `order-${index}`,
    requestId: `request-${index}`,
    accountWriteSubjectId: `internal-user-${index}`,
    owner: { kind: "account", subjectId: `owner-${index}` },
    binding: {
      reportId: `report-${index}`,
      analysisId: `analysis-${index}`,
      candidateId: `candidate-${index}`,
      productId: "report.story-completion.v1",
      contentVersion: "story-completion.test.v1",
    },
    contentActivation: {
      sourceKind: "report_artifact",
      resourceId: `artifact-${index}`,
      activationId: `activation-${index}`,
      immutableContentDigest: `sha256:${"1".repeat(64)}`,
    },
    catalogVersion: "catalog.test.v1",
    status: "paid",
    paymentKey: `payment-${index}`,
    paymentProvider: "toss_web",
    paymentRecovery: { status: "scheduled", updatedAt: "2026-07-17T23:45:00.000Z", dueAt: "2026-07-18T00:00:00.000Z" },
    amount: 1_000,
    currency: "KRW",
    entitlementId: `entitlement-${index}`,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    paidAt: "2026-07-18T00:00:00.000Z",
    refundedAt: null,
    purchaseTermsReceipt: {
      accepted: true,
      termsVersion: "premium-terms.test.v1",
      termsDigest: `sha256:${"2".repeat(64)}`,
      refundPolicyVersion: "premium-refund.test.v1",
      refundPolicyDigest: `sha256:${"3".repeat(64)}`,
      clientAcceptedAt: "2026-07-17T00:00:00.000Z",
      recordedAt: "2026-07-17T00:00:00.000Z",
      acceptanceDigest: `sha256:${"4".repeat(64)}`,
      bindingDigest: `sha256:${"5".repeat(64)}`,
    },
  } as PremiumPaymentOrderRecordV1;
}

function observation(index: number, status = "DONE"): PremiumProviderObservationV1 {
  return {
    eventId: `event-${index}`,
    orderId: `order-${index}`,
    paymentKey: `payment-${index}`,
    status,
    totalAmount: 1_000,
    balanceAmount: status === "CANCELED" ? 0 : 1_000,
    currency: "KRW",
    occurredAt: "2026-07-18T00:00:00.000Z",
    observedAt: "2026-07-18T00:00:00.000Z",
  };
}

class LeaseRepository {
  readonly finalized: string[] = [];
  readonly retained = new Map<string, PremiumRetainedPaymentRecordV1>();
  readonly orders = new Map<string, PremiumPaymentOrderRecordV1>();
  corruptInternalUserId: string | null = null;
  confirmationFailureCode: string | null = null;

  constructor(readonly candidates: readonly PremiumPaymentLeaseCandidateV1[]) {}

  async listDuePaymentConfirmationLeaseCandidates(input: { limit: number }) {
    return this.candidates.slice(0, input.limit);
  }

  async readDuePaymentConfirmationLease(input: { candidate: PremiumPaymentLeaseCandidateV1 }) {
    if (input.candidate.internalUserId === this.corruptInternalUserId) {
      throw new ApiHttpError(500, "PREMIUM_PAYMENT_LEASE_CORRUPT", "sensitive corrupt candidate detail");
    }
    const index = Number(input.candidate.internalUserId.split("-").at(-1));
    return work(index);
  }

  async finalizeSettledPaymentConfirmationLease(input: { lease: PremiumPaymentLeaseWorkItemV1 }) {
    this.finalized.push(input.lease.orderId);
  }

  async getOrder(orderId: string) { return this.orders.get(orderId) ?? null; }
  async getRetainedPayment(orderId: string) { return this.retained.get(orderId) ?? null; }

  async confirmPayment(input: {
    orderId: string;
    observation: PremiumProviderObservationV1;
    entitlementId: string;
  }) {
    if (this.confirmationFailureCode) {
      throw new ApiHttpError(409, this.confirmationFailureCode, "deterministic local grant failure");
    }
    const order = this.orders.get(input.orderId)!;
    const entitlement = {
      schemaVersion: "namespring.report-entitlement.v1" as const,
      entitlementId: input.entitlementId,
      authority: "server" as const,
      owner: order.owner,
      binding: order.binding,
      status: "active" as const,
      grantSource: "verified_payment" as const,
      createdAt: input.observation.observedAt,
      updatedAt: input.observation.observedAt,
      activatedAt: input.observation.occurredAt,
    };
    const updated = {
      ...order,
      status: "paid" as const,
      paymentKey: input.observation.paymentKey,
      entitlementId: entitlement.entitlementId,
      paidAt: input.observation.occurredAt,
      updatedAt: input.observation.observedAt,
    };
    this.orders.set(order.orderId, updated);
    return { order: updated, entitlement, mode: "initial" as const };
  }

  async compensateCanceledPayment(input: {
    orderId: string;
    observation: PremiumProviderObservationV1;
  }) {
    const order = this.orders.get(input.orderId)!;
    const updated = {
      ...order,
      status: "refunded" as const,
      paymentKey: input.observation.paymentKey,
      refundedAt: input.observation.occurredAt,
      updatedAt: input.observation.observedAt,
      providerState: {
        status: input.observation.status,
        totalAmount: input.observation.totalAmount,
        balanceAmount: input.observation.balanceAmount,
        occurredAt: input.observation.occurredAt,
        observedAt: input.observation.observedAt,
        eventId: input.observation.eventId,
      },
    };
    this.orders.set(order.orderId, updated);
    return { order: updated, entitlement: null, mode: "initial" as const };
  }

  async settleRetainedPayment(input: { orderId: string; observation: PremiumProviderObservationV1 }) {
    const previous = this.retained.get(input.orderId)!;
    const updated: PremiumRetainedPaymentRecordV1 = {
      ...previous,
      status: input.observation.status === "CANCELED" ? "refunded" : previous.status,
      refundedAt: input.observation.status === "CANCELED" ? input.observation.occurredAt : previous.refundedAt,
      providerState: {
        status: input.observation.status,
        totalAmount: input.observation.totalAmount,
        balanceAmount: input.observation.balanceAmount,
        occurredAt: input.observation.occurredAt,
        observedAt: input.observation.observedAt,
        eventId: input.observation.eventId,
      },
    };
    this.retained.set(input.orderId, updated);
    return { payment: updated, mode: "initial" as const };
  }
}

class TossStub implements TossPremiumClientV1 {
  readonly rail = "toss_web" as const;
  getCalls = 0;
  cancelCalls = 0;
  readonly statuses = new Map<string, string>();
  onCall: (() => void) | null = null;

  async get(paymentKey: string) {
    this.getCalls += 1;
    this.onCall?.();
    const index = Number(paymentKey.split("-").at(-1));
    return observation(index, this.statuses.get(paymentKey) ?? "DONE");
  }

  async cancel(params: { paymentKey: string }) {
    this.cancelCalls += 1;
    this.onCall?.();
    const index = Number(params.paymentKey.split("-").at(-1));
    return observation(index, "CANCELED");
  }

  async confirm() { throw new Error("not used"); }
}

function serviceFixture(count: number) {
  let nowEpoch = Date.parse("2026-07-18T00:00:00.000Z");
  const repository = new LeaseRepository(Array.from({ length: count }, (_, index) => candidate(index + 1)));
  const toss = new TossStub();
  const service = new PremiumServiceV1({
    repository: repository as unknown as PremiumRepositoryV1,
    toss,
    now: () => new Date(nowEpoch).toISOString(),
    createEngine: () => { throw new Error("maintenance must not initialize SpringEngine"); },
    ownerForActor: () => { throw new Error("maintenance must not derive a browser owner"); },
  });
  return {
    repository,
    toss,
    service,
    advance(ms: number) { nowEpoch += ms; },
    now: () => nowEpoch,
  };
}

test("premium lease sweep isolates a corrupt candidate and performs at most exactly three sequential provider reads", async () => {
  const fixture = serviceFixture(5);
  fixture.repository.corruptInternalUserId = candidate(1).internalUserId;
  for (const index of [2, 3, 4, 5]) fixture.repository.orders.set(`order-${index}`, paidOrder(index));

  const result = await fixture.service.reconcileDuePaymentLeases(SYSTEM_ACTOR, 3, {
    deadlineAtEpochMs: fixture.now() + 45_000,
  });
  assert.deepEqual(result, {
    scanned: 3,
    settled: 2,
    retryRequired: 1,
    deadlineReached: false,
    hasMore: true,
  });
  assert.equal(fixture.toss.getCalls, 2);
  assert.deepEqual(fixture.repository.finalized, ["order-2", "order-3"]);
  assert.equal(JSON.stringify(result).includes("order-"), false);
  assert.equal(JSON.stringify(result).includes("PREMIUM_PAYMENT_LEASE_CORRUPT"), false);
});

test("premium lease sweep reserves a 12-second provider budget and leaves later leases untouched", async () => {
  const fixture = serviceFixture(3);
  for (const index of [1, 2, 3]) fixture.repository.orders.set(`order-${index}`, paidOrder(index));
  fixture.toss.onCall = () => fixture.advance(12_000);
  const result = await fixture.service.reconcileDuePaymentLeases(SYSTEM_ACTOR, 3, {
    deadlineAtEpochMs: fixture.now() + 25_000,
  });
  assert.deepEqual(result, {
    scanned: 2,
    settled: 2,
    retryRequired: 0,
    deadlineReached: true,
    hasMore: true,
  });
  assert.equal(fixture.toss.getCalls, 2);
  assert.deepEqual(fixture.repository.finalized, ["order-1", "order-2"]);
});

test("provider DONE after a lost local commit converges to grant or automatic full compensation", async () => {
  const grant = serviceFixture(1);
  grant.repository.orders.set("order-1", {
    ...paidOrder(1),
    status: "ready",
    paymentKey: null,
    entitlementId: null,
    paidAt: null,
  });
  const granted = await grant.service.reconcileDuePaymentLeases(SYSTEM_ACTOR, 1, {
    deadlineAtEpochMs: grant.now() + 45_000,
  });
  assert.equal(granted.settled, 1);
  assert.equal(grant.repository.orders.get("order-1")?.status, "paid");
  assert.equal(grant.toss.cancelCalls, 0);
  assert.deepEqual(grant.repository.finalized, ["order-1"]);

  const compensated = serviceFixture(1);
  compensated.repository.orders.set("order-1", {
    ...paidOrder(1),
    status: "ready",
    paymentKey: null,
    entitlementId: null,
    paidAt: null,
  });
  compensated.repository.confirmationFailureCode = "PREMIUM_CHECKOUT_STALE";
  const recovered = await compensated.service.reconcileDuePaymentLeases(SYSTEM_ACTOR, 1, {
    deadlineAtEpochMs: compensated.now() + 45_000,
  });
  assert.equal(recovered.settled, 1);
  assert.equal(compensated.repository.orders.get("order-1")?.status, "refunded");
  assert.equal(compensated.toss.cancelCalls, 1);
  assert.equal(compensated.repository.orders.get("order-1")?.providerState?.balanceAmount, 0);
  assert.deepEqual(compensated.repository.finalized, ["order-1"]);
});

test("partial-canceled retained payment does not start compensation without budget and keeps its lease", async () => {
  const fixture = serviceFixture(1);
  fixture.repository.retained.set("order-1", {
    schemaVersion: "namespring.retained-payment.v1",
    orderId: "order-1",
    amount: 1_000,
    currency: "KRW",
    paymentProvider: "toss_web",
    paymentKey: "payment-1",
    status: "paid",
    createdAt: "2026-07-17T00:00:00.000Z",
    paidAt: "2026-07-17T00:01:00.000Z",
    refundedAt: null,
    paymentRecovery: { status: "scheduled", updatedAt: "2026-07-17T23:45:00.000Z", dueAt: "2026-07-18T00:00:00.000Z" },
    purchasePolicyReceipt: {
      termsVersion: "premium-terms.test.v1",
      termsDigest: `sha256:${"2".repeat(64)}`,
      refundPolicyVersion: "premium-refund.test.v1",
      refundPolicyDigest: `sha256:${"3".repeat(64)}`,
      recordedAt: "2026-07-17T00:00:00.000Z",
      bindingDigest: `sha256:${"4".repeat(64)}`,
    },
    retainedAt: "2026-07-17T00:02:00.000Z",
    retentionReason: "payment_tax_refund_record",
    deletionReference: "deletion-1",
    deleteAfter: "2031-07-17T00:02:00.000Z",
  });
  fixture.toss.statuses.set("payment-1", "PARTIAL_CANCELED");
  fixture.toss.onCall = () => fixture.advance(12_000);
  const result = await fixture.service.reconcileDuePaymentLeases(SYSTEM_ACTOR, 1, {
    deadlineAtEpochMs: fixture.now() + 20_000,
  });
  assert.equal(result.retryRequired, 1);
  assert.equal(result.deadlineReached, true);
  assert.equal(fixture.toss.getCalls, 1);
  assert.equal(fixture.toss.cancelCalls, 0);
  assert.deepEqual(fixture.repository.finalized, []);
});

test("fully canceled retained payment settles idempotently and releases its surviving lease", async () => {
  const fixture = serviceFixture(1);
  fixture.repository.retained.set("order-1", {
    schemaVersion: "namespring.retained-payment.v1",
    orderId: "order-1",
    amount: 1_000,
    currency: "KRW",
    paymentProvider: "toss_web",
    paymentKey: "payment-1",
    status: "paid",
    createdAt: "2026-07-17T00:00:00.000Z",
    paidAt: "2026-07-17T00:01:00.000Z",
    refundedAt: null,
    paymentRecovery: { status: "scheduled", updatedAt: "2026-07-17T23:45:00.000Z", dueAt: "2026-07-18T00:00:00.000Z" },
    purchasePolicyReceipt: {
      termsVersion: "premium-terms.test.v1",
      termsDigest: `sha256:${"2".repeat(64)}`,
      refundPolicyVersion: "premium-refund.test.v1",
      refundPolicyDigest: `sha256:${"3".repeat(64)}`,
      recordedAt: "2026-07-17T00:00:00.000Z",
      bindingDigest: `sha256:${"4".repeat(64)}`,
    },
    retainedAt: "2026-07-17T00:02:00.000Z",
    retentionReason: "payment_tax_refund_record",
    deletionReference: "deletion-1",
    deleteAfter: "2031-07-17T00:02:00.000Z",
  });
  fixture.toss.statuses.set("payment-1", "CANCELED");
  const result = await fixture.service.reconcileDuePaymentLeases(SYSTEM_ACTOR, 1, {
    deadlineAtEpochMs: fixture.now() + 45_000,
  });
  assert.equal(result.settled, 1);
  assert.equal(fixture.repository.retained.get("order-1")?.status, "refunded");
  assert.deepEqual(fixture.repository.finalized, ["order-1"]);
});

class ExclusiveCoordinator implements MaintenanceCoordinatorV1 {
  active = false;
  finishCalls = 0;

  async claim(input: { job: "premium_payment_reconciliation"; runId: string }) {
    if (this.active) return { acquired: false } as const;
    this.active = true;
    return {
      acquired: true,
      job: input.job,
      runId: input.runId,
      claimToken: "a".repeat(43),
      fence: 1,
    } satisfies Extract<MaintenanceClaimResultV1, { acquired: true }>;
  }

  async finish() {
    this.finishCalls += 1;
    this.active = false;
    return true;
  }
}

test("manual admin and cron use one durable claim so concurrent provider work cannot overlap", async () => {
  const coordinator = new ExclusiveCoordinator();
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let serviceCalls = 0;
  const dependencies: PremiumMaintenanceDependenciesV1 = {
    coordinator,
    service: {
      async reconcileDuePaymentLeases(_actor, limit) {
        serviceCalls += 1;
        assert.equal(limit, 3);
        await held;
        return { scanned: 3, settled: 3, retryRequired: 0, deadlineReached: false, hasMore: true };
      },
    },
    now: () => new Date("2026-07-18T00:00:00.000Z"),
    newRunId: (() => {
      let index = 0;
      return () => `mrun_0123456789abcdefghijkl${++index}`;
    })(),
  };
  const adminRun = runPremiumPaymentMaintenanceV1({ actor: SYSTEM_ACTOR, limit: 3 }, dependencies);
  await Promise.resolve();
  const cronRun = await runPremiumPaymentMaintenanceV1({}, dependencies);
  assert.equal(cronRun.outcome, "skipped_locked");
  assert.equal(cronRun.hasMore, true);
  release();
  const completed = await adminRun;
  assert.equal(completed.outcome, "completed");
  assert.deepEqual(
    { scanned: completed.scanned, deleted: completed.deleted, failed: completed.failed },
    { scanned: 3, deleted: 3, failed: 0 },
  );
  assert.equal(serviceCalls, 1);
  assert.equal(coordinator.finishCalls, 1);
});
