import assert from "node:assert/strict";
import test from "node:test";

import {
  SERVICE_CATALOG_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
  type ServiceCatalogV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import {
  getPremiumServiceCatalogV1,
  PREMIUM_CATALOG_ACTIVATION_STATE_VERIFIED_V1,
} from "../../api/_lib/premium-catalog.js";
import {
  assertTossWebRailV1,
  getPremiumPaymentRailCapabilitiesV1,
  PREMIUM_TOSS_WEB_RAIL_STATE_VERIFIED_V1,
  requirePremiumPaymentRailEnabledV1,
} from "../../api/_lib/premium-payment-provider.js";
import { ApiHttpError } from "../../api/_lib/http.js";

const activeCatalog: ServiceCatalogV1 = {
  schemaVersion: SERVICE_CATALOG_SCHEMA_V1,
  catalogVersion: "premium-catalog.test.v1",
  generatedAt: "2026-07-19T00:00:00.000Z",
  products: [{
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    contentVersion: "story-completion.test.v1",
    displayName: "이야기 완성하기",
    availability: "active",
    price: { amount: 1_000, currency: "KRW", authority: "server_catalog", taxIncluded: true },
  }],
};

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("checked-in catalog is unavailable and an active override requires both deployment fences", () => {
  const priorCatalog = process.env.PREMIUM_SERVICE_CATALOG_JSON;
  const priorActivation = process.env.PREMIUM_CATALOG_ACTIVATION_STATE;
  const priorRail = process.env.PREMIUM_TOSS_WEB_RAIL_STATE;
  try {
    delete process.env.PREMIUM_SERVICE_CATALOG_JSON;
    delete process.env.PREMIUM_CATALOG_ACTIVATION_STATE;
    delete process.env.PREMIUM_TOSS_WEB_RAIL_STATE;
    const checkedIn = getPremiumServiceCatalogV1();
    assert.equal(checkedIn.products.every((product) => product.availability !== "active"), true);
    assert.deepEqual(getPremiumPaymentRailCapabilitiesV1(checkedIn).map((rail) => ({
      rail: rail.rail, enabled: rail.enabled, reason: rail.disabledReason,
    })), [
      { rail: "toss_web", enabled: false, reason: "catalog_unavailable" },
      { rail: "apple_app_store", enabled: false, reason: "adapter_not_implemented" },
      { rail: "google_play", enabled: false, reason: "adapter_not_implemented" },
    ]);

    process.env.PREMIUM_SERVICE_CATALOG_JSON = JSON.stringify(activeCatalog);
    assert.throws(
      () => getPremiumServiceCatalogV1(),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "PREMIUM_CATALOG_ACTIVATION_UNVERIFIED",
    );

    process.env.PREMIUM_CATALOG_ACTIVATION_STATE = PREMIUM_CATALOG_ACTIVATION_STATE_VERIFIED_V1;
    const active = getPremiumServiceCatalogV1();
    assert.equal(active.products[0]?.availability, "active");
    assert.throws(
      () => requirePremiumPaymentRailEnabledV1("toss_web", active),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "PREMIUM_PAYMENT_RAIL_UNAVAILABLE",
    );

    process.env.PREMIUM_TOSS_WEB_RAIL_STATE = PREMIUM_TOSS_WEB_RAIL_STATE_VERIFIED_V1;
    requirePremiumPaymentRailEnabledV1("toss_web", active);
    assert.throws(
      () => requirePremiumPaymentRailEnabledV1("apple_app_store", active),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "PREMIUM_PAYMENT_RAIL_UNAVAILABLE",
    );
    assert.throws(
      () => assertTossWebRailV1("google_play"),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "PREMIUM_PAYMENT_RAIL_MISMATCH",
    );
  } finally {
    restore("PREMIUM_SERVICE_CATALOG_JSON", priorCatalog);
    restore("PREMIUM_CATALOG_ACTIVATION_STATE", priorActivation);
    restore("PREMIUM_TOSS_WEB_RAIL_STATE", priorRail);
  }
});
