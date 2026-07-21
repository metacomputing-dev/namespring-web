import type { ServiceCatalogV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import type {
  PremiumPaymentRailCapabilityV1,
  PremiumPaymentRailV1,
} from "../../shared/types/premium-service.js";
import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

export const PREMIUM_TOSS_WEB_RAIL_STATE_VERIFIED_V1 =
  "provider_staging_verified_v1" as const;

/**
 * Provider evidence is intentionally rail-discriminated. Tokens are accepted
 * only by a future server adapter and must never enter entitlement ownership,
 * public DTOs, admin projections, analytics, or logs.
 */
export type PremiumProviderPurchaseEvidenceV1 =
  | {
      readonly rail: "toss_web";
      readonly paymentKey: string;
      readonly orderId: string;
    }
  | {
      readonly rail: "apple_app_store";
      readonly signedTransactionJws: string;
      readonly environment: "sandbox" | "production";
    }
  | {
      readonly rail: "google_play";
      readonly purchaseToken: string;
      readonly packageName: string;
      readonly environment: "test" | "production";
    };

export interface PremiumPaymentRailAdapterIdentityV1<Rail extends PremiumPaymentRailV1> {
  readonly rail: Rail;
}

export function isTossWebRailDeploymentVerifiedV1(): boolean {
  return getOptionalEnv("PREMIUM_TOSS_WEB_RAIL_STATE")
    === PREMIUM_TOSS_WEB_RAIL_STATE_VERIFIED_V1;
}

export function getPremiumPaymentRailCapabilitiesV1(
  catalog: ServiceCatalogV1,
): readonly PremiumPaymentRailCapabilityV1[] {
  const catalogAvailable = catalog.products.some((product) => product.availability === "active");
  const tossDeploymentVerified = isTossWebRailDeploymentVerifiedV1();
  const tossEnabled = catalogAvailable && tossDeploymentVerified;
  return Object.freeze([
    Object.freeze({
      rail: "toss_web" as const,
      implemented: true as const,
      enabled: tossEnabled,
      checkoutMode: "web_redirect" as const,
      verification: "server_provider_api" as const,
      ...(tossEnabled ? {} : {
        disabledReason: catalogAvailable ? "deployment_not_verified" as const : "catalog_unavailable" as const,
      }),
    }),
    Object.freeze({
      rail: "apple_app_store" as const,
      implemented: false as const,
      enabled: false as const,
      checkoutMode: "native_store" as const,
      verification: "server_signed_purchase" as const,
      disabledReason: "adapter_not_implemented" as const,
    }),
    Object.freeze({
      rail: "google_play" as const,
      implemented: false as const,
      enabled: false as const,
      checkoutMode: "native_store" as const,
      verification: "server_signed_purchase" as const,
      disabledReason: "adapter_not_implemented" as const,
    }),
  ]);
}

export function requirePremiumPaymentRailEnabledV1(
  rail: PremiumPaymentRailV1,
  catalog: ServiceCatalogV1,
): void {
  const capability = getPremiumPaymentRailCapabilitiesV1(catalog)
    .find((entry) => entry.rail === rail);
  if (!capability?.implemented || !capability.enabled) {
    throw new ApiHttpError(
      409,
      "PREMIUM_PAYMENT_RAIL_UNAVAILABLE",
      "The selected payment rail is not available.",
    );
  }
}

export function assertTossWebRailV1(
  value: PremiumPaymentRailV1,
): asserts value is "toss_web" {
  if (value !== "toss_web") {
    throw new ApiHttpError(
      409,
      "PREMIUM_PAYMENT_RAIL_MISMATCH",
      "This endpoint accepts only the Toss web payment rail.",
    );
  }
}
